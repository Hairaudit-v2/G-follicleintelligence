/** Stable form keys for FI OS consent templates / instances. */
export const CONSENT_FORM_KEYS = [
  "photo_clinical",
  "privacy_treatment",
  "surgery_procedure",
  "prp_treatment",
  "exosome_treatment",
] as const;

export type ConsentFormKey = (typeof CONSENT_FORM_KEYS)[number];

export const CONSENT_INSTANCE_STATUSES = [
  "outstanding",
  "signed",
  "void",
  "declined",
] as const;

export type ConsentInstanceStatus = (typeof CONSENT_INSTANCE_STATUSES)[number];

export const CONSENT_CHANNELS = [
  "fi_patient_link",
  "fi_clinic_device",
  "staff_assisted",
  "upload",
] as const;

export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];

export const CONSENT_FORM_KEY_SET = new Set<string>(CONSENT_FORM_KEYS);

export function isConsentFormKey(value: string): value is ConsentFormKey {
  return CONSENT_FORM_KEY_SET.has(value);
}

export const CONSENT_FORM_KEY_TITLES: Record<ConsentFormKey, string> = {
  photo_clinical: "Clinical photography consent",
  privacy_treatment: "Privacy and treatment information consent",
  surgery_procedure: "Hair transplant / surgery procedure consent",
  prp_treatment: "PRP treatment consent",
  exosome_treatment: "Exosome treatment consent",
};

export type ConsentRequirementResolution = {
  requiredFormKeys: ConsentFormKey[];
  reasons: Record<ConsentFormKey, string[]>;
};

export type ConsentTemplateRef = {
  id: string;
  form_key: ConsentFormKey;
  title: string;
  version: string;
  body_md: string;
  required_for: string[];
  is_active: boolean;
};

export type ConsentInstanceRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  template_id: string | null;
  form_key: ConsentFormKey;
  form_version: string;
  status: ConsentInstanceStatus;
  channel: ConsentChannel | null;
  signed_at: string | null;
  signed_name: string | null;
  recorded_by_fi_user_id: string | null;
  evidence_document_id: string | null;
  related_booking_id: string | null;
  related_case_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PatientConsentStatusSummary = {
  required: ConsentFormKey[];
  signed: ConsentFormKey[];
  outstanding: ConsentFormKey[];
  allRequiredSigned: boolean;
};

export type RequiredConsentPanelItem = {
  formKey: ConsentFormKey;
  title: string;
  version: string;
  status: "outstanding" | "signed" | "missing_template";
  reasons: string[];
  instanceId: string | null;
  signedAt: string | null;
  signedName: string | null;
  templateId: string | null;
  bodyPreview: string | null;
};

export type PatientRequiredConsentsPanelData = {
  ok: true;
  items: RequiredConsentPanelItem[];
  allRequiredSigned: boolean;
  unavailable?: false;
} | {
  ok: false;
  unavailable: true;
  message: string;
  items: [];
  allRequiredSigned: false;
};
