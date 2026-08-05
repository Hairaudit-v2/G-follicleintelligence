/**
 * FI-CALENDAR-WRITEBACK-1A — convert external Google event → FiOS appointment
 * without duplicating the calendar card.
 *
 * Creates (or reuses) an `fi_bookings` row linked to the existing `fi_calendar_events`
 * mirror and reclassifies the mirror as `google_linked_fios`.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  classifyFiCalendarEventOverlapRow,
  type CalendarEventClassification,
} from "@/src/lib/calendar/calendarEventClassification";
import {
  buildCalendarMutationAuditRecord,
  calendarAuditToActivityEntry,
} from "@/src/lib/calendar/calendarWritebackAudit";
import { logStructured } from "@/src/lib/server/structuredLog";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type ConvertExternalCalendarEventInput = {
  tenantId: string;
  eventId: string;
  actingUserId?: string | null;
  actingUserLabel?: string | null;
  /** Optional clinic for the new booking. */
  clinicId?: string | null;
  assignedStaffId?: string | null;
};

export type ConvertExternalCalendarEventResult =
  | {
      ok: true;
      calendarEventId: string;
      fiosAppointmentId: string;
      classification: CalendarEventClassification;
      auditId: string;
      createdBooking: boolean;
    }
  | {
      ok: false;
      error: string;
      code:
        | "not_found"
        | "already_converted"
        | "classification_blocked"
        | "missing_times"
        | "create_failed";
    };

/**
 * Convert a `google_external_unlinked` CalendarOS event into a FiOS appointment
 * while keeping the same Google event id (no duplicate calendar card).
 */
export async function convertExternalCalendarEventToFiosAppointment(
  input: ConvertExternalCalendarEventInput,
  opts: ServerOpts = {}
): Promise<ConvertExternalCalendarEventResult> {
  const tenantId = input.tenantId.trim();
  const eventId = input.eventId.trim();
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const auditId = randomUUID();

  const { data: event, error } = await supabase
    .from("fi_calendar_events")
    .select("*")
    .eq("id", eventId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !event) {
    return { ok: false, error: "Calendar event not found.", code: "not_found" };
  }

  const row = event as {
    id: string;
    external_event_id: string | null;
    title: string;
    description: string | null;
    location: string | null;
    start_time: string | null;
    end_time: string | null;
    event_type: string | null;
    patient_id: string | null;
    lead_id: string | null;
    metadata: Record<string, unknown>;
  };

  const meta = row.metadata ?? {};
  const existingBookingId =
    typeof meta.fios_appointment_id === "string"
      ? meta.fios_appointment_id.trim()
      : typeof meta.fi_booking_id === "string"
        ? meta.fi_booking_id.trim()
        : "";

  if (existingBookingId) {
    return {
      ok: false,
      error: "This event is already linked to a FiOS appointment.",
      code: "already_converted",
    };
  }

  const classificationBefore = classifyFiCalendarEventOverlapRow(row);
  if (
    classificationBefore !== "google_external_unlinked" &&
    classificationBefore !== "google_linked_fios"
  ) {
    return {
      ok: false,
      error: `Cannot convert classification "${classificationBefore}".`,
      code: "classification_blocked",
    };
  }

  if (!row.start_time || !row.end_time) {
    return { ok: false, error: "Event is missing start/end times.", code: "missing_times" };
  }

  const now = new Date().toISOString();
  const bookingId = randomUUID();
  const bookingType = row.event_type?.trim() || "consultation";

  const { error: insertErr } = await supabase.from("fi_bookings").insert({
    id: bookingId,
    tenant_id: tenantId,
    lead_id: row.lead_id,
    patient_id: row.patient_id,
    person_id: null,
    case_id: null,
    clinic_id: input.clinicId?.trim() || null,
    room_id: null,
    room_required: false,
    assigned_staff_id: input.assignedStaffId?.trim() || null,
    assigned_user_id: null,
    booking_type: bookingType,
    booking_status: "scheduled",
    title: row.title,
    description: row.description,
    start_at: row.start_time,
    end_at: row.end_time,
    timezone: null,
    location: row.location,
    metadata: {
      source: "calendar_external_conversion",
      calendar_event_id: row.id,
      external_event_id: row.external_event_id,
      converted_at: now,
      converted_by_user_id: input.actingUserId ?? null,
    },
    created_at: now,
    updated_at: now,
  });

  if (insertErr) {
    return { ok: false, error: insertErr.message, code: "create_failed" };
  }

  const nextMeta: Record<string, unknown> = {
    ...meta,
    source: "fi_appointment_create",
    ownership: "fi_system",
    fios_appointment_id: bookingId,
    fi_booking_id: bookingId,
    converted_from_external: true,
    converted_at: now,
    converted_by_user_id: input.actingUserId ?? null,
  };

  const classification = classifyFiCalendarEventOverlapRow({
    metadata: nextMeta,
    patient_id: row.patient_id,
    lead_id: row.lead_id,
    external_event_id: row.external_event_id,
  });

  nextMeta.calendar_event_classification = classification;

  const audit = buildCalendarMutationAuditRecord({
    id: auditId,
    tenantId,
    actingUserId: input.actingUserId,
    actingUserLabel: input.actingUserLabel,
    interactionSource: "external_conversion",
    classification,
    fiosAppointmentId: bookingId,
    googleEventId: row.external_event_id,
    localCalendarEventId: row.id,
    previousValues: { fios_appointment_id: null, classification: classificationBefore },
    nextValues: { fios_appointment_id: bookingId, classification },
    writebackStatus: "not_required",
  });

  const activityRaw = nextMeta.appointment_activity;
  const activity = Array.isArray(activityRaw) ? [...activityRaw] : [];
  activity.push(calendarAuditToActivityEntry(audit));
  nextMeta.appointment_activity = activity;

  const { error: updateErr } = await supabase
    .from("fi_calendar_events")
    .update({
      metadata: nextMeta,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("tenant_id", tenantId);

  if (updateErr) {
    // Booking already created — leave linkage attempt visible for ops recovery.
    logStructured("error", "calendar_os_convert_metadata_failed", {
      tenantId,
      eventId: row.id,
      bookingId,
      error: updateErr.message,
    });
  }

  logStructured("info", "calendar_os_external_converted", {
    tenantId,
    eventId: row.id,
    bookingId,
    googleEventId: row.external_event_id,
    classification,
    auditId,
  });

  return {
    ok: true,
    calendarEventId: row.id,
    fiosAppointmentId: bookingId,
    classification,
    auditId,
    createdBooking: true,
  };
}
