/**
 * SA-1 — Adaptive Staff Access & Entitlements Engine: static registry.
 *
 * Pure, dependency-free definitions (no DB, no `server-only`) so the access engine and
 * its tests can run anywhere. The DB seed in
 * `supabase/migrations/20260927120001_sa1_staff_access_entitlements.sql` mirrors
 * {@link STAFF_ROLE_TEMPLATE_DEFAULTS}; the server loader prefers DB rows and falls back
 * to this registry when none exist (fresh tenants, local dev, unit tests).
 */

export const STAFF_ACCESS_MODULE_KEYS = [
  "clinic_os",
  "lead_flow",
  "patient_os",
  "consultation_os",
  "surgery_os",
  "imaging_os",
  "audit_os",
  "academy_os",
  "analytics_os",
  "financial_os",
  "workforce_os",
  "settings",
  "platform_progress",
  "investor_dashboard",
] as const;

export type StaffAccessModuleKey = (typeof STAFF_ACCESS_MODULE_KEYS)[number];

export const STAFF_ROLE_KEYS = [
  "doctor",
  "nurse",
  "reception",
  "consultant",
  "manager",
  "owner",
  "investor",
  "trainer",
  "auditor",
  "platform_admin",
] as const;

export type StaffRoleKey = (typeof STAFF_ROLE_KEYS)[number];

/** Access levels, ordered weakest → strongest. Index in the array is the comparable rank. */
export const STAFF_ACCESS_LEVELS = ["none", "read", "edit", "approve", "admin"] as const;
export type StaffAccessLevel = (typeof STAFF_ACCESS_LEVELS)[number];

export const STAFF_ACCESS_SCOPES = ["tenant", "clinic", "own", "assigned"] as const;
export type StaffAccessScope = (typeof STAFF_ACCESS_SCOPES)[number];

export function isStaffAccessModuleKey(v: unknown): v is StaffAccessModuleKey {
  return typeof v === "string" && (STAFF_ACCESS_MODULE_KEYS as readonly string[]).includes(v);
}

export function isStaffRoleKey(v: unknown): v is StaffRoleKey {
  return typeof v === "string" && (STAFF_ROLE_KEYS as readonly string[]).includes(v);
}

export function isStaffAccessLevel(v: unknown): v is StaffAccessLevel {
  return typeof v === "string" && (STAFF_ACCESS_LEVELS as readonly string[]).includes(v);
}

export function isStaffAccessScope(v: unknown): v is StaffAccessScope {
  return typeof v === "string" && (STAFF_ACCESS_SCOPES as readonly string[]).includes(v);
}

/** Numeric rank of an access level (0 = none … 4 = admin). Unknown values → 0. */
export function accessLevelRank(level: StaffAccessLevel | string | null | undefined): number {
  const idx = STAFF_ACCESS_LEVELS.indexOf(String(level ?? "none") as StaffAccessLevel);
  return idx < 0 ? 0 : idx;
}

/** True when `level` is at least as strong as `required`. */
export function accessLevelSatisfies(
  level: StaffAccessLevel | string | null | undefined,
  required: StaffAccessLevel
): boolean {
  return accessLevelRank(level) >= accessLevelRank(required);
}

export type StaffAccessModuleDefinition = {
  key: StaffAccessModuleKey;
  label: string;
  description: string;
  category: string;
  /** Path segment under `/fi-admin/[tenantId]/` (no leading slash); empty string = tenant home. */
  navPath: string;
  sortOrder: number;
};

