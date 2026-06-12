import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { DashboardQuickActionKey } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";

/**
 * FI OS Stage 3 — adaptive workspace personas (layout suggestions only).
 * Feature access overrides (Stage 2) and RBAC remain authoritative.
 */
export const FI_WORKSPACE_PROFILE_KEYS = [
  "director",
  "clinic_manager",
  "surgeon",
  "doctor",
  "nurse",
  "consultant",
  "reception",
  "academy_trainer",
  "auditor",
  "platform_admin",
  "default",
] as const;

export type FiWorkspaceProfileKey = (typeof FI_WORKSPACE_PROFILE_KEYS)[number];

/** Values admins may assign in staff UI (excludes implicit `platform_admin` and baseline `default`). */
export const FI_WORKSPACE_PROFILE_ADMIN_DROPDOWN_KEYS = [
  "default",
  "director",
  "clinic_manager",
  "surgeon",
  "doctor",
  "nurse",
  "consultant",
  "reception",
  "academy_trainer",
  "auditor",
] as const satisfies readonly FiWorkspaceProfileKey[];

export function isFiWorkspaceProfileKey(v: string): v is FiWorkspaceProfileKey {
  return (FI_WORKSPACE_PROFILE_KEYS as readonly string[]).includes(v);
}

export type FiWorkspaceProfile = {
  key: FiWorkspaceProfileKey;
  label: string;
  description: string;
  primaryFocus: string;
  defaultDashboardWidgets: readonly FiDashboardWidgetKey[];
  defaultQuickActions: readonly DashboardQuickActionKey[];
  /** Reserved for Stage 4 nav weighting — not enforced in Stage 3. */
  preferredNavFeatures: readonly FiFeatureKey[];
  /** Reserved for Stage 4 tenant defaults — not enforced in Stage 3. */
  hiddenByDefaultFeatures: readonly FiFeatureKey[];
  /** When true, UI may expose per-staff feature toggles (policy TBD in Stage 4). */
  allowedFeatureOverrides: boolean;
  /** Human-readable task themes for My Workspace copy (best-effort; no new loaders in Stage 3). */
  priorityTaskTypes: readonly string[];
};

