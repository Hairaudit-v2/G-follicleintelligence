import { z } from "zod";

import { CRON_OR_WEBHOOK_SECRET_MIN_LENGTH, timingSafeUtf8Equal } from "@/src/lib/security/timingSafeSecret";
import type { IiohrHrStaffImportCounts, IiohrHrStaffImportRunResult } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";
import { parseIiohrHrStaffSyncRows } from "@/src/lib/staffImport/iiohrHrStaffSyncRowsParse";
import type { IiohrHrStaffSyncPayload, IiohrHrStaffSyncSummary, SyncIiohrHrStaffForTenantInput } from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";

export const IIOHR_HR_STAFF_SYNC_MAX_ROWS = 500;

const tenantIdParamSchema = z.string().uuid("Invalid tenant id.");

const apiBodySchema = z.object({
  mode: z.enum(["preview", "commit"]).optional(),
  confirm: z.literal(true).optional(),
  rows: z.array(z.unknown()),
});

export type StaffSyncPostServices = {
  assertTenantExists: (tenantId: string) => Promise<boolean>;
  runSync: (input: SyncIiohrHrStaffForTenantInput) => Promise<IiohrHrStaffSyncSummary>;
  createRun: (input: {
    tenantId: string;
    mode: "preview" | "commit";
    receivedRows: number;
    metadata?: Record<string, unknown>;
  }) => Promise<{ id: string } | null>;
  finishRun: (input: {
    runId: string;
    tenantId: string;
    status: "success" | "failed";
    receivedRows: number;
    createdCount: number;
    updatedCount: number;
    linkedCount: number;
    skippedCount: number;
    warningCount: number;
    errorMessage?: string | null;
    metadataPatch?: Record<string, unknown>;
  }) => Promise<void>;
};

function timingSafeSecretEqual(expected: string, received: string | null): boolean {
  if (received == null) return false;
  return timingSafeUtf8Equal(expected, received);
}

function rollupImportCounts(c: IiohrHrStaffImportCounts): {
  createdCount: number;
  updatedCount: number;
  linkedCount: number;
} {
  return {
    createdCount: c.createdUsers + c.createdStaff + c.createdSourceIds,
    updatedCount: c.updatedUsers + c.updatedStaff + c.updatedSourceIds + c.deactivatedStaff,
    linkedCount: c.linkedStaff,
  };
}

function pickCounts(summary: IiohrHrStaffSyncSummary): IiohrHrStaffImportCounts {
  const r = summary.result;
  return r.commit && r.appliedCounts ? r.appliedCounts : r.dryRunCounts;
}

function summarizeResult(summary: IiohrHrStaffSyncSummary): Record<string, unknown> {
  const r: IiohrHrStaffImportRunResult = summary.result;
  const c = pickCounts(summary);
  const roll = rollupImportCounts(c);
  return {
    ok: r.ok,
    mode: summary.mode,
    lastSyncedAt: summary.lastSyncedAt,
    commit: r.commit,
    skippedRowCount: r.skippedRowCount,
    validationErrors: r.validationErrors,
    warnings: r.warnings,
    error: r.error ?? null,
    counts: {
      ...roll,
      raw: c,
    },
  };
}

export type ProcessIiohrHrStaffSyncPostInput = {
  tenantId: string;
  secretHeader: string | null;
  configuredSecret: string | undefined;
  body: unknown;
  /** When true, caller already verified `x-iiohr-sync-secret` (e.g. HTTP layer before reading JSON body). */
  callerSecretVerified?: boolean;
  /**
   * When set (e.g. from internal `x-fi-staff-sync-source` header), stored on
   * `fi_staff_sync_runs.metadata.trigger` to distinguish scheduled FI cron from external producers.
   */
  syncSource?: string | null;
};

/**
 * HTTP POST handler logic for IIOHR HR staff sync (inject services for tests).
 */
