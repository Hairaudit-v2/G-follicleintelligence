import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  createGoogleCalendarSyncAlertIfNeeded,
  type GoogleCalendarSyncAlertEventType,
} from "./googleCalendarSyncAlerts.server";
import {
  computeRollingAverageDurationMs,
  deriveGoogleCalendarSyncHealth,
  GOOGLE_CALENDAR_SYNC_AUTO_PAUSE_FAILURE_THRESHOLD,
  GOOGLE_CALENDAR_SYNC_RUN_RETENTION_PER_TENANT,
  GOOGLE_CALENDAR_SYNC_REVIEW_QUEUE_ALERT_THRESHOLD,
  GOOGLE_CALENDAR_SYNC_STALE_HOURS,
  isTokenInvalidSyncError,
  resolveSyncRunStatus,
  shouldAutoPauseScheduledSync,
  type FiCalendarSyncHealthStatus,
  type FiCalendarSyncRunStatus,
} from "./googleCalendarSyncHealthCore";
import type { GoogleCalendarSyncResult } from "./googleCalendarTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type FiCalendarSyncHealthRow = {
  id: string;
  tenant_id: string;
  integration_id: string;
  provider: string;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  last_successful_sync_at: string | null;
  consecutive_failures: number;
  total_sync_runs: number;
  total_events_fetched: number;
  total_events_inserted: number;
  total_events_updated: number;
  total_events_skipped: number;
  total_review_items_created: number;
  average_sync_duration_ms: number | null;
  health_score: number;
  health_status: FiCalendarSyncHealthStatus;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiCalendarSyncRunRow = {
  id: string;
  tenant_id: string;
  integration_id: string;
  provider: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  calendars_scanned: number;
  events_fetched: number;
  events_inserted: number;
  events_updated: number;
  events_skipped: number;
  conflicts_detected: number;
  review_items_created: number;
  failed_calendars: number;
  status: FiCalendarSyncRunStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

export type GoogleCalendarSyncRunMetrics = {
  calendarsScanned: number;
  eventsFetched: number;
  eventsInserted: number;
  eventsUpdated: number;
  eventsSkipped: number;
  conflictsDetected: number;
  reviewItemsCreated: number;
  failedCalendars: number;
};

function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, "[redacted]")
    .replace(/access_token[=:]\S+/gi, "access_token=[redacted]")
    .replace(/refresh_token[=:]\S+/gi, "refresh_token=[redacted]")
    .slice(0, 500);
}

function mapSyncResultMetrics(
  result: GoogleCalendarSyncResult | undefined
): GoogleCalendarSyncRunMetrics {
  const review = result?.reviewSummary;
  return {
    calendarsScanned: result?.calendarsScanned ?? result?.perCalendar?.length ?? 0,
    eventsFetched: result?.eventsFetchedTotal ?? result?.discovered ?? 0,
    eventsInserted: result?.eventsInsertedTotal ?? result?.created ?? 0,
    eventsUpdated: result?.eventsUpdatedTotal ?? result?.updated ?? 0,
    eventsSkipped: result?.eventsSkippedTotal ?? result?.skipped ?? 0,
    conflictsDetected: review?.conflictsDetected ?? 0,
    reviewItemsCreated: review?.reviewItemsCreated ?? 0,
    failedCalendars: result?.failedCalendars?.length ?? 0,
  };
}

