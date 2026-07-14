/**
 * Google Calendar historical backfill — pure logic (no server-only).
 * FI-GOOGLE-CALENDAR-BACKFILL-1
 */

import type { GoogleCalendarApiEvent } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";
import { classifyExternalCalendarEventType } from "@/src/lib/onboarding-os/googleCalendarConnectorCore";
import {
  addDaysToCalendarDate,
  calendarDateStringFromInstant,
  parseCalendarDateString,
  zonedMidnightUtcMs,
  zonedNextDayUtcMs,
} from "@/src/lib/calendar/calendarTimezone";
import type { GoogleCalendarSyncResult } from "@/src/lib/googleCalendar/googleCalendarTypes";

export const GOOGLE_CALENDAR_BACKFILL_DEFAULT_LOOKBACK_DAYS = 30;
export const GOOGLE_CALENDAR_BACKFILL_DEFAULT_LOOKAHEAD_DAYS = 90;

export type GoogleCalendarBackfillDateRange = {
  rangeStart: string;
  rangeEnd: string;
  timeMin: string;
  timeMax: string;
};

export type GoogleCalendarBackfillDryRunSummary = {
  sourceEventsFound: number;
  alreadyImported: number;
  toCreate: number;
  toUpdate: number;
  cancelled: number;
  ambiguousReviewRequired: number;
  failed: number;
};

export type GoogleCalendarBackfillWriteSummary = GoogleCalendarBackfillDryRunSummary & {
  createdCalendarEvents: number;
  updatedCalendarEvents: number;
  createdBookings: number;
  updatedBookings: number;
  sentToReview: number;
  skippedDuplicates: number;
};

export type GoogleCalendarBackfillDiagnostics = {
  googleCalendarBackfillLastRunAt: string | null;
  googleCalendarBackfillLastRangeStart: string | null;
  googleCalendarBackfillLastRangeEnd: string | null;
  googleCalendarBackfillImportedCount: number;
  googleCalendarBackfillReviewCount: number;
  warnings: string[];
};

export type GoogleCalendarExternalSource = "google_calendar" | "timely_via_google";

const TIMELY_VIA_GOOGLE_MARKERS = [
  "timely",
  "gettimely.com",
  "booked via timely",
  "timely appointment",
] as const;

const NON_APPOINTMENT_TITLE_PATTERNS = [
  /^out of office$/i,
  /^ooo$/i,
  /^lunch$/i,
  /^break$/i,
  /^holiday$/i,
  /^annual leave$/i,
  /^staff meeting$/i,
  /^team meeting$/i,
  /^blocked$/i,
  /^block$/i,
] as const;

/** Resolve inclusive calendar date range to UTC ISO bounds for Google Calendar API. */
export function resolveGoogleCalendarBackfillDateRange(input: {
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
  timeZone: string;
  lookbackDays?: number;
  lookaheadDays?: number;
}): GoogleCalendarBackfillDateRange | { error: string } {
  const tz = input.timeZone.trim();
  const now = input.now ?? new Date();
  const todayYmd = calendarDateStringFromInstant(now, tz);

  let rangeStart: string;
  let rangeEnd: string;

  const startTrim = input.startDate?.trim();
  const endTrim = input.endDate?.trim();

  if (startTrim || endTrim) {
    if (!startTrim || !endTrim) {
      return { error: "Both start date and end date are required for a custom range." };
    }
    const parsedStart = parseCalendarDateString(startTrim, tz);
    const parsedEnd = parseCalendarDateString(endTrim, tz);
    if (!parsedStart || !parsedEnd) {
      return { error: "Invalid date — use YYYY-MM-DD in the clinic timezone." };
    }
    if (parsedStart > parsedEnd) {
      return { error: "Start date must be on or before end date." };
    }
    rangeStart = parsedStart;
    rangeEnd = parsedEnd;
  } else {
    const lookback = input.lookbackDays ?? GOOGLE_CALENDAR_BACKFILL_DEFAULT_LOOKBACK_DAYS;
    const lookahead = input.lookaheadDays ?? GOOGLE_CALENDAR_BACKFILL_DEFAULT_LOOKAHEAD_DAYS;
    rangeStart = addDaysToCalendarDate(todayYmd, -lookback, tz);
    rangeEnd = addDaysToCalendarDate(todayYmd, lookahead, tz);
  }

  const timeMinMs = zonedMidnightUtcMs(rangeStart, tz);
  const timeMaxMs = zonedNextDayUtcMs(rangeEnd, tz);
  if (timeMinMs == null || timeMaxMs == null) {
    return { error: "Could not resolve timezone boundaries for the selected range." };
  }

  return {
    rangeStart,
    rangeEnd,
    timeMin: new Date(timeMinMs).toISOString(),
    timeMax: new Date(timeMaxMs).toISOString(),
  };
}

