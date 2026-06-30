/**
 * CalendarOS GC-7 — Google Calendar inbound sync review queue pure logic (no server-only).
 */

import type { GoogleCalendarApiEvent } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

import {
  diagnoseGoogleApiEventMapping,
  isFiCreatedCalendarSource,
  isGoogleEventCancelled,
  mapGoogleApiEventToFiFields,
} from "./googleCalendarCore";
import type { FiCalendarEvent } from "./googleCalendarTypes";

export const GOOGLE_CALENDAR_SYNC_CONFLICT_TYPES = [
  "possible_duplicate",
  "time_overlap",
  "missing_required_fields",
  "unsupported_event_type",
  "cancelled_unmatched",
  "update_conflict",
  "permission_or_scope_warning",
] as const;
export type GoogleCalendarSyncConflictType = (typeof GOOGLE_CALENDAR_SYNC_CONFLICT_TYPES)[number];

export const GOOGLE_CALENDAR_SYNC_REVIEW_STATUSES = [
  "open",
  "ignored",
  "linked",
  "imported",
  "dismissed",
  "failed",
] as const;
export type GoogleCalendarSyncReviewStatus = (typeof GOOGLE_CALENDAR_SYNC_REVIEW_STATUSES)[number];

export const GOOGLE_CALENDAR_SYNC_REVIEW_SEVERITIES = ["review", "warning", "block"] as const;
export type GoogleCalendarSyncReviewSeverity =
  (typeof GOOGLE_CALENDAR_SYNC_REVIEW_SEVERITIES)[number];

/** Default overlap buffer when comparing Google events to local FI appointments (minutes). */
export const GOOGLE_CALENDAR_SYNC_OVERLAP_THRESHOLD_MINUTES = 0;

export type GoogleCalendarSyncConflictDetection = {
  conflictType: GoogleCalendarSyncConflictType;
  conflictReason: string;
  severity: GoogleCalendarSyncReviewSeverity;
  matchedLocalEventId: string | null;
  matchedLocalEventType: string | null;
  mappedFields: ReturnType<typeof mapGoogleApiEventToFiFields>;
};

export type DetectGoogleCalendarSyncConflictInput = {
  googleEvent: GoogleCalendarApiEvent;
  calendarId: string;
  calendarSummary?: string | null;
  accessRole?: string | null;
  existingByExternalId?: FiCalendarEvent | null;
  localEvents: ReadonlyArray<FiCalendarEvent>;
  overlapThresholdMinutes?: number;
};

type LocalEventCandidate = Pick<
  FiCalendarEvent,
  "id" | "externalEventId" | "title" | "startTime" | "endTime" | "eventType" | "metadata"
>;

function isActiveLocalEvent(row: LocalEventCandidate): boolean {
  return !row.metadata?.deleted_from_provider && !row.metadata?.deleted_locally;
}

function hasSafeTitle(summary: string | null | undefined): boolean {
  const trimmed = (summary ?? "").trim();
  return trimmed.length > 0;
}

function isUnsupportedGoogleEventShape(event: GoogleCalendarApiEvent): boolean {
  const recurrence = (event as GoogleCalendarApiEvent & { recurrence?: unknown }).recurrence;
  if (Array.isArray(recurrence) && recurrence.length > 0) {
    const hasStart = Boolean(event.start?.dateTime ?? event.start?.date);
    if (!hasStart) return true;
  }
  return false;
}

function parseTimeMs(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function eventsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
  thresholdMinutes: number
): boolean {
  const aStartMs = parseTimeMs(aStart);
  const aEndMs = parseTimeMs(aEnd);
  const bStartMs = parseTimeMs(bStart);
  const bEndMs = parseTimeMs(bEnd);
  if (aStartMs == null || aEndMs == null || bStartMs == null || bEndMs == null) return false;

  const thresholdMs = thresholdMinutes * 60_000;
  const aStartAdj = aStartMs - thresholdMs;
  const aEndAdj = aEndMs + thresholdMs;
  const bStartAdj = bStartMs - thresholdMs;
  const bEndAdj = bEndMs + thresholdMs;
  return aStartAdj < bEndAdj && bStartAdj < aEndAdj;
}

function findTitleStartDuplicateMatch(
  candidate: Pick<FiCalendarEvent, "externalEventId" | "title" | "startTime">,
  localEvents: ReadonlyArray<LocalEventCandidate>
): LocalEventCandidate | null {
  for (const row of localEvents) {
    if (!isActiveLocalEvent(row)) continue;
    if (
      candidate.externalEventId &&
      row.externalEventId &&
      row.externalEventId === candidate.externalEventId
    ) {
      continue;
    }
    if (
      row.title.trim().toLowerCase() === candidate.title.trim().toLowerCase() &&
      row.startTime &&
      candidate.startTime &&
      row.startTime === candidate.startTime
    ) {
      return row;
    }
  }
  return null;
}