export const STAFF_ACCESS_MODULES: Record<StaffAccessModuleKey, StaffAccessModuleDefinition> = {
  clinic_os: {
    key: "clinic_os",
    label: "ClinicOS",
    description: "Dashboard, bookings, calendar, daily operations.",
    category: "operations",
    navPath: "",
    sortOrder: 10,
  },
  lead_flow: {
    key: "lead_flow",
    label: "LeadFlow",
    description: "Enquiries, leads, pipeline, tasks, follow-ups.",
    category: "growth",
    navPath: "crm",
    sortOrder: 20,
  },
  patient_os: {
    key: "patient_os",
    label: "PatientOS",
    description: "Patient records, profiles, and directory.",
    category: "clinical",
    navPath: "patients",
    sortOrder: 30,
  },
  consultation_os: {
    key: "consultation_os",
    label: "ConsultationOS",
    description: "Consultation workspace and conversion funnel.",
    category: "clinical",
    navPath: "consultations",
    sortOrder: 40,
  },
  surgery_os: {
    key: "surgery_os",
    label: "SurgeryOS",
    description: "Planning, procedure day, post-op, follow-up.",
    category: "clinical",
    navPath: "cases",
    sortOrder: 50,
  },
  imaging_os: {
    key: "imaging_os",
    label: "ImagingOS",
    description: "Clinical imaging, protocols, and media workflows.",
    category: "clinical",
    navPath: "imaging",
    sortOrder: 60,
  },
  audit_os: {
    key: "audit_os",
    label: "AuditOS",
    description: "HairAudit queue, evidence, and outcome intelligence.",
    category: "intelligence",
    navPath: "audit",
    sortOrder: 70,
  },
  academy_os: {
    key: "academy_os",
    label: "AcademyOS",
    description: "Training and academy experiences.",
    category: "intelligence",
    navPath: "academy",
    sortOrder: 80,
  },
  analytics_os: {
    key: "analytics_os",
    label: "AnalyticsOS",
    description: "Executive KPIs and cross-module intelligence.",
    category: "intelligence",
    navPath: "analytics",
    sortOrder: 90,
  },
  financial_os: {
    key: "financial_os",
    label: "FinancialOS",
    description: "Revenue, invoices, payments, and finance reporting.",
    category: "finance",
    navPath: "financial",
    sortOrder: 100,
  },
  workforce_os: {
    key: "workforce_os",
    label: "WorkforceOS",
    description: "Staff, rosters, HR, and workforce operations.",
    category: "team",
    navPath: "staff",
    sortOrder: 110,
  },
  settings: {
    key: "settings",
    label: "Settings",
    description: "Tenant, clinic, and system configuration.",
    category: "system",
    navPath: "configuration",
    sortOrder: 120,
  },
  platform_progress: {
    key: "platform_progress",
    label: "Platform Progress",
    description: "Platform rollout, onboarding, and progress tracking.",
    category: "system",
    navPath: "platform-progress",
    sortOrder: 130,
  },
  investor_dashboard: {
    key: "investor_dashboard",
    label: "Investor Dashboard",
    description: "Investor-facing performance and growth metrics.",
    category: "finance",
    navPath: "investor",
    sortOrder: 140,
  },
};

export function listStaffAccessModules(): StaffAccessModuleDefinition[] {
  return [...STAFF_ACCESS_MODULES_LIST];
}

const STAFF_ACCESS_MODULES_LIST = STAFF_ACCESS_MODULE_KEYS.map((k) => STAFF_ACCESS_MODULES[k]).sort(
  (a, b) => a.sortOrder - b.sortOrder
);

export const STAFF_ROLE_LABELS: Record<StaffRoleKey, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  reception: "Reception",
  consultant: "Consultant",
  manager: "Manager",
  owner: "Owner",
  investor: "Investor",
  trainer: "Trainer",
  auditor: "Auditor",
  platform_admin: "Platform admin",
};

/** A single module/tab access entry. */
export type StaffAccessEntry = {
  level: StaffAccessLevel;
  scope: StaffAccessScope;
};

/**
 * Baseline access per role per module. Omitted modules default to `none`.
 * Kept in lockstep with the SQL seed; treated as fallback when the DB has no template rows.
 */
export const STAFF_ROLE_TEMPLATE_DEFAULTS: Record<
  StaffRoleKey,
  Partial<Record<StaffAccessModuleKey, StaffAccessEntry>>
