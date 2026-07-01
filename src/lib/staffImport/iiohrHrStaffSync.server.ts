import "server-only";

import {
  applyIiohrHrStaffSyncStampToPlan,
  mapIiohrHrStaffSyncRowToImportRow,
} from "@/src/lib/staffImport/iiohrHrStaffSync";
import { runIiohrHrStaffImport } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

import type {
  IiohrHrStaffSyncPayload,
  IiohrHrStaffSyncRow,
  IiohrHrStaffSyncSummary,
  SyncIiohrHrStaffForTenantInput,
} from "./iiohrHrStaffSyncTypes";

export type {
  IiohrHrStaffSyncPayload,
  IiohrHrStaffSyncRow,
  IiohrHrStaffSyncSummary,
  SyncIiohrHrStaffForTenantInput,
};

export {
  applyIiohrHrStaffSyncStampToPlan,
  mapIiohrHrStaffSyncRowToImportRow,
} from "./iiohrHrStaffSync";

/**
 * Stage-1 sync: HR SoR → FI operational projection via existing import planner + runner.
 * Stamps `metadata.last_synced_at` and optional bounded `metadata_snapshot` on `fi_staff_source_ids` only.
 */
export async function syncIiohrHrStaffForTenant(
  input: SyncIiohrHrStaffForTenantInput
): Promise<IiohrHrStaffSyncSummary> {
  const lastSyncedAt = input.lastSyncedAt?.trim() || new Date().toISOString();
  const syncRows = input.payload.rows;
  const importRows = syncRows.map(mapIiohrHrStaffSyncRowToImportRow);
  const commit = input.mode === "commit";

  let hrSyncRunId: string | null = null;
  if (commit) {
    const { beginWorkforceHrSyncRun } = await import(
      "@/src/lib/workforce/workforceHrStaffSyncOrchestrator.server"
    );
    const started = await beginWorkforceHrSyncRun({ tenantId: input.tenantId });
    hrSyncRunId = started.hrSyncRunId;
  }

  const result = await runIiohrHrStaffImport({
    tenantId: input.tenantId,
    rows: importRows,
    commit,
    confirm: commit ? input.confirm === true : undefined,
    adminKey: input.adminKey,
    authUserId: input.authUserId,
    skipImportAuthCheck: input.skipImportAuthCheck,
    mutatePlanAfterAttachPerth: (plan) =>
      applyIiohrHrStaffSyncStampToPlan(plan, syncRows, lastSyncedAt),
  });

  if (commit && result.ok && importRows.length > 0) {
    const { runWorkforceReconciliationForInboundRows } = await import(
      "@/src/lib/workforce/workforceHrStaffSyncOrchestrator.server"
    );
    const workforce = await runWorkforceReconciliationForInboundRows({
      tenantId: input.tenantId,
      rows: importRows,
      syncedAt: lastSyncedAt,
      hrSyncRunId,
    });
    result.workforceReconciliation = {
      recordsLinked: workforce.recordsLinked,
      recordsCreated: workforce.recordsCreated,
      recordsUpdated: workforce.recordsUpdated,
      duplicatesDetected: workforce.duplicatesDetected,
      recordsSkipped: workforce.recordsSkipped,
    };
    result.hrSyncRunId = workforce.hrSyncRunId;
    if (workforce.warnings.length) {
      result.warnings = [...result.warnings, ...workforce.warnings];
    }
  } else if (hrSyncRunId) {
    const { completeHrSyncRun } = await import("@/src/lib/workforce/hrSyncAudit.server");
    await completeHrSyncRun({
      runId: hrSyncRunId,
      counts: {
        recordsReceived: importRows.length,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsLinked: 0,
        duplicatesDetected: 0,
        recordsSkipped: importRows.length,
      },
      warnings: result.warnings,
      errors: result.error ? [result.error] : [],
      status: result.ok ? "partial" : "failed",
    });
    result.hrSyncRunId = hrSyncRunId;
  }

  return {
    mode: input.mode,
    lastSyncedAt,
    result,
  };
}