function findTimeOverlapMatch(
  candidate: Pick<FiCalendarEvent, "startTime" | "endTime" | "externalEventId">,
  localEvents: ReadonlyArray<LocalEventCandidate>,
  thresholdMinutes: number
): LocalEventCandidate | null {
  if (!candidate.startTime || !candidate.endTime) return null;

  for (const row of localEvents) {
    if (!isActiveLocalEvent(row)) continue;
    if (
      candidate.externalEventId &&
      row.externalEventId &&
      row.externalEventId === candidate.externalEventId
    ) {
      continue;
    }
    if (!row.startTime || !row.endTime) continue;
    if (
      eventsOverlap(
        candidate.startTime,
        candidate.endTime,
        row.startTime,
        row.endTime,
        thresholdMinutes
      )
    ) {
      return row;
    }
  }
  return null;
}

function isRiskyGoogleUpdate(
  local: FiCalendarEvent,
  mapped: ReturnType<typeof mapGoogleApiEventToFiFields>
): boolean {
  if (!isFiCreatedCalendarSource(local.metadata?.source)) return false;

  const titleChanged = local.title.trim().toLowerCase() !== mapped.title.trim().toLowerCase();
  const startChanged = Boolean(
    local.startTime && mapped.startTime && local.startTime !== mapped.startTime
  );
  const endChanged = Boolean(local.endTime && mapped.endTime && local.endTime !== mapped.endTime);

  return titleChanged || startChanged || endChanged;
}

function buildDetection(
  conflictType: GoogleCalendarSyncConflictType,
  conflictReason: string,
  mapped: ReturnType<typeof mapGoogleApiEventToFiFields>,
  matched: LocalEventCandidate | null,
  severity: GoogleCalendarSyncReviewSeverity = "review"
): GoogleCalendarSyncConflictDetection {
  return {
    conflictType,
    conflictReason,
    severity,
    matchedLocalEventId: matched?.id ?? null,
    matchedLocalEventType: matched?.eventType ?? null,
    mappedFields: mapped,
  };
}

/** Detect whether an inbound Google event should be staged for admin review instead of auto-synced. */
export function detectGoogleCalendarSyncConflict(
  input: DetectGoogleCalendarSyncConflictInput
): GoogleCalendarSyncConflictDetection | null {
  const {
    googleEvent,
    calendarId,
    accessRole,
    existingByExternalId,
    localEvents,
    overlapThresholdMinutes = GOOGLE_CALENDAR_SYNC_OVERLAP_THRESHOLD_MINUTES,
  } = input;

  const mappingDiag = diagnoseGoogleApiEventMapping(googleEvent, calendarId);
  const mapped = mappingDiag.mapped;
  const extId = mapped.externalEventId?.trim() ?? "";

  if (accessRole?.trim().toLowerCase() === "freebusyreader") {
    return buildDetection(
      "permission_or_scope_warning",
      "Calendar access role is freeBusyReader — event details may be incomplete.",
      mapped,
      null,
      "warning"
    );
  }

  if (isGoogleEventCancelled(googleEvent)) {
    if (!existingByExternalId) {
      return buildDetection(
        "cancelled_unmatched",
        "Google event is cancelled but no matching local FI calendar row exists.",
        mapped,
        null
      );
    }
    return null;
  }

  if (existingByExternalId) {
    if (isRiskyGoogleUpdate(existingByExternalId, mapped)) {
      return buildDetection(
        "update_conflict",
        "Google event would update an FI-created appointment with different title or time.",
        mapped,
        existingByExternalId
      );
    }
    return null;
  }

  if (isUnsupportedGoogleEventShape(googleEvent)) {
    return buildDetection(
      "unsupported_event_type",
      "Recurring event master without a concrete instance start time.",
      mapped,
      null
    );
  }

  if (mappingDiag.mappingFailed) {
    const reason =
      mappingDiag.failureReason === "missing_event_id"
        ? "Google event is missing an external event id."
        : mappingDiag.failureReason === "missing_or_unparseable_start"
          ? "Google event is missing or has an unparseable start time."
          : mappingDiag.failureReason === "missing_or_unparseable_end"
            ? "Google event is missing or has an unparseable end time."
            : "Google event is missing required fields for safe auto-sync.";
    return buildDetection("missing_required_fields", reason, mapped, null);
  }

  if (!hasSafeTitle(googleEvent.summary)) {
    return buildDetection(
      "missing_required_fields",
      "Google event lacks a safe title for automatic import.",
      mapped,
      null
    );
  }

  const duplicateMatch = findTitleStartDuplicateMatch(
    { externalEventId: extId, title: mapped.title, startTime: mapped.startTime },
    localEvents
  );
  if (duplicateMatch) {
    return buildDetection(
      "possible_duplicate",
      "Google event matches an existing FI event by title and start time but has a different external id.",
      mapped,
      duplicateMatch
    );
  }

  const overlapMatch = findTimeOverlapMatch(
    { externalEventId: extId, startTime: mapped.startTime, endTime: mapped.endTime },
    localEvents,
    overlapThresholdMinutes
  );
  if (overlapMatch) {
    return buildDetection(
      "time_overlap",
      "Google event overlaps an existing FI calendar event in the sync window.",
      mapped,
      overlapMatch
    );
  }

  return null;
}

