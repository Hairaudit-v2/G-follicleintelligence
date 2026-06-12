export const PATIENT_DETAIL_TABS = [
  "overview",
  "clinical",
  "appointments",
  "gallery",
  "treatment_history",
  "timeline",
  "prescriptions",
  "documents",
  "payments",
] as const;

export type PatientDetailTabId = (typeof PATIENT_DETAIL_TABS)[number];

const TAB_SET = new Set<string>(PATIENT_DETAIL_TABS);

export const PATIENT_DETAIL_TAB_LABELS: Record<PatientDetailTabId, string> = {
  overview: "Overview",
  clinical: "Clinical",
  appointments: "Appointments",
  gallery: "Gallery",
  treatment_history: "Treatment history",
  timeline: "Timeline",
  prescriptions: "Prescriptions",
  documents: "Documents",
  payments: "Payments",
};

export function parsePatientDetailTab(raw: string | string[] | undefined): PatientDetailTabId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const t = v?.trim().toLowerCase();
  if (t && TAB_SET.has(t)) return t as PatientDetailTabId;
  return "overview";
}
