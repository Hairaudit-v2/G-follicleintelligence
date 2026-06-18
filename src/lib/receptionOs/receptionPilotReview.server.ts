import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import { loadReceptionPilotFeedbackForPeriod } from "@/src/lib/receptionOs/receptionPilotFeedback.server";
import {
  aggregateReceptionPilotMetrics,
  buildReceptionPilotManagerScores,
} from "@/src/lib/receptionOs/receptionPilotMetricsModel";
import {
  buildReceptionOwnerValueDashboard,
  emptyReceptionOwnerValuePayload,
  receptionOwnerValueVisible,
} from "@/src/lib/receptionOs/receptionOwnerValueModel";
import {
  buildReceptionPilotReviewReport,
  emptyReceptionPilotReviewPayload,
  isDepositChaseTemplateKey,
  RECEPTION_PILOT_REVIEW_DEFAULT_PERIOD_DAYS,
  receptionPilotReviewVisible,
  type ReceptionPilotReviewPayload,
} from "@/src/lib/receptionOs/receptionPilotReviewModel";
import type { ReceptionOwnerValuePayload } from "@/src/lib/receptionOs/receptionOwnerValueModel";
import {
  isMissingDatabaseRelationError,
  missingTableMessage,
} from "@/src/lib/receptionOs/receptionOsLoaderResilience";
import type { ReceptionUsageEventKind } from "@/src/lib/receptionOs/receptionUsageEventModel";

function subtractDays(isoEnd: string, days: number): string {
  const end = Date.parse(isoEnd);
  if (!Number.isFinite(end)) return isoEnd;
  return new Date(end - days * 86_400_000).toISOString();
}

export type ReceptionPhase8Payload = {
  pilotReview: ReceptionPilotReviewPayload;
  ownerValue: ReceptionOwnerValuePayload;
};

