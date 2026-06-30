/**
 * Pure patient admin policy (Stage 4A): status allow-list and admin note bounds.
 */

export const PATIENT_STATUS_VALUES = [
  "active",
  "inactive",
  "archived",
  "deceased",
  "duplicate",
] as const;

export type PatientStatusValue = (typeof PATIENT_STATUS_VALUES)[number];

export const DEFAULT_PATIENT_STATUS: PatientStatusValue = "active";

/** Staff admin note — not for clinical documentation. */
export const PATIENT_ADMIN_NOTE_MAX_LENGTH = 4000;

const STATUS_SET = new Set<string>(PATIENT_STATUS_VALUES);

export function isAllowedPatientStatus(
  value: string | null | undefined
): value is PatientStatusValue {
  if (!value || typeof value !== "string") return false;
  return STATUS_SET.has(value.trim());
}

export function normalizePatientStatus(value: string | null | undefined): PatientStatusValue {
  const v = String(value ?? "").trim();
  if (isAllowedPatientStatus(v)) return v;
  return DEFAULT_PATIENT_STATUS;
}

export function assertAdminNoteWithinBounds(note: string | null | undefined): string | null {
  if (note == null) return null;
  const s = String(note);
  if (s.length > PATIENT_ADMIN_NOTE_MAX_LENGTH) {
    throw new Error(`admin_note exceeds ${PATIENT_ADMIN_NOTE_MAX_LENGTH} characters.`);
  }
  return s;
}