export async function processIiohrHrStaffSyncPost(
  input: ProcessIiohrHrStaffSyncPostInput,
  services: StaffSyncPostServices
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const secret = input.configuredSecret?.trim();
  if (!input.callerSecretVerified) {
    if (!secret) {
      return { httpStatus: 503, body: { ok: false, error: "Service unavailable." } };
    }
    if (secret.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
      return { httpStatus: 503, body: { ok: false, error: "Service unavailable." } };
    }
    if (!timingSafeSecretEqual(secret, input.secretHeader)) {
      return { httpStatus: 401, body: { ok: false, error: "Unauthorized." } };
    }
  } else {
    if (!secret || secret.length < CRON_OR_WEBHOOK_SECRET_MIN_LENGTH) {
      return { httpStatus: 503, body: { ok: false, error: "Service unavailable." } };
    }
  }

  const tidParse = tenantIdParamSchema.safeParse(input.tenantId?.trim());
  if (!tidParse.success) {
    return { httpStatus: 400, body: { ok: false, error: "Invalid tenant id." } };
  }
  const tenantId = tidParse.data;

  const tenantOk = await services.assertTenantExists(tenantId);
  if (!tenantOk) {
    return { httpStatus: 404, body: { ok: false, error: "Tenant not found." } };
  }

  if (input.body === null || typeof input.body !== "object" || Array.isArray(input.body)) {
    return { httpStatus: 400, body: { ok: false, error: "JSON body must be an object." } };
  }

  const bodyParse = apiBodySchema.safeParse(input.body);
  if (!bodyParse.success) {
    return { httpStatus: 400, body: { ok: false, error: "Invalid payload: require rows array." } };
  }
  const raw = bodyParse.data;
  const rowsArr = raw.rows;
  if (!Array.isArray(rowsArr) || rowsArr.length === 0) {
    return { httpStatus: 400, body: { ok: false, error: "rows must be a non-empty array." } };
  }
  if (rowsArr.length > IIOHR_HR_STAFF_SYNC_MAX_ROWS) {
    return {
      httpStatus: 400,
      body: { ok: false, error: `rows exceeds maximum of ${IIOHR_HR_STAFF_SYNC_MAX_ROWS}.` },
    };
  }

  const requestedMode = raw.mode ?? "preview";
  if (requestedMode === "commit" && raw.confirm !== true) {
    return {
      httpStatus: 400,
      body: { ok: false, error: "commit requires confirm: true." },
    };
  }
  const effectiveMode: "preview" | "commit" = requestedMode === "commit" && raw.confirm === true ? "commit" : "preview";

  const rowParse = parseIiohrHrStaffSyncRows(rowsArr);
  if (!rowParse.ok) {
    return { httpStatus: 400, body: { ok: false, error: rowParse.error } };
  }
  const payload: IiohrHrStaffSyncPayload = { rows: rowParse.rows };

  const trigger = input.syncSource?.trim();
  const run = await services.createRun({
    tenantId,
    mode: effectiveMode,
    receivedRows: payload.rows.length,
    metadata: {
      channel: "api",
      path: "iiohr-hr/staff-sync",
      ...(trigger ? { trigger } : {}),
    },
  });
  if (!run) {
    return { httpStatus: 500, body: { ok: false, error: "Could not record sync run." } };
  }

  let summary: IiohrHrStaffSyncSummary;
  try {
    summary = await services.runSync({
      tenantId,
      payload,
      mode: effectiveMode,
      confirm: effectiveMode === "commit" ? true : undefined,
      skipImportAuthCheck: true,
    });
  } catch {
    await services.finishRun({
      runId: run.id,
      tenantId,
      status: "failed",
      receivedRows: payload.rows.length,
      createdCount: 0,
      updatedCount: 0,
      linkedCount: 0,
      skippedCount: 0,
      warningCount: 0,
      errorMessage: "Sync execution failed.",
    });
    return { httpStatus: 500, body: { ok: false, error: "Sync execution failed.", runId: run.id } };
  }

  const c = pickCounts(summary);
  const roll = rollupImportCounts(c);
  const errMsg =
    summary.result.error ??
    (summary.result.validationErrors.length
      ? summary.result.validationErrors.slice(0, 3).join("; ")
      : null);

  await services.finishRun({
    runId: run.id,
    tenantId,
    status: summary.result.ok ? "success" : "failed",
    receivedRows: payload.rows.length,
    createdCount: roll.createdCount,
    updatedCount: roll.updatedCount,
    linkedCount: roll.linkedCount,
    skippedCount: summary.result.skippedRowCount,
    warningCount: summary.result.warnings.length,
    errorMessage: summary.result.ok ? null : errMsg,
    metadataPatch: {
      result_ok: summary.result.ok,
      planner_warnings: summary.result.warnings.length,
    },
  });

  const httpStatus = 200;
  return {
    httpStatus,
    body: {
      ok: summary.result.ok,
      runId: run.id,
      summary: summarizeResult(summary),
    },
  };
}
