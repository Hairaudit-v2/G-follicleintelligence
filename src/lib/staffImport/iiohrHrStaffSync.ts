import { IIOHR_HR_SOURCE_SYSTEM } from "@/src/lib/staffImport/iiohrHrStaffImportPlan";
import type { IiohrHrStaffImportPlanResult } from "@/src/lib/staffImport/iiohrHrStaffImportTypes";
import type { IiohrHrStaffImportRow } from "@/src/lib/staffImport/iiohrHrStaffImportTypes";
import {
  normalizeFiStaffSourceMetadata,
  normalizeFiStaffSourceSystem,
} from "@/src/lib/staff/staffSourceIdsNormalize";

import type { IiohrHrStaffSyncRow } from "./iiohrHrStaffSyncTypes";

/**
 * Maps a sync producer row onto the existing import row shape (`metadata_snapshot` handled separately at stamp time).
 */
export function mapIiohrHrStaffSyncRowToImportRow(row: IiohrHrStaffSyncRow): IiohrHrStaffImportRow {
  return {
    external_staff_id: String(row.external_staff_id).trim(),
    full_name: String(row.full_name ?? "").trim(),
    email: row.email != null && String(row.email).trim() ? String(row.email).trim().toLowerCase() : null,
    staff_role: row.staff_role != null ? String(row.staff_role).trim() : null,
    employment_status: row.employment_status != null ? String(row.employment_status).trim() : null,
    source_url: row.source_url != null ? String(row.source_url) : undefined,
    default_timezone: row.default_timezone != null ? String(row.default_timezone).trim() : undefined,
    working_hours: row.working_hours,
    iiohr_user_id: row.iiohr_user_id != null && String(row.iiohr_user_id).trim() ? String(row.iiohr_user_id).trim() : null,
  };
}

function snapshotForRow(row: IiohrHrStaffSyncRow | undefined): Record<string, unknown> {
  if (!row?.metadata_snapshot || typeof row.metadata_snapshot !== "object" || Array.isArray(row.metadata_snapshot)) {
    return {};
  }
  return row.metadata_snapshot as Record<string, unknown>;
}

/**
 * Merges `metadata_snapshot` + `last_synced_at` into `create_staff_source_id` / `update_staff_source_id` actions
 * for `iiohr_hr` (identity bridge rows). Call after `attachEvolvedPerthClinicMetadataToPlan`.
 */
export function applyIiohrHrStaffSyncStampToPlan(
  plan: IiohrHrStaffImportPlanResult,
  syncRowsBySourceRowIndex: IiohrHrStaffSyncRow[],
  lastSyncedAt: string
): void {
  for (const pr of plan.perRow) {
    for (const a of pr.actions) {
      if (a.type === "create_staff_source_id") {
        if (normalizeFiStaffSourceSystem(a.payload.source_system) !== IIOHR_HR_SOURCE_SYSTEM) continue;
        const snap = snapshotForRow(syncRowsBySourceRowIndex[a.sourceRowIndex]);
        const base = normalizeFiStaffSourceMetadata(a.payload.metadata);
        a.payload.metadata = normalizeFiStaffSourceMetadata({
          ...base,
          ...snap,
          last_synced_at: lastSyncedAt,
        });
      } else if (a.type === "update_staff_source_id") {
        const snap = snapshotForRow(syncRowsBySourceRowIndex[a.sourceRowIndex]);
        const base =
          a.payload.metadata != null ? normalizeFiStaffSourceMetadata(a.payload.metadata) : normalizeFiStaffSourceMetadata({});
        a.payload.metadata = normalizeFiStaffSourceMetadata({
          ...base,
          ...snap,
          last_synced_at: lastSyncedAt,
        });
      }
    }
  }
}
