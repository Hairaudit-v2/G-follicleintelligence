/**
 * CalendarOS GC-8 — Google Calendar monitoring dashboard types (client-safe).
 */

import type { FiEventBusHealthClientModel } from "@/src/lib/events/fiEventBusHealthCore";
import type {
  FiCalendarSyncFrequencyMinutes,
  FiCalendarSyncHealthStatus,
} from "./googleCalendarSyncHealthCore";

export type GoogleCalendarSyncRunClientRow = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  calendarsScanned: number;
  eventsFetched: number;
  eventsInserted: number;
  eventsUpdated: number;
  eventsSkipped: number;
  conflictsDetected: number;
  reviewItemsCreated: number;
  failedCalendars: number;
  status: string;
  errorMessage: string | null;
};

export type GoogleCalendarWebhookHealthModel = {
  realtimeSyncEnabled: boolean;
  subscriptionStatus: "active" | "expired" | "stopped" | "failed" | "none";
  subscriptionId: string | null;
  lastNotificationAt: string | null;
  expirationAt: string | null;
  failureCount: number;
  syncMode: "realtime_active" | "fallback_polling" | "expired" | "failed" | "disabled";
};

export type GoogleCalendarMonitoringPageModel = {
  tenantId: string;
  canManage: boolean;
  connected: boolean;
  integrationId: string | null;
  syncEnabled: boolean;
  scheduledSyncEnabled: boolean;
  syncFrequencyMinutes: FiCalendarSyncFrequencyMinutes;
  schedulerPaused: boolean;
  schedulerPausedReason: string | null;
  healthStatus: FiCalendarSyncHealthStatus;
  healthScore: number;
  lastSuccessfulSyncAt: string | null;
  consecutiveFailures: number;
  successRatePercent: number;
  metrics: {
    totalSyncRuns: number;
    totalEventsProcessed: number;
    totalReviewItemsCreated: number;
    failedSyncs: number;
    averageSyncDurationMs: number | null;
  };
  recentRuns: GoogleCalendarSyncRunClientRow[];
  openAlertCount: number;
  webhook: GoogleCalendarWebhookHealthModel;
  eventBus: FiEventBusHealthClientModel;
};

export function formatHealthStatusLabel(status: FiCalendarSyncHealthStatus): string {
  if (status === "healthy") return "Healthy";
  if (status === "degraded") return "Degraded";
  if (status === "warning") return "Warning";
  if (status === "failing") return "Failing";
  return "Paused";
}

export function formatRelativeTime(iso: string | null, nowMs: number = Date.now()): string {
  if (!iso) return "Never";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "Unknown";
  const diffSec = Math.round((nowMs - ms) / 1000);
  if (diffSec < 60) return `${Math.max(diffSec, 1)} sec ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 48) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleString();
}

export function syncRunRowToClient(row: {
  id: string;
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
  status: string;
  error_message: string | null;
}): GoogleCalendarSyncRunClientRow {
  return {
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    calendarsScanned: row.calendars_scanned,
    eventsFetched: row.events_fetched,
    eventsInserted: row.events_inserted,
    eventsUpdated: row.events_updated,
    eventsSkipped: row.events_skipped,
    conflictsDetected: row.conflicts_detected,
    reviewItemsCreated: row.review_items_created,
    failedCalendars: row.failed_calendars,
    status: row.status,
    errorMessage: row.error_message,
  };
}

export function formatRunStatusLabel(status: string): string {
  if (status === "success") return "Success";
  if (status === "partial") return "Partial";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  if (status === "running") return "Running";
  return status;
}

export function formatWebhookSyncModeLabel(
  mode: GoogleCalendarWebhookHealthModel["syncMode"]
): string {
  if (mode === "realtime_active") return "Real-time active";
  if (mode === "fallback_polling") return "Fallback polling";
  if (mode === "expired") return "Expired";
  if (mode === "failed") return "Failed";
  return "Disabled";
}

export function webhookSyncModeBadgeClass(
  mode: GoogleCalendarWebhookHealthModel["syncMode"]
): string {
  if (mode === "realtime_active") return "bg-emerald-500/15 text-emerald-300";
  if (mode === "fallback_polling") return "bg-sky-500/15 text-sky-300";
  if (mode === "expired" || mode === "failed") return "bg-red-500/15 text-red-300";
  return "bg-slate-500/15 text-slate-300";
}

export function formatDurationMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
