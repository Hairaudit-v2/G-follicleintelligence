/**
 * Bounded metadata contract for `fi_staff_source_ids.metadata` across workforce identity links.
 * Projection only — IIOHR remains source of truth for education, certification, and HR records.
 */

import { parseIsoStaffMetadataDate } from "@/src/lib/staff/staffSensitiveMetadataKeys";
import { normalizeFiStaffSourceMetadata } from "@/src/lib/staff/staffSourceIdsNormalize";

/** Cross-system identity and sync projection keys (allowlisted). */
export const WORKFORCE_IDENTITY_METADATA_KEYS = [
  "iiohr_user_id",
  "iiohr_hr_profile_id",
  "iiohr_academy_profile_id",
  "global_professional_id",
  "nexus_profile_id",
  "primary_fi_clinic_id",
  "training_source",
  "certification_source",
  "sop_source",
  "competency_source",
  "sync_status",
  "last_synced_at",
] as const;

export type WorkforceIdentityMetadataKey = (typeof WORKFORCE_IDENTITY_METADATA_KEYS)[number];

export const WORKFORCE_IDENTITY_SAFE_METADATA_KEYS = new Set<string>(
  WORKFORCE_IDENTITY_METADATA_KEYS
);

export const WORKFORCE_IDENTITY_SYNC_STATUSES = [
  "active",
  "pending",
  "stale",
  "revoked",
  "error",
] as const;

export type WorkforceIdentitySyncStatus = (typeof WORKFORCE_IDENTITY_SYNC_STATUSES)[number];

function trimId(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function trimSourceLabel(v: unknown): string | undefined {
  const s = trimId(v);
  if (!s) return undefined;
  return s.length <= 64 ? s : s.slice(0, 63) + "…";
}

export function parseWorkforceIdentitySyncStatus(
  v: unknown
): WorkforceIdentitySyncStatus | undefined {
  const s = trimId(v)?.toLowerCase();
  if (!s) return undefined;
  return (WORKFORCE_IDENTITY_SYNC_STATUSES as readonly string[]).includes(s)
    ? (s as WorkforceIdentitySyncStatus)
    : undefined;
}

export type ExtractWorkforceIdentityMetadataInput = {
  iiohr_user_id?: unknown;
  iiohr_hr_profile_id?: unknown;
  iiohr_academy_profile_id?: unknown;
  global_professional_id?: unknown;
  nexus_profile_id?: unknown;
  primary_fi_clinic_id?: unknown;
  training_source?: unknown;
  certification_source?: unknown;
  sop_source?: unknown;
  competency_source?: unknown;
  sync_status?: unknown;
  last_synced_at?: unknown;
};

/** Validates and extracts allowlisted identity metadata fields. Invalid values are omitted. */
export function extractWorkforceIdentityMetadataFields(
  input: ExtractWorkforceIdentityMetadataInput
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const iiohrUserId = trimId(input.iiohr_user_id);
  if (iiohrUserId) out.iiohr_user_id = iiohrUserId;

  const hrProfileId = trimId(input.iiohr_hr_profile_id);
  if (hrProfileId) out.iiohr_hr_profile_id = hrProfileId;

  const academyProfileId = trimId(input.iiohr_academy_profile_id);
  if (academyProfileId) out.iiohr_academy_profile_id = academyProfileId;

  const globalId = trimId(input.global_professional_id);
  if (globalId) out.global_professional_id = globalId;

  const nexusProfileId = trimId(input.nexus_profile_id);
  if (nexusProfileId) out.nexus_profile_id = nexusProfileId;

  const clinicId = trimId(input.primary_fi_clinic_id);
  if (clinicId) out.primary_fi_clinic_id = clinicId;

  const trainingSource = trimSourceLabel(input.training_source);
  if (trainingSource) out.training_source = trainingSource;

  const certSource = trimSourceLabel(input.certification_source);
  if (certSource) out.certification_source = certSource;

  const sopSource = trimSourceLabel(input.sop_source);
  if (sopSource) out.sop_source = sopSource;

  const competencySource = trimSourceLabel(input.competency_source);
  if (competencySource) out.competency_source = competencySource;

  const syncStatus = parseWorkforceIdentitySyncStatus(input.sync_status);
  if (syncStatus) out.sync_status = syncStatus;

  const lastSynced = parseIsoStaffMetadataDate(input.last_synced_at);
  if (lastSynced) out.last_synced_at = lastSynced;

  return out;
}

/**
 * Strips sensitive keys and normalizes allowlisted workforce identity metadata.
 */
export function sanitizeWorkforceIdentityMetadata(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return extractWorkforceIdentityMetadataFields(raw as ExtractWorkforceIdentityMetadataInput);
}

/** Merges incoming identity metadata into existing; does not stamp sync time unless provided. */
export function mergeWorkforceIdentityMetadata(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const base = normalizeFiStaffSourceMetadata(existing);
  const cleanIncoming = sanitizeWorkforceIdentityMetadata(incoming);
  return normalizeFiStaffSourceMetadata({ ...base, ...cleanIncoming });
}
