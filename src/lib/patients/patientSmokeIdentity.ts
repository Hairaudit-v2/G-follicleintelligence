/**
 * Deterministic smoke / demo patient markers (FI-PATIENT-IDENTITY-1).
 * Prefer metadata flags over name/email text matching.
 */

export const PATIENT_SMOKETEST_KEY_METADATA = "smoketest_key";
export const PATIENT_SMOKETEST_SEED_TAG_METADATA = "smoketest_seed_tag";
export const PATIENT_ENTERPRISE_DEMO_METADATA_FLAG = "enterprise_demo_patient";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function hasNonEmptyStringFlag(meta: Record<string, unknown>, key: string): boolean {
  const v = meta[key];
  return typeof v === "string" && v.trim().length > 0;
}

function hasTrueFlag(meta: Record<string, unknown>, key: string): boolean {
  const v = meta[key];
  return v === true || v === "true" || v === 1 || v === "1";
}

/**
 * Deterministic seed display-name prefix used by Evolved SMOKETEST board seeds.
 * Supplement to metadata flags — not a fuzzy personal-name match.
 */
function hasSmoketestDisplayPrefix(meta: Record<string, unknown>): boolean {
  for (const key of ["display_name", "normalised_display_name", "patient_name", "full_name"]) {
    const v = meta[key];
    if (typeof v === "string" && /^SMOKETEST(?:-|\b)/i.test(v.trim())) return true;
  }
  return false;
}

/** True when patient or person metadata carries a deterministic smoke/demo marker. */
export function isSmokeOrTestPatientIdentity(input: {
  patientMetadata?: unknown;
  personMetadata?: unknown;
}): boolean {
  const patientMeta = asRecord(input.patientMetadata);
  const personMeta = asRecord(input.personMetadata);
  for (const meta of [patientMeta, personMeta]) {
    if (!meta) continue;
    if (hasNonEmptyStringFlag(meta, PATIENT_SMOKETEST_KEY_METADATA)) return true;
    if (hasNonEmptyStringFlag(meta, PATIENT_SMOKETEST_SEED_TAG_METADATA)) return true;
    if (hasTrueFlag(meta, PATIENT_ENTERPRISE_DEMO_METADATA_FLAG)) return true;
    if (hasSmoketestDisplayPrefix(meta)) return true;
  }
  return false;
}
