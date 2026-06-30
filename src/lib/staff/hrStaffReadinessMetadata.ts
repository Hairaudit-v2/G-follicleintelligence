/**
 * Safe HR/training readiness fields for `fi_staff_source_ids.metadata` (IIOHR HR sync → FI OS).
 * Validates and strips sensitive HR/payroll payloads at the sync boundary.
 */

import {
  HR_PORTAL_SOURCE_SYSTEM_PRIORITY,
  isAllowedHrPortalUrl,
} from "@/src/lib/staff/myHrPortalSelection";
import {
  isStaffSensitiveMetadataKey,
  parseIsoStaffMetadataDate,
  STAFF_SENSITIVE_METADATA_KEYS,
} from "@/src/lib/staff/staffSensitiveMetadataKeys";
import {
  normalizeFiStaffSourceMetadata,
  normalizeFiStaffSourceSystem,
} from "@/src/lib/staff/staffSourceIdsNormalize";
import {
  extractWorkforceIdentityMetadataFields,
  WORKFORCE_IDENTITY_METADATA_KEYS,
  WORKFORCE_IDENTITY_SAFE_METADATA_KEYS,
} from "@/src/lib/workforce-os/workforceIdentityMetadata";
import { canonicaliseWorkforceSourceSystem } from "@/src/lib/workforce-os/workforceIdentitySources";

/** Readiness keys surfaced by FI OS staff directory / HR notification UI. */
export const HR_STAFF_READINESS_METADATA_KEYS = [
  "onboarding_status",
  "onboarding_completed_at",
  "required_documents_missing_count",
  "training_required_count",
  "certificates_outstanding_count",
  "hr_profile_url",
] as const;

/** Legacy bounded snapshot keys (schema v1) still merged on sync. */
export const IIOHR_HR_LEGACY_METADATA_SNAPSHOT_KEYS = [
  "schema_version",
  "employment_type",
  "clinic_name",
  "role_label",
  "compliance_summary",
  "training_summary",
  "last_hr_updated_at",
  "iiohr_user_id",
  "primary_fi_clinic_id",
] as const;

export const IIOHR_HR_SAFE_METADATA_SNAPSHOT_KEYS = new Set<string>([
  ...IIOHR_HR_LEGACY_METADATA_SNAPSHOT_KEYS,
  ...HR_STAFF_READINESS_METADATA_KEYS,
  ...WORKFORCE_IDENTITY_METADATA_KEYS,
]);

/** Workforce identity keys merged on HR sync (projection only). */
export const HR_WORKFORCE_IDENTITY_METADATA_KEYS = WORKFORCE_IDENTITY_METADATA_KEYS;

export const HR_STAFF_SENSITIVE_METADATA_KEYS = STAFF_SENSITIVE_METADATA_KEYS;

export function isHrStaffSourceSystem(sourceSystem: string): boolean {
  const canon = canonicaliseWorkforceSourceSystem(sourceSystem);
  return canon === "iiohr_hr";
}

/** Lower rank = higher priority (`iiohr_hr` first). */
export function hrStaffSourceSystemRank(sourceSystem: string): number {
  const norm = normalizeFiStaffSourceSystem(sourceSystem);
  const idx = (HR_PORTAL_SOURCE_SYSTEM_PRIORITY as readonly string[]).indexOf(norm);
  return idx === -1 ? 999 : idx;
}

function isSensitiveMetadataKey(key: string): boolean {
  return isStaffSensitiveMetadataKey(key);
}

