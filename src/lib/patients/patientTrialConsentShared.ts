export type PatientTrialConsentGateView = {
  required: boolean;
  satisfied: boolean;
};

/** Global trial override when tenant config_json omits the flag. */
export function isGlobalTrialConsentGateEnabled(): boolean {
  const raw = process.env.FI_TRIAL_REQUIRE_CONSENT_BEFORE_CAPTURE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export const PATIENT_TRIAL_CONSENT_REQUIRED_TOOLTIP =
  "Upload a signed consent document on the patient Documents tab before clinical photography.";

export const PATIENT_TRIAL_CONSENT_REQUIRED_MESSAGE =
  "Upload a signed consent document on the patient profile (Documents tab) before clinical photography or consultation completion.";

export const PATIENT_TRIAL_CONSENT_LINK_PATIENT_MESSAGE =
  "Link a patient to this consultation before completing or capturing clinical photography.";

export function isPatientTrialConsentCaptureAllowed(
  gate: PatientTrialConsentGateView | null | undefined
): boolean {
  if (!gate?.required) return true;
  return gate.satisfied;
}

export function buildPatientDocumentsTabHref(tenantId: string, patientId: string): string {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  return `/fi-admin/${encodeURIComponent(tid)}/patients/${encodeURIComponent(pid)}?tab=documents`;
}