import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GoogleCalendarApiEvent } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

import {
  buildGoogleCalendarListQueryParams,
  mapGoogleApiEventToFiFields,
  parseGoogleCalendarListResponse,
} from "@/src/lib/googleCalendar/googleCalendarCore";
import { resolveGoogleCalendarAccessToken } from "@/src/lib/googleCalendar/googleCalendarAuth.server";
import {
  fetchGoogleCalendarWithRetry,
  formatGoogleCalendarApiError,
} from "@/src/lib/googleCalendar/googleCalendarSyncRetryCore";

import type {
  CalendarProviderAdapter,
  ListEventsOptions,
  NormalizedCalendarEvent,
} from "./calendarProviderAdapter";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const DEFAULT_WATCH_TTL_SECONDS = 604800;

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
};

function normalizeGoogleEvent(
  event: GoogleCalendarApiEvent,
  calendarId: string
): NormalizedCalendarEvent {
  const mapped = mapGoogleApiEventToFiFields(event, calendarId);
  const etag = (event as GoogleCalendarApiEvent & { etag?: string }).etag?.trim() ?? null;
  return {
    ...mapped,
    externalEventId: mapped.externalEventId ?? "",
    etag,
    updatedAt: event.updated?.trim() ?? null,
    status: event.status?.trim() ?? null,
    raw: event,
  };
}