export const FI_WORKSPACE_PROFILES: Record<FiWorkspaceProfileKey, FiWorkspaceProfile> = {
  director: {
    key: "director",
    label: "Director",
    description: "Business performance, conversion, revenue, and clinic health at a glance.",
    primaryFocus: "Business performance, conversion, revenue, clinic health, outcome intelligence.",
    defaultDashboardWidgets: [
      "clinic_metrics",
      "attention_centre",
      "operational_workspace",
      "surgery_pipeline",
      "analytics_summary",
      "audit_summary",
      "quick_actions",
      "my_workspace",
    ],
    defaultQuickActions: ["booking", "lead", "case", "upload_images"],
    preferredNavFeatures: ["analytics", "audit", "crm", "cases", "calendar"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: [
      "Pipeline and revenue follow-ups",
      "Conversion risks across the funnel",
      "Clinic-wide attention items",
      "Outcome and audit escalations",
    ],
  },
  clinic_manager: {
    key: "clinic_manager",
    label: "Clinic manager",
    description: "Day-to-day clinic operations, staffing, and patient flow.",
    primaryFocus: "Operational excellence, scheduling, team coordination, patient experience.",
    defaultDashboardWidgets: [
      "operational_workspace",
      "attention_centre",
      "clinic_metrics",
      "surgery_pipeline",
      "my_workspace",
      "quick_actions",
    ],
    defaultQuickActions: ["booking", "patient", "case", "lead"],
    preferredNavFeatures: ["calendar", "staff", "cases", "crm"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: [
      "Operational escalations",
      "Team coverage and handoffs",
      "Patient flow bottlenecks",
      "Same-day scheduling fixes",
    ],
  },
  surgeon: {
    key: "surgeon",
    label: "Surgeon",
    description: "Surgery planning, readiness, and clinical decision support entry points.",
    primaryFocus: "Surgery planning and clinical decisions.",
    defaultDashboardWidgets: [
      "operational_workspace",
      "surgery_pipeline",
      "my_workspace",
      "imaging_summary",
      "pathology_summary",
      "attention_centre",
      "quick_actions",
    ],
    defaultQuickActions: ["case", "upload_images", "patient", "booking"],
    preferredNavFeatures: ["cases", "imaging", "pathology", "procedure_day"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: [
      "Cases awaiting review",
      "Surgery readiness alerts",
      "Imaging review",
      "Pathology review",
    ],
  },
  doctor: {
    key: "doctor",
    label: "Doctor",
    description: "Clinical workflows with a slightly broader lens than surgeon-only stacks.",
    primaryFocus: "Clinical care, diagnostics, and longitudinal patient management.",
    defaultDashboardWidgets: [
      "my_workspace",
      "operational_workspace",
      "surgery_pipeline",
      "imaging_summary",
      "pathology_summary",
      "quick_actions",
    ],
    defaultQuickActions: ["patient", "case", "consultation", "upload_images"],
    preferredNavFeatures: ["patients", "cases", "imaging", "pathology"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: [
      "Clinical follow-ups",
      "Diagnostics and imaging",
      "Medication and care plans",
      "Consultation handoffs",
    ],
  },
  nurse: {
    key: "nurse",
    label: "Nurse",
    description: "Procedure preparation, patient flow, and follow-up coordination.",
    primaryFocus: "Procedure preparation, patient flow, follow-ups.",
    defaultDashboardWidgets: [
      "operational_workspace",
      "my_workspace",
      "procedure_day_queue",
      "follow_up_queue",
      "imaging_uploads",
      "quick_actions",
    ],
    defaultQuickActions: ["booking", "patient", "upload_images", "case"],
    preferredNavFeatures: ["procedure_day", "patients", "imaging", "calendar"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: [
      "Procedure preparation",
      "Follow-ups",
      "Imaging uploads",
      "Patient flow",
    ],
  },
  consultant: {
    key: "consultant",
    label: "Consultant",
    description: "Leads, consultations, quotes, and bookings.",
    primaryFocus: "Leads, consults, quotes, bookings.",
    defaultDashboardWidgets: [
      "my_workspace",
      "crm_pipeline",
      "consultation_queue",
      "operational_workspace",
      "attention_centre",
      "quick_actions",
    ],
    defaultQuickActions: ["lead", "consultation", "booking", "patient"],
    preferredNavFeatures: ["crm", "consultations", "calendar", "patients"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: [
      "Leads to call",
      "Consultations to complete",
      "Quotes to prepare",
      "Bookings to confirm",
    ],
  },
  reception: {
    key: "reception",
    label: "Reception",
    description: "Front desk, calendar, arrivals, and light CRM triage.",
    primaryFocus: "Bookings, front desk, calendar, patient flow.",
    defaultDashboardWidgets: [
      "operational_workspace",
      "booking_queue",
      "my_workspace",
      "attention_centre",
      "quick_actions",
    ],
    defaultQuickActions: ["booking", "patient", "lead"],
    preferredNavFeatures: ["calendar", "patients", "crm"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: [
      "Today’s bookings",
      "Patient arrivals",
      "Call-ins",
      "Unassigned leads",
    ],
  },
  academy_trainer: {
    key: "academy_trainer",
    label: "Academy trainer",
    description: "Training delivery, academy content, and learner follow-ups.",
    primaryFocus: "Training sessions, academy progress, learner engagement.",
    defaultDashboardWidgets: ["my_workspace", "attention_centre", "operational_workspace", "quick_actions"],
    defaultQuickActions: ["patient", "booking", "consultation", "lead"],
    preferredNavFeatures: ["academy", "staff", "calendar"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: ["Session prep", "Learner follow-ups", "Content updates", "Clinic coordination"],
  },
  auditor: {
    key: "auditor",
    label: "Auditor",
    description: "Security and compliance review surfaces (visibility still obeys Stage 2 toggles).",
    primaryFocus: "Audit trails, access review, data safety signals.",
    defaultDashboardWidgets: ["audit_summary", "attention_centre", "clinic_metrics", "quick_actions", "my_workspace"],
    defaultQuickActions: ["patient", "booking", "case"],
    preferredNavFeatures: ["audit", "analytics", "staff"],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: ["Items requiring verification", "Policy exceptions", "Access anomalies", "Documentation gaps"],
  },
  platform_admin: {
    key: "platform_admin",
    label: "Platform admin",
    description: "Full-module FI OS operator layout (subject to Stage 2 when impersonating tenant staff).",
    primaryFocus: "Cross-tenant operations, configuration, and support readiness.",
    defaultDashboardWidgets: [
      "quick_actions",
      "clinic_metrics",
      "operational_workspace",
      "surgery_pipeline",
      "my_workspace",
      "attention_centre",
      "analytics_summary",
      "audit_summary",
    ],
    defaultQuickActions: ["booking", "patient", "lead", "case", "consultation", "upload_images"],
    preferredNavFeatures: [],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: ["Operator escalations", "Tenant support tasks", "Configuration follow-ups", "Cross-clinic checks"],
  },
  default: {
    key: "default",
    label: "Default",
    description: "Standard FI OS home stack (Stage 1 / 2 ordering).",
    primaryFocus: "Balanced clinic operating view.",
    defaultDashboardWidgets: [
      "quick_actions",
      "clinic_metrics",
      "operational_workspace",
      "surgery_pipeline",
      "my_workspace",
      "attention_centre",
    ],
    defaultQuickActions: ["booking", "patient", "lead", "consultation", "case", "upload_images"],
    preferredNavFeatures: [],
    hiddenByDefaultFeatures: [],
    allowedFeatureOverrides: true,
    priorityTaskTypes: ["Assigned CRM tasks", "Owned reminders", "Personal follow-ups", "Delegated work"],
  },
};

export function assertFiWorkspaceProfilesComplete(): void {
  for (const k of FI_WORKSPACE_PROFILE_KEYS) {
    if (!FI_WORKSPACE_PROFILES[k]) throw new Error(`Missing workspace profile: ${k}`);
  }
}

export function getWorkspaceProfileLabel(key: FiWorkspaceProfileKey): string {
  return FI_WORKSPACE_PROFILES[key]?.label ?? FI_WORKSPACE_PROFILES.default.label;
}