> = {
  doctor: {
    clinic_os: { level: "read", scope: "tenant" },
    patient_os: { level: "edit", scope: "tenant" },
    consultation_os: { level: "edit", scope: "tenant" },
    surgery_os: { level: "approve", scope: "tenant" },
    imaging_os: { level: "edit", scope: "tenant" },
    academy_os: { level: "read", scope: "tenant" },
  },
  nurse: {
    clinic_os: { level: "read", scope: "tenant" },
    patient_os: { level: "edit", scope: "assigned" },
    consultation_os: { level: "read", scope: "assigned" },
    surgery_os: { level: "edit", scope: "assigned" },
    imaging_os: { level: "edit", scope: "assigned" },
    academy_os: { level: "read", scope: "tenant" },
  },
  /**
   * Reception — operational front-desk staff (SA-2B calibrated).
   *
   * Reception requires administrative access to patient records for workflow continuity
   * (contact updates, document intake, identity verification). Module access provides the
   * operational ceiling (`patient_os` → edit). Field permissions (SA-2) enforce protected-data
   * boundaries — reception must never access clinical decision data, financial summaries, or
   * internal practitioner notes even though the module ceiling is edit.
   */
  reception: {
    clinic_os: { level: "edit", scope: "tenant" },
    lead_flow: { level: "edit", scope: "tenant" },
    patient_os: { level: "edit", scope: "tenant" },
    consultation_os: { level: "read", scope: "tenant" },
    academy_os: { level: "read", scope: "tenant" },
  },
  consultant: {
    clinic_os: { level: "read", scope: "tenant" },
    lead_flow: { level: "edit", scope: "tenant" },
    patient_os: { level: "read", scope: "tenant" },
    consultation_os: { level: "edit", scope: "tenant" },
    analytics_os: { level: "read", scope: "tenant" },
    academy_os: { level: "read", scope: "tenant" },
  },
  manager: {
    clinic_os: { level: "edit", scope: "tenant" },
    lead_flow: { level: "edit", scope: "tenant" },
    patient_os: { level: "edit", scope: "tenant" },
    consultation_os: { level: "edit", scope: "tenant" },
    surgery_os: { level: "edit", scope: "tenant" },
    imaging_os: { level: "read", scope: "tenant" },
    audit_os: { level: "read", scope: "tenant" },
    academy_os: { level: "edit", scope: "tenant" },
    analytics_os: { level: "read", scope: "tenant" },
    financial_os: { level: "read", scope: "tenant" },
    workforce_os: { level: "edit", scope: "tenant" },
    settings: { level: "edit", scope: "tenant" },
    platform_progress: { level: "read", scope: "tenant" },
  },
  owner: Object.fromEntries(
    STAFF_ACCESS_MODULE_KEYS.map((k) => [
      k,
      { level: "admin", scope: "tenant" } as StaffAccessEntry,
    ])
  ) as Record<StaffAccessModuleKey, StaffAccessEntry>,
  investor: {
    analytics_os: { level: "read", scope: "tenant" },
    financial_os: { level: "read", scope: "tenant" },
    investor_dashboard: { level: "read", scope: "tenant" },
  },
  trainer: {
    clinic_os: { level: "read", scope: "tenant" },
    patient_os: { level: "read", scope: "tenant" },
    academy_os: { level: "admin", scope: "tenant" },
  },
  auditor: {
    clinic_os: { level: "read", scope: "tenant" },
    patient_os: { level: "read", scope: "tenant" },
    consultation_os: { level: "read", scope: "tenant" },
    imaging_os: { level: "read", scope: "tenant" },
    audit_os: { level: "approve", scope: "tenant" },
    analytics_os: { level: "read", scope: "tenant" },
  },
  platform_admin: Object.fromEntries(
    STAFF_ACCESS_MODULE_KEYS.map((k) => [
      k,
      { level: "admin", scope: "tenant" } as StaffAccessEntry,
    ])
  ) as Record<StaffAccessModuleKey, StaffAccessEntry>,
};

/**
 * Map a free-text staff/clinical role (e.g. `fi_staff.staff_role`, `fi_users.role`) to a
 * canonical {@link StaffRoleKey}. Returns null when no confident mapping exists.
 */
export function normalizeStaffRoleKey(raw: string | null | undefined): StaffRoleKey | null {
  const r = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!r) return null;
  if (isStaffRoleKey(r)) return r;
  const aliases: Record<string, StaffRoleKey> = {
    surgeon: "doctor",
    physician: "doctor",
    gp: "doctor",
    registered_nurse: "nurse",
    rn: "nurse",
    receptionist: "reception",
    front_desk: "reception",
    coordinator: "reception",
    patient_advisor: "consultant",
    sales: "consultant",
    clinic_manager: "manager",
    operations_admin: "manager",
    clinic_admin: "manager",
    practice_manager: "manager",
    director: "owner",
    principal: "owner",
    fi_admin: "platform_admin",
    fi_platform_admin: "platform_admin",
    admin: "owner",
  };
  return aliases[r] ?? null;
}
