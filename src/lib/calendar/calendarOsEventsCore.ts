/**
 * CalendarOS Phase GC-5 — map `fi_calendar_events` into operational calendar booking shape.
 * Pure helpers (no server-only) for loader + unit tests.
 */

import type { FiCalendarEvent } from "@/src/lib/googleCalendar/googleCalendarTypes";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  anchorLabelForBookingRow,
  type BookingDisplayContextMaps,
} from "@/src/lib/bookings/bookingDisplayContext";
import { serviceForBookingType } from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";

export const CALENDAR_OS_EVENT_META_FLAG = "calendar_os_event" as const;

export type CalendarOsProviderKind = "google" | "fi";

export type CalendarOsSourceLabel = "Google Calendar" | "FI OS";

export type CalendarOsEventClientFields = {
  calendarOsProvider: CalendarOsProviderKind;
  calendarOsSourceLabel: CalendarOsSourceLabel;
  calendarId: string;
  googleMeetUrl: string | null;
  externalEventId: string | null;
  eventType: string | null;
  calendarOsStatus: string | null;
};

/** Safe column subset loaded from `fi_calendar_events` for calendar overlap reads. */
export type FiCalendarEventOverlapRow = {
  id: string;
  tenant_id: string;
  external_event_id: string | null;
  provider: string;
  calendar_id: string;
  title: string;
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

export const FI_CALENDAR_EVENTS_OVERLAP_SELECT =
  "id, tenant_id, external_event_id, provider, calendar_id, title, location, start_time, end_time, event_type, google_meet_url, patient_id, lead_id, metadata, created_at, updated_at";

const TOKEN_KEY_PATTERN = /token|secret|credential|password|authorization|refresh_token|access_token/i;
const RAW_GOOGLE_PAYLOAD_KEYS = new Set([
  "raw_google_event",
  "google_event",
  "provider_payload",
  "oauth",
  "conferenceData",
  "attendees",
]);

function humanizeEventType(type: string): string {
  const t = type.trim();
  if (!t) return "Event";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** True when metadata marks a mirrored CalendarOS event (read-only in GC-5). */
export function isCalendarOsEventRow(row: Pick<FiBookingRow, "metadata">): boolean {
  const meta = row.metadata ?? {};
  return meta[CALENDAR_OS_EVENT_META_FLAG] === true;
}

/** Resolve FI vs Google source from event metadata (GC-4 writes `source: fi_calendar_create`). */
export function resolveCalendarOsProviderKind(
  metadata: Record<string, unknown> | null | undefined
): CalendarOsProviderKind {
  const source = String(metadata?.source ?? "").trim().toLowerCase();
  if (source === "fi_calendar_create") return "fi";
  return "google";
}

export function calendarOsSourceLabelForProvider(provider: CalendarOsProviderKind): CalendarOsSourceLabel {
  return provider === "fi" ? "FI OS" : "Google Calendar";
}

/** Strip secrets and raw Google payloads before serializing to the calendar client. */
export function sanitizeCalendarOsMetadataForClient(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return out;

  for (const [key, value] of Object.entries(metadata)) {
    if (TOKEN_KEY_PATTERN.test(key)) continue;
    if (RAW_GOOGLE_PAYLOAD_KEYS.has(key)) continue;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      const nested = sanitizeCalendarOsMetadataForClient(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }
    if (Array.isArray(value)) continue;
    out[key] = value;
  }
  return out;
}

export function calendarOsClientFieldsFromEvent(
  event: Pick<
    FiCalendarEvent | FiCalendarEventOverlapRow,
    | "provider"
    | "calendar_id"
    | "calendarId"
    | "google_meet_url"
    | "googleMeetUrl"
    | "external_event_id"
    | "externalEventId"
    | "event_type"
    | "eventType"
    | "metadata"
  >
): CalendarOsEventClientFields {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const providerKind = resolveCalendarOsProviderKind(metadata);
  const eventType =
    ("event_type" in event ? event.event_type : event.eventType)?.trim() ||
    (typeof metadata.event_type === "string" ? metadata.event_type.trim() : "") ||
    null;
  const statusRaw =
    typeof metadata.sync_status === "string"
      ? metadata.sync_status.trim()
      : typeof metadata.status === "string"
        ? metadata.status.trim()
        : null;

  return {
    calendarOsProvider: providerKind,
    calendarOsSourceLabel: calendarOsSourceLabelForProvider(providerKind),
    calendarId: ("calendar_id" in event ? event.calendar_id : event.calendarId)?.trim() || "",
    googleMeetUrl:
      ("google_meet_url" in event ? event.google_meet_url : event.googleMeetUrl)?.trim() || null,
    externalEventId:
      ("external_event_id" in event ? event.external_event_id : event.externalEventId)?.trim() || null,
    eventType,
    calendarOsStatus: statusRaw || "scheduled",
  };
}

export function mapFiCalendarEventOverlapRowToBookingRow(
  row: FiCalendarEventOverlapRow,
  calendarTimezone: string
): FiBookingRow | null {
  const startAt = row.start_time?.trim();
  const endAt = row.end_time?.trim();
  if (!startAt || !endAt) return null;
  if (Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt))) return null;

  const meta = row.metadata ?? {};
  if (meta.deleted_from_provider === true || meta.deleted_locally === true) return null;

  const clientFields = calendarOsClientFieldsFromEvent(row);
  const eventType = clientFields.eventType?.trim() || "consultation";
  const safeMeta = sanitizeCalendarOsMetadataForClient(meta);

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    lead_id: row.lead_id,
    person_id: null,
    patient_id: row.patient_id,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: eventType,
    booking_status: clientFields.calendarOsStatus ?? "scheduled",
    title: row.title?.trim() || "(Untitled event)",
    description: null,
    start_at: startAt,
    end_at: endAt,
    timezone: calendarTimezone,
    location: row.location,
    metadata: {
      ...safeMeta,
      [CALENDAR_OS_EVENT_META_FLAG]: true,
      calendar_os_provider: clientFields.calendarOsProvider,
      calendar_os_source_label: clientFields.calendarOsSourceLabel,
      calendar_id: clientFields.calendarId,
      google_meet_url: clientFields.googleMeetUrl,
      external_event_id: clientFields.externalEventId,
      event_type: clientFields.eventType,
      calendar_os_status: clientFields.calendarOsStatus,
      ...(clientFields.googleMeetUrl ? { is_virtual: true } : {}),
    },
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapFiCalendarEventToBookingDisplay(
  row: FiCalendarEventOverlapRow,
  opts?: {
    anchorLabel?: string;
    procedureCatalogName?: string | null;
    procedureCatalogHex?: string | null;
  }
): OperationalCalendarBookingDisplay {
  const clientFields = calendarOsClientFieldsFromEvent(row);
  const startMs = row.start_time ? Date.parse(row.start_time) : NaN;
  const endMs = row.end_time ? Date.parse(row.end_time) : NaN;
  const durationMin =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.round((endMs - startMs) / 60000))
      : 30;

  const eventTypeLabel = humanizeEventType(clientFields.eventType ?? row.event_type ?? "event");

  return {
    anchorLabel: opts?.anchorLabel?.trim() || row.title?.trim() || eventTypeLabel,
    scalesSummary: null,
    durationMin,
    reminderHint: null,
    procedureCatalogName: opts?.procedureCatalogName ?? eventTypeLabel,
    procedureCatalogHex: opts?.procedureCatalogHex ?? null,
    suggestedPrice: null,
    patientEmail: null,
    patientPhone: null,
    roomLabel: row.location?.trim() || null,
    resourceRoomLine: null,
    resourceTeamLine: null,
    clinicalStaffing: null,
    calendarOsSourceLabel: clientFields.calendarOsSourceLabel,
    calendarOsProvider: clientFields.calendarOsProvider,
    googleMeetUrl: clientFields.googleMeetUrl,
    calendarOsCalendarId: clientFields.calendarId,
    calendarOsEventTypeLabel: eventTypeLabel,
    calendarOsExternalEventId: clientFields.externalEventId,
    calendarOsStatus: clientFields.calendarOsStatus,
  };
}

