/**
 * Pure helpers: resolve patient-facing identity + contact fields from `fi_persons.metadata`,
 * `fi_patients.metadata`, and optional first-class patient row fields (HubSpot Stage 1 paths).
 */

export type PatientPreferredContactMethod = "email" | "sms" | "both" | null;

export type PatientIdentityContactView = {
  /** Primary heading name (never empty — falls back to "—"). */
  fullName: string;
  preferredDisplayName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  dateOfBirth: string | null;
  ageYears: number | null;
  address: string | null;
  preferredContactMethod: PatientPreferredContactMethod;
  reminderConsent: boolean | null;
  lifecycleStage: string | null;
  leadStatus: string | null;
  stageOfJourney: string | null;
  importBatchId: string | null;
  hubspotRecordId: string | null;
  hasHubspotSlice: boolean;
};

function asTrimmedString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function readHubspot(meta: Record<string, unknown>): Record<string, unknown> {
  const h = meta.hubspot;
  if (h && typeof h === "object" && !Array.isArray(h)) return h as Record<string, unknown>;
  return {};
}

/** Patient hubspot wins for patient-only keys; person hubspot overlays contact names from person. */
function mergedHubspot(
  personMeta: Record<string, unknown>,
  patientMeta: Record<string, unknown>
): Record<string, unknown> {
  return { ...readHubspot(patientMeta), ...readHubspot(personMeta) };
}

function hubspotFullName(hub: Record<string, unknown>): string | null {
  const fn = asTrimmedString(hub.first_name);
  const ln = asTrimmedString(hub.last_name);
  const parts = [fn, ln].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(" ");
}

function coalesceString(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

function addressFromUnknown(v: unknown): string | null {
  const s = asTrimmedString(v);
  if (s) return s;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const parts = [
      asTrimmedString(o.line1 ?? o.street ?? o.address1),
      asTrimmedString(o.line2 ?? o.address2),
      asTrimmedString(o.city),
      asTrimmedString(o.state ?? o.region),
      asTrimmedString(o.postal_code ?? o.zip),
      asTrimmedString(o.country),
    ].filter(Boolean) as string[];
    if (parts.length) return parts.join(", ");
  }
  return null;
}

function normalizePreferredContact(raw: unknown): PatientPreferredContactMethod {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (t === "email" || t === "sms" || t === "both") return t;
  return null;
}

/**
 * Computes whole-year age from a calendar date string (YYYY-MM-DD prefix or full ISO).
 */
export function computeAgeYearsFromDobString(
  dob: string | null | undefined,
  reference = new Date()
): number | null {
  if (!dob?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  let age = reference.getFullYear() - y;
  const md = reference.getMonth() + 1 - mo;
  if (md < 0 || (md === 0 && reference.getDate() < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

export type DerivePatientIdentityContactParams = {
  personMetadata: Record<string, unknown>;
  patientMetadata?: Record<string, unknown> | null;
  preferredContactMethod?: string | null;
  reminderConsent?: boolean | null;
  /** When metadata does not yet store `hubspot.record_id` (legacy imports). */
  hubspotSourcePersonId?: string | null;
};

export function derivePatientIdentityContact(
  args: DerivePatientIdentityContactParams
): PatientIdentityContactView {
  const person = args.personMetadata;
  const patient =
    args.patientMetadata &&
    typeof args.patientMetadata === "object" &&
    !Array.isArray(args.patientMetadata)
      ? (args.patientMetadata as Record<string, unknown>)
      : {};

  const hub = mergedHubspot(person, patient);
  const hasHubspotSlice = Object.keys(hub).length > 0;

  const hubName = hubspotFullName(hub);

  const preferredDisplayName = coalesceString(
    asTrimmedString(person.display_name),
    asTrimmedString(patient.display_name as unknown),
    hubName,
    asTrimmedString(person.normalised_display_name)
  );

  const fullName =
    coalesceString(
      asTrimmedString(person.display_name),
      asTrimmedString(patient.display_name as unknown),
      hubName,
      asTrimmedString(person.normalised_display_name),
      asTrimmedString(person.email_normalized),
      asTrimmedString(hub.email)
    ) ?? "—";

  const primaryEmail = coalesceString(
    asTrimmedString(person.email),
    asTrimmedString(patient.email as unknown),
    asTrimmedString(person.email_normalized),
    asTrimmedString(hub.email)
  );

  const primaryPhone = coalesceString(
    asTrimmedString(person.phone),
    asTrimmedString(patient.phone as unknown),
    asTrimmedString(hub.phone_number)
  );

  const dateOfBirth = coalesceString(
    asTrimmedString(person.date_of_birth),
    asTrimmedString(patient.date_of_birth as unknown),
    asTrimmedString(hub.date_of_birth),
    asTrimmedString(hub.dob)
  );

  const address = coalesceString(
    asTrimmedString(person.address),
    asTrimmedString(patient.address as unknown),
    addressFromUnknown(hub.address)
  );

  const importBatchId = coalesceString(
    asTrimmedString(person.import_batch_id),
    asTrimmedString(patient.import_batch_id)
  );

  const hubspotRecordId = coalesceString(
    asTrimmedString(hub.record_id),
    args.hubspotSourcePersonId ?? null
  );

  const lifecycleStage = asTrimmedString(hub.lifecycle_stage);
  const leadStatus = asTrimmedString(hub.lead_status);
  const stageOfJourney = asTrimmedString(hub.stage_of_journey);

  const preferredContactMethod = normalizePreferredContact(args.preferredContactMethod);
  const reminderConsent = typeof args.reminderConsent === "boolean" ? args.reminderConsent : null;

  return {
    fullName,
    preferredDisplayName,
    primaryEmail,
    primaryPhone,
    dateOfBirth,
    ageYears: computeAgeYearsFromDobString(dateOfBirth),
    address,
    preferredContactMethod,
    reminderConsent,
    lifecycleStage,
    leadStatus,
    stageOfJourney,
    importBatchId,
    hubspotRecordId,
    hasHubspotSlice,
  };
}
