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
  existing: readonly Pick<FiCalendarEvent, "externalEventId" | "title" | "startTime" | "metadata">
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

/** Detect Google events removed since last sync — local external ids not in discovered set. */
export function detectDeletedExternalEvents(
  localEvents: readonly Pick<FiCalendarEvent, "id" | "externalEventId" | "metadata">,
  discoveredExternalIds: ReadonlySet<string>
): string[] {
  const deletedIds: string[] = [];
  for (const row of localEvents) {
    const extId = row.externalEventId?.trim();
    if (!extId) continue;
    if (row.metadata?.deleted_from_provider) continue;
    if (!discoveredExternalIds.has(extId)) {
      deletedIds.push(row.id);
    }
  }
  return deletedIds;
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