/** Preset: next N calendar days from today in tenant timezone (inclusive). */
export function resolveGoogleCalendarBackfillNextDaysRange(
  days: number,
  timeZone: string,
  now?: Date
): GoogleCalendarBackfillDateRange | { error: string } {
  const tz = timeZone.trim();
  const todayYmd = calendarDateStringFromInstant(now ?? new Date(), tz);
  const endYmd = addDaysToCalendarDate(todayYmd, Math.max(0, days - 1), tz);
  return resolveGoogleCalendarBackfillDateRange({
    startDate: todayYmd,
    endDate: endYmd,
    timeZone: tz,
    now,
  });
}

export function detectGoogleCalendarExternalSource(
  event: GoogleCalendarApiEvent
): GoogleCalendarExternalSource {
  const haystack = [
    event.description,
    event.location,
    event.creator?.email,
    event.organizer?.email,
    (event as { source?: { title?: string } }).source?.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (TIMELY_VIA_GOOGLE_MARKERS.some((m) => haystack.includes(m))) {
    return "timely_via_google";
  }
  return "google_calendar";
}

export function isTimedGoogleCalendarEvent(event: GoogleCalendarApiEvent): boolean {
  return Boolean(event.start?.dateTime?.trim());
}

export function looksLikeGoogleCalendarAppointment(event: GoogleCalendarApiEvent): boolean {
  if (
    String(event.status ?? "")
      .trim()
      .toLowerCase() === "cancelled"
  )
    return false;
  if (!isTimedGoogleCalendarEvent(event)) return false;

  const title = (event.summary ?? "").trim();
  if (!title || title === "(Untitled event)") return false;
  if (NON_APPOINTMENT_TITLE_PATTERNS.some((re) => re.test(title))) return false;

  const eventType = classifyExternalCalendarEventType(title, event.description);
  if (eventType !== "unknown") return true;

  // Timely-style patient-name titles (e.g. "Aaron Diehl") — at least two word tokens.
  const tokens = title.split(/\s+/).filter(Boolean);
  return tokens.length >= 1 && tokens.length <= 5;
}

export type GoogleCalendarPatientNameMatch = {
  status: "matched" | "none" | "ambiguous";
  patientId: string | null;
  personId: string | null;
  leadId: string | null;
};

/** Conservative title match against known display names — never creates records. */
export function matchPatientByEventTitle(
  title: string,
  candidates: ReadonlyArray<{
    patientId: string;
    personId: string;
    displayName: string;
    leadId?: string | null;
  }>
): GoogleCalendarPatientNameMatch {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) {
    return { status: "none", patientId: null, personId: null, leadId: null };
  }

  const exact = candidates.filter((c) => c.displayName.trim().toLowerCase() === normalizedTitle);
  if (exact.length === 1) {
    return {
      status: "matched",
      patientId: exact[0]!.patientId,
      personId: exact[0]!.personId,
      leadId: exact[0]!.leadId ?? null,
    };
  }
  if (exact.length > 1) {
    return { status: "ambiguous", patientId: null, personId: null, leadId: null };
  }

  return { status: "none", patientId: null, personId: null, leadId: null };
}

export function mapGoogleEventTypeToBookingType(eventType: string | null | undefined): string {
  const t = String(eventType ?? "").trim();
  const allowed = new Set([
    "consultation",
    "hair_transplant_consultation",
    "trichology",
    "beard_transplant_consultation",
    "eyebrow_transplant_consultation",
    "prp",
    "prf",
    "mesotherapy",
    "exosomes",
    "surgery",
    "review",
    "follow_up",
    "other",
  ]);
  if (allowed.has(t)) return t;
  if (t === "unknown" || !t) return "consultation";
  return "other";
}

