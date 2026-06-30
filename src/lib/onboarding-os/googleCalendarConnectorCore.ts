/**
 * OnboardingOS Phase F3 — Google Calendar read-only connector engine (pure; no server-only).
 * Deterministic keyword classification only — no AI.
 */

import type {
  CalendarSyncHealth,
  CalendarSyncPreview,
  ExternalCalendarEventType,
  ExternalCalendarImportStatus,
  ExternalCalendarStagingEvent,
  ExternalCalendarSyncRun,
  ExternalCalendarSyncRunStatus,
  GoogleCalendarApiEvent,
  NormalizedExternalCalendarEvent,
} from "./googleCalendarConnectorTypes";
import { isExternalCalendarEventType } from "./googleCalendarConnectorTypes";

/** Keyword rules ordered by specificity (first match wins). */
const CLASSIFICATION_RULES: readonly {
  type: ExternalCalendarEventType;
  keywords: readonly string[];
}[] = [
  { type: "exosomes", keywords: ["exosome", "exosomes"] },
  { type: "prp", keywords: ["prp", "platelet rich plasma", "platelet-rich"] },
  {
    type: "surgery",
    keywords: ["surgery", "transplant", "fue", "dhi", "hair transplant", "procedure day"],
  },
  {
    type: "follow_up",
    keywords: ["follow up", "follow-up", "followup", "post op", "post-op", "postoperative"],
  },
  {
    type: "consultation",
    keywords: ["consultation", "consult", "initial consult", "hair consult", "discovery call"],
  },
  {
    type: "review",
    keywords: ["review", "check-in", "check in", "progress review", "6 month", "12 month"],
  },
];

function normalizeSearchText(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

function parseGoogleDateTime(
  value: { dateTime?: string; date?: string } | undefined
): string | null {
  if (!value) return null;
  const raw = value.dateTime ?? value.date;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function extractAttendeeEmails(event: GoogleCalendarApiEvent): string[] {
  const emails: string[] = [];
  for (const attendee of event.attendees ?? []) {
    const email = attendee.email?.trim().toLowerCase();
    if (email && !emails.includes(email)) emails.push(email);
  }
  return emails;
}

/** Classify event type from title and description using deterministic keyword matching. */
export function classifyExternalCalendarEventType(
  title: string,
  description?: string | null
): ExternalCalendarEventType {
  const haystack = normalizeSearchText(title, description);
  if (!haystack) return "unknown";

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.type;
    }
  }
  return "unknown";
}

/** Normalize a Google Calendar API event into FI staging shape. */
export function normalizeGoogleCalendarEvent(
  event: GoogleCalendarApiEvent,
  calendarId: string
): NormalizedExternalCalendarEvent | null {
  const googleEventId = event.id?.trim();
  if (!googleEventId) return null;

  const eventTitle = (event.summary ?? "").trim() || "(Untitled event)";
  const startAt = parseGoogleDateTime(event.start);
  const endAt = parseGoogleDateTime(event.end);
  const normalizedEventType = classifyExternalCalendarEventType(eventTitle, event.description);

  return {
    googleEventId,
    calendarId: calendarId.trim(),
    eventTitle,
    startAt,
    endAt,
    attendeeEmails: extractAttendeeEmails(event),
    normalizedEventType,
    rawPayload: { ...event } as Record<string, unknown>,
  };
}

/** Detect duplicate against existing staged events (by google_event_id or title+start). */
export function detectDuplicateExternalEvent(
  candidate: NormalizedExternalCalendarEvent,
  existing: readonly Pick<
    ExternalCalendarStagingEvent,
    "googleEventId" | "eventTitle" | "startAt" | "importStatus"
  >[]
): boolean {
  for (const row of existing) {
    if (row.googleEventId === candidate.googleEventId) return true;

    if (
      row.importStatus !== "rejected" &&
      row.eventTitle.trim().toLowerCase() === candidate.eventTitle.trim().toLowerCase() &&
      row.startAt &&
      candidate.startAt &&
      row.startAt === candidate.startAt
    ) {
      return true;
    }
  }
  return false;
}

