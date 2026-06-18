import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import type { ReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import { loadReceptionPilotFeedbackForPeriod } from "@/src/lib/receptionOs/receptionPilotFeedback.server";
import {
  aggregateReceptionPilotMetrics,
  buildReceptionPilotManagerScores,
  emptyReceptionPilotMetricsPayload,
  receptionPilotManagerWidgetVisible,
  type ReceptionPilotMetricsPayload,
} from "@/src/lib/receptionOs/receptionPilotMetricsModel";
import type { ReceptionUsageEventKind } from "@/src/lib/receptionOs/receptionUsageEventModel";
import { isMissingDatabaseRelationError } from "@/src/lib/receptionOs/receptionOsLoaderResilience";

export async function loadReceptionPilotMetricsForCommandCentre(
  payload: ReceptionOsCommandCentrePayload,
  viewerRole: ReceptionOsViewerRole,
): Promise<ReceptionPilotMetricsPayload> {
  const visible = receptionPilotManagerWidgetVisible(viewerRole);
  if (!visible) return emptyReceptionPilotMetricsPayload(false);

  const tid = assertNonEmptyUuid(payload.tenantId, "tenantId").trim();
  const { localStartIso, localEndIso } = payload.operationalDay;
  const supabase = supabaseAdmin();

  const [eventsRes, tasksRes, deliveriesRes, closeoutsRes, feedbackRows] = await Promise.all([
    supabase
      .from("fi_reception_usage_events")
      .select("event_kind, profile_id, widget_key, created_at, metadata")
      .eq("tenant_id", tid)
      .gte("created_at", localStartIso)
      .lt("created_at", localEndIso)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("fi_reception_tasks")
      .select("id, status, severity, created_at, updated_at")
      .eq("tenant_id", tid)
      .gte("created_at", localStartIso)
      .lt("created_at", localEndIso),
    supabase
      .from("fi_reception_communication_deliveries")
      .select("delivery_status, created_at")
      .eq("tenant_id", tid)
      .gte("created_at", localStartIso)
      .lt("created_at", localEndIso),
    supabase
      .from("fi_reception_daily_closeouts")
      .select("id")
      .eq("tenant_id", tid)
      .gte("closed_at", localStartIso)
      .lt("closed_at", localEndIso),
    loadReceptionPilotFeedbackForPeriod(tid, localStartIso, localEndIso),
  ]);

  if (eventsRes.error) {
    if (isMissingDatabaseRelationError(eventsRes.error)) return emptyReceptionPilotMetricsPayload(true);
    throw new Error(eventsRes.error.message);
  }
  if (tasksRes.error) {
    if (isMissingDatabaseRelationError(tasksRes.error)) return emptyReceptionPilotMetricsPayload(true);
    throw new Error(tasksRes.error.message);
  }
  if (deliveriesRes.error) {
    if (isMissingDatabaseRelationError(deliveriesRes.error)) return emptyReceptionPilotMetricsPayload(true);
    throw new Error(deliveriesRes.error.message);
  }
  if (closeoutsRes.error) {
    if (isMissingDatabaseRelationError(closeoutsRes.error)) return emptyReceptionPilotMetricsPayload(true);
    throw new Error(closeoutsRes.error.message);
  }

  const tasks = tasksRes.data ?? [];
  const resolvedStatuses = new Set(["resolved", "dismissed"]);
  const tasksCreatedInPeriod = tasks.length;
  const tasksResolvedInPeriod = tasks.filter((t) => resolvedStatuses.has(String((t as { status: string }).status))).length;

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

  const unresolvedCriticalRisks =
    payload.receptionTasks.filter((t) => t.status === "open" && (t.severity === "critical" || t.severity === "blocked"))
      .length + payload.actionAlerts.filter((a) => a.severity === "critical" || a.severity === "blocked").length;

  const deliveries = deliveriesRes.data ?? [];
  const communicationsDrafted = deliveries.filter((d) => String((d as { delivery_status: string }).delivery_status) === "draft").length;
  const communicationsSent = deliveries.filter((d) => String((d as { delivery_status: string }).delivery_status) === "sent").length;
  const communicationsDryRun = deliveries.filter((d) => String((d as { delivery_status: string }).delivery_status) === "dry_run").length;

  const usageEvents = (eventsRes.data ?? []).map((raw) => {
    const row = raw as {
      event_kind: ReceptionUsageEventKind;
      profile_id: string | null;
      widget_key: string | null;
      created_at: string;
      metadata: unknown;
    };
    return {
      eventKind: row.event_kind,
      profileId: row.profile_id,
      widgetKey: row.widget_key,
      createdAt: row.created_at,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {},
    };
  });

  const summary = aggregateReceptionPilotMetrics({
    periodStart: localStartIso,
    periodEnd: localEndIso,
    usageEvents,
    feedbackRows: feedbackRows.map((f) => ({ feedbackKind: f.feedback_kind, createdAt: f.created_at })),
    tasksCreatedInPeriod,
    tasksResolvedInPeriod,
    avgTaskResolutionMinutes,
    unresolvedCriticalRisks,
    communicationsDrafted,
    communicationsSent,
    communicationsDryRun,
    closeoutsCompleted: (closeoutsRes.data ?? []).length,
  });

  const managerScores = buildReceptionPilotManagerScores(
    summary,
    feedbackRows.map((f) => ({ feedbackKind: f.feedback_kind })),
  );

  return { visible: true, summary, managerScores };
}
