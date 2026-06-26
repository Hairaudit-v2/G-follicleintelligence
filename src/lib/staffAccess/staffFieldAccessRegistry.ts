/**
 * SA-2 — Field-Level Permission Engine: static registry.
 *
 * Pure, dependency-free definitions (no DB, no `server-only`) so the field-access engine and
 * its tests can run anywhere. The DB seed in
 * `supabase/migrations/20260927120002_sa2_field_level_permissions.sql` mirrors
 * {@link STAFF_ACCESS_FIELDS} and {@link STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS}; the server loader
 * prefers DB rows and falls back to this registry when none exist (fresh tenants, local dev,
 * unit tests).
 *
 * SA-2 is a SECOND gate that sits INSIDE SA-1 module access. It never replaces module access:
 * if a staff member cannot view a module (SA-1), they cannot view any field inside it (SA-2),
 * regardless of any field template or grant. See `staffFieldAccessCore.ts` for the clamp.
 */

import { STAFF_ACCESS_MODULE_KEYS, type StaffAccessModuleKey } from "./staffAccessRegistry";

/**
 * Field permission levels, ordered weakest → strongest. The index is the comparable rank.
 *
 *   hidden   — the field does not exist for this person (omit / null on render).
 *   masked   — the field is acknowledged but its value is replaced (e.g. "Restricted").
 *   summary  — only a safe, de-identified / aggregate summary value is exposed.
 *   read     — the real value is visible.
 *   edit     — the real value is visible and editable.
 *   approve  — may approve / sign-off the field (e.g. consent, surgical sign-off).
 *   export   — may export / extract the raw value out of the platform.
 *
 * `export` is deliberately the HIGHEST and SEPARATE level: being able to read or even edit a
 * value in-app is materially different from being allowed to extract it (CSV, PDF, API). Export
 * is the most sensitive data-egress action, so it is gated independently and never implied by
 * read/edit/approve. It requires an explicit `export` grant or an admin override.
 */
export const STAFF_FIELD_PERMISSION_LEVELS = [
  "hidden",
  "masked",
  "summary",
  "read",
  "edit",
  "approve",
  "export",
] as const;

export type StaffFieldPermissionLevel = (typeof STAFF_FIELD_PERMISSION_LEVELS)[number];

/** Data-sensitivity classification used to drive safe defaults and admin warnings. */
export const STAFF_FIELD_SENSITIVITY_LEVELS = [
  "standard",
  "sensitive",
  "clinical",
  "financial",
  "identity",
  "governance",
] as const;

export type StaffFieldSensitivityLevel = (typeof STAFF_FIELD_SENSITIVITY_LEVELS)[number];

/** How a field renders by default (before any role template / grant raises it). */
export const STAFF_FIELD_MASKING_STRATEGIES = [
  "visible",
  "hidden",
  "masked",
  "summary_only",
] as const;

export type StaffFieldMaskingStrategy = (typeof STAFF_FIELD_MASKING_STRATEGIES)[number];

/**
 * Sensitivity classes that default to `hidden` even when their per-field masking strategy is
 * `visible`. Financial and identity data is hidden unless a role template or grant explicitly
 * allows it (see the SA-2 spec: "financial and identity fields default hidden").
 */
export const SENSITIVITY_DEFAULT_HIDDEN: ReadonlySet<StaffFieldSensitivityLevel> = new Set([
  "financial",
  "identity",
]);

/**
 * Modules where export is forbidden even for an admin override (data-egress policy). Empty by
 * default; surfaces can opt a module in here to cap admin override at `approve`.
 */
export const EXPORT_FORBIDDEN_MODULES: ReadonlySet<StaffAccessModuleKey> = new Set([]);

export function isStaffFieldPermissionLevel(v: unknown): v is StaffFieldPermissionLevel {
  return (
    typeof v === "string" && (STAFF_FIELD_PERMISSION_LEVELS as readonly string[]).includes(v)
  );
}