/** Build sync preview from discovered events and existing staging rows. */
export function buildCalendarSyncPreview(opts: {
  integrationId: string;
  calendarId: string;
  discoveredEvents: readonly GoogleCalendarApiEvent[];
  existingStaging: readonly Pick<
    ExternalCalendarStagingEvent,
    "googleEventId" | "eventTitle" | "startAt" | "importStatus"
  >[];
}): CalendarSyncPreview {
  const normalized: NormalizedExternalCalendarEvent[] = [];
  const warnings: string[] = [];
  let duplicateCount = 0;

  for (const raw of opts.discoveredEvents) {
    const event = normalizeGoogleCalendarEvent(raw, opts.calendarId);
    if (!event) {
      warnings.push("Skipped event without ID.");
      continue;
    }
    if (detectDuplicateExternalEvent(event, opts.existingStaging)) {
      duplicateCount += 1;
      continue;
    }
    normalized.push(event);
  }

  return {
    integrationId: opts.integrationId,
    calendarId: opts.calendarId,
    eventsDiscovered: opts.discoveredEvents.length,
    eventsToStage: normalized.length,
    duplicateCount,
    sampleEvents: normalized.slice(0, 5),
    warnings,
  };
}

/** Resolve next import status after admin review action. */
export function resolveCalendarImportStatus(
  currentStatus: ExternalCalendarImportStatus | string,
  action: "approve" | "reject"
): ExternalCalendarImportStatus | null {
  const status = String(currentStatus ?? "").trim() as ExternalCalendarImportStatus;
  if (status !== "staged" && status !== "reviewed") return null;
  return action === "approve" ? "approved" : "rejected";
}

/** Calculate sync health from recent runs and staging queue. */
export function calculateCalendarSyncHealth(opts: {
  latestSyncRun: ExternalCalendarSyncRun | null;
  recentSyncRuns: readonly ExternalCalendarSyncRun[];
  stagingEvents: readonly Pick<ExternalCalendarStagingEvent, "importStatus">[];
  authVerified: boolean;
}): CalendarSyncHealth {
  const stagedPendingReview = opts.stagingEvents.filter((e) => e.importStatus === "staged").length;
  const approvedCount = opts.stagingEvents.filter((e) => e.importStatus === "approved").length;
  const rejectedCount = opts.stagingEvents.filter((e) => e.importStatus === "rejected").length;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!opts.authVerified) {
    blockers.push("Google Calendar credentials not verified — sync unavailable.");
  }

  const lastRun = opts.latestSyncRun;
  const lastSyncAt = lastRun?.completedAt ?? lastRun?.startedAt ?? null;
  const lastSyncStatus = lastRun?.status ?? null;

  let healthScore = 0;

  if (opts.authVerified) healthScore += 30;
  if (lastRun?.status === "completed") healthScore += 40;
  else if (lastRun?.status === "partial") healthScore += 25;
  else if (lastRun?.status === "failed") healthScore += 5;

  if (lastRun && lastRun.eventsDiscovered > 0) {
    const stageRate = lastRun.eventsStaged / lastRun.eventsDiscovered;
    healthScore += Math.round(stageRate * 20);
  } else if (lastRun?.status === "completed") {
    healthScore += 15;
  }

  if (stagedPendingReview > 20) {
    warnings.push(`${stagedPendingReview} events awaiting review — clear staging queue.`);
    healthScore = Math.max(0, healthScore - 10);
  }

  const failedRecent = opts.recentSyncRuns.filter((r) => r.status === "failed").length;
  if (failedRecent >= 2) {
    warnings.push("Multiple recent sync failures — check OAuth token and calendar ID.");
    healthScore = Math.max(0, healthScore - 15);
  }

  healthScore = Math.min(100, Math.max(0, healthScore));

  let healthBand: CalendarSyncHealth["healthBand"] = "unknown";
  if (!opts.authVerified && !lastRun) healthBand = "unknown";
  else if (healthScore >= 75) healthBand = "healthy";
  else if (healthScore >= 45) healthBand = "degraded";
  else healthBand = "unhealthy";

  const summary = !opts.authVerified
    ? "Verify Google Calendar credentials before syncing."
    : lastRun?.status === "failed"
      ? "Last sync failed — review connector auth and calendar configuration."
      : stagedPendingReview > 0
        ? `${stagedPendingReview} staged event(s) pending human review — no automatic import.`
        : lastRun?.status === "completed"
          ? "Calendar sync healthy — events staged for review only."
          : "Run a manual sync to discover external calendar events.";

  return {
    healthScore,
    healthBand,
    lastSyncAt,
    lastSyncStatus,
    stagedPendingReview,
    approvedCount,
    rejectedCount,
    summary,
    blockers,
    warnings,
  };
}

/** Map raw sync run status string safely. */
export function coerceSyncRunStatus(value: string): ExternalCalendarSyncRunStatus {
  const v = value.trim();
  if (v === "completed" || v === "partial" || v === "failed" || v === "started") return v;
  return "failed";
}

/** Map raw event type string safely. */
export function coerceEventType(value: string): ExternalCalendarEventType {
  return isExternalCalendarEventType(value) ? value : "unknown";
}