/** Returns true when serialized booking row exposes token or raw Google payload keys. */
export function calendarOsBookingRowExposesSecrets(row: FiBookingRow): boolean {
  const meta = row.metadata ?? {};
  for (const key of Object.keys(meta)) {
    if (TOKEN_KEY_PATTERN.test(key)) return true;
    if (RAW_GOOGLE_PAYLOAD_KEYS.has(key)) return true;
  }
  const serialized = JSON.stringify(row);
  return /access_token|refresh_token|provider_payload/i.test(serialized);
}

export function mapFiCalendarEventsToOperationalCalendar(
  rows: FiCalendarEventOverlapRow[],
  opts: {
    tenantId: string;
    calendarTimezone: string;
    displayMaps: BookingDisplayContextMaps;
    services: FiServiceRow[];
  }
): { bookings: FiBookingRow[]; bookingDisplay: Record<string, OperationalCalendarBookingDisplay> } {
  const bookings: FiBookingRow[] = [];
  const bookingDisplay: Record<string, OperationalCalendarBookingDisplay> = {};

  for (const row of rows) {
    if (row.tenant_id.trim() !== opts.tenantId.trim()) continue;

    const mapped = mapFiCalendarEventOverlapRowToBookingRow(row, opts.calendarTimezone);
    if (!mapped) continue;

    const cat = serviceForBookingType(opts.services, mapped.booking_type);
    const anchorLabel = anchorLabelForBookingRow(mapped, opts.displayMaps);
    bookingDisplay[mapped.id] = mapFiCalendarEventToBookingDisplay(row, {
      anchorLabel,
      procedureCatalogName: cat?.name ?? null,
      procedureCatalogHex: cat?.color ?? null,
    });
    bookings.push(mapped);
  }

  return { bookings, bookingDisplay };
}