export function buildGoogleCalendarBookingMetadata(input: {
  externalEventId: string;
  sourceCalendarId: string;
  externalSource: GoogleCalendarExternalSource;
  integrationId: string;
  existingMetadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const base =
    input.existingMetadata &&
    typeof input.existingMetadata === "object" &&
    !Array.isArray(input.existingMetadata)
      ? { ...input.existingMetadata }
      : {};

  return {
    ...base,
    source: "google_calendar",
    external_source: input.externalSource,
    external_event_id: input.externalEventId,
    source_calendar_id: input.sourceCalendarId,
    google_calendar_integration_id: input.integrationId,
    google_calendar_backfill: true,
  };
}

export function bookingsOverlapByTitleAndStart(
  title: string,
  startAtIso: string,
  bookings: ReadonlyArray<{ id: string; title: string | null; start_at: string }>
): string | null {
  const normalizedTitle = title.trim().toLowerCase();
  const startMs = Date.parse(startAtIso);
  if (!normalizedTitle || Number.isNaN(startMs)) return null;

  const matches = bookings.filter((b) => {
    const bTitle = (b.title ?? "").trim().toLowerCase();
    if (bTitle !== normalizedTitle) return false;
    const bStart = Date.parse(b.start_at);
    return !Number.isNaN(bStart) && bStart === startMs;
  });

  if (matches.length === 1) return matches[0]!.id;
  return null;
}

export function buildDryRunSummaryFromSyncResult(
  result: GoogleCalendarSyncResult,
  failedCalendarCount: number
): GoogleCalendarBackfillDryRunSummary {
  const skip = result.skipBreakdown;
  const review = result.reviewSummary;
  return {
    sourceEventsFound: result.eventsFetchedTotal ?? result.discovered ?? 0,
    alreadyImported: skip?.noUpdateNeeded ?? 0,
    toCreate: result.eventsInsertedTotal ?? result.created ?? 0,
    toUpdate: result.eventsUpdatedTotal ?? result.updated ?? 0,
    cancelled: (result.deleted ?? 0) + (skip?.cancelledNoLocal ?? 0),
    ambiguousReviewRequired:
      (review?.conflictsDetected ?? 0) +
      (skip?.duplicateTitleStart ?? 0) +
      (skip?.uniqueViolation ?? 0),
    failed: failedCalendarCount,
  };
}

export function buildWriteSummaryFromSyncAndBookings(
  dryRun: GoogleCalendarBackfillDryRunSummary,
  bookingCounts: {
    createdBookings: number;
    updatedBookings: number;
    sentToReview: number;
    skippedDuplicates: number;
  }
): GoogleCalendarBackfillWriteSummary {
  return {
    ...dryRun,
    createdCalendarEvents: dryRun.toCreate,
    updatedCalendarEvents: dryRun.toUpdate,
    createdBookings: bookingCounts.createdBookings,
    updatedBookings: bookingCounts.updatedBookings,
    sentToReview: bookingCounts.sentToReview,
    skippedDuplicates: bookingCounts.skippedDuplicates,
  };
}

export function parseGoogleCalendarBackfillDiagnostics(
  metadata: Record<string, unknown> | null | undefined
): GoogleCalendarBackfillDiagnostics {
  const raw =
    metadata?.google_calendar_backfill &&
    typeof metadata.google_calendar_backfill === "object" &&
    !Array.isArray(metadata.google_calendar_backfill)
      ? (metadata.google_calendar_backfill as Record<string, unknown>)
      : {};

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w): w is string => typeof w === "string")
    : [];

  return {
    googleCalendarBackfillLastRunAt: typeof raw.last_run_at === "string" ? raw.last_run_at : null,
    googleCalendarBackfillLastRangeStart:
      typeof raw.last_range_start === "string" ? raw.last_range_start : null,
    googleCalendarBackfillLastRangeEnd:
      typeof raw.last_range_end === "string" ? raw.last_range_end : null,
    googleCalendarBackfillImportedCount:
      typeof raw.imported_count === "number" ? raw.imported_count : 0,
    googleCalendarBackfillReviewCount: typeof raw.review_count === "number" ? raw.review_count : 0,
    warnings,
  };
}

export function buildGoogleCalendarBackfillDiagnosticsPatch(input: {
  rangeStart: string;
  rangeEnd: string;
  importedCount: number;
  reviewCount: number;
  warnings: string[];
  now?: Date;
}): Record<string, unknown> {
  const now = (input.now ?? new Date()).toISOString();
  return {
    google_calendar_backfill: {
      last_run_at: now,
      last_range_start: input.rangeStart,
      last_range_end: input.rangeEnd,
      imported_count: input.importedCount,
      review_count: input.reviewCount,
      warnings: input.warnings,
    },
  };
}
