/**
 * ReceptionOS Phase 7 — pilot metrics aggregation and manager scores (pure).
 */

import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionPilotFeedbackKind } from "@/src/lib/receptionOs/receptionPilotFeedbackModel";
import type { ReceptionUsageEventKind } from "@/src/lib/receptionOs/receptionUsageEventModel";

export type ReceptionPilotWidgetUsage = {
  widgetKey: string;
  viewCount: number;
};

export type ReceptionPilotFeedbackIssue = {
  feedbackKind: ReceptionPilotFeedbackKind;
  count: number;
  label: string;
};

export type ReceptionPilotMetricsSummary = {
  periodStart: string;
  periodEnd: string;
  dailyActiveUsers: number;
  tasksCreated: number;
  tasksResolved: number;
  averageTaskResolutionMinutes: number | null;
  unresolvedCriticalRisks: number;
  communicationsDrafted: number;
  communicationsSent: number;
  communicationsDryRun: number;
  closeoutsCompleted: number;
  mostUsedWidgets: ReceptionPilotWidgetUsage[];
  topFeedbackIssues: ReceptionPilotFeedbackIssue[];
};

export type ReceptionPilotManagerScores = {
  adoptionScore: number;
  workflowCompletionScore: number;
  riskClosureScore: number;
  feedbackCount: number;
  topFrictionPoints: Array<{ label: string; count: number }>;
};

export type ReceptionPilotMetricsPayload = {
  visible: boolean;
  summary: ReceptionPilotMetricsSummary | null;
  managerScores: ReceptionPilotManagerScores | null;
};

export type AggregateReceptionPilotMetricsInput = {
  periodStart: string;
  periodEnd: string;
  usageEvents: ReadonlyArray<{
    eventKind: ReceptionUsageEventKind;
    profileId: string | null;
    widgetKey: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
  feedbackRows: ReadonlyArray<{
    feedbackKind: ReceptionPilotFeedbackKind;
    createdAt: string;
  }>;
  tasksCreatedInPeriod: number;
  tasksResolvedInPeriod: number;
  avgTaskResolutionMinutes: number | null;
  unresolvedCriticalRisks: number;
  communicationsDrafted: number;
  communicationsSent: number;
  communicationsDryRun: number;
  closeoutsCompleted: number;
};

const FEEDBACK_ISSUE_LABELS: Record<ReceptionPilotFeedbackKind, string> = {
  useful: "Marked useful",
  missing_information: "Missing information",
  wrong_alert: "Wrong alert",
  workflow_friction: "Workflow friction",
};

export function receptionPilotManagerWidgetVisible(role: ReceptionOsViewerRole): boolean {
  return role === "admin" || role === "clinic_manager";
}

export function aggregateReceptionPilotMetrics(
  input: AggregateReceptionPilotMetricsInput
): ReceptionPilotMetricsSummary {
  const activeProfiles = new Set<string>();
  const widgetCounts = new Map<string, number>();
  const feedbackCounts = new Map<ReceptionPilotFeedbackKind, number>();

  for (const ev of input.usageEvents) {
    if (ev.eventKind === "dashboard_viewed" && ev.profileId) {
      activeProfiles.add(ev.profileId);
    }
    if (ev.eventKind === "widget_viewed" && ev.widgetKey) {
      widgetCounts.set(ev.widgetKey, (widgetCounts.get(ev.widgetKey) ?? 0) + 1);
    }
  }

  for (const fb of input.feedbackRows) {
    if (fb.feedbackKind === "useful") continue;
    feedbackCounts.set(fb.feedbackKind, (feedbackCounts.get(fb.feedbackKind) ?? 0) + 1);
  }

  const mostUsedWidgets = [...widgetCounts.entries()]
    .map(([widgetKey, viewCount]) => ({ widgetKey, viewCount }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 8);

  const topFeedbackIssues = [...feedbackCounts.entries()]
    .map(([feedbackKind, count]) => ({
      feedbackKind,
      count,
      label: FEEDBACK_ISSUE_LABELS[feedbackKind],
    }))
    .sort((a, b) => b.count - a.count);

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dailyActiveUsers: activeProfiles.size,
    tasksCreated: input.tasksCreatedInPeriod,
    tasksResolved: input.tasksResolvedInPeriod,
    averageTaskResolutionMinutes: input.avgTaskResolutionMinutes,
    unresolvedCriticalRisks: input.unresolvedCriticalRisks,
    communicationsDrafted: input.communicationsDrafted,
    communicationsSent: input.communicationsSent,
    communicationsDryRun: input.communicationsDryRun,
    closeoutsCompleted: input.closeoutsCompleted,
    mostUsedWidgets,
    topFeedbackIssues,
  };
}

export function buildReceptionPilotManagerScores(
  summary: ReceptionPilotMetricsSummary,
  feedbackRows: ReadonlyArray<{ feedbackKind: ReceptionPilotFeedbackKind }>
): ReceptionPilotManagerScores {
  const feedbackCount = feedbackRows.length;
  const usefulCount = feedbackRows.filter((f) => f.feedbackKind === "useful").length;

  const adoptionDenominator = Math.max(summary.dailyActiveUsers, 1);
  const dashboardViewsPerUser =
    summary.mostUsedWidgets.reduce((acc, w) => acc + w.viewCount, 0) / adoptionDenominator;
  const adoptionScore = clampScore(
    Math.round(Math.min(100, 20 + dashboardViewsPerUser * 15 + summary.dailyActiveUsers * 8))
  );

  const workflowActions = summary.tasksCreated + summary.tasksResolved + summary.closeoutsCompleted;
  const workflowCompletionScore = clampScore(
    Math.round(
      workflowActions === 0
        ? 0
        : Math.min(
            100,
            (summary.tasksResolved / Math.max(summary.tasksCreated, 1)) * 50 +
              summary.closeoutsCompleted * 25
          )
    )
  );

  const riskDenominator = summary.unresolvedCriticalRisks + summary.tasksResolved;
  const riskClosureScore = clampScore(
    Math.round(
      riskDenominator === 0
        ? 100
        : (summary.tasksResolved / riskDenominator) * 100 - summary.unresolvedCriticalRisks * 5
    )
  );

  const frictionMap = new Map<string, number>();
  for (const issue of summary.topFeedbackIssues) {
    frictionMap.set(issue.label, issue.count);
  }
  const topFrictionPoints = [...frictionMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  if (usefulCount > 0 && topFrictionPoints.length === 0) {
    topFrictionPoints.push({ label: "Positive feedback", count: usefulCount });
  }

  return {
    adoptionScore,
    workflowCompletionScore,
    riskClosureScore,
    feedbackCount,
    topFrictionPoints,
  };
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function emptyReceptionPilotMetricsPayload(visible: boolean): ReceptionPilotMetricsPayload {
  return { visible, summary: null, managerScores: null };
}