export function parseNonNegativeCount(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  let n: number;
  if (typeof v === "number" && Number.isFinite(v)) {
    n = Math.floor(v);
  } else {
    n = Math.floor(Number(String(v)));
  }
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function parseIsoMetadataDate(v: unknown): string | undefined {
  return parseIsoStaffMetadataDate(v);
}

export function parseOnboardingStatus(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export function parseHrProfileUrl(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  if (!s || !isAllowedHrPortalUrl(s)) return undefined;
  return s;
}

export type ExtractHrReadinessInput = {
  onboarding_status?: unknown;
  onboarding_completed_at?: unknown;
  required_documents_missing_count?: unknown;
  training_required_count?: unknown;
  certificates_outstanding_count?: unknown;
  hr_profile_url?: unknown;
  source_url?: unknown;
};

/** Validates readiness fields from a feed row or metadata snapshot. Invalid values are omitted. */
export function extractValidatedHrReadinessFields(
  input: ExtractHrReadinessInput
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const onboardingStatus = parseOnboardingStatus(input.onboarding_status);
  if (onboardingStatus) out.onboarding_status = onboardingStatus;

  const onboardingCompletedAt = parseIsoMetadataDate(input.onboarding_completed_at);
  if (onboardingCompletedAt) out.onboarding_completed_at = onboardingCompletedAt;

  const docs = parseNonNegativeCount(input.required_documents_missing_count);
  if (docs !== undefined) out.required_documents_missing_count = docs;

  const training = parseNonNegativeCount(input.training_required_count);
  if (training !== undefined) out.training_required_count = training;

  const certs = parseNonNegativeCount(input.certificates_outstanding_count);
  if (certs !== undefined) out.certificates_outstanding_count = certs;

  const profileUrl = parseHrProfileUrl(input.hr_profile_url) ?? parseHrProfileUrl(input.source_url);
  if (profileUrl) out.hr_profile_url = profileUrl;

  return out;
}

/**
 * Strips sensitive keys and normalizes allowlisted readiness + legacy snapshot fields.
 * Missing numeric counts are omitted (FI UI treats absent as unknown, not zero).
 */
export function sanitizeIiohrHrMetadataSnapshot(
  raw: Record<string, unknown> | null | undefined,
  sourceUrl?: string | null
): Record<string, unknown> {
  const readinessInput: ExtractHrReadinessInput = { source_url: sourceUrl };

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const key of HR_STAFF_READINESS_METADATA_KEYS) {
      if (key in raw) readinessInput[key] = raw[key];
    }
    if (raw.source_url != null) readinessInput.source_url = raw.source_url;
  }

  const out = extractValidatedHrReadinessFields(readinessInput);

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    Object.assign(out, extractWorkforceIdentityMetadataFields(raw));
    for (const [key, value] of Object.entries(raw)) {
      if (isSensitiveMetadataKey(key)) continue;
      if (
        (HR_STAFF_READINESS_METADATA_KEYS as readonly string[]).includes(
          key as (typeof HR_STAFF_READINESS_METADATA_KEYS)[number]
        )
      ) {
        continue;
      }
      if (WORKFORCE_IDENTITY_SAFE_METADATA_KEYS.has(key)) continue;
      if (!IIOHR_HR_SAFE_METADATA_SNAPSHOT_KEYS.has(key)) continue;
      if (value === undefined) continue;
      out[key] = value;
    }
  }

  return out;
}

/** Merges incoming sync snapshot into existing metadata; always stamps `last_synced_at`. */
export function mergeHrStaffSourceMetadataOnSync(
  existing: Record<string, unknown>,
  incomingSnapshot: Record<string, unknown>,
  lastSyncedAt: string,
  sourceUrl?: string | null
): Record<string, unknown> {
  const base = normalizeFiStaffSourceMetadata(existing);
  const incoming = sanitizeIiohrHrMetadataSnapshot(incomingSnapshot, sourceUrl);
  return normalizeFiStaffSourceMetadata({
    ...base,
    ...incoming,
    last_synced_at: lastSyncedAt,
    sync_status: "active",
    training_source: incoming.training_source ?? base.training_source ?? "iiohr_hr",
    certification_source: incoming.certification_source ?? base.certification_source ?? "iiohr_hr",
  });
}

/** Builds HR sync identity projection fields from an external staff id and optional user id. */
export function buildHrWorkforceIdentityMetadataProjection(input: {
  externalStaffId: string;
  iiohrUserId?: string | null;
}): Record<string, unknown> {
  return extractWorkforceIdentityMetadataFields({
    iiohr_hr_profile_id: input.externalStaffId.trim(),
    iiohr_user_id: input.iiohrUserId,
    sync_status: "active",
    training_source: "iiohr_hr",
    certification_source: "iiohr_hr",
    competency_source: "iiohr_hr",
  });
}
