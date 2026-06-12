/**
 * FI OS Stage 3.75 — catalogue of explainable operational signals (counts / queues).
 * No scoring, no rankings, no punitive framing. Visibility is policy metadata for UI gating.
 */

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";

export const FI_INTELLIGENCE_SIGNAL_VISIBILITY_LEVELS = ["staff_self", "manager_only", "director_only"] as const;
export type FiIntelligenceSignalVisibilityLevel = (typeof FI_INTELLIGENCE_SIGNAL_VISIBILITY_LEVELS)[number];

export const FI_INTELLIGENCE_SIGNAL_CATEGORIES = [
  "consultations",
  "crm",
  "surgery",
  "follow_up",
  "imaging",
  "training",
  "audit",
  "experience",
  "conversion",
  "productivity",
  "clinical",
] as const;
export type FiIntelligenceSignalCategory = (typeof FI_INTELLIGENCE_SIGNAL_CATEGORIES)[number];

export type FiIntelligenceSignalSeverity = "info" | "attention" | "critical";

export type FiOrganisationalIntelligenceSignalDefinition = {
  key: string;
  label: string;
  description: string;
  category: FiIntelligenceSignalCategory;
  visibility_level: FiIntelligenceSignalVisibilityLevel;
  /** Workspace personas where this signal is most relevant for recommendations (not access control). */
  related_workspace_profiles: readonly FiWorkspaceProfileKey[];
  /** When `count >= attention_min` → attention; when `count >= critical_min` → critical (if set). */
  attention_min: number;
  critical_min: number | null;
};

export const FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS = [
  "consultations_assigned",
  "consultations_completed",
  "consultations_overdue",
  "leads_assigned",
  "leads_stale",
  "follow_ups_due",
  "surgery_cases_assigned",
  "surgery_readiness_alerts",
  "post_op_pending",
  "imaging_uploads_pending",
  "training_due",
  "certification_expiring",
  "audit_reviews_pending",
  "patient_satisfaction_low",
  "conversion_attention",
  "productivity_attention",
  "clinical_readiness_attention",
] as const;

export type FiOrganisationalIntelligenceSignalKey = (typeof FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS)[number];

export function isFiOrganisationalIntelligenceSignalKey(v: string): v is FiOrganisationalIntelligenceSignalKey {
  return (FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS as readonly string[]).includes(v);
}

export const FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS: Record<
  FiOrganisationalIntelligenceSignalKey,
  FiOrganisationalIntelligenceSignalDefinition
