import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { ScheduledIiohrHrStaffSyncCoreResult } from "@/src/lib/hr/runScheduledIiohrHrStaffSyncCore";
import { assertCronAuthorized } from "@/src/lib/server/cronAuth";
import { logStructured } from "@/src/lib/server/structuredLog";
import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH } from "@/src/lib/security/timingSafeSecret";

export const MIN_CRON_SECRET_LENGTH = CRON_OR_WEBHOOK_SECRET_MIN_LENGTH;

export type IiohrHrPerthStaffSyncCronPostOptions = {
  getEnv: (key: string) => string | undefined;
  runScheduled: () => Promise<ScheduledIiohrHrStaffSyncCoreResult>;
  /** Wall-clock cap for the scheduled job (feed + FI POST). */
  timeoutMs?: number;
  /** Optional hook after a scheduled result is known (e.g. alert intent logging). */
  afterRun?: (
    result: ScheduledIiohrHrStaffSyncCoreResult,
    getEnv: (key: string) => string | undefined
  ) => void | Promise<void>;
};

function sleep(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Scheduled staff sync timed out.")), ms)
  );
}

function jsonBody(
  result: ScheduledIiohrHrStaffSyncCoreResult,
  httpStatus: number
): NextResponse<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    ok: result.ok,
    rowsSent: result.rowsSent,
    runId: result.runId,
    created: result.created,
    updated: result.updated,
    linked: result.linked,
    skipped: result.skipped,
    warnings: result.warnings,
  };
  if (result.error) body.error = result.error;
  return NextResponse.json(body, { status: httpStatus });
}

/**
 * GET or POST handler for `/api/cron/iiohr-hr-perth-staff-sync`. No stack traces or secrets in responses.
 */
export async function handleIiohrHrPerthStaffSyncCronPost(
  req: NextRequest,
  opts: IiohrHrPerthStaffSyncCronPostOptions
): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return NextResponse.json({ ok: false, error: "Method not allowed." }, { status: 405 });
  }

  const authRes = assertCronAuthorized(req, [
    opts.getEnv("CRON_SECRET") ?? "",
    opts.getEnv("FI_HR_SYNC_CRON_SECRET") ?? "",
  ]);
  if (authRes) return authRes;

  const tenantId = opts.getEnv("EVOLVED_PERTH_TENANT_ID")?.trim();
  if (!tenantId) {
    return NextResponse.json(
      { ok: false, error: "EVOLVED_PERTH_TENANT_ID is not configured." },
      { status: 503 }
    );
  }
  if (!z.string().uuid().safeParse(tenantId).success) {
    return NextResponse.json(
      { ok: false, error: "EVOLVED_PERTH_TENANT_ID is not a valid UUID." },
      { status: 503 }
    );
  }

  const timeoutMs = opts.timeoutMs ?? 55_000;
  try {
    const result = await Promise.race([opts.runScheduled(), sleep(timeoutMs)]);
    const httpStatus = !result.ok && result.error?.includes("refusing sync") ? 400 : 200;
    if (opts.afterRun) {
      await opts.afterRun(result, opts.getEnv);
    }
    return jsonBody(result, httpStatus);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed.";
    const isTimeout = msg.includes("timed out");
    logStructured("error", "iiohr_hr_perth_staff_sync_cron_failed", {
      message: msg,
      timeout: isTimeout,
    });
    const failureResult: ScheduledIiohrHrStaffSyncCoreResult = {
      ok: false,
      rowsSent: 0,
      runId: null,
      created: null,
      updated: null,
      linked: null,
      skipped: null,
      warnings: [],
      error: isTimeout ? "Scheduled staff sync timed out." : "Scheduled staff sync failed.",
    };
    if (opts.afterRun) {
      await opts.afterRun(failureResult, opts.getEnv);
    }
    return NextResponse.json(
      { ok: false, error: failureResult.error },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
