import {
  isHrStaffSourceSystem,
  mergeHrStaffSourceMetadataOnSync,
  sanitizeIiohrHrMetadataSnapshot,
} from "@/src/lib/staff/hrStaffReadinessMetadata";
import { normalizeFiStaffSourceMetadata } from "@/src/lib/staff/staffSourceIdsNormalize";
import type { IiohrHrStaffImportPlanResult } from "@/src/lib/staffImport/iiohrHrStaffImportTypes";
import type { IiohrHrStaffImportRow } from "@/src/lib/staffImport/iiohrHrStaffImportTypes";

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

function combinedSnapshotFromSyncRow(row: IiohrHrStaffSyncRow | undefined): Record<string, unknown> {
  if (!row) return {};
  const combined: Record<string, unknown> = {};
  if (row.metadata_snapshot && typeof row.metadata_snapshot === "object" && !Array.isArray(row.metadata_snapshot)) {
    Object.assign(combined, row.metadata_snapshot);
  }
  if (row.onboarding_status !== undefined) combined.onboarding_status = row.onboarding_status;
  if (row.onboarding_completed_at !== undefined) combined.onboarding_completed_at = row.onboarding_completed_at;
  if (row.required_documents_missing_count !== undefined) {
    combined.required_documents_missing_count = row.required_documents_missing_count;
  }
  if (row.training_required_count !== undefined) combined.training_required_count = row.training_required_count;
  if (row.certificates_outstanding_count !== undefined) {
    combined.certificates_outstanding_count = row.certificates_outstanding_count;
  }
  if (row.hr_profile_url !== undefined) combined.hr_profile_url = row.hr_profile_url;
  return sanitizeIiohrHrMetadataSnapshot(combined, row.source_url);
}

/**
 * Merges validated readiness metadata + `last_synced_at` into `create_staff_source_id` / `update_staff_source_id`
 * for HR source systems (`iiohr_hr`, `iiohr`, `hr`). Call after `attachEvolvedPerthClinicMetadataToPlan`.
 */
export function applyIiohrHrStaffSyncStampToPlan(
  plan: IiohrHrStaffImportPlanResult,
  syncRowsBySourceRowIndex: IiohrHrStaffSyncRow[],
  lastSyncedAt: string
): void {
  for (const pr of plan.perRow) {
    for (const a of pr.actions) {
      if (a.type === "create_staff_source_id") {
        if (!isHrStaffSourceSystem(a.payload.source_system)) continue;
        const syncRow = syncRowsBySourceRowIndex[a.sourceRowIndex];
        const snap = combinedSnapshotFromSyncRow(syncRow);
        const base = normalizeFiStaffSourceMetadata(a.payload.metadata);
        a.payload.metadata = mergeHrStaffSourceMetadataOnSync(base, snap, lastSyncedAt, syncRow?.source_url);
      } else if (a.type === "update_staff_source_id") {
        const syncRow = syncRowsBySourceRowIndex[a.sourceRowIndex];
        const snap = combinedSnapshotFromSyncRow(syncRow);
        const base =
          a.payload.metadata != null ? normalizeFiStaffSourceMetadata(a.payload.metadata) : normalizeFiStaffSourceMetadata({});
        a.payload.metadata = mergeHrStaffSourceMetadataOnSync(base, snap, lastSyncedAt, syncRow?.source_url);
      }
    }
  }
}
