import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { resolveGoogleCalendarAccessToken } from "./googleCalendarAuth.server";
import {
  buildGoogleMeetConferenceRequest,
  extractGoogleMeetUrl,
  mapGoogleApiEventToFiFields,
} from "./googleCalendarCore";
import type {
  FiAppointmentInput,
  FiCalendarEvent,
  GoogleCalendarApiEventWithConference,
  NormalizedFiAppointmentInput,
  SanitizedFiAppointment,
} from "./googleCalendarTypes";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const DEFAULT_EVENT_TYPE = "consultation";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FiAppointmentResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export type FiAppointmentServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  fetchOverride?: typeof fetch;
  integrationId?: string;
  actorAuthUserId?: string | null;
  actorLabel?: string | null;
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

function parseIsoTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

/** Validate attendee email addresses for Google Calendar invites. */
export function isValidAppointmentAttendeeEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 320) return false;
  return EMAIL_PATTERN.test(trimmed);
}

/** Normalize and validate FI appointment input before Google Calendar write. */
export function normalizeFiAppointmentInput(
  input: FiAppointmentInput
): FiAppointmentResult<{ normalized: NormalizedFiAppointmentInput }> {
  const tenantId = input.tenantId?.trim();
  if (!tenantId) return { ok: false, error: "Tenant id is required." };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Title is required." };

  const startTime = parseIsoTime(input.startTime);
  if (!startTime) return { ok: false, error: "Start time is required and must be a valid ISO datetime." };

  const endTime = parseIsoTime(input.endTime);
  if (!endTime) return { ok: false, error: "End time is required and must be a valid ISO datetime." };

  if (Date.parse(endTime) <= Date.parse(startTime)) {
    return { ok: false, error: "End time must be after start time." };
  }

  const attendeesRaw = input.attendees ?? [];
  const attendees: string[] = [];
  for (const raw of attendeesRaw) {
    const email = String(raw).trim().toLowerCase();
    if (!email) continue;
    if (!isValidAppointmentAttendeeEmail(email)) {
      return { ok: false, error: `Invalid attendee email: ${raw}` };
    }
    if (!attendees.includes(email)) attendees.push(email);
  }

  const eventType = (input.eventType?.trim() || DEFAULT_EVENT_TYPE).toLowerCase();

  return {
    ok: true,
    data: {
      normalized: {
        tenantId,
        title,
        description: input.description?.trim() ?? null,
        location: input.location?.trim() ?? null,
        startTime,
        endTime,
        eventType,
        patientId: input.patientId?.trim() ?? null,
        leadId: input.leadId?.trim() ?? null,
        addGoogleMeet: Boolean(input.addGoogleMeet),
        attendees,
        metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {},
      },
    },
  };
}

/** Build Google Calendar events.insert payload from normalized FI appointment input. */
export function buildGoogleCalendarEventPayload(
  input: NormalizedFiAppointmentInput
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
    start: { dateTime: input.startTime },
    end: { dateTime: input.endTime },
  };

  if (input.attendees.length > 0) {
    body.attendees = input.attendees.map((email) => ({ email }));
  }

  if (input.addGoogleMeet) {
    body.conferenceData = buildGoogleMeetConferenceRequest(randomUUID());
  }

  return body;
}

/** Strip sensitive fields — API-safe appointment object only. */
export function sanitizeFiAppointmentForResponse(
  event: FiCalendarEvent
): SanitizedFiAppointment {
  return {
    id: event.id,
    title: event.title,
    start_time: event.startTime ?? "",
    end_time: event.endTime ?? "",
    google_meet_url: event.googleMeetUrl,
    external_event_id: event.externalEventId,
    calendar_id: event.calendarId,
  };
}