export type GoogleCalendarSyncReviewUpsertInput = {
  tenantId: string;
  integrationId: string;
  googleCalendarId: string | null;
  googleCalendarSummary: string | null;
  externalEventId: string;
  googleEvent: GoogleCalendarApiEvent;
  detection: GoogleCalendarSyncConflictDetection;
};

export function buildGoogleCalendarSyncReviewRowPayload(
  input: GoogleCalendarSyncReviewUpsertInput,
  now: string
): Record<string, unknown> {
  const mapped = input.detection.mappedFields;
  return {
    tenant_id: input.tenantId.trim(),
    integration_id: input.integrationId.trim(),
    provider: "google",
    google_calendar_id: input.googleCalendarId,
    google_calendar_summary: input.googleCalendarSummary,
    external_event_id: input.externalEventId.trim(),
    event_summary: mapped.title,
    event_start_at: mapped.startTime,
    event_end_at: mapped.endTime,
    event_location: mapped.location,
    event_description: mapped.description,
    event_status: input.googleEvent.status?.trim() ?? null,
    raw_event: input.googleEvent as Record<string, unknown>,
    mapped_fields: mapped as Record<string, unknown>,
    matched_local_event_id: input.detection.matchedLocalEventId,
    matched_local_event_type: input.detection.matchedLocalEventType,
    conflict_type: input.detection.conflictType,
    conflict_reason: input.detection.conflictReason,
    severity: input.detection.severity,
    status: "open",
    updated_at: now,
  };
}

export function reviewItemRowToClient(row: ReviewItemDbRow): GoogleCalendarSyncReviewClientItem {
  return {
    id: row.id,
    googleCalendarId: row.google_calendar_id?.trim() ?? null,
    googleCalendarSummary: row.google_calendar_summary?.trim() ?? null,
    externalEventId: row.external_event_id.trim(),
    eventSummary: row.event_summary?.trim() ?? null,
    eventStartAt: row.event_start_at,
    eventEndAt: row.event_end_at,
    conflictType: row.conflict_type as GoogleCalendarSyncConflictType,
    conflictReason: row.conflict_reason,
    severity: row.severity as GoogleCalendarSyncReviewSeverity,
    status: row.status as GoogleCalendarSyncReviewStatus,
    matchedLocalEventId: row.matched_local_event_id,
    matchedLocalEventType: row.matched_local_event_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ReviewItemDbRow = {
  id: string;
  tenant_id: string;
  integration_id: string;
  provider: string;
  google_calendar_id: string | null;
  google_calendar_summary: string | null;
  external_event_id: string;
  event_summary: string | null;
  event_start_at: string | null;
  event_end_at: string | null;
  event_location: string | null;
  event_description: string | null;
  event_status: string | null;
  raw_event: Record<string, unknown>;
  mapped_fields: Record<string, unknown>;
  matched_local_event_id: string | null;
  matched_local_event_type: string | null;
  conflict_type: string;
  conflict_reason: string;
  severity: string;
  status: string;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GoogleCalendarSyncReviewClientItem = {
  id: string;
  googleCalendarId: string | null;
  googleCalendarSummary: string | null;
  externalEventId: string;
  eventSummary: string | null;
  eventStartAt: string | null;
  eventEndAt: string | null;
  conflictType: GoogleCalendarSyncConflictType;
  conflictReason: string;
  severity: GoogleCalendarSyncReviewSeverity;
  status: GoogleCalendarSyncReviewStatus;
  matchedLocalEventId: string | null;
  matchedLocalEventType: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GoogleCalendarSyncReviewPageModel = {
  tenantId: string;
  canManage: boolean;
  connected: boolean;
  integrationId: string | null;
  openCount: number;
  items: GoogleCalendarSyncReviewClientItem[];
};

export function formatConflictTypeLabel(type: GoogleCalendarSyncConflictType): string {
  switch (type) {
    case "possible_duplicate":
      return "Possible duplicate";
    case "time_overlap":
      return "Time overlap";
    case "missing_required_fields":
      return "Missing required fields";
    case "unsupported_event_type":
      return "Unsupported event type";
    case "cancelled_unmatched":
      return "Cancelled (no local match)";
    case "update_conflict":
      return "Update conflict";
    case "permission_or_scope_warning":
      return "Permission / scope warning";
    default:
      return type;
  }
}

export function emptyReviewSyncCounters(): GoogleCalendarSyncReviewCounters {
  return {
    reviewItemsCreated: 0,
    reviewItemsUpdated: 0,
    conflictsDetected: 0,
    conflictsByType: {},
  };
}

export type GoogleCalendarSyncReviewCounters = {
  reviewItemsCreated: number;
  reviewItemsUpdated: number;
  conflictsDetected: number;
  conflictsByType: Partial<Record<GoogleCalendarSyncConflictType, number>>;
};

export function incrementReviewCounter(
  counters: GoogleCalendarSyncReviewCounters,
  conflictType: GoogleCalendarSyncConflictType,
  created: boolean
): void {
  counters.conflictsDetected += 1;
  counters.conflictsByType[conflictType] = (counters.conflictsByType[conflictType] ?? 0) + 1;
  if (created) counters.reviewItemsCreated += 1;
  else counters.reviewItemsUpdated += 1;
}
