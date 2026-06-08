import "server-only";

import { applyIiohrHrStaffSyncStampToPlan, mapIiohrHrStaffSyncRowToImportRow } from "@/src/lib/staffImport/iiohrHrStaffSync";
import { runIiohrHrStaffImport } from "@/src/lib/staffImport/iiohrHrStaffImportRunner";

import type {
  IiohrHrStaffSyncPayload,
  IiohrHrStaffSyncRow,
  IiohrHrStaffSyncSummary,
  SyncIiohrHrStaffForTenantInput,
} from "./iiohrHrStaffSyncTypes";

export type { IiohrHrStaffSyncPayload, IiohrHrStaffSyncRow, IiohrHrStaffSyncSummary, SyncIiohrHrStaffForTenantInput };

export { applyIiohrHrStaffSyncStampToPlan, mapIiohrHrStaffSyncRowToImportRow } from "./iiohrHrStaffSync";

/**
 * Stage-1 sync: HR SoR → FI operational projection via existing import planner + runner.
 * Stamps `metadata.last_synced_at` and optional bounded `metadata_snapshot` on `fi_staff_source_ids` only.
 */
export async function syncIiohrHrStaffForTenant(input: SyncIiohrHrStaffForTenantInput): Promise<IiohrHrStaffSyncSummary> {
  const lastSyncedAt = input.lastSyncedAt?.trim() || new Date().toISOString();
  const syncRows = input.payload.rows;
  const importRows = syncRows.map(mapIiohrHrStaffSyncRowToImportRow);
  const commit = input.mode === "commit";

  const result = await runIiohrHrStaffImport({
    tenantId: input.tenantId,
    rows: importRows,
    commit,
    confirm: commit ? input.confirm === true : undefined,
    adminKey: input.adminKey,
    authUserId: input.authUserId,
    skipImportAuthCheck: input.skipImportAuthCheck,
    mutatePlanAfterAttachPerth: (plan) => applyIiohrHrStaffSyncStampToPlan(plan, syncRows, lastSyncedAt),
  });

  return {
    mode: input.mode,
    lastSyncedAt,
    result,
  };
}