async function callGoogleCalendarApi(
  method: "POST",
  path: string,
  accessToken: string,
  opts: FiAppointmentServerOpts,
  body: Record<string, unknown>,
  query?: Record<string, string>
): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
  const fetchFn = opts.fetchOverride ?? fetch;
  const params = query ? `?${new URLSearchParams(query).toString()}` : "";
  const url = `${GOOGLE_CALENDAR_API_BASE}${path}${params}`;

  const res = await fetchFn(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Google Calendar API error (${res.status}): ${text.slice(0, 300)}`,
    };
  }

  return { ok: true, json: await res.json() };
}

async function loadLocalEventByExternalId(
  supabase: SupabaseClient,
  tenantId: string,
  externalEventId: string
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from("fi_calendar_events")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("external_event_id", externalEventId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventRow | null) ?? null;
}

async function insertLocalAppointment(
  supabase: SupabaseClient,
  row: {
    tenantId: string;
    externalEventId: string;
    calendarId: string;
    title: string;
    description: string | null;
    location: string | null;
    startTime: string;
    endTime: string;
    eventType: string;
    googleMeetUrl: string | null;
    patientId: string | null;
    leadId: string | null;
    metadata: Record<string, unknown>;
  }
): Promise<{ row: EventRow; created: boolean }> {
  const existing = await loadLocalEventByExternalId(supabase, row.tenantId, row.externalEventId);
  if (existing) {
    return { row: existing, created: false };
  }

  const { data, error } = await supabase
    .from("fi_calendar_events")
    .insert({
      tenant_id: row.tenantId,
      external_event_id: row.externalEventId,
      provider: "google",
      calendar_id: row.calendarId,
      title: row.title,
      description: row.description,
      location: row.location,
      start_time: row.startTime,
      end_time: row.endTime,
      event_type: row.eventType,
      google_meet_url: row.googleMeetUrl,
      patient_id: row.patientId,
      lead_id: row.leadId,
      metadata: row.metadata,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const dup = await loadLocalEventByExternalId(supabase, row.tenantId, row.externalEventId);
      if (dup) return { row: dup, created: false };
    }
    throw new Error(error.message ?? "Failed to create FI calendar event.");
  }

  return { row: data as EventRow, created: true };
}

/** Record appointment creation activity in event metadata (no separate audit table in GC-1). */
export async function appendCalendarAppointmentActivity(
  supabase: SupabaseClient,
  eventId: string,
  tenantId: string,
  entry: {
    action: "created" | "meet_added";
    actorAuthUserId?: string | null;
    actorLabel?: string | null;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  const { data: existing, error: loadErr } = await supabase
    .from("fi_calendar_events")
    .select("metadata")
    .eq("id", eventId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (loadErr || !existing) return;

  const metadata = (existing.metadata ?? {}) as Record<string, unknown>;
  const activityRaw = metadata.appointment_activity;
  const activity = Array.isArray(activityRaw) ? [...activityRaw] : [];
  activity.push({
    action: entry.action,
    at: new Date().toISOString(),
    actor_auth_user_id: entry.actorAuthUserId ?? null,
    actor_label: entry.actorLabel ?? null,
    ...(entry.detail ?? {}),
  });

  await supabase
    .from("fi_calendar_events")
    .update({
      metadata: { ...metadata, appointment_activity: activity },
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .eq("tenant_id", tenantId);
}

/** Create native FI calendar appointment mirrored to Google Calendar. */
export async function createFiCalendarAppointment(
  input: FiAppointmentInput,
  opts: FiAppointmentServerOpts = {}
): Promise<FiAppointmentResult<{ appointment: SanitizedFiAppointment; event: FiCalendarEvent }>> {
  const normalizedResult = normalizeFiAppointmentInput(input);
  if (!normalizedResult.ok) return normalizedResult;

  const normalized = normalizedResult.data!.normalized;
  const tokenResult = await resolveGoogleCalendarAccessToken(normalized.tenantId, opts);
  if (!tokenResult.ok) {
    const friendly =
      tokenResult.error.includes("not found") || tokenResult.error.includes("disconnected")
        ? "Google Calendar is not connected for this clinic. Connect Google Calendar in Settings → Integrations first."
        : tokenResult.error.includes("expired") || tokenResult.error.includes("Refresh token")
          ? "Google Calendar connection has expired. Reconnect in Settings → Integrations."
          : tokenResult.error;
    return { ok: false, error: friendly };
  }

  const { accessToken, integration } = tokenResult.data!;
  const calendarId = integration.calendarId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();

  const googleBody = buildGoogleCalendarEventPayload(normalized);
  const query: Record<string, string> = {
    sendUpdates: "none",
  };
  if (normalized.addGoogleMeet) {
    query.conferenceDataVersion = "1";
  }

  const encodedCalendar = encodeURIComponent(calendarId);
  const apiResult = await callGoogleCalendarApi(
    "POST",
    `/calendars/${encodedCalendar}/events`,
    accessToken,
    opts,
    googleBody,
    query
  );

  if (!apiResult.ok) return { ok: false, error: apiResult.error };

  const googleEvent = apiResult.json as GoogleCalendarApiEventWithConference;
  const mapped = mapGoogleApiEventToFiFields(googleEvent, calendarId);
  const externalEventId = mapped.externalEventId?.trim();
  if (!externalEventId) {
    return { ok: false, error: "Google Calendar did not return an event id." };
  }

  const meetUrl = normalized.addGoogleMeet ? extractGoogleMeetUrl(googleEvent) : null;

  try {
    const insertResult = await insertLocalAppointment(supabase, {
      tenantId: normalized.tenantId,
      externalEventId,
      calendarId,
      title: mapped.title,
      description: mapped.description ?? normalized.description,
      location: mapped.location ?? normalized.location,
      startTime: mapped.startTime ?? normalized.startTime,
      endTime: mapped.endTime ?? normalized.endTime,
      eventType: normalized.eventType,
      googleMeetUrl: meetUrl ?? (normalized.addGoogleMeet ? mapped.googleMeetUrl : null),
      patientId: normalized.patientId,
      leadId: normalized.leadId,
      metadata: {
        ...normalized.metadata,
        source: "fi_appointment_create",
        integration_id: integration.id,
        attendee_emails: normalized.attendees,
        attendee_invites_sent: false,
        send_updates: "none",
      },
    });

    const { row, created } = insertResult;
    let event = mapEventRow(row);

    if (!created) {
      event = {
        ...event,
        metadata: { ...event.metadata, deduplicated_on_retry: true },
      };
    }

    if (created) {
      await appendCalendarAppointmentActivity(supabase, event.id, normalized.tenantId, {
        action: normalized.addGoogleMeet ? "meet_added" : "created",
        actorAuthUserId: opts.actorAuthUserId,
        actorLabel: opts.actorLabel,
        detail: {
          external_event_id: externalEventId,
          add_google_meet: normalized.addGoogleMeet,
          attendee_count: normalized.attendees.length,
        },
      });
    }

    return {
      ok: true,
      data: {
        appointment: sanitizeFiAppointmentForResponse(event),
        event,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mirror appointment locally." };
  }
}

/** Create FI appointment with Google Meet link (ConsultationOS infrastructure). */
export async function createFiGoogleMeetAppointment(
  input: Omit<FiAppointmentInput, "addGoogleMeet">,
  opts: FiAppointmentServerOpts = {}
): Promise<FiAppointmentResult<{ appointment: SanitizedFiAppointment; event: FiCalendarEvent }>> {
  return createFiCalendarAppointment({ ...input, addGoogleMeet: true }, opts);
}
