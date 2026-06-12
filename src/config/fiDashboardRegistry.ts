/**
 * FI OS tenant dashboard — widget registry (Stage 1 groundwork).
 *
 * Stage 2 may filter or reorder widgets per staff member / feature flags.
 * Stage 3 adds optional profile-driven modules (including safe placeholders for future data).
 * Do not use this file for permission checks yet.
 */

export const FI_DASHBOARD_WIDGET_KEYS = [
  "quick_actions",
  "clinic_metrics",
  "operational_workspace",
  "surgery_pipeline",
  "my_workspace",
  "attention_centre",
  /** Stage 3 placeholders — thin shells until dedicated loaders exist (Stage 4+). */
  "analytics_summary",
  "audit_summary",
  "imaging_summary",
  "pathology_summary",
  "crm_pipeline",
  "consultation_queue",
  "procedure_day_queue",
  "follow_up_queue",
  "imaging_uploads",
  "booking_queue",
  /** Stage 3.75 — manager support signals (director / clinic manager profiles; placeholder until richer loaders). */
  "staff_intelligence_summary",
  /** Stage 5 — neutral clinical journey signals (no AI; no treatment advice). */
  "clinical_intelligence_summary",
  /** Stage 6 — structured outcome intelligence (tenant-safe; no cross-tenant patient data). */
  "outcome_intelligence_summary",
] as const;

export type FiDashboardWidgetKey = (typeof FI_DASHBOARD_WIDGET_KEYS)[number];

export const FI_DASHBOARD_WIDGET_LABELS = {
  quick_actions: {
    title: "Quick actions",
    description: "Compact shortcuts to common workflows.",
  },
  clinic_metrics: {
    title: "Clinic performance",
    description: "Week-to-date KPIs and pipeline signals.",
  },
  operational_workspace: {
    title: "Today’s operations",
    description: "Appointments and staff coverage for the operational day.",
  },
  surgery_pipeline: {
    title: "Surgery pipeline",
    description: "Case and readiness-oriented counts (best-effort until loader extends).",
  },
  my_workspace: {
    title: "My workspace",
    description: "Work assigned to the signed-in tenant user.",
  },
  attention_centre: {
    title: "Attention centre",
    description: "Items that need a response before the clinic day moves on.",
  },
  analytics_summary: {
    title: "Analytics summary",
    description: "Tenant analytics highlights (module wiring lands in Stage 4).",
  },
  audit_summary: {
    title: "Audit summary",
    description: "Security and compliance snapshots (deep links follow AuditOS).",
  },
  imaging_summary: {
    title: "Imaging summary",
    description: "Imaging review queue and upload signals (detailed board in Stage 4).",
  },
  pathology_summary: {
    title: "Pathology summary",
    description: "Pathology-oriented follow-ups (detailed board in Stage 4).",
  },
  crm_pipeline: {
    title: "CRM pipeline",
    description: "Lead and pipeline snapshot (opens CRM when enabled).",
  },
  consultation_queue: {
    title: "Consultation queue",
    description: "Consultation-oriented worklist (ties to ConsultationOS).",
  },
  procedure_day_queue: {
    title: "Procedure day",
    description: "Procedure-day preparation signals (board lives under SurgeryOS).",
  },
  follow_up_queue: {
    title: "Follow-up queue",
    description: "Follow-up reminders and tasks (shared with attention centre data later).",
  },
  imaging_uploads: {
    title: "Imaging uploads",
    description: "Media capture and upload follow-ups (Foundation / ImagingOS).",
  },
  booking_queue: {
    title: "Booking queue",
    description: "Scheduling and arrivals-oriented snapshot (calendar remains canonical).",
  },
  staff_intelligence_summary: {
    title: "Staff intelligence",
    description: "Operational support signals for clinic leadership (no automated permission changes).",
  },
  clinical_intelligence_summary: {
    title: "Clinical Intelligence",
    description: "Neutral patient journey and outcome support signals for clinical leadership (no automated medical advice).",
  },
  outcome_intelligence_summary: {
    title: "Outcome Intelligence",
    description:
      "Structured outcome checkpoints, imaging and audit references, and anonymisation-ready aggregates (no predictions).",
  },
} as const satisfies Record<FiDashboardWidgetKey, { title: string; description?: string }>;

/** Default home stack order — keep `FiOsControlCentreHome` / Stage 3 default profile in sync when changing. */
export const FI_DASHBOARD_HOME_WIDGET_ORDER: readonly FiDashboardWidgetKey[] = [
  "quick_actions",
  "clinic_metrics",
  "operational_workspace",
  "surgery_pipeline",
  "my_workspace",
  "attention_centre",
];