export async function loadReceptionPhase8PayloadForCommandCentre(
  payload: ReceptionOsCommandCentrePayload,
  viewerRole: ReceptionOsViewerRole,
  periodDays: number = RECEPTION_PILOT_REVIEW_DEFAULT_PERIOD_DAYS,
): Promise<ReceptionPhase8Payload> {
  const reviewVisible = receptionPilotReviewVisible(viewerRole);
  const ownerVisible = receptionOwnerValueVisible(viewerRole);

  if (!reviewVisible && !ownerVisible) {
    return {
      pilotReview: emptyReceptionPilotReviewPayload(false),
      ownerValue: emptyReceptionOwnerValuePayload(false),
    };
  }

  const tid = assertNonEmptyUuid(payload.tenantId, "tenantId").trim();
  const periodEnd = payload.operationalDay.localEndIso;
  const periodStart = subtractDays(periodEnd, periodDays);
  const supabase = supabaseAdmin();

  const [eventsRes, tasksRes, deliveriesRes, closeoutsRes, feedbackRows] = await Promise.all([
    supabase
      .from("fi_reception_usage_events")
      .select("event_kind, profile_id, widget_key, created_at")
      .eq("tenant_id", tid)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("fi_reception_tasks")
      .select("id, status, severity, created_at, updated_at")
      .eq("tenant_id", tid)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd),
    supabase
      .from("fi_reception_communication_deliveries")
      .select("delivery_status, template_key, created_at")
      .eq("tenant_id", tid)
      .gte("created_at", periodStart)
      .lt("created_at", periodEnd),
    supabase
      .from("fi_reception_daily_closeouts")
      .select("id")
      .eq("tenant_id", tid)
      .gte("closed_at", periodStart)
      .lt("closed_at", periodEnd),
    loadReceptionPilotFeedbackForPeriod(tid, periodStart, periodEnd),
  ]);

  if (eventsRes.error) {
    if (isMissingDatabaseRelationError(eventsRes.error)) throw new Error(missingTableMessage("fi_reception_usage_events"));
    throw new Error(eventsRes.error.message);
  }
  if (tasksRes.error) {
    if (isMissingDatabaseRelationError(tasksRes.error)) throw new Error(missingTableMessage("fi_reception_tasks"));
    throw new Error(tasksRes.error.message);
  }
  if (deliveriesRes.error) {
    if (isMissingDatabaseRelationError(deliveriesRes.error)) throw new Error(missingTableMessage("fi_reception_communication_deliveries"));
    throw new Error(deliveriesRes.error.message);
  }
  if (closeoutsRes.error) {
    if (isMissingDatabaseRelationError(closeoutsRes.error)) throw new Error(missingTableMessage("fi_reception_daily_closeouts"));
    throw new Error(closeoutsRes.error.message);
  }

  const tasks = tasksRes.data ?? [];
  const resolvedStatuses = new Set(["resolved", "dismissed"]);
  const criticalSeverities = new Set(["critical", "blocked"]);

  const tasksCreatedInPeriod = tasks.length;
  const tasksResolvedInPeriod = tasks.filter((t) => resolvedStatuses.has(String((t as { status: string }).status))).length;
  const risksClosedInPeriod = tasks.filter((raw) => {
    const row = raw as { status: string; severity: string };
    return resolvedStatuses.has(row.status) && criticalSeverities.has(row.severity);
  }).length;

  const resolutionMinutes: number[] = [];
  for (const raw of tasks) {
    const row = raw as { status: string; created_at: string; updated_at: string };
    if (!resolvedStatuses.has(row.status)) continue;
    const start = Date.parse(row.created_at);
    const end = Date.parse(row.updated_at);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      resolutionMinutes.push((end - start) / 60_000);
    }
  }
  const avgTaskResolutionMinutes =
    resolutionMinutes.length > 0
      ? Math.round(resolutionMinutes.reduce((a, b) => a + b, 0) / resolutionMinutes.length)
      : null;

  const deliveries = deliveriesRes.data ?? [];
  const communicationsDrafted = deliveries.filter((d) => String((d as { delivery_status: string }).delivery_status) === "draft").length;
  const communicationsSent = deliveries.filter((d) => String((d as { delivery_status: string }).delivery_status) === "sent").length;
  const communicationsDryRun = deliveries.filter((d) => String((d as { delivery_status: string }).delivery_status) === "dry_run").length;
  const depositsChased = deliveries.filter((d) =>
    isDepositChaseTemplateKey(String((d as { template_key?: string }).template_key ?? "")),
  ).length;

  const revenueAtRiskIdentified = payload.revenueSummary.totalAtRiskRevenue;

  const usageEvents = (eventsRes.data ?? []).map((raw) => {
    const row = raw as {
      event_kind: ReceptionUsageEventKind;
      profile_id: string | null;
      widget_key: string | null;
      created_at: string;
    };
    return {
      eventKind: row.event_kind,
      profileId: row.profile_id,
      widgetKey: row.widget_key,
      createdAt: row.created_at,
      metadata: {},
    };
  });

  const report = buildReceptionPilotReviewReport({
    periodStart,
    periodEnd,
    periodDays,
    currency: payload.revenueSummary.currency,
    revenueAtRiskIdentified,
    usageEvents,
    feedbackRows: feedbackRows.map((f) => ({ feedbackKind: f.feedback_kind, createdAt: f.created_at })),
    tasksCreatedInPeriod,
    tasksResolvedInPeriod,
    risksClosedInPeriod,
    avgTaskResolutionMinutes,
    communicationsDrafted,
    communicationsSent,
    communicationsDryRun,
    depositsChased,
    closeoutsCompleted: (closeoutsRes.data ?? []).length,
  });

  const dailySummary = aggregateReceptionPilotMetrics({
    periodStart,
    periodEnd,
    usageEvents,
    feedbackRows: feedbackRows.map((f) => ({ feedbackKind: f.feedback_kind, createdAt: f.created_at })),
    tasksCreatedInPeriod,
    tasksResolvedInPeriod,
    avgTaskResolutionMinutes,
    unresolvedCriticalRisks: 0,
    communicationsDrafted,
    communicationsSent,
    communicationsDryRun,
    closeoutsCompleted: (closeoutsRes.data ?? []).length,
  });

  const managerScores = buildReceptionPilotManagerScores(
    dailySummary,
    feedbackRows.map((f) => ({ feedbackKind: f.feedback_kind })),
  );

  const conversionEventCount = usageEvents.filter(
    (ev) => ev.eventKind === "task_actioned" || ev.eventKind === "communication_dry_run_sent",
  ).length;

  const ownerDashboard = buildReceptionOwnerValueDashboard({
    report,
    managerScores,
    feedbackRows: feedbackRows.map((f) => ({ feedbackKind: f.feedback_kind })),
    conversionActionsTaken: conversionEventCount + depositsChased,
  });

  return {
    pilotReview: {
      visible: reviewVisible,
      periodDays,
      report: reviewVisible ? report : null,
    },
    ownerValue: {
      visible: ownerVisible,
      dashboard: ownerVisible ? ownerDashboard : null,
    },
  };
}