export function isStaffFieldSensitivityLevel(v: unknown): v is StaffFieldSensitivityLevel {
  return (
    typeof v === "string" && (STAFF_FIELD_SENSITIVITY_LEVELS as readonly string[]).includes(v)
  );
}

export function isStaffFieldMaskingStrategy(v: unknown): v is StaffFieldMaskingStrategy {
  return (
    typeof v === "string" && (STAFF_FIELD_MASKING_STRATEGIES as readonly string[]).includes(v)
  );
}

export type StaffFieldDefinition = {
  /** SA-1 module this field lives inside. Field access is always clamped to module access. */
  moduleKey: StaffAccessModuleKey;
  /** Stable dotted key, e.g. `patient.identity`. Unique within a module. */
  fieldKey: string;
  label: string;
  description: string;
  sensitivity: StaffFieldSensitivityLevel;
  defaultMaskingStrategy: StaffFieldMaskingStrategy;
};

/**
 * The protected field / section / data-category registry. Mirrors the SQL seed in the SA-2
 * migration. Grouped by module for readability.
 */
export const STAFF_ACCESS_FIELDS: StaffFieldDefinition[] = [
  // ---- patient_os ----
  {
    moduleKey: "patient_os",
    fieldKey: "patient.identity",
    label: "Patient identity",
    description: "Name, date of birth, identifiers — directly identifiable data.",
    sensitivity: "identity",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "patient_os",
    fieldKey: "patient.contact_details",
    label: "Contact details",
    description: "Email, phone, address.",
    sensitivity: "sensitive",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "patient_os",
    fieldKey: "patient.medical_history",
    label: "Medical history",
    description: "Past conditions, history, intake answers.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "patient_os",
    fieldKey: "patient.medications",
    label: "Medications",
    description: "Current and historical medications.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "patient_os",
    fieldKey: "patient.photos",
    label: "Clinical photos",
    description: "Patient photography and clinical imaging.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "patient_os",
    fieldKey: "patient.documents",
    label: "Documents",
    description: "Uploaded documents and files.",
    sensitivity: "sensitive",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "patient_os",
    fieldKey: "patient.audit_reports",
    label: "Audit reports",
    description: "HairAudit reports and outcome intelligence.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "summary_only",
  },
  {
    moduleKey: "patient_os",
    fieldKey: "patient.financial_summary",
    label: "Financial summary",
    description: "Balance, invoice totals, payment status for the patient.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "patient_os",
    fieldKey: "patient.internal_notes",
    label: "Internal notes",
    description: "Staff-only internal notes.",
    sensitivity: "governance",
    defaultMaskingStrategy: "hidden",
  },

  // ---- consultation_os ----
  {
    moduleKey: "consultation_os",
    fieldKey: "consultation.clinical_notes",
    label: "Clinical notes",
    description: "Consultation clinical notes.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "consultation_os",
    fieldKey: "consultation.diagnosis",
    label: "Diagnosis",
    description: "Diagnosis and assessment.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "consultation_os",
    fieldKey: "consultation.treatment_plan",
    label: "Treatment plan",
    description: "Proposed treatment plan.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "consultation_os",
    fieldKey: "consultation.quote",
    label: "Quote",
    description: "Quoted pricing for the consultation.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "consultation_os",
    fieldKey: "consultation.consent",
    label: "Consent",
    description: "Consent capture and status.",
    sensitivity: "governance",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "consultation_os",
    fieldKey: "consultation.private_practitioner_notes",
    label: "Private practitioner notes",
    description: "Practitioner-only private notes.",
    sensitivity: "governance",
    defaultMaskingStrategy: "hidden",
  },

  // ---- surgery_os ----
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.graft_count",
    label: "Graft count",
    description: "Number of grafts.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.hair_count",
    label: "Hair count",
    description: "Number of hairs.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.punch_size",
    label: "Punch size",
    description: "Punch size used.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.transection_rate",
    label: "Transection rate",
    description: "Transection rate metric.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "summary_only",
  },
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.team_members",
    label: "Team members",
    description: "Surgical team roster.",
    sensitivity: "sensitive",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.medications",
    label: "Surgical medications",
    description: "Intra-operative medications.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.surgical_notes",
    label: "Surgical notes",
    description: "Operative notes.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.complications",
    label: "Complications",
    description: "Recorded complications.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "surgery_os",
    fieldKey: "surgery.outcome_metrics",
    label: "Outcome metrics",
    description: "Outcome and yield metrics.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "summary_only",
  },

  // ---- financial_os ----
  {
    moduleKey: "financial_os",
    fieldKey: "financial.invoice",
    label: "Invoice",
    description: "Invoice line items and totals.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "financial_os",
    fieldKey: "financial.payment_status",
    label: "Payment status",
    description: "Paid / outstanding status.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "financial_os",
    fieldKey: "financial.refunds",
    label: "Refunds",
    description: "Refund records.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "financial_os",
    fieldKey: "financial.revenue",
    label: "Revenue",
    description: "Revenue figures.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "financial_os",
    fieldKey: "financial.margin",
    label: "Margin",
    description: "Margin and profitability.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "financial_os",
    fieldKey: "financial.practitioner_commission",
    label: "Practitioner commission",
    description: "Per-practitioner commission.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },

  // ---- analytics_os ----
  {
    moduleKey: "analytics_os",
    fieldKey: "analytics.revenue",
    label: "Revenue analytics",
    description: "Revenue analytics.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "analytics_os",
    fieldKey: "analytics.conversion",
    label: "Conversion analytics",
    description: "Conversion funnel metrics.",
    sensitivity: "standard",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "analytics_os",
    fieldKey: "analytics.marketing_roi",
    label: "Marketing ROI",
    description: "Marketing return on investment.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "analytics_os",
    fieldKey: "analytics.staff_productivity",
    label: "Staff productivity",
    description: "Per-staff productivity metrics.",
    sensitivity: "sensitive",
    defaultMaskingStrategy: "summary_only",
  },
  {
    moduleKey: "analytics_os",
    fieldKey: "analytics.clinical_outcomes",
    label: "Clinical outcomes",
    description: "Aggregate clinical outcomes.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "summary_only",
  },
  {
    moduleKey: "analytics_os",
    fieldKey: "analytics.investor_summary",
    label: "Investor summary",
    description: "Investor-safe analytics summary.",
    sensitivity: "financial",
    defaultMaskingStrategy: "summary_only",
  },

  // ---- workforce_os ----
  {
    moduleKey: "workforce_os",
    fieldKey: "workforce.personal_details",
    label: "Personal details",
    description: "Staff personal / identity details.",
    sensitivity: "identity",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "workforce_os",
    fieldKey: "workforce.documents",
    label: "Staff documents",
    description: "Staff documents and files.",
    sensitivity: "sensitive",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "workforce_os",
    fieldKey: "workforce.training",
    label: "Training",
    description: "Training records.",
    sensitivity: "standard",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "workforce_os",
    fieldKey: "workforce.certifications",
    label: "Certifications",
    description: "Certifications and licences.",
    sensitivity: "standard",
    defaultMaskingStrategy: "visible",
  },
  {
    moduleKey: "workforce_os",
    fieldKey: "workforce.performance",
    label: "Performance",
    description: "Performance reviews and ratings.",
    sensitivity: "sensitive",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "workforce_os",
    fieldKey: "workforce.payroll",
    label: "Payroll",
    description: "Payroll and compensation.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },

  // ---- settings ----
  {
    moduleKey: "settings",
    fieldKey: "settings.billing",
    label: "Billing settings",
    description: "Subscription and billing configuration.",
    sensitivity: "financial",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "settings",
    fieldKey: "settings.users",
    label: "User management",
    description: "User accounts and membership.",
    sensitivity: "governance",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "settings",
    fieldKey: "settings.permissions",
    label: "Permissions",
    description: "Access and permission configuration.",
    sensitivity: "governance",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "settings",
    fieldKey: "settings.integrations",
    label: "Integrations",
    description: "Third-party integrations and secrets.",
    sensitivity: "governance",
    defaultMaskingStrategy: "hidden",
  },
  {
    moduleKey: "settings",
    fieldKey: "settings.security",
    label: "Security",
    description: "Security and compliance configuration.",
    sensitivity: "governance",
    defaultMaskingStrategy: "hidden",
  },

  // ---- investor_dashboard ----
  {
    moduleKey: "investor_dashboard",
    fieldKey: "investor.financial_summary",
    label: "Investor financial summary",
    description: "Investor-facing financial summary.",
    sensitivity: "financial",
    defaultMaskingStrategy: "summary_only",
  },
  {
    moduleKey: "investor_dashboard",
    fieldKey: "investor.growth_metrics",
    label: "Growth metrics",
    description: "Investor-facing growth metrics.",
    sensitivity: "financial",
    defaultMaskingStrategy: "summary_only",
  },
  {
    moduleKey: "investor_dashboard",
    fieldKey: "investor.clinic_performance",
    label: "Clinic performance",
    description: "Investor-facing clinic performance.",
    sensitivity: "sensitive",
    defaultMaskingStrategy: "summary_only",
  },
  {
    moduleKey: "investor_dashboard",
    fieldKey: "investor.deidentified_outcomes",
    label: "De-identified outcomes",
    description: "De-identified clinical outcomes for investors.",
    sensitivity: "clinical",
    defaultMaskingStrategy: "summary_only",
  },
];

/** Index: fieldKey → definition. */
export const STAFF_ACCESS_FIELDS_BY_KEY: Record<string, StaffFieldDefinition> = Object.fromEntries(
  STAFF_ACCESS_FIELDS.map((f) => [f.fieldKey, f])
);

/** Index: moduleKey → its field definitions, in registry order. */
export const STAFF_ACCESS_FIELDS_BY_MODULE: Record<string, StaffFieldDefinition[]> = (() => {
  const out: Record<string, StaffFieldDefinition[]> = {};
  for (const m of STAFF_ACCESS_MODULE_KEYS) out[m] = [];
  for (const f of STAFF_ACCESS_FIELDS) {
    (out[f.moduleKey] ??= []).push(f);
  }
  return out;
})();

export function getStaffFieldDefinition(fieldKey: string): StaffFieldDefinition | null {
  return STAFF_ACCESS_FIELDS_BY_KEY[fieldKey] ?? null;
}

export function listStaffAccessFieldsForModule(
  moduleKey: StaffAccessModuleKey
): StaffFieldDefinition[] {
  return STAFF_ACCESS_FIELDS_BY_MODULE[moduleKey] ?? [];
}

/**
 * Baseline field permission per role per field. Mirrors the SQL seed; treated as a fallback
 * when the DB has no `fi_role_field_permission_templates` rows. Omitted fields fall back to the
 * field's own default masking strategy (and the financial/identity hidden rule).
 *
 * Only entries that RAISE access above the field default are listed — absence ≠ access.
 */
export type RoleFieldTemplateMap = Record<string, StaffFieldPermissionLevel>;

function exportAllFields(): RoleFieldTemplateMap {
  // Owner / platform admin: explicit export on every protected field (clamped to module access
  // and to EXPORT_FORBIDDEN_MODULES by the core, so this remains safe).
  const out: RoleFieldTemplateMap = {};
  for (const f of STAFF_ACCESS_FIELDS) out[f.fieldKey] = "export";
  return out;
}

export const STAFF_ROLE_FIELD_TEMPLATE_DEFAULTS: Record<string, RoleFieldTemplateMap> = {
  doctor: {
    "patient.identity": "read",
    "patient.contact_details": "read",
    "patient.medical_history": "edit",
    "patient.medications": "edit",
    "patient.photos": "edit",
    "patient.documents": "read",
    "patient.audit_reports": "read",
    "patient.internal_notes": "read",
    "consultation.clinical_notes": "edit",
    "consultation.diagnosis": "edit",
    "consultation.treatment_plan": "edit",
    "consultation.quote": "read",
    "consultation.consent": "approve",
    "consultation.private_practitioner_notes": "edit",
    "surgery.graft_count": "edit",
    "surgery.hair_count": "edit",
    "surgery.punch_size": "edit",
    "surgery.transection_rate": "edit",
    "surgery.team_members": "read",
    "surgery.medications": "edit",
    "surgery.surgical_notes": "edit",
    "surgery.complications": "edit",
    "surgery.outcome_metrics": "approve",
    // patient.financial_summary deliberately omitted → hidden by default.
  },
  nurse: {
    "patient.identity": "read",
    "patient.contact_details": "read",
    "patient.medical_history": "read",
    "patient.medications": "edit",
    "patient.photos": "edit",
    "patient.audit_reports": "read",
    "consultation.clinical_notes": "read",
    "consultation.treatment_plan": "read",
    "surgery.graft_count": "edit",
    "surgery.hair_count": "edit",
    "surgery.punch_size": "read",
    "surgery.team_members": "read",
    "surgery.medications": "edit",
    "surgery.surgical_notes": "edit",
    "surgery.complications": "read",
    "surgery.outcome_metrics": "read",
  },
  reception: {
    "patient.identity": "read",
    "patient.contact_details": "edit",
    "patient.documents": "read",
    "consultation.quote": "read",
    "financial.payment_status": "read",
    // patient.medical_history, financial.margin omitted → hidden by default.
  },
  consultant: {
    "patient.identity": "read",
    "patient.contact_details": "read",
    "patient.audit_reports": "read",
    "consultation.clinical_notes": "read",
    "consultation.diagnosis": "read",
    "consultation.treatment_plan": "edit",
    "consultation.quote": "edit",
    "consultation.consent": "edit",
    "consultation.private_practitioner_notes": "read",
    "analytics.conversion": "read",
  },
  manager: {
    "patient.identity": "read",
    "patient.contact_details": "read",
    "patient.financial_summary": "read",
    "patient.audit_reports": "read",
    "consultation.quote": "read",
    "consultation.consent": "read",
    "financial.invoice": "read",
    "financial.payment_status": "read",
    "financial.refunds": "read",
    "financial.revenue": "read",
    "analytics.revenue": "read",
    "analytics.conversion": "read",
    "analytics.staff_productivity": "read",
    "workforce.personal_details": "read",
    "workforce.documents": "read",
    "workforce.training": "read",
    "workforce.certifications": "read",
    "workforce.performance": "read",
    "settings.users": "read",
  },
  owner: exportAllFields(),
  investor: {
    "analytics.revenue": "read",
    "analytics.conversion": "read",
    "analytics.investor_summary": "read",
    "investor.financial_summary": "read",
    "investor.growth_metrics": "read",
    "investor.clinic_performance": "read",
    "investor.deidentified_outcomes": "read",
    // No patient.* entries → identity/contact hidden, also blocked by module access.
  },
  trainer: {
    "patient.identity": "read",
    "patient.audit_reports": "read",
  },
  auditor: {
    "patient.identity": "read",
    "patient.contact_details": "read",
    "patient.medical_history": "read",
    "patient.medications": "read",
    "patient.photos": "read",
    "patient.audit_reports": "read",
    "consultation.clinical_notes": "read",
    "consultation.diagnosis": "read",
    "consultation.treatment_plan": "read",
    "consultation.consent": "read",
    "surgery.surgical_notes": "read",
    "surgery.complications": "read",
    "surgery.outcome_metrics": "read",
    "analytics.clinical_outcomes": "read",
  },
  platform_admin: exportAllFields(),
};