async function loadOrCreateHealthRow(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string
): Promise<FiCalendarSyncHealthRow> {
  const { data: existing, error: loadError } = await supabase
    .from("fi_calendar_sync_health")
    .select("*")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (existing) return existing as FiCalendarSyncHealthRow;

  const now = new Date().toISOString();
  const insertRow = {
    id: randomUUID(),
    tenant_id: tenantId,
    integration_id: integrationId,
    provider: "google",
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("fi_calendar_sync_health")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as FiCalendarSyncHealthRow;
}

async function loadIntegrationSchedulerFlags(
  supabase: SupabaseClient,
  integrationId: string
): Promise<{
  scheduledSyncPausedAt: string | null;
  scheduledSyncPausedReason: string | null;
  status: string;
}> {
  const { data, error } = await supabase
    .from("fi_calendar_integrations")
    .select("scheduled_sync_paused_at, scheduled_sync_paused_reason, status")
    .eq("id", integrationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return {
    scheduledSyncPausedAt: (data?.scheduled_sync_paused_at as string | null) ?? null,
    scheduledSyncPausedReason: (data?.scheduled_sync_paused_reason as string | null) ?? null,
    status: String(data?.status ?? "active"),
  };
}

async function countOpenReviewItems(
  supabase: SupabaseClient,
  tenantId: string,
  integrationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("fi_calendar_sync_review_items")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .eq("status", "open");

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function trimSyncRunHistory(supabase: SupabaseClient, tenantId: string): Promise<void> {
  const { data, error } = await supabase
    .from("fi_calendar_sync_runs")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .range(
      GOOGLE_CALENDAR_SYNC_RUN_RETENTION_PER_TENANT,
      GOOGLE_CALENDAR_SYNC_RUN_RETENTION_PER_TENANT + 49
    );

  if (error) throw new Error(error.message);
  const staleIds = (data ?? []).map((row) => String(row.id));
  if (staleIds.length === 0) return;

  const { error: deleteError } = await supabase
    .from("fi_calendar_sync_runs")
    .delete()
    .in("id", staleIds);
  if (deleteError) throw new Error(deleteError.message);
}

/** Begin a sync run record when sync starts. */
export async function beginGoogleCalendarSyncRun(
  input: {
    tenantId: string;
    integrationId: string;
    source: "scheduled" | "manual" | "cron" | "webhook";
  },
  opts: ServerOpts = {}
): Promise<{ runId: string; startedAt: string }> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const startedAt = new Date().toISOString();
  const runId = randomUUID();

  const { error } = await supabase.from("fi_calendar_sync_runs").insert({
    id: runId,
    tenant_id: input.tenantId.trim(),
    integration_id: input.integrationId,
    provider: "google",
    started_at: startedAt,
    status: "running",
    metadata: { source: input.source },
  });

  if (error) throw new Error(error.message);

  const health = await loadOrCreateHealthRow(supabase, input.tenantId, input.integrationId);
  const { error: healthError } = await supabase
    .from("fi_calendar_sync_health")
    .update({
      last_sync_started_at: startedAt,
      updated_at: startedAt,
    })
    .eq("id", health.id);

  if (healthError) throw new Error(healthError.message);

  return { runId, startedAt };
}

export type UpdateGoogleCalendarSyncHealthInput = {
  tenantId: string;
  integrationId: string;
  runId: string;
  startedAt: string;
  ok: boolean;
  error?: string | null;
  skipped?: boolean;
  result?: GoogleCalendarSyncResult;
};

/** Update health metrics, complete sync run, and evaluate alerts after each sync. */
export async function updateGoogleCalendarSyncHealth(
  input: UpdateGoogleCalendarSyncHealthInput,
  opts: ServerOpts = {}
): Promise<FiCalendarSyncHealthRow> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const completedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.parse(completedAt) - Date.parse(input.startedAt));
  const metrics = mapSyncResultMetrics(input.result);
  const sanitizedError = input.error ? sanitizeError(input.error) : null;

  const health = await loadOrCreateHealthRow(supabase, input.tenantId, input.integrationId);
  const scheduler = await loadIntegrationSchedulerFlags(supabase, input.integrationId);
  const previousStatus = health.health_status;

  const consecutiveFailures = input.ok
    ? 0
    : input.skipped
      ? health.consecutive_failures
      : health.consecutive_failures + 1;

  const totalRuns = health.total_sync_runs + (input.skipped ? 0 : 1);
  const averageDuration = input.skipped
    ? health.average_sync_duration_ms
    : computeRollingAverageDurationMs(
        health.average_sync_duration_ms,
        health.total_sync_runs,
        durationMs
      );

  const tokenInvalid = isTokenInvalidSyncError(sanitizedError) || scheduler.status === "expired";
  const autoPaused =
    Boolean(scheduler.scheduledSyncPausedAt) &&
    (scheduler.scheduledSyncPausedReason?.includes("consecutive_failures") ?? false);
  const manuallyPaused = Boolean(scheduler.scheduledSyncPausedAt) && !autoPaused;

  const derived = deriveGoogleCalendarSyncHealth({
    consecutiveFailures,
    lastSuccessfulSyncAt: input.ok ? completedAt : health.last_successful_sync_at,
    lastError: input.ok ? null : sanitizedError,
    tokenInvalid,
    manuallyPaused,
    autoPaused,
  });

  let healthStatus = derived.healthStatus;
  if (shouldAutoPauseScheduledSync(consecutiveFailures) && !manuallyPaused) {
    healthStatus = "failing";
    await supabase
      .from("fi_calendar_integrations")
      .update({
        scheduled_sync_paused_at: completedAt,
        scheduled_sync_paused_reason: `Auto-paused after ${GOOGLE_CALENDAR_SYNC_AUTO_PAUSE_FAILURE_THRESHOLD} consecutive failures.`,
        updated_at: completedAt,
      })
      .eq("id", input.integrationId)
      .eq("tenant_id", input.tenantId);
  }

  const runStatus: FiCalendarSyncRunStatus = input.skipped
    ? "skipped"
    : resolveSyncRunStatus({
        ok: input.ok,
        failedCalendars: metrics.failedCalendars,
        calendarsScanned: metrics.calendarsScanned,
      });

  const healthPatch = {
    last_sync_completed_at: completedAt,
    last_successful_sync_at: input.ok ? completedAt : health.last_successful_sync_at,
    consecutive_failures: consecutiveFailures,
    total_sync_runs: totalRuns,
    total_events_fetched: health.total_events_fetched + (input.skipped ? 0 : metrics.eventsFetched),
    total_events_inserted:
      health.total_events_inserted + (input.skipped ? 0 : metrics.eventsInserted),
    total_events_updated: health.total_events_updated + (input.skipped ? 0 : metrics.eventsUpdated),
    total_events_skipped: health.total_events_skipped + (input.skipped ? 0 : metrics.eventsSkipped),
    total_review_items_created:
      health.total_review_items_created + (input.skipped ? 0 : metrics.reviewItemsCreated),
    average_sync_duration_ms: averageDuration,
    health_score: derived.healthScore,
    health_status: healthStatus,
    last_error: input.ok ? null : sanitizedError,
    updated_at: completedAt,
  };

  const { data: updatedHealth, error: healthError } = await supabase
    .from("fi_calendar_sync_health")
    .update(healthPatch)
    .eq("id", health.id)
    .select("*")
    .single();

  if (healthError) throw new Error(healthError.message);

  const { error: runError } = await supabase
    .from("fi_calendar_sync_runs")
    .update({
      completed_at: completedAt,
      duration_ms: input.skipped ? null : durationMs,
      calendars_scanned: metrics.calendarsScanned,
      events_fetched: metrics.eventsFetched,
      events_inserted: metrics.eventsInserted,
      events_updated: metrics.eventsUpdated,
      events_skipped: metrics.eventsSkipped,
      conflicts_detected: metrics.conflictsDetected,
      review_items_created: metrics.reviewItemsCreated,
      failed_calendars: metrics.failedCalendars,
      status: runStatus,
      error_message: sanitizedError,
    })
    .eq("id", input.runId);

  if (runError) throw new Error(runError.message);

  if (!input.skipped) {
    await trimSyncRunHistory(supabase, input.tenantId);
  }

  const openReviewCount = await countOpenReviewItems(supabase, input.tenantId, input.integrationId);

  const alertChecks: Array<{
    eventType: GoogleCalendarSyncAlertEventType;
    shouldFire: boolean;
    title: string;
    message: string;
    severity: "info" | "warning" | "high";
    idempotencyKey: string;
  }> = [
    {
      eventType: "google_calendar_sync_failed",
      shouldFire: !input.ok && !input.skipped,
      title: "Google Calendar sync failed",
      message: sanitizedError ?? "Scheduled sync failed.",
      severity: "high",
      idempotencyKey: `gcal-sync-failed:${input.integrationId}:${input.runId}`,
    },
    {
      eventType: "google_calendar_sync_paused",
      shouldFire: shouldAutoPauseScheduledSync(consecutiveFailures),
      title: "Scheduled Google Calendar sync paused",
      message: `Sync paused after ${consecutiveFailures} consecutive failures.`,
      severity: "high",
      idempotencyKey: `gcal-sync-paused:${input.integrationId}:${consecutiveFailures}`,
    },
    {
      eventType: "google_calendar_sync_alert_created",
      shouldFire:
        !input.ok &&
        !input.skipped &&
        Boolean(
          sanitizedError?.toLowerCase().includes("(429)") || sanitizedError?.includes("quota")
        ),
      title: "Google Calendar API quota exceeded",
      message: sanitizedError ?? "Google API rate limit or quota exceeded.",
      severity: "warning",
      idempotencyKey: `gcal-quota:${input.integrationId}:${completedAt.slice(0, 13)}`,
    },
    {
      eventType: "google_calendar_sync_alert_created",
      shouldFire: tokenInvalid,
      title: "Google Calendar OAuth token invalid",
      message: sanitizedError ?? "Reconnect Google Calendar to restore sync.",
      severity: "high",
      idempotencyKey: `gcal-token-invalid:${input.integrationId}`,
    },
    {
      eventType: "google_calendar_sync_alert_created",
      shouldFire: openReviewCount > GOOGLE_CALENDAR_SYNC_REVIEW_QUEUE_ALERT_THRESHOLD,
      title: "Google Calendar review queue backlog",
      message: `${openReviewCount} open review items require attention.`,
      severity: "warning",
      idempotencyKey: `gcal-review-backlog:${input.integrationId}:${openReviewCount}`,
    },
  ];

  if (!input.ok && !input.skipped && health.last_successful_sync_at) {
    const staleMs = Date.parse(completedAt) - Date.parse(health.last_successful_sync_at);
    if (staleMs >= GOOGLE_CALENDAR_SYNC_STALE_HOURS * 60 * 60 * 1000) {
      alertChecks.push({
        eventType: "google_calendar_sync_alert_created",
        shouldFire: true,
        title: "No successful Google Calendar sync in 24 hours",
        message: "Last successful sync was more than 24 hours ago.",
        severity: "warning",
        idempotencyKey: `gcal-stale:${input.integrationId}:${completedAt.slice(0, 10)}`,
      });
    }
  }

  for (const alert of alertChecks) {
    if (!alert.shouldFire) continue;
    await createGoogleCalendarSyncAlertIfNeeded(
      {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        eventType: alert.eventType,
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        idempotencyKey: alert.idempotencyKey,
      },
      opts
    );
  }

  if (previousStatus !== healthStatus) {
    logStructured("info", "google_calendar_sync_health_changed", {
      tenantId: input.tenantId,
      integrationId: input.integrationId,
      previousStatus,
      healthStatus,
      healthScore: derived.healthScore,
      consecutiveFailures,
    });

    await createGoogleCalendarSyncAlertIfNeeded(
      {
        tenantId: input.tenantId,
        integrationId: input.integrationId,
        eventType: "google_calendar_sync_health_changed",
        title: "Google Calendar sync health changed",
        message: `Health status changed from ${previousStatus} to ${healthStatus}.`,
        severity: healthStatus === "healthy" ? "info" : "warning",
        idempotencyKey: `gcal-health:${input.integrationId}:${previousStatus}->${healthStatus}:${completedAt.slice(0, 16)}`,
      },
      opts
    );
  }

  return updatedHealth as FiCalendarSyncHealthRow;
}

/** Load recent sync runs for admin monitoring (last 25). */
export async function loadGoogleCalendarSyncRunHistory(
  input: { tenantId: string; integrationId?: string; limit?: number },
  opts: ServerOpts = {}
): Promise<FiCalendarSyncRunRow[]> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const limit = Math.min(input.limit ?? 25, 25);

  let query = supabase
    .from("fi_calendar_sync_runs")
    .select("*")
    .eq("tenant_id", input.tenantId.trim());

  if (input.integrationId) {
    query = query.eq("integration_id", input.integrationId);
  }

  const { data, error } = await query.order("started_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as FiCalendarSyncRunRow[];
}

/** Load health row for an integration. */
export async function loadGoogleCalendarSyncHealthRow(
  input: { tenantId: string; integrationId: string },
  opts: ServerOpts = {}
): Promise<FiCalendarSyncHealthRow | null> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_calendar_sync_health")
    .select("*")
    .eq("tenant_id", input.tenantId.trim())
    .eq("integration_id", input.integrationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as FiCalendarSyncHealthRow | null) ?? null;
}
