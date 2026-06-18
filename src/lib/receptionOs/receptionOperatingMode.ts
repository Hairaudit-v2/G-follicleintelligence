/**
 * ReceptionOS Phase 2 — daily operating modes filter widgets and task priorities.
 */

import type { ReceptionOsWidgetKey } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionTaskStatus } from "@/src/lib/receptionOs/receptionTaskPolicy";

export const RECEPTION_OS_OPERATING_MODES = ["morning_prep", "live_clinic", "end_of_day"] as const;
export type ReceptionOsOperatingMode = (typeof RECEPTION_OS_OPERATING_MODES)[number];

export const RECEPTION_OS_OPERATING_MODE_LABELS: Record<ReceptionOsOperatingMode, string> = {
  morning_prep: "Morning Prep",
  live_clinic: "Live Clinic",
  end_of_day: "End-of-Day Closeout",
};

/** Phase 2 widgets (always available in command centre). */
export const RECEPTION_OS_PHASE2_WIDGET_KEYS = ["daily_brief", "reception_tasks"] as const;
export type ReceptionOsPhase2WidgetKey = (typeof RECEPTION_OS_PHASE2_WIDGET_KEYS)[number];

const MODE_WIDGET_PRIORITY: Record<ReceptionOsOperatingMode, readonly ReceptionOsWidgetKey[]> = {
  morning_prep: ["todays_patients", "upcoming_surgery", "outstanding_deposits", "action_alerts"],
  live_clinic: ["todays_patients", "communication_timeline", "action_alerts", "consultation_pipeline"],
  end_of_day: ["action_alerts", "consultation_pipeline", "outstanding_deposits", "upcoming_surgery"],
};

const MODE_TASK_STATUSES: Record<ReceptionOsOperatingMode, readonly ReceptionTaskStatus[]> = {
  morning_prep: ["open", "snoozed"],
  live_clinic: ["open", "in_progress", "snoozed"],
  end_of_day: ["open", "in_progress", "snoozed"],
};

export function inferDefaultOperatingMode(localHour: number): ReceptionOsOperatingMode {
  if (localHour < 10) return "morning_prep";
  if (localHour >= 17) return "end_of_day";
  return "live_clinic";
}

/** Intersect persona-visible widgets with mode priority ordering. Phase 2 widgets always included. */
export function widgetsForOperatingMode(
  mode: ReceptionOsOperatingMode,
  personaWidgets: readonly ReceptionOsWidgetKey[],
): ReceptionOsWidgetKey[] {
  const allowed = new Set(personaWidgets);
  const ordered = MODE_WIDGET_PRIORITY[mode].filter((w) => allowed.has(w));
  for (const w of personaWidgets) {
    if (!ordered.includes(w)) ordered.push(w);
  }
  return ordered;
}

export function taskStatusesForOperatingMode(mode: ReceptionOsOperatingMode): readonly ReceptionTaskStatus[] {
  return MODE_TASK_STATUSES[mode];
}

export function isReceptionOsOperatingMode(v: string): v is ReceptionOsOperatingMode {
  return (RECEPTION_OS_OPERATING_MODES as readonly string[]).includes(v);
}
