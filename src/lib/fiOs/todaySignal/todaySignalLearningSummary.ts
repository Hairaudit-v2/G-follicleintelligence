import type { TodaySignalLearningSummary } from "@/src/lib/fiOs/todaySignal/todaySignalLearning";

export type TodaySignalLearningHealth = "quiet" | "normal" | "watch" | "attention";

export type TodaySignalLearningSummaryLoadOptions = {
  rangeDays?: number;
  criticalThresholdSeconds?: number;
  recurringThreshold?: number;
  now?: Date;
};

export type TodaySignalLearningPageModel =
  | { status: "disabled" }
  | { status: "empty"; rangeDays: number }
  | { status: "ready"; view: TodaySignalLearningSummaryView };

export type TodaySignalLearningSummaryView = {
  rangeDays: number;
  health: TodaySignalLearningHealth;
  cards: Array<{
    id: string;
    label: string;
    value: string;
    helper: string;
    tone: "neutral" | "watch" | "attention";
  }>;
  recurringSignals: Array<{
    signalType: string;
    count: number;
    helper: string;
  }>;
  slowestSignals: Array<{
    signalType: string;
    averageResolutionLabel: string;
    sampleSize: number;
  }>;
  unresolvedCriticalSignals: Array<{
    signalType: string;
    openForLabel: string;
    priorityBand: string;
  }>;
  roleResolution: Array<{
    role: string;
    averageResolutionLabel: string;
    resolvedCount: number;
  }>;
  warnings: string[];
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  arrival_intent: "Patient arrival intent",
  reception_waiting: "Reception waiting",
  reception_arriving_soon: "Arriving soon",
  reception_in_clinic: "In clinic",
  payment_blocker: "Payment blocker",
  financial_clearance: "Financial clearance",
  pathology_review: "Pathology review pending",
  pathology_review_pending: "Pathology review pending",
  surgery_readiness: "Surgery readiness blocker",
  surgery_readiness_blocker: "Surgery readiness blocker",
  stale_lead: "Stale lead",
  staff_compliance: "Staff compliance alert",
  staff_compliance_alert: "Staff compliance alert",
  consultation: "Consultation next action",
  consultation_next_action: "Consultation next action",
  task_due: "Task due",
  reminder: "Reminder",
  aggregate: "Aggregate signal",
};

const ROLE_LABELS: Record<string, string> = {
  reception: "Reception",
  consultant: "Consultant",
  doctor: "Doctor",
  surgeon: "Surgeon",
  nurse: "Nurse",
  clinic_manager: "Clinic manager",
  director: "Director",
  platform_admin: "Platform admin",
  auditor: "Auditor",
  default: "Default",
};

function humanizeToken(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Safe display label for signal types — never includes entity identifiers. */
export function safeSignalTypeLabel(signalType: string): string {
  const key = signalType.trim().toLowerCase();
  return SIGNAL_TYPE_LABELS[key] ?? humanizeToken(key);
}

export function safeRoleLabel(role: string): string {
  const key = role.trim().toLowerCase();
  return ROLE_LABELS[key] ?? humanizeToken(key);
}

export function formatSignalLearningDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return "Less than a minute";
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const days = Math.round(seconds / 86400);
  return days === 1 ? "1 day" : `${days} days`;
}

function overallAverageResolutionSeconds(summary: TodaySignalLearningSummary): number | null {
  const rows = summary.averageResolutionTimeBySignalType;
  if (rows.length === 0) return null;
  let total = 0;
  let count = 0;
  for (const row of rows) {
    total += row.avgSeconds * row.sampleCount;
    count += row.sampleCount;
  }
  if (count === 0) return null;
  return Math.round(total / count);
}

function dedupeCriticalUnresolved(
  summary: TodaySignalLearningSummary
): TodaySignalLearningSummaryView["unresolvedCriticalSignals"] {
  const byType = new Map<
    string,
    { ageSeconds: number; priorityBand: string }
  >();

  for (const row of summary.criticalSignalsUnresolvedOverThreshold) {
    const signalType = row.signalType;
    const existing = byType.get(signalType);
    if (!existing || row.ageSeconds > existing.ageSeconds) {
      byType.set(signalType, {
        ageSeconds: row.ageSeconds,
        priorityBand: row.priorityBand ?? "critical",
      });
    }
  }

  return [...byType.entries()]
    .sort((a, b) => b[1].ageSeconds - a[1].ageSeconds)
    .map(([signalType, stats]) => ({
      signalType: safeSignalTypeLabel(signalType),
      openForLabel: formatSignalLearningDuration(stats.ageSeconds),
      priorityBand: stats.priorityBand,
    }));
}

export function classifySignalLearningHealth(
  summary: TodaySignalLearningSummary,
  opts: { recurringThreshold?: number } = {}
): TodaySignalLearningHealth {
  const recurringThreshold = opts.recurringThreshold ?? 3;
  const criticalOpen = summary.criticalSignalsUnresolvedOverThreshold.length;
  const recurringTypes = summary.topRecurringSignalTypes.filter(
    (row) => row.totalOccurrences >= recurringThreshold
  ).length;
  const overExpected = summary.signalsRecurringMoreThanExpected.length;

  if (criticalOpen > 0) return "attention";
  if (overExpected > 0 || recurringTypes >= 2) return "watch";

  const avgSeconds = overallAverageResolutionSeconds(summary);
  if (avgSeconds != null && avgSeconds >= 14_400) return "watch";

  if (summary.observationCount < 5) return "quiet";
  return "normal";
}

