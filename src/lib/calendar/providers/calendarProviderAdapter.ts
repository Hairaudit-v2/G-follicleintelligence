/**
 * CalendarOS GC-9 — provider-agnostic calendar adapter interface.
 */

import type { GoogleCalendarApiEvent } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

import type { FiCalendarEvent } from "@/src/lib/googleCalendar/googleCalendarTypes";

export type CalendarProviderName = "google";

export type NormalizedCalendarEvent = {
  externalEventId: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  eventType: string | null;
  googleMeetUrl: string | null;
  etag: string | null;
  updatedAt: string | null;
  status: string | null;
  raw: GoogleCalendarApiEvent;
};

export type WebhookSubscriptionResult = {
  channelId: string;
  resourceId: string;
  resourceUri: string | null;
  expirationAt: string;
};

export type ListEventsOptions = {
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
  syncToken?: string | null;
  pageToken?: string;
};

export type ListEventsResult = {
  events: NormalizedCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
  syncTokenInvalid?: boolean;
};

export interface CalendarProviderAdapter {
  readonly provider: CalendarProviderName;

  createEvent(
    input: {
      tenantId: string;
      calendarId: string;
      title: string;
      description?: string | null;
      location?: string | null;
      startTime: string;
      endTime: string;
      addGoogleMeet?: boolean;
    }
  ): Promise<{ ok: true; event: NormalizedCalendarEvent } | { ok: false; error: string }>;

  updateEvent(
    input: {
      tenantId: string;
      calendarId: string;
      externalEventId: string;
      patch: Partial<{
        title: string;
        description: string | null;
        location: string | null;
        startTime: string;
        endTime: string;
      }>;
    }
  ): Promise<{ ok: true; event: NormalizedCalendarEvent } | { ok: false; error: string }>;

  deleteEvent(input: {
    tenantId: string;
    calendarId: string;
    externalEventId: string;
  }): Promise<{ ok: true } | { ok: false; error: string }>;

  getEvent(input: {
    tenantId: string;
    calendarId: string;
    externalEventId: string;
  }): Promise<{ ok: true; event: NormalizedCalendarEvent } | { ok: false; error: string; notFound?: boolean }>;

  listEvents(
    input: ListEventsOptions & { tenantId: string }
  ): Promise<{ ok: true; result: ListEventsResult } | { ok: false; error: string; syncTokenInvalid?: boolean }>;

  subscribeWebhook(input: {
    tenantId: string;
    calendarId: string;
    webhookUrl: string;
    channelId: string;
    channelToken?: string;
    ttlSeconds?: number;
  }): Promise<{ ok: true; subscription: WebhookSubscriptionResult } | { ok: false; error: string }>;

  stopWebhook(input: {
    tenantId: string;
    channelId: string;
    resourceId: string;
  }): Promise<{ ok: true } | { ok: false; error: string }>;

  refreshToken(tenantId: string): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }>;

  normalizeEvent(event: GoogleCalendarApiEvent, calendarId: string): NormalizedCalendarEvent;
}

export type CalendarEventOwnershipSource = "fi_system" | "google_external" | "imported_external";

/** Map a local FI calendar row to GC-9 ownership source. */
export function deriveCalendarEventOwnershipSource(
  local: Pick<FiCalendarEvent, "metadata" | "patientId" | "leadId">
): CalendarEventOwnershipSource {
  const source = String(local.metadata?.source ?? "").trim();
  if (source === "fi_appointment_create" || source === "fi_calendar_create") {
    return "fi_system";
  }
  if (local.patientId || local.leadId) {
    return "fi_system";
  }
  if (local.metadata?.imported_from_review === true || local.metadata?.ownership === "imported_external") {
    return "imported_external";
  }
  return "google_external";
}

/** Fields safe to mirror from Google for display-only inbound events. */
export const GOOGLE_MIRRORABLE_DISPLAY_FIELDS = [
  "title",
  "description",
  "location",
  "startTime",
  "endTime",
  "googleMeetUrl",
] as const;

export function isRiskyGoogleChangeForFiOwnedEvent(
  local: Pick<FiCalendarEvent, "title" | "startTime" | "endTime" | "metadata">,
  incoming: Pick<NormalizedCalendarEvent, "title" | "startTime" | "endTime">
): boolean {
  if (deriveCalendarEventOwnershipSource(local) !== "fi_system") return false;

  const titleChanged =
    local.title.trim().toLowerCase() !== incoming.title.trim().toLowerCase();
  const startChanged = Boolean(
    local.startTime && incoming.startTime && local.startTime !== incoming.startTime
  );
  const endChanged = Boolean(local.endTime && incoming.endTime && local.endTime !== incoming.endTime);

  return titleChanged || startChanged || endChanged;
}

export function shouldSkipDuplicateWebhookNotification(
  lastMessageNumber: string | null | undefined,
  incomingMessageNumber: string | null | undefined
): boolean {
  if (!incomingMessageNumber?.trim()) return false;
  if (!lastMessageNumber?.trim()) return false;
  const last = Number(lastMessageNumber);
  const incoming = Number(incomingMessageNumber);
  if (!Number.isFinite(last) || !Number.isFinite(incoming)) return false;
  return incoming <= last;
}

export function isWebhookSubscriptionExpiringSoon(
  expirationAt: string | null | undefined,
  nowMs: number = Date.now(),
  thresholdHours: number = 24
): boolean {
  if (!expirationAt) return true;
  const expMs = Date.parse(expirationAt);
  if (Number.isNaN(expMs)) return true;
  return expMs - nowMs <= thresholdHours * 60 * 60 * 1000;
}
