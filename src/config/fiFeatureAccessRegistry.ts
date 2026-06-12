import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import { FI_DASHBOARD_WIDGET_LABELS } from "@/src/config/fiDashboardRegistry";
import type { FiTenantAdminRole } from "@/src/lib/tenantAdmin/tenantAdminRoles";

/**
 * FI OS Stage 2 — central feature keys for visibility (UI only).
 * Route guards and RBAC remain authoritative for security.
 */
export const FI_FEATURE_KEYS = [
  "dashboard",
  "calendar",
  "patients",
  "crm",
  "consultations",
  "cases",
  "procedure_day",
  "prescriptions",
  "pathology",
  "imaging",
  "patient_twin",
  "audit",
  "analytics",
  "academy",
  "staff",
  "settings",
  "quick_actions",
  "surgery_pipeline",
  "my_workspace",
  "attention_centre",
] as const;

export type FiFeatureKey = (typeof FI_FEATURE_KEYS)[number];

export function isFiFeatureKey(v: string): v is FiFeatureKey {
  return (FI_FEATURE_KEYS as readonly string[]).includes(v);
}

export type FiFeatureCategory =
  | "home"
  | "today"
  | "patient_journey"
  | "clinical"
  | "intelligence"
  | "team"
  | "system";

export const FI_FEATURE_CATEGORY_ORDER: readonly FiFeatureCategory[] = [
  "home",
  "today",
  "patient_journey",
  "clinical",
  "intelligence",
  "team",
  "system",
];

export const FI_FEATURE_CATEGORY_LABELS: Record<FiFeatureCategory, string> = {
  home: "Home",
  today: "Today",
  patient_journey: "Patient Journey",
  clinical: "Clinical",
  intelligence: "Intelligence",
  team: "Team",
  system: "System",
};

export type FiFeatureRegistryEntry = {
  key: FiFeatureKey;
  label: string;
  description: string;
  category: FiFeatureCategory;
  /**
   * When false for the viewer’s tenant-admin persona, the feature is hidden by default until
   * explicitly enabled (Stage 2 uses all-true defaults for everyone; reserved for later).
   */
  defaultEnabledForRoles?: Partial<Record<FiTenantAdminRole, boolean>>;
  /** Path segment under `/fi-admin/[tenantId]/` (no leading slash). */
  navPath?: string;
  dashboardWidgetKey?: FiDashboardWidgetKey;
};

const dash = FI_DASHBOARD_WIDGET_LABELS;

