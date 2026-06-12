/**
 * FI OS tenant dashboard — widget registry (Stage 1 groundwork).
 *
 * Stage 2 may filter or reorder widgets per staff member / feature flags.
 * Do not use this file for permission checks yet.
 */

export const FI_DASHBOARD_WIDGET_KEYS = [
  "quick_actions",
  "clinic_metrics",
  "operational_workspace",
  "surgery_pipeline",
  "my_workspace",
  "attention_centre",
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
} as const satisfies Record<FiDashboardWidgetKey, { title: string; description?: string }>;

/** Default home stack order — keep `FiOsControlCentreHome` in sync when changing. */
export const FI_DASHBOARD_HOME_WIDGET_ORDER: readonly FiDashboardWidgetKey[] = [
  "quick_actions",
  "clinic_metrics",
  "operational_workspace",
  "surgery_pipeline",
  "my_workspace",
  "attention_centre",
];
