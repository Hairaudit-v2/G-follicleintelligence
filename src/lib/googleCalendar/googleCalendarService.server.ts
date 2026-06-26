import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logStructured } from "@/src/lib/server/structuredLog";
import type { GoogleCalendarApiEvent } from "@/src/lib/onboarding-os/googleCalendarConnectorTypes";

import {
  buildDeletedFromProviderMetadata,
  buildGoogleCalendarListQueryParams,
  buildGoogleMeetConferenceRequest,
  buildGoogleSyncInsertMetadata,
  buildGoogleSyncUpdateMetadata,
  detectDeletedExternalEvents,
  diagnoseGoogleApiEventMapping,
  extractGoogleMeetUrl,
  GOOGLE_CALENDAR_SYNC_MAX_PAGES,
  isDuplicateFiCalendarEvent,
  isEventStartInSyncWindow,
  isFiCreatedCalendarSource,
  isGoogleCalendarAuthFailure,
  isGoogleEventCancelled,
  mapGoogleApiEventToFiFields,
  parseGoogleCalendarListResponse,
  shouldUpdateFiEventFromGoogle,
} from "./googleCalendarCore";
import {
  fetchGoogleCalendarWithRetry,
  formatGoogleCalendarApiError,
} from "./googleCalendarSyncRetryCore";
import { resolveGoogleCalendarAccessToken } from "./googleCalendarAuth.server";
import {
  getGoogleInboundCalendarScopesForIntegration,
  touchInboundSyncCalendarLastSynced,
  type GoogleInboundCalendarScope,
} from "./googleCalendarInboundSyncData.server";
import {
  emptyReviewSyncCounters,
  stageGoogleCalendarSyncReviewIfConflict,
  type GoogleCalendarSyncReviewCounters,
} from "./googleCalendarSyncReview.server";
import type {
  CreateGoogleCalendarEventInput,
  FiCalendarEvent,
  FiCalendarIntegration,
  GoogleCalendarApiEventWithConference,
  GoogleCalendarSyncPerCalendarResult,
  GoogleCalendarSyncResult,
  GoogleCalendarSyncSkipBreakdown,
  UpdateGoogleCalendarEventInput,
} from "./googleCalendarTypes";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const SYNC_LOOKBACK_DAYS = 30;
const SYNC_LOOKAHEAD_DAYS = 180;

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
  integrationId?: string;
  lookbackDays?: number;
  lookaheadDays?: number;
};