export const FI_FEATURE_REGISTRY: Record<FiFeatureKey, FiFeatureRegistryEntry> = {
  dashboard: {
    key: "dashboard",
    label: "Dashboard",
    description: "Clinic operating centre home and overview modules.",
    category: "home",
    navPath: "",
  },
  calendar: {
    key: "calendar",
    label: "Calendar",
    description: "Operational calendar, bookings, and day boards tied to scheduling.",
    category: "today",
    navPath: "calendar",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: false,
      finance_admin: true,
      dashboard_viewer: true,
      data_safety_admin: true,
    },
  },
  patients: {
    key: "patients",
    label: "Patients",
    description: "PatientOS directory and patient records entry points.",
    category: "patient_journey",
    navPath: "patients",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: false,
      finance_admin: true,
      dashboard_viewer: true,
      data_safety_admin: true,
    },
  },
  crm: {
    key: "crm",
    label: "CRM / LeadFlow",
    description: "Leads, pipeline, and CRM shell workflows.",
    category: "patient_journey",
    navPath: "crm",
  },
  consultations: {
    key: "consultations",
    label: "Consultations",
    description: "ConsultationOS including conversion workflows.",
    category: "patient_journey",
    navPath: "consultations",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: false,
      finance_admin: true,
      dashboard_viewer: true,
      data_safety_admin: true,
    },
  },
  cases: {
    key: "cases",
    label: "Cases / SurgeryOS",
    description: "Case worklists, SurgeryOS readiness, and case lifecycle.",
    category: "clinical",
    navPath: "cases",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: false,
      finance_admin: true,
      dashboard_viewer: true,
      data_safety_admin: true,
    },
  },
  procedure_day: {
    key: "procedure_day",
    label: "Procedure day",
    description: "Procedure day board under SurgeryOS.",
    category: "clinical",
    navPath: "procedure-day",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: false,
      finance_admin: true,
      dashboard_viewer: true,
      data_safety_admin: true,
    },
  },
  prescriptions: {
    key: "prescriptions",
    label: "Prescriptions",
    description: "Prescribing and medication workflows.",
    category: "clinical",
    navPath: "prescriptions",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: true,
      finance_admin: true,
      dashboard_viewer: true,
      data_safety_admin: true,
    },
  },
  pathology: {
    key: "pathology",
    label: "Pathology",
    description: "Pathology requests and results (where surfaced in FI OS).",
    category: "clinical",
  },
  imaging: {
    key: "imaging",
    label: "Imaging",
    description: "Clinical imaging and media workflows.",
    category: "clinical",
  },
  patient_twin: {
    key: "patient_twin",
    label: "Patient Twin",
    description: "Foundation integrity and twin-style longitudinal views.",
    category: "intelligence",
    navPath: "foundation-integrity",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: false,
      finance_admin: true,
      dashboard_viewer: true,
      data_safety_admin: true,
    },
  },
  audit: {
    key: "audit",
    label: "AuditOS",
    description: "Security and operational audit surfaces.",
    category: "intelligence",
    navPath: "audit",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: false,
      finance_admin: false,
      dashboard_viewer: false,
      data_safety_admin: false,
    },
  },
  analytics: {
    key: "analytics",
    label: "AnalyticsOS",
    description: "Tenant analytics and reporting entry points.",
    category: "intelligence",
    navPath: "analytics",
    defaultEnabledForRoles: {
      clinic_admin: false,
      operations_admin: false,
      finance_admin: false,
      dashboard_viewer: false,
      data_safety_admin: false,
    },
  },
  academy: {
    key: "academy",
    label: "AcademyOS",
    description: "Training and academy experiences (staged rollout).",
    category: "intelligence",
  },
  staff: {
    key: "staff",
    label: "Staff",
    description: "Staff directory and clinic staffing settings strip.",
    category: "team",
    navPath: "staff",
  },
  settings: {
    key: "settings",
    label: "Settings",
    description: "Configuration hub, clinic setup, imports, and tenant settings.",
    category: "system",
    navPath: "configuration",
  },
  quick_actions: {
    key: "quick_actions",
    label: dash.quick_actions.title,
    description: dash.quick_actions.description ?? "Compact shortcuts to common workflows.",
    category: "home",
    dashboardWidgetKey: "quick_actions",
  },
  surgery_pipeline: {
    key: "surgery_pipeline",
    label: dash.surgery_pipeline.title,
    description: dash.surgery_pipeline.description ?? "",
    category: "home",
    dashboardWidgetKey: "surgery_pipeline",
  },
  my_workspace: {
    key: "my_workspace",
    label: dash.my_workspace.title,
    description: dash.my_workspace.description ?? "",
    category: "home",
    dashboardWidgetKey: "my_workspace",
  },
  attention_centre: {
    key: "attention_centre",
    label: dash.attention_centre.title,
    description: dash.attention_centre.description ?? "",
    category: "home",
    dashboardWidgetKey: "attention_centre",
  },
};

export function listFiFeatureKeys(): FiFeatureKey[] {
  return [...FI_FEATURE_KEYS];
}

export function assertRegistryCoversAllKeys(): void {
  for (const k of FI_FEATURE_KEYS) {
    if (!FI_FEATURE_REGISTRY[k]) throw new Error(`Missing registry entry for feature key: ${k}`);
  }
}

/** Baseline Stage-2 policy: every feature is visible unless an explicit DB override disables it. */
export function buildDefaultFeatureAccessAllEnabled(): Map<FiFeatureKey, boolean> {
  return new Map(FI_FEATURE_KEYS.map((k) => [k, true] as const));
}

export function applyPartialFeatureOverrides(
  base: ReadonlyMap<FiFeatureKey, boolean>,
  overrides: Partial<Record<FiFeatureKey, boolean>>
): Map<FiFeatureKey, boolean> {
  const out = new Map(base);
  for (const [raw, v] of Object.entries(overrides)) {
    if (!isFiFeatureKey(raw)) continue;
    out.set(raw, Boolean(v));
  }
  return out;
}