> = {
  consultations_assigned: {
    key: "consultations_assigned",
    label: "Consultations in progress",
    description: "Consultation records linked to this clinician that are still in an in-flight status.",
    category: "consultations",
    visibility_level: "staff_self",
    related_workspace_profiles: ["consultant", "doctor", "surgeon", "clinic_manager", "director"],
    attention_min: 3,
    critical_min: 8,
  },
  consultations_completed: {
    key: "consultations_completed",
    label: "Consultations completed (period)",
    description: "Completed consultations in the measurement window (informational context only).",
    category: "consultations",
    visibility_level: "manager_only",
    related_workspace_profiles: ["consultant", "clinic_manager", "director"],
    attention_min: 1,
    critical_min: null,
  },
  consultations_overdue: {
    key: "consultations_overdue",
    label: "Consultations needing follow-up",
    description: "Consultations with a past scheduled date still awaiting completion or structured handoff.",
    category: "consultations",
    visibility_level: "manager_only",
    related_workspace_profiles: ["consultant", "clinic_manager", "director", "doctor"],
    attention_min: 1,
    critical_min: 4,
  },
  leads_assigned: {
    key: "leads_assigned",
    label: "Owned leads",
    description: "Open commercial opportunities where this user is recorded as primary owner.",
    category: "crm",
    visibility_level: "staff_self",
    related_workspace_profiles: ["consultant", "reception", "clinic_manager", "director"],
    attention_min: 8,
    critical_min: 20,
  },
  leads_stale: {
    key: "leads_stale",
    label: "Leads with ageing pipeline stages",
    description: "Leads that have remained in the same pipeline stage longer than the clinic’s stale threshold.",
    category: "crm",
    visibility_level: "manager_only",
    related_workspace_profiles: ["consultant", "clinic_manager", "director"],
    attention_min: 1,
    critical_min: 6,
  },
  follow_ups_due: {
    key: "follow_ups_due",
    label: "Follow-up tasks",
    description: "Active CRM follow-up style tasks assigned to this user with an approaching or past due time.",
    category: "follow_up",
    visibility_level: "staff_self",
    related_workspace_profiles: ["consultant", "nurse", "reception", "clinic_manager", "director"],
    attention_min: 3,
    critical_min: 10,
  },
  surgery_cases_assigned: {
    key: "surgery_cases_assigned",
    label: "Surgery cases in flight",
    description: "Cases where this staff member is a primary assignee (when wired to case assignment in a later release).",
    category: "surgery",
    visibility_level: "manager_only",
    related_workspace_profiles: ["surgeon", "doctor", "nurse", "clinic_manager", "director"],
    attention_min: 2,
    critical_min: 6,
  },
  surgery_readiness_alerts: {
    key: "surgery_readiness_alerts",
    label: "Surgery readiness items",
    description: "Cases with readiness sections that still need review or documentation (best-effort).",
    category: "surgery",
    visibility_level: "manager_only",
    related_workspace_profiles: ["surgeon", "doctor", "clinic_manager", "director"],
    attention_min: 1,
    critical_min: 5,
  },
  post_op_pending: {
    key: "post_op_pending",
    label: "Post-operative follow-ups",
    description: "Post-operative pathways that may need structured review (placeholder aggregation).",
    category: "clinical",
    visibility_level: "manager_only",
    related_workspace_profiles: ["nurse", "surgeon", "doctor", "clinic_manager", "director"],
    attention_min: 1,
    critical_min: 5,
  },
  imaging_uploads_pending: {
    key: "imaging_uploads_pending",
    label: "Imaging follow-ups",
    description: "Imaging or media workflows awaiting upload or review (when linked to this staff member).",
    category: "imaging",
    visibility_level: "staff_self",
    related_workspace_profiles: ["nurse", "doctor", "surgeon", "clinic_manager"],
    attention_min: 2,
    critical_min: 6,
  },
  training_due: {
    key: "training_due",
    label: "Training items",
    description: "Training or academy checkpoints sourced from HR metadata when available.",
    category: "training",
    visibility_level: "staff_self",
    related_workspace_profiles: ["academy_trainer", "nurse", "consultant", "clinic_manager", "director"],
    attention_min: 1,
    critical_min: 4,
  },
  certification_expiring: {
    key: "certification_expiring",
    label: "Certification windows",
    description: "Credentials or certifications approaching renewal (when HR feeds expose dates).",
    category: "training",
    visibility_level: "manager_only",
    related_workspace_profiles: ["clinic_manager", "director"],
    attention_min: 1,
    critical_min: 3,
  },
  audit_reviews_pending: {
    key: "audit_reviews_pending",
    label: "Audit review queue",
    description: "Items surfaced for governance or outcome review (best-effort linkage).",
    category: "audit",
    visibility_level: "director_only",
    related_workspace_profiles: ["auditor", "director"],
    attention_min: 1,
    critical_min: 5,
  },
  patient_satisfaction_low: {
    key: "patient_satisfaction_low",
    label: "Experience signals",
    description: "Aggregated patient experience indicators when survey or outcome feeds are connected.",
    category: "experience",
    visibility_level: "director_only",
    related_workspace_profiles: ["director", "clinic_manager", "consultant"],
    attention_min: 1,
    critical_min: 3,
  },
  conversion_attention: {
    key: "conversion_attention",
    label: "Conversion support",
    description: "Pipeline or consultation signals that suggest additional conversion support could help.",
    category: "conversion",
    visibility_level: "manager_only",
    related_workspace_profiles: ["consultant", "clinic_manager", "director"],
    attention_min: 1,
    critical_min: 4,
  },
  productivity_attention: {
    key: "productivity_attention",
    label: "Workload balance",
    description: "Composite queue depth across CRM and consultation tasks (supportive, not comparative).",
    category: "productivity",
    visibility_level: "manager_only",
    related_workspace_profiles: ["clinic_manager", "director", "consultant", "reception"],
    attention_min: 6,
    critical_min: 15,
  },
  clinical_readiness_attention: {
    key: "clinical_readiness_attention",
    label: "Clinical readiness support",
    description: "Clinical checklists or readiness sections that may benefit from a second review.",
    category: "clinical",
    visibility_level: "manager_only",
    related_workspace_profiles: ["surgeon", "doctor", "nurse", "clinic_manager", "director"],
    attention_min: 1,
    critical_min: 4,
  },
};

export function assertFiOrganisationalIntelligenceSignalsRegistryComplete(): void {
  for (const k of FI_ORGANISATIONAL_INTELLIGENCE_SIGNAL_KEYS) {
    if (!FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS[k]) {
      throw new Error(`Missing intelligence signal definition: ${k}`);
    }
  }
}
