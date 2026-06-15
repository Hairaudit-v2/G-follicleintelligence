/**
 * Global and pseudonymous identifiers (boundary types).
 *
 * **Migration note:** IIOHR and FI OS today use various string UUIDs and source maps
 * (`fi_patient_source_ids`, `fi_global_cases`, etc.). Do **not** remove or bypass
 * existing IIOHR identity helpers — adopt these aliases when adding **new** cross-system APIs.
 */

/** Branded string for a professional entity across systems. */
export type ProfessionalGlobalId = string;

/** Branded string for a patient in FI / linked sources (operational; not for public export). */
export type PatientGlobalId = string;

export type ClinicGlobalId = string;

export type AuditCaseGlobalId = string;

/** Training / academy case or scenario identifier (IIOHR). */
export type TrainingCaseGlobalId = string;

export type OrganizationGlobalId = string;

/**
 * Opaque pseudonymous identifier for analytics graph nodes (non-PHI).
 * Format: `psub_v0_<orgScope>_<fingerprint>`
 */
export type PseudonymousSubjectId = `psub_v0_${string}`;

const PSUB_PATTERN = /^psub_v0_[a-zA-Z0-9._-]+$/;

/**
 * Deterministic stub fingerprint (not cryptographic).
 * Replace with HMAC or keyed hash in hardened environments — documented for Stage 10.
 */
export function buildPseudonymousSubjectId(orgScope: string, stableKey: string): PseudonymousSubjectId {
  const scope = orgScope.trim().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48) || "unknown";
  let h = 2166136261;
  const input = `${scope}|${stableKey}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const fp = (h >>> 0).toString(16);
  return `psub_v0_${scope}_${fp}` as PseudonymousSubjectId;
}

export function validatePseudonymousSubjectId(value: string): value is PseudonymousSubjectId {
  return PSUB_PATTERN.test(value.trim());
}
