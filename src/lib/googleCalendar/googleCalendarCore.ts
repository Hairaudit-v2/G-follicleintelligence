/**
 * CalendarOS Phase GC-1 — Google Calendar connector pure logic (no server-only).
 */

import { classifyExternalCalendarEventType } from "@/src/lib/onboarding-os/googleCalendarConnectorCore";
import type { GoogleCalendarApiEvent } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

import type {
  FiCalendarEvent,
  GoogleCalendarApiEventWithConference,
} from "./googleCalendarTypes";

const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

/** Google Calendar events.list page size (API max 2500; 250 is a stable default). */
export const GOOGLE_CALENDAR_SYNC_PAGE_SIZE = 250;

/** Safety cap on paginated list requests during sync (250 × 20 = 5000 events). */
export const GOOGLE_CALENDAR_SYNC_MAX_PAGES = 20;

export function buildGoogleCalendarListQueryParams(opts: {
  timeMin: string;
  timeMax: string;
  pageToken?: string;
}): URLSearchParams {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    maxResults: String(GOOGLE_CALENDAR_SYNC_PAGE_SIZE),
  });
  if (opts.pageToken?.trim()) {
    params.set("pageToken", opts.pageToken.trim());
  }
  return params;
}

export function parseGoogleCalendarListResponse(json: unknown): {
  items: GoogleCalendarApiEvent[];
  nextPageToken?: string;
} {
  const body = json as { items?: GoogleCalendarApiEvent[]; nextPageToken?: string };
  return {
    items: body.items ?? [],
    nextPageToken: body.nextPageToken?.trim() || undefined,
  };
}

export function isFiCreatedCalendarSource(source: unknown): boolean {
  const normalized = String(source ?? "").trim();
  return normalized === "fi_appointment_create" || normalized === "fi_calendar_create";
}

export function isEventStartInSyncWindow(
  startTime: string | null | undefined,
  timeMin: string,
  timeMax: string
): boolean {
  if (!startTime) return false;
  const startMs = Date.parse(startTime);
  const minMs = Date.parse(timeMin);
  const maxMs = Date.parse(timeMax);
  if (Number.isNaN(startMs) || Number.isNaN(minMs) || Number.isNaN(maxMs)) return false;
  return startMs >= minMs && startMs <= maxMs;
}

export function isGoogleEventCancelled(event: GoogleCalendarApiEvent): boolean {
  return String(event.status ?? "").trim().toLowerCase() === "cancelled";
}

export function buildGoogleCalendarOAuthScopes(): string {
  return GOOGLE_OAUTH_SCOPES.join(" ");
}

export function buildGoogleOAuthAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: opts.scopes ?? buildGoogleCalendarOAuthScopes(),
    access_type: "offline",
    prompt: "consent",
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function isAccessTokenExpired(
  tokenExpiresAt: string | null | undefined,
  bufferSeconds = 60
): boolean {
  if (!tokenExpiresAt) return true;
  const expiresMs = Date.parse(tokenExpiresAt);
  if (Number.isNaN(expiresMs)) return true;
  return expiresMs <= Date.now() + bufferSeconds * 1000;
}

