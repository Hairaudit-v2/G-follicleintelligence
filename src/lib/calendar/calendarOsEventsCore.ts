/**
 * CalendarOS Phase GC-5 — map `fi_calendar_events` into operational calendar booking shape.
 * Pure helpers (no server-only) for loader + unit tests.
 */

import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  anchorLabelForBookingRow,
  type BookingDisplayContextMaps,
} from "@/src/lib/bookings/bookingDisplayContext";
import { serviceForBookingType } from "@/src/lib/bookings/servicesCatalog";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

import type { OperationalCalendarBookingDisplay } from "@/src/lib/calendar/operationalCalendarTypes";
import {
  classifyFiCalendarEventOverlapRow,
  withCalendarEventClassificationMeta,
} from "@/src/lib/calendar/calendarEventClassification";
import {
  calendarIdentityDisplayFields,
  resolveCalendarPersonIdentity,
} from "@/src/lib/calendar/calendarPersonIdentity";
import { readPersistedGooglePatientHydration } from "@/src/lib/calendar/calendarGooglePatientHydration";
import {
  buildStaffCalendarLinkIndex,
  resolveCalendarEventStaffAssignment,
  type StaffCalendarLinkLookupRow,
} from "@/src/lib/googleCalendar/googleCalendarProviderLinksCore";

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
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  event_type: string | null;
  google_meet_url: string | null;
  patient_id: string | null;
  lead_id: string | null;
  consultation_id?: string | null;
  person_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Overlap projection that works before identity-link migration columns exist. */
export const FI_CALENDAR_EVENTS_OVERLAP_SELECT_BASE =
  "id, tenant_id, external_event_id, provider, calendar_id, title, description, location, start_time, end_time, event_type, google_meet_url, patient_id, lead_id, metadata, created_at, updated_at";

/**
 * Preferred overlap projection including identity columns from
 * `202611102001_calendar_identity_link_1b`. Loader falls back to
 * {@link FI_CALENDAR_EVENTS_OVERLAP_SELECT_BASE} when those columns are missing.
 */
export const FI_CALENDAR_EVENTS_OVERLAP_SELECT =
  "id, tenant_id, external_event_id, provider, calendar_id, title, description, location, start_time, end_time, event_type, google_meet_url, patient_id, lead_id, consultation_id, person_id, metadata, created_at, updated_at";

/** True when PostgREST rejects consultation_id / person_id on fi_calendar_events. */
export function isMissingFiCalendarIdentityColumnError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  const m = (error?.message ?? "").toLowerCase();
  if (!m) return false;
  const mentionsIdentityCol =
    m.includes("consultation_id") || m.includes("person_id");
  if (!mentionsIdentityCol) return false;
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the") ||
    error?.code === "42703" ||
    error?.code === "PGRST204"
  );
}

/** Hard cap for CalendarOS overlap reads — month grid should stay well under this after range scoping. */
export const CALENDAR_OS_EVENTS_OVERLAP_CAP = 1000;

const TOKEN_KEY_PATTERN =
  /token|secret|credential|password|authorization|refresh_token|access_token/i;
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
  const source = String(metadata?.source ?? "")
    .trim()
    .toLowerCase();
  if (source === "fi_calendar_create") return "fi";
  return "google";
}

export function calendarOsSourceLabelForProvider(
  provider: CalendarOsProviderKind
): CalendarOsSourceLabel {
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

export type CalendarOsEventFieldSource = {
  provider?: string;
  metadata?: Record<string, unknown> | null;
  calendar_id?: string;
  calendarId?: string;
  google_meet_url?: string | null;
  googleMeetUrl?: string | null;
  external_event_id?: string | null;
  externalEventId?: string | null;
  event_type?: string | null;
  eventType?: string | null;
};

export function calendarOsClientFieldsFromEvent(
  event: CalendarOsEventFieldSource
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
      ("external_event_id" in event ? event.external_event_id : event.externalEventId)?.trim() ||
      null,
    eventType,
    calendarOsStatus: statusRaw || "scheduled",
  };
}

