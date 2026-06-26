/**
 * CalendarOS GC-8 — pure health scoring and status transitions for scheduled sync monitoring.
 */

export const FI_CALENDAR_SYNC_HEALTH_STATUSES = [
  "healthy",
  "degraded",
  "warning",
  "failing",
  "paused",
] as const;

export type FiCalendarSyncHealthStatus = (typeof FI_CALENDAR_SYNC_HEALTH_STATUSES)[number];

export const FI_CALENDAR_SYNC_FREQUENCY_OPTIONS = [5, 15, 30, 60] as const;
export type FiCalendarSyncFrequencyMinutes = (typeof FI_CALENDAR_SYNC_FREQUENCY_OPTIONS)[number];

export const FI_CALENDAR_SYNC_RUN_STATUSES = [
  "running",
  "success",
  "partial",
  "failed",
  "skipped",
] as const;

export type FiCalendarSyncRunStatus = (typeof FI_CALENDAR_SYNC_RUN_STATUSES)[number];

export const GOOGLE_CALENDAR_SYNC_RUN_RETENTION_PER_TENANT = 500;

export const GOOGLE_CALENDAR_SYNC_STALE_HOURS = 24;

export const GOOGLE_CALENDAR_SYNC_AUTO_PAUSE_FAILURE_THRESHOLD = 5;

export const GOOGLE_CALENDAR_SYNC_REVIEW_QUEUE_ALERT_THRESHOLD = 20;

export type GoogleCalendarSyncHealthInput = {
  consecutiveFailures: number;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  tokenInvalid: boolean;
  manuallyPaused: boolean;
  autoPaused: boolean;
  nowMs?: number;
};

export type GoogleCalendarSyncHealthDerived = {
  healthScore: number;
  healthStatus: FiCalendarSyncHealthStatus;
};

function hoursSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return (nowMs - ms) / (60 * 60 * 1000);
}

/** Compute health score (0–100) and status from rolling sync metrics. */
export function deriveGoogleCalendarSyncHealth(
  input: GoogleCalendarSyncHealthInput
): GoogleCalendarSyncHealthDerived {
  const nowMs = input.nowMs ?? Date.now();

  if (input.manuallyPaused || input.autoPaused) {
    return { healthScore: Math.max(0, 100 - input.consecutiveFailures * 10), healthStatus: "paused" };
  }

  if (input.tokenInvalid) {
    return { healthScore: 30, healthStatus: "degraded" };
  }

  if (input.consecutiveFailures >= GOOGLE_CALENDAR_SYNC_AUTO_PAUSE_FAILURE_THRESHOLD) {
    return { healthScore: 0, healthStatus: "failing" };
  }

  let score = 100;
  score -= Math.min(input.consecutiveFailures * 12, 48);

  const staleHours = hoursSince(input.lastSuccessfulSyncAt, nowMs);
  if (staleHours != null && staleHours >= GOOGLE_CALENDAR_SYNC_STALE_HOURS) {
    score -= 25;
  } else if (input.lastSuccessfulSyncAt == null) {
    score -= 15;
  }

  if (input.lastError?.trim()) {
    score -= 8;
  }

  score = Math.max(0, Math.min(100, score));

  if (input.consecutiveFailures >= 3) {
    return { healthScore: score, healthStatus: "warning" };
  }

  if (staleHours != null && staleHours >= GOOGLE_CALENDAR_SYNC_STALE_HOURS) {
    return { healthScore: score, healthStatus: "warning" };
  }

  if (score >= 80 && input.consecutiveFailures === 0) {
    return { healthScore: score, healthStatus: "healthy" };
  }

  if (score < 50) {
    return { healthScore: score, healthStatus: "warning" };
  }

  return { healthScore: score, healthStatus: input.consecutiveFailures > 0 ? "warning" : "healthy" };
}

/** Whether a tenant integration is due for scheduled sync based on frequency and last start. */
export function isGoogleCalendarSyncDue(
  lastSyncStartedAt: string | null,
  frequencyMinutes: FiCalendarSyncFrequencyMinutes,
  nowMs: number = Date.now()
): boolean {
  if (!lastSyncStartedAt) return true;
  const startedMs = Date.parse(lastSyncStartedAt);
  if (Number.isNaN(startedMs)) return true;
  const elapsedMs = nowMs - startedMs;
  return elapsedMs >= frequencyMinutes * 60 * 1000;
}

export function computeRollingAverageDurationMs(
  previousAverage: number | null,
  previousRunCount: number,
  latestDurationMs: number
): number {
  if (previousRunCount <= 0 || previousAverage == null) return Math.round(latestDurationMs);
  const total = previousAverage * previousRunCount + latestDurationMs;
  return Math.round(total / (previousRunCount + 1));
}

export function computeSuccessRatePercent(successRuns: number, totalRuns: number): number {
  if (totalRuns <= 0) return 100;
  return Math.round((successRuns / totalRuns) * 1000) / 10;
}

export function formatSyncFrequencyLabel(minutes: FiCalendarSyncFrequencyMinutes): string {
  if (minutes === 60) return "Hourly";
  return `${minutes} min`;
}

export function resolveSyncRunStatus(input: {
  ok: boolean;
  failedCalendars: number;
  calendarsScanned: number;
}): FiCalendarSyncRunStatus {
  if (!input.ok) return "failed";
  if (input.calendarsScanned > 0 && input.failedCalendars > 0) return "partial";
  return "success";
}

export function shouldAutoPauseScheduledSync(consecutiveFailures: number): boolean {
  return consecutiveFailures >= GOOGLE_CALENDAR_SYNC_AUTO_PAUSE_FAILURE_THRESHOLD;
}

export function isTokenInvalidSyncError(error: string | null | undefined): boolean {
  if (!error?.trim()) return false;
  const normalized = error.trim().toLowerCase();
  return (
    normalized.includes("refresh token not available") ||
    normalized.includes("failed to refresh") ||
    normalized.includes("invalid_grant") ||
    normalized.includes("reconnect google calendar") ||
    normalized.includes("integration is disconnected") ||
    normalized.includes("expired")
  );
}
