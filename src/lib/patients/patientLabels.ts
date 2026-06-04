import type { PatientStatusValue } from "./patientPolicy";

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

/** Person metadata → display fields for patient shell (pure). */
export function displayFromPersonMetadata(meta: Record<string, unknown>): {
  name: string;
  email: string | null;
  phone: string | null;
} {
  const name =
    (typeof meta.display_name === "string" && meta.display_name.trim()) ||
    (typeof meta.normalised_display_name === "string" && meta.normalised_display_name.trim()) ||
    (typeof meta.email_normalized === "string" && meta.email_normalized.trim()) ||
    "—";
  const email =
    typeof meta.email === "string"
      ? meta.email.trim() || null
      : typeof meta.email_normalized === "string"
        ? meta.email_normalized.trim() || null
        : null;
  const phone = typeof meta.phone === "string" ? meta.phone.trim() || null : null;
  return { name, email, phone };
}