export function computeTokenExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function parseGoogleDateTime(
  value: { dateTime?: string; date?: string } | undefined
): string | null {
  if (!value) return null;
  const raw = value.dateTime ?? value.date;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

/** Extract Google Meet URL from a Google Calendar API event payload. */
export function extractGoogleMeetUrl(
  event: GoogleCalendarApiEventWithConference
): string | null {
  const hangout = event.hangoutLink?.trim();
  if (hangout) return hangout;

  for (const entry of event.conferenceData?.entryPoints ?? []) {
    if (entry.entryPointType === "video" && entry.uri?.trim()) {
      return entry.uri.trim();
    }
  }
  return null;
}

export function buildGoogleMeetConferenceRequest(requestId: string): GoogleCalendarApiEventWithConference["conferenceData"] {
  return {
    createRequest: {
      requestId,
      conferenceSolutionKey: { type: "hangoutsMeet" },
    },
  };
}

export function mapGoogleApiEventToFiFields(
  event: GoogleCalendarApiEvent,
  calendarId: string
): Pick<
  FiCalendarEvent,
  "externalEventId" | "calendarId" | "title" | "description" | "location" | "startTime" | "endTime" | "eventType" | "googleMeetUrl"
> {
  const title = (event.summary ?? "").trim() || "(Untitled event)";
  const eventType = classifyExternalCalendarEventType(title, event.description);
  const withConference = event as GoogleCalendarApiEventWithConference;

  return {
    externalEventId: event.id?.trim() ?? null,
    calendarId: calendarId.trim(),
    title,
    description: event.description?.trim() ?? null,
    location: event.location?.trim() ?? null,
    startTime: parseGoogleDateTime(event.start),
    endTime: parseGoogleDateTime(event.end),
    eventType,
    googleMeetUrl: extractGoogleMeetUrl(withConference),
  };
}

/** Detect duplicate FI calendar event before create (external id or title+start). */
export function isDuplicateFiCalendarEvent(
  candidate: Pick<FiCalendarEvent, "externalEventId" | "title" | "startTime">,
  existing: ReadonlyArray<
    Pick<FiCalendarEvent, "externalEventId" | "title" | "startTime" | "metadata">
  >
): boolean {
  for (const row of existing) {
    if (
      candidate.externalEventId &&
      row.externalEventId &&
      row.externalEventId === candidate.externalEventId
    ) {
      return true;
    }

    const deleted = Boolean(row.metadata?.deleted_from_provider);
    if (
      !deleted &&
      row.title.trim().toLowerCase() === candidate.title.trim().toLowerCase() &&
      row.startTime &&
      candidate.startTime &&
      row.startTime === candidate.startTime
    ) {
      return true;
    }
  }
  return false;
}

/** Compare Google updated timestamp vs local mirror to decide if sync update is needed. */
export function shouldUpdateFiEventFromGoogle(
  local: Pick<FiCalendarEvent, "updatedAt" | "metadata">,
  googleEvent: GoogleCalendarApiEvent
): boolean {
  if (local.metadata?.deleted_from_provider) return true;

  const googleUpdated = googleEvent.updated?.trim();
  if (!googleUpdated) return true;

  const googleMs = Date.parse(googleUpdated);
  const localMs = Date.parse(local.updatedAt);
  if (Number.isNaN(googleMs) || Number.isNaN(localMs)) return true;
  return googleMs > localMs;
}

/**
 * Detect Google events removed since last sync — local external ids not in discovered set.
 * Scoped to the sync time window; FI-created rows require explicit provider confirmation.
 */
export function detectDeletedExternalEvents(
  localEvents: ReadonlyArray<
    Pick<FiCalendarEvent, "id" | "externalEventId" | "startTime" | "metadata">
  >,
  discoveredExternalIds: ReadonlySet<string>,
  opts: { timeMin: string; timeMax: string }
): string[] {
  const deletedIds: string[] = [];
  for (const row of localEvents) {
    const extId = row.externalEventId?.trim();
    if (!extId) continue;
    if (row.metadata?.deleted_from_provider) continue;
    if (!isEventStartInSyncWindow(row.startTime, opts.timeMin, opts.timeMax)) continue;
    if (isFiCreatedCalendarSource(row.metadata?.source)) continue;
    if (!discoveredExternalIds.has(extId)) {
      deletedIds.push(row.id);
    }
  }
  return deletedIds;
}

/** Merge Google sync fields into local metadata without clobbering GC-4 appointment fields. */
export function buildGoogleSyncUpdateMetadata(
  existing: Record<string, unknown>,
  syncNow: string
): Record<string, unknown> {
  return {
    ...existing,
    deleted_from_provider: false,
    deleted_at: null,
    sync_status: "synced",
    last_synced_at: syncNow,
  };
}

export function buildDeletedFromProviderMetadata(
  existing: Record<string, unknown>,
  deletedAt: string
): Record<string, unknown> {
  return {
    ...existing,
    deleted_from_provider: true,
    deleted_at: deletedAt,
    sync_status: "deleted_external",
  };
}
