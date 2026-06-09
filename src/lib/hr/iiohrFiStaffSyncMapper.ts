/**
 * Maps IIOHR HR portal staff shapes into FI staff sync rows (operational projection only).
 * Sensitive HR payloads must never be forwarded — strip at this boundary.
 */

import {
  extractValidatedHrReadinessFields,
  HR_STAFF_SENSITIVE_METADATA_KEYS,
} from "@/src/lib/staff/hrStaffReadinessMetadata";
import type { IiohrHrStaffSyncRow } from "@/src/lib/staffImport/iiohrHrStaffSyncTypes";

/** Bounded metadata stored under `metadata_snapshot` (schema_version 1). */
export type IiohrFiStaffSyncMetadataSnapshotV1 = {
  schema_version: 1;
  employment_type?: string | null;
  clinic_name?: string | null;
  role_label?: string | null;
  compliance_summary?: string | null;
  training_summary?: string | null;
  last_hr_updated_at?: string | null;
};

/**
 * Rich HR record shape (IIOHR HR portal). May contain fields we intentionally never forward.
 * Only whitelisted fields participate in the FI sync row + bounded snapshot.
 */
export type IiohrHrPortalStaffRecord = {
  external_staff_id: string;
  iiohr_user_id?: string | null;
  full_name: string;
  email?: string | null;
  staff_role?: string | null;
  employment_status?: string | null;
  employment_type?: string | null;
  source_url?: string | null;
  default_timezone?: string | null;
  working_hours?: unknown;
  clinic_name?: string | null;
  role_label?: string | null;
  compliance_summary?: string | null;
  training_summary?: string | null;
  last_hr_updated_at?: string | null;
  onboarding_status?: string | null;
  onboarding_completed_at?: string | null;
  required_documents_missing_count?: number | null;
  training_required_count?: number | null;
  certificates_outstanding_count?: number | null;
  hr_profile_url?: string | null;
  /** Never forwarded — present so callers/tests can assert stripping. */
  contracts?: unknown;
  offer_letters?: unknown;
  hr_letters?: unknown;
  identity_documents?: unknown;
  bank_details?: unknown;
  super_details?: unknown;
  tax_details?: unknown;
  private_notes?: unknown;
};

const SENSITIVE_KEYS = new Set([
  ...HR_STAFF_SENSITIVE_METADATA_KEYS,
  "contracts",
  "offer_letters",
  "hr_letters",
  "identity_documents",
  "bank_details",
  "super_details",
  "tax_details",
  "private_notes",
]);

/** Keys that must never appear on the FI sync row or in `metadata_snapshot`. */
export function listSensitiveHrFieldKeys(): string[] {
  return Array.from(SENSITIVE_KEYS);
}

function trimStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function truncate(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Builds versioned bounded metadata for FI `metadata_snapshot` (no documents, no PII beyond summaries).
 */
export function buildBoundedMetadataSnapshotV1(record: IiohrHrPortalStaffRecord): IiohrFiStaffSyncMetadataSnapshotV1 {
  return {
    schema_version: 1,
    employment_type: truncate(trimStr(record.employment_type), 120),
    clinic_name: truncate(trimStr(record.clinic_name), 200),
    role_label: truncate(trimStr(record.role_label), 200),
    compliance_summary: truncate(trimStr(record.compliance_summary), 2000),
    training_summary: truncate(trimStr(record.training_summary), 2000),
    last_hr_updated_at: trimStr(record.last_hr_updated_at),
  };
}

/** Validated HR/training readiness fields for FI OS staff directory notifications. */
export function buildHrReadinessMetadataSnapshot(record: IiohrHrPortalStaffRecord): Record<string, unknown> {
  return extractValidatedHrReadinessFields({
    onboarding_status: record.onboarding_status,
    onboarding_completed_at: record.onboarding_completed_at,
    required_documents_missing_count: record.required_documents_missing_count,
    training_required_count: record.training_required_count,
    certificates_outstanding_count: record.certificates_outstanding_count,
    hr_profile_url: record.hr_profile_url,
    source_url: record.source_url,
  });
}

/**
 * Maps one IIOHR HR staff record to a single FI `IiohrHrStaffSyncRow` (operational + bounded snapshot only).
 */
export function mapIiohrHrStaffToFiSyncRow(record: IiohrHrPortalStaffRecord): IiohrHrStaffSyncRow {
  const ext = trimStr(record.external_staff_id);
  const name = trimStr(record.full_name) ?? "";
  if (!ext) {
    throw new Error("mapIiohrHrStaffToFiSyncRow: external_staff_id is required.");
  }

  return {
    external_staff_id: ext,
    iiohr_user_id: trimStr(record.iiohr_user_id),
    full_name: name || "Staff",
    email: trimStr(record.email),
    staff_role: trimStr(record.staff_role),
    employment_status: trimStr(record.employment_status),
    source_url: trimStr(record.source_url),
    default_timezone: trimStr(record.default_timezone),
    working_hours:
      record.working_hours && typeof record.working_hours === "object" && !Array.isArray(record.working_hours)
        ? record.working_hours
        : undefined,
    metadata_snapshot: {
      ...buildBoundedMetadataSnapshotV1(record),
      ...buildHrReadinessMetadataSnapshot(record),
    } as Record<string, unknown>,
  };
}

export function mapIiohrHrStaffRecordsToFiSyncRows(records: IiohrHrPortalStaffRecord[]): IiohrHrStaffSyncRow[] {
  return records.map(mapIiohrHrStaffToFiSyncRow);
}
