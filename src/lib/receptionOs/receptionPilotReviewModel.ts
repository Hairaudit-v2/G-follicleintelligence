/**
 * ReceptionOS Phase 8 — pilot review report (owner-facing value summary).
 */

import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionPilotFeedbackKind } from "@/src/lib/receptionOs/receptionPilotFeedbackModel";
import type {
  ReceptionPilotFeedbackIssue,
  ReceptionPilotWidgetUsage,
} from "@/src/lib/receptionOs/receptionPilotMetricsModel";
import type { ReceptionUsageEventKind } from "@/src/lib/receptionOs/receptionUsageEventModel";

export const RECEPTION_PILOT_REVIEW_DEFAULT_PERIOD_DAYS = 14;

export type ReceptionPilotReviewReport = {
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  activeUsers: number;
  tasksCreated: number;
  tasksResolved: number;
  risksClosed: number;
  revenueAtRiskIdentified: number;
  currency: string;
  depositsChased: number;
  communicationsDrafted: number;
  communicationsSent: number;
  communicationsDryRun: number;
  closeoutsCompleted: number;
  averageResponseTimeMinutes: number | null;
  topWorkflowIssues: ReceptionPilotFeedbackIssue[];
  mostValuableWidgets: ReceptionPilotWidgetUsage[];
};

export type ReceptionPilotReviewPayload = {
  visible: boolean;
  periodDays: number;
  report: ReceptionPilotReviewReport | null;
};

export type BuildReceptionPilotReviewReportInput = {
  periodStart: string;
  periodEnd: string;
  periodDays: number;
  currency: string;
  revenueAtRiskIdentified: number;
  usageEvents: ReadonlyArray<{
    eventKind: ReceptionUsageEventKind;
    profileId: string | null;
    widgetKey: string | null;
    createdAt: string;
  }>;
  feedbackRows: ReadonlyArray<{
    feedbackKind: ReceptionPilotFeedbackKind;
    createdAt: string;
  }>;
  tasksCreatedInPeriod: number;
  tasksResolvedInPeriod: number;
  risksClosedInPeriod: number;
  avgTaskResolutionMinutes: number | null;
  communicationsDrafted: number;
  communicationsSent: number;
  communicationsDryRun: number;
  depositsChased: number;
  closeoutsCompleted: number;
};

const FEEDBACK_ISSUE_LABELS: Record<ReceptionPilotFeedbackKind, string> = {
  useful: "Marked useful",
  missing_information: "Missing information",
  wrong_alert: "Wrong alert",
  workflow_friction: "Workflow friction",
};

const DEPOSIT_CHASE_TEMPLATE_KEYS = new Set(["deposit_reminder", "payment_link_follow_up"]);

export function receptionPilotReviewVisible(role: ReceptionOsViewerRole): boolean {
  return role === "admin" || role === "clinic_manager";
}

export function isDepositChaseTemplateKey(templateKey: string | null | undefined): boolean {
  if (!templateKey) return false;
  return DEPOSIT_CHASE_TEMPLATE_KEYS.has(String(templateKey).trim());
}

export function buildReceptionPilotReviewReport(input: BuildReceptionPilotReviewReportInput): ReceptionPilotReviewReport {
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

  const mostValuableWidgets = [...widgetCounts.entries()]
    .map(([widgetKey, viewCount]) => ({ widgetKey, viewCount }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 8);

  const topWorkflowIssues = [...feedbackCounts.entries()]
    .map(([feedbackKind, count]) => ({
      feedbackKind,
      count,
      label: FEEDBACK_ISSUE_LABELS[feedbackKind],
    }))
    .sort((a, b) => b.count - a.count);

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    periodDays: input.periodDays,
    activeUsers: activeProfiles.size,
    tasksCreated: input.tasksCreatedInPeriod,
    tasksResolved: input.tasksResolvedInPeriod,
    risksClosed: input.risksClosedInPeriod,
    revenueAtRiskIdentified: Math.max(0, Math.round(input.revenueAtRiskIdentified)),
    currency: input.currency,
    depositsChased: input.depositsChased,
    communicationsDrafted: input.communicationsDrafted,
    communicationsSent: input.communicationsSent,
    communicationsDryRun: input.communicationsDryRun,
    closeoutsCompleted: input.closeoutsCompleted,
    averageResponseTimeMinutes: input.avgTaskResolutionMinutes,
    topWorkflowIssues,
    mostValuableWidgets,
  };
}

export function emptyReceptionPilotReviewPayload(visible: boolean): ReceptionPilotReviewPayload {
  return {
    visible,
    periodDays: RECEPTION_PILOT_REVIEW_DEFAULT_PERIOD_DAYS,
    report: null,
  };
}