async function callGoogleApi(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  accessToken: string,
  opts: ServerOpts,
  body?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<{ ok: true; json: unknown; status: number } | { ok: false; error: string; status?: number }> {
  const fetchFn = opts.fetchOverride ?? fetch;
  const params = query ? `?${new URLSearchParams(query).toString()}` : "";
  const url = `${GOOGLE_CALENDAR_API_BASE}${path}${params}`;

  const attempt = await fetchGoogleCalendarWithRetry(fetchFn, url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!attempt.ok) {
    return {
      ok: false,
      error: formatGoogleCalendarApiError(attempt.status, attempt.text),
      status: attempt.status,
    };
  }

  if (method === "DELETE") {
    return { ok: true, json: null, status: attempt.status };
  }

  try {
    return { ok: true, json: attempt.text ? JSON.parse(attempt.text) : {}, status: attempt.status };
  } catch {
    return { ok: true, json: {}, status: attempt.status };
  }
}

function buildGoogleEventBody(input: {
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: string;
  endTime: string;
  addGoogleMeet?: boolean;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
    start: { dateTime: input.startTime },
    end: { dateTime: input.endTime },
  };
  if (input.addGoogleMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  return body;
}

/** Google Calendar implementation of CalendarProviderAdapter (wraps existing GC-1/GC-8 logic). */
export function createGoogleCalendarProviderAdapter(opts: ServerOpts = {}): CalendarProviderAdapter {
  return {
    provider: "google",

    normalizeEvent(event: GoogleCalendarApiEvent, calendarId: string) {
      return normalizeGoogleEvent(event, calendarId);
    },

    async refreshToken(tenantId: string) {
      const tokenResult = await resolveGoogleCalendarAccessToken(tenantId, opts);
      if (!tokenResult.ok) return { ok: false, error: tokenResult.error };
      return { ok: true, accessToken: tokenResult.data!.accessToken };
    },

    async createEvent(input) {
      const tokenResult = await this.refreshToken(input.tenantId);
      if (!tokenResult.ok) return tokenResult;

      const encodedCalendar = encodeURIComponent(input.calendarId.trim());
      const apiResult = await callGoogleApi(
        "POST",
        `/calendars/${encodedCalendar}/events`,
        tokenResult.accessToken,
        opts,
        buildGoogleEventBody(input),
        input.addGoogleMeet ? { conferenceDataVersion: "1" } : undefined
      );
      if (!apiResult.ok) return { ok: false, error: apiResult.error };
      return {
        ok: true,
        event: normalizeGoogleEvent(apiResult.json as GoogleCalendarApiEvent, input.calendarId),
      };
    },

    async updateEvent(input) {
      const tokenResult = await this.refreshToken(input.tenantId);
      if (!tokenResult.ok) return tokenResult;

      const patch: Record<string, unknown> = {};
      if (input.patch.title != null) patch.summary = input.patch.title;
      if (input.patch.description !== undefined) patch.description = input.patch.description;
      if (input.patch.location !== undefined) patch.location = input.patch.location;
      if (input.patch.startTime) patch.start = { dateTime: input.patch.startTime };
      if (input.patch.endTime) patch.end = { dateTime: input.patch.endTime };

      const encodedCalendar = encodeURIComponent(input.calendarId.trim());
      const encodedEvent = encodeURIComponent(input.externalEventId.trim());
      const apiResult = await callGoogleApi(
        "PATCH",
        `/calendars/${encodedCalendar}/events/${encodedEvent}`,
        tokenResult.accessToken,
        opts,
        patch
      );
      if (!apiResult.ok) return { ok: false, error: apiResult.error };
      return {
        ok: true,
        event: normalizeGoogleEvent(apiResult.json as GoogleCalendarApiEvent, input.calendarId),
      };
    },

    async deleteEvent(input) {
      const tokenResult = await this.refreshToken(input.tenantId);
      if (!tokenResult.ok) return tokenResult;

      const encodedCalendar = encodeURIComponent(input.calendarId.trim());
      const encodedEvent = encodeURIComponent(input.externalEventId.trim());
      const apiResult = await callGoogleApi(
        "DELETE",
        `/calendars/${encodedCalendar}/events/${encodedEvent}`,
        tokenResult.accessToken,
        opts
      );
      if (!apiResult.ok) return { ok: false, error: apiResult.error };
      return { ok: true };
    },

    async getEvent(input) {
      const tokenResult = await this.refreshToken(input.tenantId);
      if (!tokenResult.ok) return tokenResult;

      const encodedCalendar = encodeURIComponent(input.calendarId.trim());
      const encodedEvent = encodeURIComponent(input.externalEventId.trim());
      const apiResult = await callGoogleApi(
        "GET",
        `/calendars/${encodedCalendar}/events/${encodedEvent}`,
        tokenResult.accessToken,
        opts
      );
      if (!apiResult.ok) {
        return {
          ok: false,
          error: apiResult.error,
          notFound: apiResult.status === 404,
        };
      }
      return {
        ok: true,
        event: normalizeGoogleEvent(apiResult.json as GoogleCalendarApiEvent, input.calendarId),
      };
    },

    async listEvents(input) {
      const tokenResult = await this.refreshToken(input.tenantId);
      if (!tokenResult.ok) return tokenResult;

      const listOpts: ListEventsOptions = {
        calendarId: input.calendarId,
        timeMin: input.timeMin,
        timeMax: input.timeMax,
        syncToken: input.syncToken,
        pageToken: input.pageToken,
      };

      const encodedCalendar = encodeURIComponent(input.calendarId.trim());
      const params = buildGoogleCalendarListQueryParams({
        timeMin: listOpts.timeMin,
        timeMax: listOpts.timeMax,
        pageToken: listOpts.pageToken,
        syncToken: listOpts.syncToken ?? undefined,
      });

      const apiResult = await callGoogleApi(
        "GET",
        `/calendars/${encodedCalendar}/events`,
        tokenResult.accessToken,
        opts,
        undefined,
        Object.fromEntries(params.entries())
      );

      if (!apiResult.ok) {
        if (apiResult.status === 410) {
          return { ok: false, error: apiResult.error, syncTokenInvalid: true };
        }
        return { ok: false, error: apiResult.error };
      }

      const body = apiResult.json as {
        items?: GoogleCalendarApiEvent[];
        nextPageToken?: string;
        nextSyncToken?: string;
      };
      const { items, nextPageToken } = parseGoogleCalendarListResponse(body);
      return {
        ok: true,
        result: {
          events: items.map((event) => normalizeGoogleEvent(event, input.calendarId)),
          nextPageToken,
          nextSyncToken: body.nextSyncToken?.trim() || undefined,
        },
      };
    },

    async subscribeWebhook(input) {
      const tokenResult = await this.refreshToken(input.tenantId);
      if (!tokenResult.ok) return tokenResult;

      const encodedCalendar = encodeURIComponent(input.calendarId.trim());
      const watchBody = {
        id: input.channelId,
        type: "webhook",
        address: input.webhookUrl,
        token: input.channelToken,
        params: {
          ttl: String(input.ttlSeconds ?? DEFAULT_WATCH_TTL_SECONDS),
        },
      };

      const apiResult = await callGoogleApi(
        "POST",
        `/calendars/${encodedCalendar}/events/watch`,
        tokenResult.accessToken,
        opts,
        watchBody
      );
      if (!apiResult.ok) return { ok: false, error: apiResult.error };

      const body = apiResult.json as {
        resourceId?: string;
        resourceUri?: string;
        expiration?: string;
      };
      const expirationMs = body.expiration ? Number(body.expiration) : NaN;
      const expirationAt = Number.isFinite(expirationMs)
        ? new Date(expirationMs).toISOString()
        : new Date(Date.now() + (input.ttlSeconds ?? DEFAULT_WATCH_TTL_SECONDS) * 1000).toISOString();

      return {
        ok: true,
        subscription: {
          channelId: input.channelId,
          resourceId: body.resourceId?.trim() ?? "",
          resourceUri: body.resourceUri?.trim() ?? null,
          expirationAt,
        },
      };
    },

    async stopWebhook(input) {
      const tokenResult = await this.refreshToken(input.tenantId);
      if (!tokenResult.ok) return tokenResult;

      const apiResult = await callGoogleApi(
        "POST",
        "/channels/stop",
        tokenResult.accessToken,
        opts,
        {
          id: input.channelId,
          resourceId: input.resourceId,
        }
      );
      if (!apiResult.ok) return { ok: false, error: apiResult.error };
      return { ok: true };
    },
  };
}

export const googleCalendarProviderAdapter = createGoogleCalendarProviderAdapter();
