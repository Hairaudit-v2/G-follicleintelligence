import type { PatientStatusValue } from "./patientPolicy";
import { derivePatientIdentityContact } from "./patientIdentityContact";

const STATUS_LABELS: Record<PatientStatusValue, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
  deceased: "Deceased",
  duplicate: "Duplicate",
};

export function patientStatusLabel(status: string | null | undefined): string {
  if (!status) return STATUS_LABELS.active;
  const key = status.trim().toLowerCase();
  if (key in STATUS_LABELS) return STATUS_LABELS[key as PatientStatusValue];
  return status;
}

/** Person (+ optional patient) metadata → display fields for patient shell (pure). */
export function displayFromPersonMetadata(
  personMeta: Record<string, unknown>,
  patientMeta?: Record<string, unknown> | null
): {
  name: string;
  email: string | null;
  phone: string | null;
} {
  const v = derivePatientIdentityContact({
    personMetadata: personMeta,
    patientMetadata: patientMeta ?? {},
  });
  return { name: v.fullName, email: v.primaryEmail, phone: v.primaryPhone };
}