export function buildSignalLearningWarnings(summary: TodaySignalLearningSummary): string[] {
  const warnings: string[] = [];
  const criticalCount = dedupeCriticalUnresolved(summary).length;
  if (criticalCount > 0) {
    warnings.push(
      criticalCount === 1
        ? "One critical signal type remains open longer than expected."
        : `${criticalCount} critical signal types remain open longer than expected.`
    );
  }

  const recurring = summary.signalsRecurringMoreThanExpected.length;
  if (recurring > 0) {
    warnings.push(
      recurring === 1
        ? "One signal type is recurring more often than expected."
        : `${recurring} signal types are recurring more often than expected.`
    );
  }

  return warnings;
}

export function buildSignalLearningCards(
  summary: TodaySignalLearningSummary,
  opts: { recurringThreshold?: number } = {}
): TodaySignalLearningSummaryView["cards"] {
  const recurringThreshold = opts.recurringThreshold ?? 3;
  const recurringTypeCount = summary.topRecurringSignalTypes.filter(
    (row) => row.totalOccurrences >= recurringThreshold
  ).length;

  const avgSeconds = overallAverageResolutionSeconds(summary);
  const criticalOpenCount = dedupeCriticalUnresolved(summary).length;

  const roleRows = summary.averageResolutionTimeByRole;
  const fastestRole =
    roleRows.length > 0
      ? [...roleRows].sort((a, b) => a.avgSeconds - b.avgSeconds)[0]
      : null;
  const busiestRole =
    roleRows.length > 0
      ? [...roleRows].sort((a, b) => b.sampleCount - a.sampleCount)[0]
      : null;

  const cards: TodaySignalLearningSummaryView["cards"] = [
    {
      id: "recurring-types",
      label: "Recurring signal types",
      value: String(recurringTypeCount),
      helper:
        recurringTypeCount === 0
          ? "No signal types crossed the recurrence threshold in this window."
          : `${recurringTypeCount} type${recurringTypeCount === 1 ? "" : "s"} met or exceeded ${recurringThreshold} occurrences.`,
      tone: recurringTypeCount >= 2 ? "watch" : "neutral",
    },
    {
      id: "avg-resolution",
      label: "Average resolution time",
      value: avgSeconds == null ? "—" : formatSignalLearningDuration(avgSeconds),
      helper:
        avgSeconds == null
          ? "No resolved signals in this window yet."
          : "Weighted average across resolved signal types.",
      tone:
        avgSeconds != null && avgSeconds >= 14_400
          ? "watch"
          : "neutral",
    },
    {
      id: "critical-open",
      label: "Critical signals open too long",
      value: String(criticalOpenCount),
      helper:
        criticalOpenCount === 0
          ? "No critical signal types are open beyond the threshold."
          : "Critical types still unresolved past the configured threshold.",
      tone: criticalOpenCount > 0 ? "attention" : "neutral",
    },
  ];

  if (fastestRole) {
    cards.push({
      id: "role-resolution",
      label: busiestRole && busiestRole.role !== fastestRole.role ? "Fastest resolving role" : "Resolving role",
      value: safeRoleLabel(fastestRole.role),
      helper: `Average ${formatSignalLearningDuration(fastestRole.avgSeconds)} across ${fastestRole.sampleCount} resolved signal${fastestRole.sampleCount === 1 ? "" : "s"}.${busiestRole && busiestRole.role !== fastestRole.role ? ` Busiest: ${safeRoleLabel(busiestRole.role)} (${busiestRole.sampleCount}).` : ""}`,
      tone: "neutral",
    });
  } else if (busiestRole) {
    cards.push({
      id: "role-resolution",
      label: "Busiest resolving role",
      value: safeRoleLabel(busiestRole.role),
      helper: `${busiestRole.sampleCount} resolved signal${busiestRole.sampleCount === 1 ? "" : "s"} in this window.`,
      tone: "neutral",
    });
  }

  return cards;
}

export function buildTodaySignalLearningSummaryView(
  summary: TodaySignalLearningSummary,
  opts: {
    rangeDays: number;
    recurringThreshold?: number;
  }
): TodaySignalLearningSummaryView {
  const recurringThreshold = opts.recurringThreshold ?? 3;

  return {
    rangeDays: opts.rangeDays,
    health: classifySignalLearningHealth(summary, { recurringThreshold }),
    cards: buildSignalLearningCards(summary, { recurringThreshold }),
    recurringSignals: summary.topRecurringSignalTypes.slice(0, 10).map((row) => ({
      signalType: safeSignalTypeLabel(row.signalType),
      count: row.totalOccurrences,
      helper: `${row.observationCount} observation${row.observationCount === 1 ? "" : "s"} in window`,
    })),
    slowestSignals: summary.averageResolutionTimeBySignalType.slice(0, 10).map((row) => ({
      signalType: safeSignalTypeLabel(row.signalType),
      averageResolutionLabel: formatSignalLearningDuration(row.avgSeconds),
      sampleSize: row.sampleCount,
    })),
    unresolvedCriticalSignals: dedupeCriticalUnresolved(summary),
    roleResolution: summary.averageResolutionTimeByRole.slice(0, 10).map((row) => ({
      role: safeRoleLabel(row.role),
      averageResolutionLabel: formatSignalLearningDuration(row.avgSeconds),
      resolvedCount: row.sampleCount,
    })),
    warnings: buildSignalLearningWarnings(summary),
  };
}

/** Ensures UI-safe JSON does not leak internal identifiers. */
export function assertTodaySignalLearningViewPrivacy(view: TodaySignalLearningSummaryView): void {
  const serialized = JSON.stringify(view);
  const blocked = [
    "signal_key",
    "signalKey",
    "entity_id",
    "entityId",
    "priorityReasons",
    "metadata",
    "resolvedByUserId",
    "personLabel",
    "patientName",
  ];
  for (const token of blocked) {
    if (serialized.includes(token)) {
      throw new Error(`Today signal learning view leaked blocked field: ${token}`);
    }
  }
}
