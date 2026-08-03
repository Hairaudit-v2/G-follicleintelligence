/**
 * F-PILOT-08 — consultation patient linkage honesty (pure helpers).
 */

import {
  CONSULTATION_EDITABLE_STATUSES,
  type ConsultationStatus,
} from "./consultationTypes";

/** Statuses that allow patient_id / person_id link corrections without full intake edit. */
export const CONSULTATION_PATIENT_LINKABLE_STATUSES = [
  "draft",
  "in_progress",
  "completed",
  "quoted",
  "accepted",
] as const;

export type ConsultationPatientLinkableStatus =
  (typeof CONSULTATION_PATIENT_LINKABLE_STATUSES)[number];

export function isConsultationEditableStatus(status: string): boolean {
  return (CONSULTATION_EDITABLE_STATUSES as readonly string[]).includes(status);
}

export function isConsultationPatientLinkableStatus(status: string): boolean {
  return (CONSULTATION_PATIENT_LINKABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Prefer consultation.patient_id; if null, use lead.patient_id.
 * Never invent IDs — empty/whitespace treated as null.
 */
export function resolveConsultationPatientId(input: {
  consultationPatientId: string | null | undefined;
  leadPatientId: string | null | undefined;
}): string | null {
  const fromConsult = input.consultationPatientId?.trim() || null;
  if (fromConsult) return fromConsult;
  const fromLead = input.leadPatientId?.trim() || null;
  return fromLead;
}

/**
 * Whether a draft patch is patient-link-only (safe on completed consultations).
 * Ignores adminKey / updatedByFiUserId-style keys if present.
 */
export function isPatientLinkOnlyConsultationPatch(
  patch: Record<string, unknown>
): boolean {
  const ignore = new Set(["adminKey", "admin_key", "updatedByFiUserId", "updated_by"]);
  const keys = Object.keys(patch).filter((k) => !ignore.has(k) && patch[k] !== undefined);
  if (keys.length === 0) return false;
  return keys.every((k) => k === "patient_id" || k === "person_id");
}

export function consultationStatusAllowsFullEdit(status: ConsultationStatus | string): boolean {
  return isConsultationEditableStatus(status);
}