type EventRow = {
  id: string;
  tenant_id: string;
  external_event_id: string | null;
  provider: string;
  calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  event_type: string | null;
  google_meet_url: string | null;
  patient_id: string | null;
  lead_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GoogleCalendarServiceResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function mapEventRow(row: EventRow): FiCalendarEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    externalEventId: row.external_event_id,
    provider: "google",
    calendarId: row.calendar_id,
    title: row.title,
    description: row.description,
    location: row.location,
    startTime: row.start_time,
    endTime: row.end_time,
    eventType: row.event_type,
    googleMeetUrl: row.google_meet_url,
    patientId: row.patient_id,
    leadId: row.lead_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function resolveIntegrationContext(
  tenantId: string,
  opts: ServerOpts,
  calendarIdOverride?: string
): Promise<
  | {
      ok: true;
      accessToken: string;
      integration: FiCalendarIntegration;
      calendarId: string;
    }
  | { ok: false; error: string }
> {
  const tokenResult = await resolveGoogleCalendarAccessToken(tenantId, opts);
  if (!tokenResult.ok) return tokenResult;

  const integration = tokenResult.data!.integration;
  const calendarId = (calendarIdOverride ?? integration.calendarId).trim();
  if (!calendarId) return { ok: false, error: "Calendar id is required." };

  return {
    ok: true,
    accessToken: tokenResult.data!.accessToken,
    integration,
    calendarId,
  };
}

async function callGoogleCalendarApi(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  accessToken: string,
  opts: ServerOpts,
  body?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<{ ok: true; json: unknown } | { ok: false; error: string; status?: number }> {
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
    return { ok: true, json: null };
  }

  try {
    return { ok: true, json: JSON.parse(attempt.text) };
  } catch {
    return { ok: true, json: null };
  }
}

async function fetchAllGoogleCalendarEventsForSync(
  calendarId: string,
  accessToken: string,
  timeMin: string,
  timeMax: string,
  opts: ServerOpts
): Promise<{ ok: true; events: GoogleCalendarApiEvent[] } | { ok: false; error: string }> {
  const fetchFn = opts.fetchOverride ?? fetch;
  const encodedCalendar = encodeURIComponent(calendarId);
  const all: GoogleCalendarApiEvent[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  logStructured("info", "google_calendar_sync_list_start", {
    calendarId,
    encodedCalendarId: encodedCalendar,
    timeMin,
    timeMax,
  });

  while (pages < GOOGLE_CALENDAR_SYNC_MAX_PAGES) {
    const params = buildGoogleCalendarListQueryParams({ timeMin, timeMax, pageToken });
    const listUrl = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendar}/events?${params.toString()}`;
    const listAttempt = await fetchGoogleCalendarWithRetry(fetchFn, listUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!listAttempt.ok) {
      return {
        ok: false,
        error: formatGoogleCalendarApiError(listAttempt.status, listAttempt.text),
      };
    }

    let listJson: unknown = {};
    try {
      listJson = listAttempt.text ? JSON.parse(listAttempt.text) : {};
    } catch {
      listJson = {};
    }

    const { items, nextPageToken } = parseGoogleCalendarListResponse(listJson);
    logStructured("info", "google_calendar_sync_list_page", {
      calendarId,
      page: pages + 1,
      eventsItemsLength: items.length,
      hasNextPage: Boolean(nextPageToken),
    });
    all.push(...items);
    pages += 1;
    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }

  logStructured("info", "google_calendar_sync_list_complete", {
    calendarId,
    pagesFetched: pages,
    eventsFetched: all.length,
  });

  return { ok: true, events: all };
}

async function lookupGoogleCalendarEventById(
  calendarId: string,
  externalEventId: string,
  accessToken: string,
  opts: ServerOpts
): Promise<"found" | "not_found" | "error"> {
  const encodedCalendar = encodeURIComponent(calendarId);
  const encodedEvent = encodeURIComponent(externalEventId);
  const apiResult = await callGoogleCalendarApi(
    "GET",
    `/calendars/${encodedCalendar}/events/${encodedEvent}`,
    accessToken,
    opts
  );
  if (apiResult.ok) return "found";
  if (apiResult.status === 404) return "not_found";
  return "error";
}

async function markLocalEventDeletedFromProvider(
  supabase: SupabaseClient,
  tenantId: string,
  localId: string,
  existingMetadata: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deletedAt = new Date().toISOString();
  const { error } = await supabase
    .from("fi_calendar_events")
    .update({
      metadata: buildDeletedFromProviderMetadata(existingMetadata, deletedAt),
      updated_at: deletedAt,
    })
    .eq("id", localId)
    .eq("tenant_id", tenantId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
    body.conferenceData = buildGoogleMeetConferenceRequest(randomUUID());
  }

  return body;
}

async function insertLocalEvent(
  supabase: SupabaseClient,
  row: {
    tenantId: string;
    externalEventId: string | null;
    calendarId: string;
    title: string;
    description?: string | null;
    location?: string | null;
    startTime: string | null;
    endTime: string | null;
    eventType?: string | null;
    googleMeetUrl?: string | null;
    patientId?: string | null;
    leadId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<EventRow> {
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .insert({
      tenant_id: row.tenantId,
      external_event_id: row.externalEventId,
      provider: "google",
      calendar_id: row.calendarId,
      title: row.title,
      description: row.description ?? null,
      location: row.location ?? null,
      start_time: row.startTime,
      end_time: row.endTime,
      event_type: row.eventType ?? null,
      google_meet_url: row.googleMeetUrl ?? null,
      patient_id: row.patientId ?? null,
      lead_id: row.leadId ?? null,
      metadata: row.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create FI calendar event.");
  return data as EventRow;
}

async function loadLocalEvent(
  supabase: SupabaseClient,
  tenantId: string,
  eventId: string
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .select("*")
    .eq("id", eventId)
    .eq("tenant_id", tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventRow | null) ?? null;
}

async function loadLocalEventsForDedup(
  supabase: SupabaseClient,
  tenantId: string,
  calendarId: string
): Promise<FiCalendarEvent[]> {
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("calendar_id", calendarId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRow[]).map(mapEventRow);
}

/** Tenant-wide external id index — avoids missing rows when calendar_id differs from integration (e.g. email vs primary). */
async function loadLocalEventsForReview(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FiCalendarEvent[]> {
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .select("*")
    .eq("tenant_id", tenantId.trim());
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventRow[]).map(mapEventRow);
}

async function loadLocalEventsByExternalIdForSync(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, FiCalendarEvent>> {
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .not("external_event_id", "is", null);
  if (error) throw new Error(error.message);

  const byExternalId = new Map<string, FiCalendarEvent>();
  for (const row of (data ?? []) as EventRow[]) {
    const mapped = mapEventRow(row);
    const ext = mapped.externalEventId?.trim();
    if (ext) byExternalId.set(ext, mapped);
  }
  return byExternalId;
}

/** Create Google Calendar event + FI mirror record. */
export async function createGoogleCalendarEvent(
  input: CreateGoogleCalendarEventInput,
  opts: ServerOpts = {}
): Promise<GoogleCalendarServiceResult<{ event: FiCalendarEvent }>> {
  const tenantId = input.tenantId.trim();
  const ctx = await resolveIntegrationContext(tenantId, opts, input.calendarId);
  if (!ctx.ok) return ctx;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const existing = await loadLocalEventsForDedup(supabase, tenantId, ctx.calendarId);

  const duplicateCandidate = {
    externalEventId: null,
    title: input.title,
    startTime: input.startTime,
  };
  if (isDuplicateFiCalendarEvent(duplicateCandidate, existing)) {
    return { ok: false, error: "Duplicate calendar event — matching title and start time already exists." };
  }

  const googleBody = buildGoogleEventBody({
    title: input.title,
    description: input.description,
    location: input.location,
    startTime: input.startTime,
    endTime: input.endTime,
    addGoogleMeet: input.addGoogleMeet,
  });

  const query = input.addGoogleMeet ? { conferenceDataVersion: "1" } : undefined;
  const encodedCalendar = encodeURIComponent(ctx.calendarId);
  const apiResult = await callGoogleCalendarApi(
    "POST",
    `/calendars/${encodedCalendar}/events`,
    ctx.accessToken,
    opts,
    googleBody,
    query
  );

  if (!apiResult.ok) return { ok: false, error: apiResult.error };

  const googleEvent = apiResult.json as GoogleCalendarApiEventWithConference;
  const mapped = mapGoogleApiEventToFiFields(googleEvent, ctx.calendarId);
  const meetUrl = input.addGoogleMeet ? extractGoogleMeetUrl(googleEvent) : null;

  try {
    const localRow = await insertLocalEvent(supabase, {
      tenantId,
      externalEventId: mapped.externalEventId,
      calendarId: ctx.calendarId,
      title: mapped.title,
      description: mapped.description,
      location: mapped.location,
      startTime: mapped.startTime,
      endTime: mapped.endTime,
      eventType: input.eventType ?? mapped.eventType,
      googleMeetUrl: meetUrl ?? mapped.googleMeetUrl,
      patientId: input.patientId,
      leadId: input.leadId,
      metadata: {
        ...(input.metadata ?? {}),
        source: "fi_calendar_create",
        integration_id: ctx.integration.id,
      },
    });

    return { ok: true, data: { event: mapEventRow(localRow) } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mirror event locally." };
  }
}

/** Create appointment with Google Meet link (ConsultationOS infrastructure). */
export async function createGoogleMeetAppointment(
  input: Omit<CreateGoogleCalendarEventInput, "addGoogleMeet">,
  opts: ServerOpts = {}
): Promise<GoogleCalendarServiceResult<{ event: FiCalendarEvent }>> {
  return createGoogleCalendarEvent({ ...input, addGoogleMeet: true }, opts);
}

/** Update Google Calendar event + FI mirror. */
export async function updateGoogleCalendarEvent(
  input: UpdateGoogleCalendarEventInput,
  opts: ServerOpts = {}
): Promise<GoogleCalendarServiceResult<{ event: FiCalendarEvent }>> {
  const tenantId = input.tenantId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const local = await loadLocalEvent(supabase, tenantId, input.eventId);
  if (!local) return { ok: false, error: "Calendar event not found." };

  const ctx = await resolveIntegrationContext(tenantId, opts, local.calendar_id);
  if (!ctx.ok) return ctx;

  const externalId = local.external_event_id?.trim();
  if (!externalId) {
    return { ok: false, error: "Event has no external Google id — cannot update provider." };
  }

  const patchBody: Record<string, unknown> = {};
  if (input.title !== undefined) patchBody.summary = input.title;
  if (input.description !== undefined) patchBody.description = input.description;
  if (input.location !== undefined) patchBody.location = input.location;
  if (input.startTime !== undefined) patchBody.start = { dateTime: input.startTime };
  if (input.endTime !== undefined) patchBody.end = { dateTime: input.endTime };

  const encodedCalendar = encodeURIComponent(ctx.calendarId);
  const encodedEvent = encodeURIComponent(externalId);
  const apiResult = await callGoogleCalendarApi(
    "PATCH",
    `/calendars/${encodedCalendar}/events/${encodedEvent}`,
    ctx.accessToken,
    opts,
    patchBody
  );

  if (!apiResult.ok) return { ok: false, error: apiResult.error };

  const googleEvent = apiResult.json as GoogleCalendarApiEventWithConference;
  const mapped = mapGoogleApiEventToFiFields(googleEvent, ctx.calendarId);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("fi_calendar_events")
    .update({
      title: input.title ?? mapped.title,
      description: input.description ?? mapped.description,
      location: input.location ?? mapped.location,
      start_time: input.startTime ?? mapped.startTime,
      end_time: input.endTime ?? mapped.endTime,
      event_type: input.eventType ?? local.event_type ?? mapped.eventType,
      google_meet_url: mapped.googleMeetUrl ?? local.google_meet_url,
      metadata: {
        ...(local.metadata ?? {}),
        ...(input.metadata ?? {}),
        last_synced_at: now,
      },
      updated_at: now,
    })
    .eq("id", local.id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update FI calendar event." };
  }

  return { ok: true, data: { event: mapEventRow(data as EventRow) } };
}

/** Delete Google Calendar event + mark FI mirror. */
export async function deleteGoogleCalendarEvent(
  tenantId: string,
  eventId: string,
  opts: ServerOpts = {}
): Promise<GoogleCalendarServiceResult<{ event: FiCalendarEvent }>> {
  const tid = tenantId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const local = await loadLocalEvent(supabase, tid, eventId);
  if (!local) return { ok: false, error: "Calendar event not found." };

  const ctx = await resolveIntegrationContext(tid, opts, local.calendar_id);
  if (!ctx.ok) return ctx;

  const externalId = local.external_event_id?.trim();
  if (externalId) {
    const encodedCalendar = encodeURIComponent(ctx.calendarId);
    const encodedEvent = encodeURIComponent(externalId);
    const apiResult = await callGoogleCalendarApi(
      "DELETE",
      `/calendars/${encodedCalendar}/events/${encodedEvent}`,
      ctx.accessToken,
      opts
    );
    if (!apiResult.ok && apiResult.status !== 404) {
      return { ok: false, error: apiResult.error };
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .update({
      metadata: {
        ...(local.metadata ?? {}),
        deleted_locally: true,
        deleted_at: now,
        sync_status: "deleted",
      },
      updated_at: now,
    })
    .eq("id", local.id)
    .eq("tenant_id", tid)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update local event after delete." };
  }

  return { ok: true, data: { event: mapEventRow(data as EventRow) } };
}

/** List FI calendar events for tenant (optionally filtered by time range). */
export async function getGoogleCalendarEvents(
  tenantId: string,
  opts: ServerOpts & {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    includeDeleted?: boolean;
  } = {}
): Promise<GoogleCalendarServiceResult<{ events: FiCalendarEvent[] }>> {
  const tid = tenantId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  let query = supabase.from("fi_calendar_events").select("*").eq("tenant_id", tid);

  if (opts.calendarId) {
    query = query.eq("calendar_id", opts.calendarId.trim());
  }
  if (opts.timeMin) {
    query = query.gte("start_time", opts.timeMin);
  }
  if (opts.timeMax) {
    query = query.lte("start_time", opts.timeMax);
  }
  query = query.order("start_time", { ascending: true, nullsFirst: false });

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  let events = ((data ?? []) as EventRow[]).map(mapEventRow);
  if (!opts.includeDeleted) {
    events = events.filter(
      (e) => !e.metadata.deleted_from_provider && !e.metadata.deleted_locally
    );
  }

  return { ok: true, data: { events } };
}

function emptySkipBreakdown(): GoogleCalendarSyncSkipBreakdown {
  return {
    noExternalId: 0,
    cancelledNoLocal: 0,
    duplicateTitleStart: 0,
    uniqueViolation: 0,
    noUpdateNeeded: 0,
  };
}

function mergeSkipBreakdown(
  target: GoogleCalendarSyncSkipBreakdown,
  source: GoogleCalendarSyncSkipBreakdown
): void {
  target.noExternalId += source.noExternalId;
  target.cancelledNoLocal += source.cancelledNoLocal;
  target.duplicateTitleStart += source.duplicateTitleStart;
  target.uniqueViolation += source.uniqueViolation;
  target.noUpdateNeeded += source.noUpdateNeeded;
}

type SyncCalendarContext = {
  tenantId: string;
  integration: FiCalendarIntegration;
  accessToken: string;
  calendarScope: GoogleInboundCalendarScope;
  timeMin: string;
  timeMax: string;
  byExternalId: Map<string, FiCalendarEvent>;
  tenantLocalEvents: FiCalendarEvent[];
  reviewCounters: GoogleCalendarSyncReviewCounters;
};

/** Reconcile Google events for a single inbound calendar scope. */
async function syncGoogleCalendarEventsForCalendar(
  ctx: SyncCalendarContext,
  opts: ServerOpts
): Promise<
  | { ok: true; result: GoogleCalendarSyncPerCalendarResult; skipBreakdown: GoogleCalendarSyncSkipBreakdown }
  | { ok: false; error: string }
> {
  const {
    tenantId: tid,
    integration,
    accessToken,
    calendarScope,
    timeMin,
    timeMax,
    byExternalId,
    tenantLocalEvents,
    reviewCounters,
  } = ctx;
  const calendarId = calendarScope.calendarId;
  const calendarSummary = calendarScope.summary;
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  logStructured("info", "google_calendar_sync_calendar_start", {
    tenantId: tid,
    integrationId: integration.id,
    calendarId,
    calendarSummary,
    timeMin,
    timeMax,
  });

  const fetchResult = await fetchAllGoogleCalendarEventsForSync(
    calendarId,
    accessToken,
    timeMin,
    timeMax,
    opts
  );
  if (!fetchResult.ok) {
    logStructured("error", "google_calendar_sync_calendar_failed", {
      tenantId: tid,
      calendarId,
      calendarSummary,
      error: fetchResult.error,
    });
    return { ok: false, error: fetchResult.error };
  }
  const discovered = fetchResult.events;

  const localRows = await loadLocalEventsForDedup(supabase, tid, calendarId);

  logStructured("info", "google_calendar_sync_fetched", {
    tenantId: tid,
    calendarId,
    calendarSummary,
    eventsFetched: discovered.length,
    localEventsForCalendar: localRows.length,
    localEventsWithExternalId: byExternalId.size,
    discoveredExternalIds: discovered
      .map((e) => e.id?.trim())
      .filter(Boolean)
      .slice(0, 50)
      .join(","),
  });

  const skipBreakdown = emptySkipBreakdown();
  const skippedSamples: Array<{ externalEventId: string; reason: string; title?: string }> = [];
  const insertedExternalIds: string[] = [];

  const calendarResult: GoogleCalendarSyncPerCalendarResult = {
    calendarId,
    calendarSummary,
    eventsFetched: discovered.length,
    eventsInserted: 0,
    eventsUpdated: 0,
    eventsSkipped: 0,
    eventsMarkedDeleted: 0,
  };

  const discoveredIds = new Set<string>();
  const sourceCalendar = { calendarId, summary: calendarSummary };

  for (let eventIndex = 0; eventIndex < discovered.length; eventIndex += 1) {
    const raw = discovered[eventIndex]!;
    const startDateTime = raw.start?.dateTime ?? raw.start?.date ?? null;
    const mappingDiag = diagnoseGoogleApiEventMapping(raw, calendarId);
    const mapped = mappingDiag.mapped;

    logStructured("info", "google_calendar_sync_event", {
      tenantId: tid,
      calendarId,
      calendarSummary,
      eventIndex,
      eventId: raw.id ?? null,
      eventSummary: raw.summary ?? null,
      startDateTime,
      mappedSuccessfully: !mappingDiag.mappingFailed,
      mappingFailureReason: mappingDiag.failureReason,
      mappedExternalEventId: mapped.externalEventId,
      mappedStartTime: mapped.startTime,
      mappedEndTime: mapped.endTime,
    });

    if (mappingDiag.mappingFailed) {
      logStructured("warn", "google_calendar_sync_map_failed", {
        tenantId: tid,
        calendarId,
        calendarSummary,
        eventIndex,
        eventId: raw.id ?? null,
        eventSummary: raw.summary ?? null,
        startDateTime,
        failureReason: mappingDiag.failureReason,
        note: "mapGoogleApiEventToFiFields never returns null; mappingFailed means required insert fields are missing",
      });
    }

    const extId = mapped.externalEventId;
    const existing = extId ? byExternalId.get(extId) : undefined;
    const syncNow = new Date().toISOString();

    const stagedForReview = await stageGoogleCalendarSyncReviewIfConflict(
      {
        tenantId: tid,
        integrationId: integration.id,
        googleCalendarId: calendarId,
        googleCalendarSummary: calendarSummary,
        googleEvent: raw,
        existingByExternalId: existing,
        localEvents: tenantLocalEvents,
        counters: reviewCounters,
      },
      opts
    );
    if (stagedForReview) {
      calendarResult.eventsSkipped += 1;
      if (!extId) skipBreakdown.noExternalId += 1;
      else if (isGoogleEventCancelled(raw) && !existing) skipBreakdown.cancelledNoLocal += 1;
      else if (
        !existing &&
        isDuplicateFiCalendarEvent(
          { externalEventId: extId ?? null, title: mapped.title, startTime: mapped.startTime },
          localRows
        )
      ) {
        skipBreakdown.duplicateTitleStart += 1;
      }
      logStructured("info", "google_calendar_sync_skip", {
        tenantId: tid,
        calendarId,
        calendarSummary,
        skipReason: "stagedForReview",
        eventIndex,
        eventId: raw.id ?? null,
        externalEventId: extId ?? null,
        eventSummary: raw.summary ?? null,
      });
      if (skippedSamples.length < 10) {
        skippedSamples.push({
          externalEventId: extId ?? "",
          reason: "staged_for_review",
          title: raw.summary?.trim() || mapped.title,
        });
      }
      if (extId) discoveredIds.add(extId);
      continue;
    }

    if (!extId) {
      calendarResult.eventsSkipped += 1;
      skipBreakdown.noExternalId += 1;
      logStructured("info", "google_calendar_sync_skip", {
        tenantId: tid,
        calendarId,
        calendarSummary,
        skipReason: "noExternalId",
        eventIndex,
        eventId: raw.id ?? null,
        eventSummary: raw.summary ?? null,
      });
      if (skippedSamples.length < 10) {
        skippedSamples.push({
          externalEventId: "",
          reason: "no_external_id",
          title: raw.summary?.trim() || undefined,
        });
      }
      continue;
    }
    discoveredIds.add(extId);

    if (isGoogleEventCancelled(raw)) {
      if (existing && !existing.metadata?.deleted_from_provider) {
        const markResult = await markLocalEventDeletedFromProvider(
          supabase,
          tid,
          existing.id,
          existing.metadata ?? {}
        );
        if (!markResult.ok) return { ok: false, error: markResult.error };
        calendarResult.eventsMarkedDeleted += 1;
      } else {
        calendarResult.eventsSkipped += 1;
        skipBreakdown.cancelledNoLocal += 1;
        logStructured("info", "google_calendar_sync_skip", {
          tenantId: tid,
          calendarId,
          calendarSummary,
          skipReason: "cancelledNoLocal",
          eventIndex,
          externalEventId: extId,
          eventSummary: raw.summary ?? null,
          hasLocalRow: Boolean(existing),
        });
        if (skippedSamples.length < 10) {
          skippedSamples.push({ externalEventId: extId, reason: "cancelled_no_local" });
        }
      }
      continue;
    }

    if (!existing) {
      if (
        isDuplicateFiCalendarEvent(
          { externalEventId: extId, title: mapped.title, startTime: mapped.startTime },
          localRows
        )
      ) {
        calendarResult.eventsSkipped += 1;
        skipBreakdown.duplicateTitleStart += 1;
        logStructured("info", "google_calendar_sync_skip", {
          tenantId: tid,
          calendarId,
          calendarSummary,
          skipReason: "duplicateTitleStart",
          eventIndex,
          externalEventId: extId,
          eventSummary: mapped.title,
          mappedStartTime: mapped.startTime,
        });
        if (skippedSamples.length < 10) {
          skippedSamples.push({
            externalEventId: extId,
            reason: "duplicate_title_start",
            title: mapped.title,
          });
        }
        continue;
      }

      logStructured("info", "google_calendar_sync_insert_attempt", {
        tenantId: tid,
        calendarId,
        calendarSummary,
        eventIndex,
        externalEventId: extId,
        title: mapped.title,
        startTime: mapped.startTime,
        endTime: mapped.endTime,
      });

      const { error } = await supabase.from("fi_calendar_events").insert({
        tenant_id: tid,
        external_event_id: extId,
        provider: "google",
        calendar_id: calendarId,
        title: mapped.title,
        description: mapped.description,
        location: mapped.location,
        start_time: mapped.startTime,
        end_time: mapped.endTime,
        event_type: mapped.eventType,
        google_meet_url: mapped.googleMeetUrl,
        metadata: buildGoogleSyncInsertMetadata(integration.id, syncNow, sourceCalendar),
      });

      if (error) {
        if (error.code === "23505") {
          calendarResult.eventsSkipped += 1;
          skipBreakdown.uniqueViolation += 1;
          logStructured("info", "google_calendar_sync_skip", {
            tenantId: tid,
            calendarId,
            calendarSummary,
            skipReason: "uniqueViolation",
            eventIndex,
            externalEventId: extId,
            dbErrorCode: error.code,
            dbErrorMessage: error.message,
          });
          if (skippedSamples.length < 10) {
            skippedSamples.push({
              externalEventId: extId,
              reason: "unique_violation_external_event_id",
              title: mapped.title,
            });
          }
        } else {
          return { ok: false, error: error.message };
        }
      } else {
        calendarResult.eventsInserted += 1;
        insertedExternalIds.push(extId);
        byExternalId.set(extId, {
          id: "",
          tenantId: tid,
          externalEventId: extId,
          provider: "google",
          calendarId,
          title: mapped.title,
          description: mapped.description,
          location: mapped.location,
          startTime: mapped.startTime,
          endTime: mapped.endTime,
          eventType: mapped.eventType,
          googleMeetUrl: mapped.googleMeetUrl,
          patientId: null,
          leadId: null,
          metadata: buildGoogleSyncInsertMetadata(integration.id, syncNow, sourceCalendar),
          createdAt: syncNow,
          updatedAt: syncNow,
        });
        logStructured("info", "google_calendar_sync_inserted", {
          tenantId: tid,
          calendarId,
          calendarSummary,
          eventIndex,
          externalEventId: extId,
          title: mapped.title,
        });
      }
      continue;
    }

    if (!shouldUpdateFiEventFromGoogle(existing, raw)) {
      calendarResult.eventsSkipped += 1;
      skipBreakdown.noUpdateNeeded += 1;
      logStructured("info", "google_calendar_sync_skip", {
        tenantId: tid,
        calendarId,
        calendarSummary,
        skipReason: "noUpdateNeeded",
        eventIndex,
        externalEventId: extId,
        eventSummary: mapped.title,
        localSource: String(existing.metadata?.source ?? ""),
        localUpdatedAt: existing.updatedAt,
        googleUpdated: raw.updated ?? null,
      });
      if (skippedSamples.length < 10) {
        skippedSamples.push({
          externalEventId: extId,
          reason: "no_update_needed",
          title: mapped.title,
        });
      }
      continue;
    }

    const { error } = await supabase
      .from("fi_calendar_events")
      .update({
        title: mapped.title,
        description: mapped.description,
        location: mapped.location,
        start_time: mapped.startTime,
        end_time: mapped.endTime,
        event_type: mapped.eventType,
        google_meet_url: mapped.googleMeetUrl ?? existing.googleMeetUrl,
        calendar_id: calendarId,
        metadata: buildGoogleSyncUpdateMetadata(existing.metadata ?? {}, syncNow, sourceCalendar),
        updated_at: syncNow,
      })
      .eq("id", existing.id)
      .eq("tenant_id", tid);

    if (error) return { ok: false, error: error.message };
    calendarResult.eventsUpdated += 1;
  }

  const deletedLocalIds = detectDeletedExternalEvents(localRows, discoveredIds, { timeMin, timeMax });
  const deletedExternalIds: string[] = [];
  for (const localId of deletedLocalIds) {
    const local = localRows.find((r) => r.id === localId);
    if (!local) continue;

    const extId = local.externalEventId?.trim();
    if (extId) deletedExternalIds.push(extId);

    const markResult = await markLocalEventDeletedFromProvider(
      supabase,
      tid,
      localId,
      local.metadata ?? {}
    );
    if (!markResult.ok) return { ok: false, error: markResult.error };
    calendarResult.eventsMarkedDeleted += 1;
  }

  for (const local of localRows) {
    const extId = local.externalEventId?.trim();
    if (!extId) continue;
    if (local.metadata?.deleted_from_provider) continue;
    if (!isFiCreatedCalendarSource(local.metadata?.source)) continue;
    if (!isEventStartInSyncWindow(local.startTime, timeMin, timeMax)) continue;
    if (discoveredIds.has(extId)) continue;

    const lookup = await lookupGoogleCalendarEventById(calendarId, extId, accessToken, opts);
    if (lookup === "not_found") {
      deletedExternalIds.push(extId);
      const markResult = await markLocalEventDeletedFromProvider(
        supabase,
        tid,
        local.id,
        local.metadata ?? {}
      );
      if (!markResult.ok) return { ok: false, error: markResult.error };
      calendarResult.eventsMarkedDeleted += 1;
    }
  }

  logStructured("info", "google_calendar_sync_calendar_complete", {
    tenantId: tid,
    calendarId,
    calendarSummary,
    eventsFetched: calendarResult.eventsFetched,
    eventsInserted: calendarResult.eventsInserted,
    eventsUpdated: calendarResult.eventsUpdated,
    eventsSkipped: calendarResult.eventsSkipped,
    eventsMarkedDeleted: calendarResult.eventsMarkedDeleted,
    skipNoExternalId: skipBreakdown.noExternalId,
    skipDuplicateTitleStart: skipBreakdown.duplicateTitleStart,
    skipUniqueViolation: skipBreakdown.uniqueViolation,
    skipNoUpdateNeeded: skipBreakdown.noUpdateNeeded,
    skipCancelledNoLocal: skipBreakdown.cancelledNoLocal,
    insertedExternalIds: insertedExternalIds.slice(0, 50).join(","),
    deletedExternalIds: deletedExternalIds.slice(0, 50).join(","),
    processedExternalIds: Array.from(discoveredIds).slice(0, 50).join(","),
  });

  if (skippedSamples.length > 0) {
    logStructured("info", "google_calendar_sync_skipped_samples", {
      tenantId: tid,
      calendarId,
      calendarSummary,
      sampleCount: skippedSamples.length,
      samplesJson: JSON.stringify(skippedSamples),
    });
  }

  if (calendarScope.inboundRowId) {
    await touchInboundSyncCalendarLastSynced(calendarScope.inboundRowId, tid, opts);
  }

  return { ok: true, result: calendarResult, skipBreakdown };
}

/** Pull recent Google events and reconcile FI mirror (dedup, updates, deletions). */
export async function syncGoogleCalendarEvents(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<GoogleCalendarServiceResult<{ result: GoogleCalendarSyncResult }>> {
  const tid = tenantId.trim();
  const ctx = await resolveIntegrationContext(tid, opts);
  if (!ctx.ok) return ctx;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const now = Date.now();
  const lookbackDays = opts.lookbackDays ?? SYNC_LOOKBACK_DAYS;
  const lookaheadDays = opts.lookaheadDays ?? SYNC_LOOKAHEAD_DAYS;
  const timeMin = new Date(now - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now + lookaheadDays * 24 * 60 * 60 * 1000).toISOString();

  const calendarScopes = await getGoogleInboundCalendarScopesForIntegration(ctx.integration, opts);

  logStructured("info", "google_calendar_sync_cycle_start", {
    tenantId: tid,
    integrationId: ctx.integration.id,
    googleAccountEmail: ctx.integration.googleAccountEmail ?? null,
    calendarCount: calendarScopes.length,
    calendarIds: calendarScopes.map((c) => c.calendarId).join(","),
    timeMin,
    timeMax,
    lookbackDays,
    lookaheadDays,
  });

  const byExternalId = await loadLocalEventsByExternalIdForSync(supabase, tid);
  const tenantLocalEvents = await loadLocalEventsForReview(supabase, tid);
  const skipBreakdown = emptySkipBreakdown();
  const reviewCounters = emptyReviewSyncCounters();
  const perCalendar: GoogleCalendarSyncPerCalendarResult[] = [];
  const failedCalendars: Array<{ calendarId: string; error: string }> = [];

  const result: GoogleCalendarSyncResult = {
    discovered: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    skipBreakdown,
    calendarsScanned: 0,
    eventsFetchedTotal: 0,
    eventsInsertedTotal: 0,
    eventsUpdatedTotal: 0,
    eventsSkippedTotal: 0,
    perCalendar,
    failedCalendars,
    reviewSummary: reviewCounters,
  };

  for (const calendarScope of calendarScopes) {
    const calendarOutcome = await syncGoogleCalendarEventsForCalendar(
      {
        tenantId: tid,
        integration: ctx.integration,
        accessToken: ctx.accessToken,
        calendarScope,
        timeMin,
        timeMax,
        byExternalId,
        tenantLocalEvents,
        reviewCounters,
      },
      opts
    );

    if (!calendarOutcome.ok) {
      failedCalendars.push({
        calendarId: calendarScope.calendarId,
        error: calendarOutcome.error,
      });
      perCalendar.push({
        calendarId: calendarScope.calendarId,
        calendarSummary: calendarScope.summary,
        eventsFetched: 0,
        eventsInserted: 0,
        eventsUpdated: 0,
        eventsSkipped: 0,
        eventsMarkedDeleted: 0,
        failed: true,
        error: calendarOutcome.error,
      });

      if (isGoogleCalendarAuthFailure(calendarOutcome.error)) {
        return { ok: false, error: calendarOutcome.error };
      }
      continue;
    }

    const cal = calendarOutcome.result;
    perCalendar.push(cal);
    result.calendarsScanned = (result.calendarsScanned ?? 0) + 1;
    result.discovered += cal.eventsFetched;
    result.created += cal.eventsInserted;
    result.updated += cal.eventsUpdated;
    result.skipped += cal.eventsSkipped;
    result.deleted += cal.eventsMarkedDeleted;
    result.eventsFetchedTotal = (result.eventsFetchedTotal ?? 0) + cal.eventsFetched;
    result.eventsInsertedTotal = (result.eventsInsertedTotal ?? 0) + cal.eventsInserted;
    result.eventsUpdatedTotal = (result.eventsUpdatedTotal ?? 0) + cal.eventsUpdated;
    result.eventsSkippedTotal = (result.eventsSkippedTotal ?? 0) + cal.eventsSkipped;
    mergeSkipBreakdown(skipBreakdown, calendarOutcome.skipBreakdown);
  }

  logStructured("info", "google_calendar_sync_cycle_complete", {
    tenantId: tid,
    integrationId: ctx.integration.id,
    calendarsScanned: result.calendarsScanned,
    eventsFetchedTotal: result.eventsFetchedTotal,
    eventsInsertedTotal: result.eventsInsertedTotal,
    eventsUpdatedTotal: result.eventsUpdatedTotal,
    eventsSkippedTotal: result.eventsSkippedTotal,
    eventsMarkedDeletedTotal: result.deleted,
    failedCalendarCount: failedCalendars.length,
    failedCalendarsJson: failedCalendars.length ? JSON.stringify(failedCalendars) : null,
    perCalendarJson: JSON.stringify(
      perCalendar.map((c) => ({
        calendarId: c.calendarId,
        calendarSummary: c.calendarSummary,
        eventsFetched: c.eventsFetched,
        eventsInserted: c.eventsInserted,
        eventsUpdated: c.eventsUpdated,
        eventsSkipped: c.eventsSkipped,
        eventsMarkedDeleted: c.eventsMarkedDeleted,
        failed: c.failed ?? false,
      }))
    ),
    skipNoExternalId: skipBreakdown.noExternalId,
    skipDuplicateTitleStart: skipBreakdown.duplicateTitleStart,
    skipUniqueViolation: skipBreakdown.uniqueViolation,
    skipNoUpdateNeeded: skipBreakdown.noUpdateNeeded,
    skipCancelledNoLocal: skipBreakdown.cancelledNoLocal,
    reviewItemsCreated: reviewCounters.reviewItemsCreated,
    reviewItemsUpdated: reviewCounters.reviewItemsUpdated,
    conflictsDetected: reviewCounters.conflictsDetected,
    conflictsByTypeJson: JSON.stringify(reviewCounters.conflictsByType),
  });

  if (failedCalendars.length > 0 && (result.calendarsScanned ?? 0) === 0) {
    return { ok: false, error: failedCalendars[0]!.error };
  }

  return { ok: true, data: { result } };
}
