export const FI_TENANT_OPERATING_MODE_KEYS = [
  "full_fi_os",
  "hair_transplant_clinic",
  "medical_hair_clinic",
  "training_academy",
  "audit_partner",
] as const;

export type FiTenantOperatingModeKey = (typeof FI_TENANT_OPERATING_MODE_KEYS)[number];

export function isFiTenantOperatingModeKey(v: string): v is FiTenantOperatingModeKey {
  return (FI_TENANT_OPERATING_MODE_KEYS as readonly string[]).includes(v);
}

export type FiTenantOperatingModeUiOption = {
  modeKey: FiTenantOperatingModeKey;
  label: string;
  description: string;
  /** Short list of modules emphasised at tenant-default layer (Stage 3.5). */
  defaultModulesLine: string;
};

export const FI_TENANT_OPERATING_MODE_UI_OPTIONS: readonly FiTenantOperatingModeUiOption[] = [
  {
    modeKey: "full_fi_os",
    label: "Full FI OS",
    description: "All modules remain available at the tenant-default layer. Staff templates and explicit overrides still apply.",
    defaultModulesLine: "All FI OS modules (subject to per-layer defaults).",
  },
  {
    modeKey: "hair_transplant_clinic",
    label: "Hair transplant clinic",
    description: "Surgery-forward defaults: SurgeryOS, procedure day, imaging, audit intelligence, and patient twin workflows.",
    defaultModulesLine: "SurgeryOS, cases, procedure day, imaging, audit intelligence, patient twin.",
  },
  {
    modeKey: "medical_hair_clinic",
    label: "Medical hair clinic",
    description: "Consultation and medical hair journeys: consultations, prescriptions, pathology, patients, and CRM defaults.",
    defaultModulesLine: "Consultations, prescriptions, pathology, patients, CRM.",
  },
  {
    modeKey: "training_academy",
    label: "Training academy",
    description: "Academy and training delivery defaults with reduced surgical and diagnostics emphasis.",
    defaultModulesLine: "Academy, staff, calendar, patients (lighter surgical defaults).",
  },
  {
    modeKey: "audit_partner",
    label: "Audit partner",
    description: "Partner organisations focused on audit and analytics with reduced scheduling and CRM defaults.",
    defaultModulesLine: "Audit intelligence, analytics, patient safety review surfaces.",
  },
] as const;

const MODE_PREVIEW: Record<FiTenantOperatingModeKey, string> = {
  full_fi_os: "This operating mode keeps the full FI OS surface available at tenant defaults.",
  hair_transplant_clinic:
    "This operating mode emphasises: SurgeryOS, cases, procedure day, imaging, audit intelligence, and patient twin.",
  medical_hair_clinic:
    "This operating mode emphasises: consultations, prescriptions, pathology, patients, and CRM-led growth workflows.",
  training_academy: "This operating mode emphasises: academy delivery, staff coordination, and teaching-friendly surfaces.",
  audit_partner: "This operating mode emphasises: audit intelligence, analytics, and governance-friendly review.",
};

export function buildFiOsOperatingModePreviewLine(modeKey: string | null | undefined): string {
  const k = String(modeKey ?? "").trim();
  if (!k || !isFiTenantOperatingModeKey(k)) {
    return "Select an operating mode to preview how tenant defaults will emphasise modules.";
  }
  return MODE_PREVIEW[k];
}

export const FI_OS_OPERATING_MODE_PREVIEW_FOOTER =
  "Staff templates and manual feature overrides may further personalise the experience.";
