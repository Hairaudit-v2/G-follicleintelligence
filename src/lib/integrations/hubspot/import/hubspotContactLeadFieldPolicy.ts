/**
 * FI-HUBSPOT-IMPORT-1D — explicit field-level merge matrix.
 * Existing native FI values win unless policy permits fill/append.
 */

import type { HubspotContactLeadFieldPolicy } from "./hubspotContactLeadPilotTypes";

export type ContactLeadFieldKey =
  | "hubspot_contact_id"
  | "display_name"
  | "email_primary"
  | "phone_primary"
  | "owner"
  | "pipeline_stage"
  | "source_created_at"
  | "source_updated_at"
  | "marketing_consent"
  | "clinical_fields";

export const CONTACT_LEAD_FIELD_MATRIX_V1: Record<
  ContactLeadFieldKey,
  { policy: HubspotContactLeadFieldPolicy; notes: string }
> = {
  hubspot_contact_id: {
    policy: "source_identity_only",
    notes: "Retained via source-ID / external mapping tables only.",
  },
  display_name: {
    policy: "fill_when_blank",
    notes: "Preserve FI native name when present; source may fill missing values.",
  },
  email_primary: {
    policy: "preserve_fi_native",
    notes: "Never overwrite primary email; alternate append only when supported.",
  },
  phone_primary: {
    policy: "fill_when_blank",
    notes: "Preserve FI primary phone; fill missing only.",
  },
  owner: {
    policy: "fill_when_blank",
    notes: "Apply mapped FI staff only when native owner blank; never invent staff.",
  },
  pipeline_stage: {
    policy: "fill_when_blank",
    notes: "Never regress a more advanced FI stage; history-only stages stay metadata.",
  },
  source_created_at: {
    policy: "source_identity_only",
    notes: "Provenance metadata only — never replaces FI audit timestamps.",
  },
  source_updated_at: {
    policy: "source_identity_only",
    notes: "Provenance metadata only.",
  },
  marketing_consent: {
    policy: "out_of_scope",
    notes: "Do not infer or upgrade consent from HubSpot import.",
  },
  clinical_fields: {
    policy: "out_of_scope",
    notes: "Clinical patient fields are never written from HubSpot contacts.",
  },
};

export function assertPatientCreationForbidden(createPatient: boolean): void {
  if (createPatient) {
    throw new Error("PATIENT_GUARD: automatic patient creation from HubSpot contacts is forbidden");
  }
}

export function assertEmailAloneCannotLinkPatient(emailOnlyPatientLink: boolean): void {
  if (emailOnlyPatientLink) {
    throw new Error("PATIENT_GUARD: email alone cannot link a HubSpot contact to a patient");
  }
}

/** Pure merge planner for person metadata enrichment (fill-when-blank only). */
export function planPersonMetadataEnrichment(input: {
  existing: Record<string, unknown>;
  sourceFirstName: string | null;
  sourceLastName: string | null;
  sourceEmailNormalized: string | null;
  sourcePhone: string | null;
}): { next: Record<string, unknown>; changedKeys: string[] } {
  const next = { ...input.existing };
  const changedKeys: string[] = [];

  const first = String(next.first_name ?? "").trim();
  const last = String(next.last_name ?? "").trim();
  if (!first && input.sourceFirstName?.trim()) {
    next.first_name = input.sourceFirstName.trim();
    changedKeys.push("first_name");
  }
  if (!last && input.sourceLastName?.trim()) {
    next.last_name = input.sourceLastName.trim();
    changedKeys.push("last_name");
  }

  // Primary email: preserve FI native (matrix).
  const existingEmail = String(next.email_normalized ?? "").trim();
  if (!existingEmail && input.sourceEmailNormalized?.trim()) {
    next.email_normalized = input.sourceEmailNormalized.trim().toLowerCase();
    changedKeys.push("email_normalized");
  }

  const existingPhone = String(next.phone ?? next.mobile_phone ?? "").trim();
  if (!existingPhone && input.sourcePhone?.trim()) {
    next.phone = input.sourcePhone.trim();
    changedKeys.push("phone");
  }

  return { next, changedKeys };
}

export function stageFillAllowed(input: {
  currentFiSlug: string | null;
  proposedFiSlug: string | null;
  wouldRegress: boolean;
  historyOnly: boolean;
}): boolean {
  if (!input.proposedFiSlug) return false;
  if (input.historyOnly) return false;
  if (input.wouldRegress) return false;
  // fill_when_blank: only when FI has no stage
  return !input.currentFiSlug;
}