export function mapFiCalendarEventOverlapRowToBookingRow(
  row: FiCalendarEventOverlapRow,
  calendarTimezone: string,
  staffAssignment?: { staffMemberId: string | null }
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
  const classification = classifyFiCalendarEventOverlapRow(row);
  const googleHtmlLink =
    typeof safeMeta.google_html_link === "string" ? safeMeta.google_html_link.trim() : null;
  const writebackStatus =
    typeof safeMeta.writeback_status === "string" ? safeMeta.writeback_status.trim() : null;
  const clinicId =
    typeof safeMeta.clinic_id === "string" && safeMeta.clinic_id.trim()
      ? safeMeta.clinic_id.trim()
      : null;
  const roomId =
    typeof safeMeta.room_id === "string" && safeMeta.room_id.trim()
      ? safeMeta.room_id.trim()
      : null;

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    lead_id: row.lead_id,
    person_id: row.person_id?.trim() || null,
    patient_id: row.patient_id,
    case_id: null,
    clinic_id: clinicId,
    room_id: roomId,
    room_required: false,
    assigned_staff_id: staffAssignment?.staffMemberId?.trim() || null,
    assigned_user_id: null,
    booking_type: eventType,
    booking_status: clientFields.calendarOsStatus ?? "scheduled",
    title: row.title?.trim() || "(Untitled event)",
    description: row.description?.trim() || null,
    start_at: startAt,
    end_at: endAt,
    timezone: calendarTimezone,
    location: row.location,
    metadata: {
      ...withCalendarEventClassificationMeta(safeMeta, classification),
      calendar_os_provider: clientFields.calendarOsProvider,
      calendar_os_source_label: clientFields.calendarOsSourceLabel,
      calendar_id: clientFields.calendarId,
      google_meet_url: clientFields.googleMeetUrl,
      external_event_id: clientFields.externalEventId,
      event_type: clientFields.eventType,
      calendar_os_status: clientFields.calendarOsStatus,
      ...(row.consultation_id?.trim()
        ? { consultation_id: row.consultation_id.trim() }
        : {}),
      ...(googleHtmlLink ? { google_html_link: googleHtmlLink } : {}),
      ...(writebackStatus ? { writeback_status: writebackStatus } : {}),
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
    /** Optional consultation display name when consultation_id is known. */
    consultationDisplayName?: string | null;
    enquiryDisplayName?: string | null;
  }
): OperationalCalendarBookingDisplay {
  const clientFields = calendarOsClientFieldsFromEvent(row);
  const classification = classifyFiCalendarEventOverlapRow(row);
  const startMs = row.start_time ? Date.parse(row.start_time) : NaN;
  const endMs = row.end_time ? Date.parse(row.end_time) : NaN;
  const durationMin =
    Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.round((endMs - startMs) / 60000))
      : 30;

  const eventTypeLabel = humanizeEventType(clientFields.eventType ?? row.event_type ?? "event");
  const externalTitle = row.title?.trim() || null;
  const meta = row.metadata ?? {};
  const hydration = readPersistedGooglePatientHydration(meta, {
    title: row.title,
    description: row.description,
    location: row.location,
  });
  const consultationId =
    row.consultation_id?.trim() ||
    (typeof meta.consultation_id === "string" ? meta.consultation_id.trim() : "") ||
    null;
  const enquiryId =
    row.lead_id?.trim() ||
    (typeof meta.enquiry_id === "string" ? meta.enquiry_id.trim() : "") ||
    null;
  const contactId =
    row.person_id?.trim() ||
    (typeof meta.person_id === "string" ? meta.person_id.trim() : "") ||
    null;
  const appointmentPatientId =
    typeof meta.appointment_patient_id === "string"
      ? meta.appointment_patient_id.trim()
      : null;

  const resolution = resolveCalendarPersonIdentity({
    tenantId: row.tenant_id,
    explicitPatientId: row.patient_id,
    explicitConsultationId: consultationId,
    explicitEnquiryId: enquiryId,
    explicitContactId: contactId,
    appointmentPatientId,
    consultation: consultationId
      ? {
          id: consultationId,
          tenantId: row.tenant_id,
          patientId: row.patient_id,
          contactId,
          enquiryId,
          displayName: opts?.consultationDisplayName ?? opts?.anchorLabel ?? null,
        }
      : null,
    enquiry: enquiryId && !consultationId
      ? {
          id: enquiryId,
          tenantId: row.tenant_id,
          patientId: row.patient_id,
          contactId,
          displayName: opts?.enquiryDisplayName ?? opts?.anchorLabel ?? null,
        }
      : null,
    verifiedEmail: hydration.email,
    verifiedPhone: hydration.phone,
    externalDisplayTitle: externalTitle,
  });

  const identityDisplay = calendarIdentityDisplayFields(resolution);
  const resolvedAnchor = opts?.anchorLabel?.trim() || null;
  // Unlinked external events: prefer Google-hydrated display name over "Patient not linked".
  const hydratedName = hydration.displayName?.trim() || null;
  const anchorLabel =
    identityDisplay.identityState === "patient_linked" && resolvedAnchor
      ? resolvedAnchor
      : identityDisplay.identityState === "consultation_identity_linked" ||
          identityDisplay.identityState === "enquiry_identity_linked"
        ? identityDisplay.anchorLabel
        : identityDisplay.patientNotLinked
          ? hydratedName || identityDisplay.anchorLabel
          : resolvedAnchor || identityDisplay.anchorLabel || hydratedName || externalTitle || eventTypeLabel;

  const googleHtmlLink =
    typeof meta.google_html_link === "string" ? meta.google_html_link.trim() : null;
  const writebackStatus =
    typeof meta.writeback_status === "string" ? meta.writeback_status.trim() : null;
  const fiosAppointmentId =
    typeof meta.fios_appointment_id === "string"
      ? meta.fios_appointment_id.trim()
      : typeof meta.fi_booking_id === "string"
        ? meta.fi_booking_id.trim()
        : null;

  return {
    anchorLabel,
    scalesSummary: null,
    durationMin,
    reminderHint: null,
    procedureCatalogName: opts?.procedureCatalogName ?? eventTypeLabel,
    procedureCatalogHex: opts?.procedureCatalogHex ?? null,
    suggestedPrice: null,
    patientEmail: resolution.verifiedEmail ?? hydration.email,
    patientPhone: resolution.verifiedPhone ?? hydration.phone,
    googleHydratedDisplayName: hydration.displayName,
    googleHydratedEmail: hydration.email,
    googleHydratedPhone: hydration.phone,
    googleHydratedLocation: hydration.location ?? row.location?.trim() ?? null,
    googleHydratedAppointmentType: hydration.appointmentTypeHint,
    roomLabel: (hydration.location ?? row.location)?.trim() || null,
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
    calendarEventClassification: classification,
    /** Always preserve original Google title separately for audit / reconciliation. */
    calendarOsExternalTitle: externalTitle,
    calendarOsGoogleHtmlLink: googleHtmlLink,
    calendarOsWritebackStatus: writebackStatus,
    calendarOsFiosAppointmentId: fiosAppointmentId,
    patientNotLinked: identityDisplay.patientNotLinked,
    identityState: identityDisplay.identityState,
    patientId: resolution.patientId,
    consultationId: resolution.consultationId,
    enquiryId: resolution.enquiryId,
    contactId: resolution.contactId,
    displayName: identityDisplay.displayName ?? hydration.displayName,
    externalDisplayTitle: identityDisplay.externalDisplayTitle,
    verifiedEmail: resolution.verifiedEmail,
    verifiedPhone: resolution.verifiedPhone,
    matchEvidence: resolution.matchEvidence,
    promotionRequired: identityDisplay.promotionRequired,
    identityKindLabel: identityDisplay.identityKindLabel,
    identityStatusLabel: identityDisplay.identityStatusLabel,
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

/** Minimal booking stubs so display-context loaders can resolve patient/lead labels without full mapping. */
export function calendarOsOverlapRowsForDisplayContext(
  rows: FiCalendarEventOverlapRow[]
): FiBookingRow[] {
  return rows.map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    lead_id: row.lead_id,
    person_id: row.person_id?.trim() || null,
    patient_id: row.patient_id,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: row.event_type?.trim() || "event",
    booking_status: "scheduled",
    title: row.title,
    description: row.description,
    start_at: row.start_time ?? "",
    end_at: row.end_time ?? "",
    timezone: null,
    location: row.location,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

function resolveStaffCalendarLinkIndex(
  links: StaffCalendarLinkLookupRow[] | Map<string, StaffCalendarLinkLookupRow> | undefined,
  tenantId: string
): Map<string, StaffCalendarLinkLookupRow> | undefined {
  if (!links) return undefined;
  if (links instanceof Map) return links;
  return buildStaffCalendarLinkIndex(links, tenantId);
}

export function mapFiCalendarEventsToOperationalCalendar(
  rows: FiCalendarEventOverlapRow[],
  opts: {
    tenantId: string;
    calendarTimezone: string;
    displayMaps: BookingDisplayContextMaps;
    services: FiServiceRow[];
    staffCalendarLinks?: StaffCalendarLinkLookupRow[] | Map<string, StaffCalendarLinkLookupRow>;
  }
): { bookings: FiBookingRow[]; bookingDisplay: Record<string, OperationalCalendarBookingDisplay> } {
  const bookings: FiBookingRow[] = [];
  const bookingDisplay: Record<string, OperationalCalendarBookingDisplay> = {};
  const linkIndex = resolveStaffCalendarLinkIndex(opts.staffCalendarLinks, opts.tenantId);

  for (const row of rows) {
    if (row.tenant_id.trim() !== opts.tenantId.trim()) continue;

    const assignment = linkIndex
      ? resolveCalendarEventStaffAssignment(row, linkIndex, opts.tenantId)
      : { staffMemberId: null, linkId: null };

    const mapped = mapFiCalendarEventOverlapRowToBookingRow(row, opts.calendarTimezone, {
      staffMemberId: assignment.staffMemberId,
    });
    if (!mapped) continue;

    const cat = serviceForBookingType(opts.services, mapped.booking_type);
    const anchorLabel = anchorLabelForBookingRow(mapped, opts.displayMaps);
    const consultationId =
      row.consultation_id?.trim() ||
      (typeof row.metadata?.consultation_id === "string"
        ? row.metadata.consultation_id.trim()
        : "") ||
      null;
    const consultationDisplayName = consultationId
      ? anchorLabel && anchorLabel !== mapped.title
        ? anchorLabel
        : null
      : null;
    bookingDisplay[mapped.id] = mapFiCalendarEventToBookingDisplay(row, {
      anchorLabel,
      procedureCatalogName: cat?.name ?? null,
      procedureCatalogHex: cat?.color ?? null,
      consultationDisplayName,
      enquiryDisplayName: row.lead_id ? anchorLabel : null,
    });
    bookings.push(mapped);
  }

  return { bookings, bookingDisplay };
}
