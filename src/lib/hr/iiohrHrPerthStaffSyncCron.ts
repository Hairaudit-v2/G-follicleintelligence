import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import type { ScheduledIiohrHrStaffSyncCoreResult } from "@/src/lib/hr/runScheduledIiohrHrStaffSyncCore";

export const MIN_CRON_SECRET_LENGTH = 16;

export function extractCronBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function secretsEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isAuthorizedCron(req: Request, expected: string | undefined): boolean {
  if (!expected) return false;
  const got = extractCronBearer(req);
  if (!got) return false;
  return secretsEqual(expected, got);
}

export type IiohrHrPerthStaffSyncCronPostOptions = {
  getEnv: (key: string) => string | undefined;
  runScheduled: () => Promise<ScheduledIiohrHrStaffSyncCoreResult>;
  /** Wall-clock cap for the scheduled job (feed + FI POST). */
  timeoutMs?: number;
};

function sleep(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("Scheduled staff sync timed out.")), ms));
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
 * POST handler for `/api/cron/iiohr-hr-perth-staff-sync`. No stack traces or secrets in responses.
 */
export async function handleIiohrHrPerthStaffSyncCronPost(
  req: Request,
  opts: IiohrHrPerthStaffSyncCronPostOptions
): Promise<Response> {
  if (req.method !== "POST") {
    return NextResponse.json({ ok: false, error: "Method not allowed." }, { status: 405 });
  }

  const expected = opts.getEnv("CRON_SECRET")?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (expected.length < MIN_CRON_SECRET_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `CRON_SECRET must be at least ${MIN_CRON_SECRET_LENGTH} characters.` },
      { status: 503 }
    );
  }
  if (!isAuthorizedCron(req, expected)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const tenantId = opts.getEnv("EVOLVED_PERTH_TENANT_ID")?.trim();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "EVOLVED_PERTH_TENANT_ID is not configured." }, { status: 503 });
  }
  if (!z.string().uuid().safeParse(tenantId).success) {
    return NextResponse.json({ ok: false, error: "EVOLVED_PERTH_TENANT_ID is not a valid UUID." }, { status: 503 });
  }

  const timeoutMs = opts.timeoutMs ?? 55_000;
  try {
    const result = await Promise.race([opts.runScheduled(), sleep(timeoutMs)]);
    const httpStatus = !result.ok && result.error?.includes("refusing sync") ? 400 : 200;
    return jsonBody(result, httpStatus);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed.";
    const isTimeout = msg.includes("timed out");
    return NextResponse.json(
      { ok: false, error: isTimeout ? "Scheduled staff sync timed out." : "Scheduled staff sync failed." },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
