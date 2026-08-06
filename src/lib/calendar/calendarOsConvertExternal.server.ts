/**
 * FI-CALENDAR-WRITEBACK-1A / FI-CALENDAR-IDENTITY-LINK-1B —
 * convert external Google event → FiOS appointment without duplicating identity.
 *
 * Always resolves person identity first. Never creates a duplicate patient or consultation.
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
import { resolveCalendarPersonIdentityForEvent } from "@/src/lib/calendar/calendarPersonIdentityResolve.server";
import { promoteConsultationToPatient } from "@/src/lib/calendar/consultationPatientPromotion.server";
import { logStructured } from "@/src/lib/server/structuredLog";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
};

export type ConvertExternalCalendarEventInput = {
  tenantId: string;
  eventId: string;
  actingUserId?: string | null;
  actingUserLabel?: string | null;
  clinicId?: string | null;
  assignedStaffId?: string | null;
  /** Optional room UUID; must belong to clinicId when both are set (validated by caller). */
  roomId?: string | null;
  /**
   * When identity is consultation without patient: promote before creating appointment.
   * Defaults to true (canonical patient for FiOS appointment).
   */
  promoteConsultationIfNeeded?: boolean;
  /** Operator-selected patient when resolver returns ambiguous_identity. */
  selectedPatientId?: string | null;
  selectedConsultationId?: string | null;
  /** Create a new patient only when identity is external_only and confirmed. */
  createNewPatient?: boolean;
  newPatientPersonId?: string | null;
  idempotencyKey?: string | null;
};

export type ConvertExternalCalendarEventResult =
  | {
      ok: true;
      calendarEventId: string;
      fiosAppointmentId: string;
      patientId: string | null;
      consultationId: string | null;
      identityState: string;
      classification: CalendarEventClassification;
      auditId: string;
      createdBooking: boolean;
      googleEventId: string | null;
    }
  | {
      ok: false;
      error: string;
      code:
        | "not_found"
        | "already_converted"
        | "classification_blocked"
        | "missing_times"
        | "create_failed"
        | "ambiguous_identity"
        | "identity_conflict"
        | "promote_failed"
        | "external_requires_patient";
      suggestions?: unknown[];
      identityState?: string;
    };

/**
 * Convert a CalendarOS external event into a FiOS appointment
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
  const promoteConsultationIfNeeded = input.promoteConsultationIfNeeded !== false;

  const identityResult = await resolveCalendarPersonIdentityForEvent(
    {
      tenantId,
      eventId,
      persistResolution: true,
      actingUserId: input.actingUserId,
    },
    opts
  );
  if (!identityResult.ok) {
    return { ok: false, error: identityResult.error, code: "not_found" };
  }

  const { resolution, googleEventId } = identityResult;

  if (resolution.identityState === "ambiguous_identity") {
    return {
      ok: false,
      error: "Multiple identity matches — confirm the correct person before converting.",
      code: "ambiguous_identity",
      suggestions: resolution.suggestions,
      identityState: resolution.identityState,
    };
  }

  if (resolution.identityState === "identity_conflict") {
    return {
      ok: false,
      error: resolution.matchEvidence.detail || "Identity conflict — resolve manually.",
      code: "identity_conflict",
      identityState: resolution.identityState,
    };
  }

  let patientId = resolution.patientId;
  let consultationId = resolution.consultationId;
  let personId = resolution.contactId;
  let leadId = resolution.enquiryId;

  if (input.selectedPatientId?.trim()) {
    patientId = input.selectedPatientId.trim();
  }
  if (input.selectedConsultationId?.trim()) {
    consultationId = input.selectedConsultationId.trim();
  }

  if (
    resolution.identityState === "consultation_identity_linked" &&
    !patientId &&
    consultationId &&
    promoteConsultationIfNeeded
  ) {
    const promo = await promoteConsultationToPatient(
      {
        tenantId,
        consultationId,
        calendarEventId: eventId,
        actingUserId: input.actingUserId,
        actingUserLabel: input.actingUserLabel,
        idempotencyKey: input.idempotencyKey ?? consultationId,
      },
      opts
    );
    if (!promo.ok) {
      return { ok: false, error: promo.error, code: "promote_failed" };
    }
    patientId = promo.patientId;
    personId = promo.personId;
  }

  if (resolution.identityState === "external_identity_only" && !patientId) {
    if (!input.createNewPatient || !input.newPatientPersonId?.trim()) {
      return {
        ok: false,
        error:
          "No safe existing identity. Offer governed new-patient creation or link an identity first.",
        code: "external_requires_patient",
        identityState: resolution.identityState,
      };
    }
    // Governed path: caller must create person/patient first and pass patient/person ids.
    // Conversion itself does not invent patients from the Google title.
    return {
      ok: false,
      error: "Create the patient via governed patient creation, then retry with selectedPatientId.",
      code: "external_requires_patient",
      identityState: resolution.identityState,
    };
  }

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
    consultation_id: string | null;
    person_id: string | null;
    metadata: Record<string, unknown>;
  };

  // Prefer identifiers resolved above; fall back to row.
  patientId = patientId ?? row.patient_id;
  leadId = leadId ?? row.lead_id;
  consultationId = consultationId ?? row.consultation_id;
  personId = personId ?? row.person_id;

  const meta = row.metadata ?? {};
  const existingBookingId =
    typeof meta.fios_appointment_id === "string"
      ? meta.fios_appointment_id.trim()
      : typeof meta.fi_booking_id === "string"
        ? meta.fi_booking_id.trim()
        : "";

  if (existingBookingId) {
    // Idempotent: if already converted, attach patient if needed and return same booking.
    if (patientId) {
      await supabase
        .from("fi_bookings")
        .update({
          patient_id: patientId,
          ...(personId ? { person_id: personId } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingBookingId)
        .eq("tenant_id", tenantId)
        .is("patient_id", null);
    }
    return {
      ok: true,
      calendarEventId: row.id,
      fiosAppointmentId: existingBookingId,
      patientId,
      consultationId,
      identityState: patientId ? "patient_linked" : resolution.identityState,
      classification: classifyFiCalendarEventOverlapRow({
        metadata: meta,
        patient_id: patientId,
        lead_id: leadId,
        external_event_id: row.external_event_id,
      }),
      auditId,
      createdBooking: false,
      googleEventId: row.external_event_id,
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
  const conversionKey = (input.idempotencyKey?.trim() || row.id).trim();

  const clinicId = input.clinicId?.trim() || null;
  const assignedStaffId = input.assignedStaffId?.trim() || null;
  const roomId = input.roomId?.trim() || null;

  const { error: insertErr } = await supabase.from("fi_bookings").insert({
    id: bookingId,
    tenant_id: tenantId,
    lead_id: leadId,
    patient_id: patientId,
    person_id: personId,
    case_id: null,
    clinic_id: clinicId,
    room_id: roomId,
    room_required: false,
    assigned_staff_id: assignedStaffId,
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
      conversion_idempotency_key: conversionKey,
      consultation_id: consultationId,
      converted_at: now,
      converted_by_user_id: input.actingUserId ?? null,
    },
    created_at: now,
    updated_at: now,
  });

  if (insertErr) {
    // Concurrent conversion — reuse existing booking for this calendar event.
    if (insertErr.code === "23505") {
      const { data: existing } = await supabase
        .from("fi_bookings")
        .select("id, patient_id")
        .eq("tenant_id", tenantId)
        .contains("metadata", { calendar_event_id: row.id })
        .maybeSingle();
      if (existing?.id) {
        return {
          ok: true,
          calendarEventId: row.id,
          fiosAppointmentId: String(existing.id),
          patientId: (existing as { patient_id: string | null }).patient_id ?? patientId,
          consultationId,
          identityState: patientId ? "patient_linked" : resolution.identityState,
          classification: "google_linked_fios",
          auditId,
          createdBooking: false,
          googleEventId: row.external_event_id,
        };
      }
    }
    return { ok: false, error: insertErr.message, code: "create_failed" };
  }

  // Attach booking to consultation without creating a second consultation.
  if (consultationId) {
    await supabase
      .from("fi_consultations")
      .update({
        booking_id: bookingId,
        ...(patientId ? { patient_id: patientId } : {}),
        ...(personId ? { person_id: personId } : {}),
        updated_at: now,
      })
      .eq("id", consultationId)
      .eq("tenant_id", tenantId)
      .is("booking_id", null);
  }

  const identityState = patientId ? "patient_linked" : resolution.identityState;

  const nextMeta: Record<string, unknown> = {
    ...meta,
    source: "fi_appointment_create",
    ownership: "fi_system",
    fios_appointment_id: bookingId,
    fi_booking_id: bookingId,
    converted_from_external: true,
    converted_at: now,
    converted_by_user_id: input.actingUserId ?? null,
    person_identity_state: identityState,
    external_display_title: resolution.externalDisplayTitle ?? row.title,
    ...(consultationId ? { consultation_id: consultationId } : {}),
  };

  const classification = classifyFiCalendarEventOverlapRow({
    metadata: nextMeta,
    patient_id: patientId,
    lead_id: leadId,
    external_event_id: row.external_event_id,
  });

  nextMeta.calendar_event_classification = classification;

  const audit = buildCalendarMutationAuditRecord({
    id: auditId,
    tenantId,
    actingUserId: input.actingUserId,
    actingUserLabel: input.actingUserLabel,
    interactionSource: "external_event_conversion",
    classification,
    fiosAppointmentId: bookingId,
    googleEventId: row.external_event_id,
    localCalendarEventId: row.id,
    previousValues: {
      fios_appointment_id: null,
      classification: classificationBefore,
      identity_state: resolution.identityState,
      clinic_id: null,
      assigned_staff_id: null,
      room_id: null,
    },
    nextValues: {
      fios_appointment_id: bookingId,
      classification,
      identity_state: identityState,
      patient_id: patientId,
      consultation_id: consultationId,
      clinic_id: clinicId,
      assigned_staff_id: assignedStaffId,
      room_id: roomId,
    },
    writebackStatus: "not_required",
    metadata: {
      match_method: resolution.matchEvidence.method,
      google_event_id_preserved: row.external_event_id,
      google_event_id: row.external_event_id,
      patient_id: patientId,
      consultation_id: consultationId,
      enquiry_id: leadId,
      appointment_id: bookingId,
      clinic_id: clinicId,
      staff_id: assignedStaffId,
      room_id: roomId,
      identity_match_method: resolution.matchEvidence.method,
      acting_user_id: input.actingUserId ?? null,
      source_interaction: "external_event_conversion",
      previous_classification: classificationBefore,
      new_classification: classification,
      idempotency_result: "created",
    },
  });

  const activityRaw = nextMeta.appointment_activity;
  const activity = Array.isArray(activityRaw) ? [...activityRaw] : [];
  activity.push(calendarAuditToActivityEntry(audit));
  nextMeta.appointment_activity = activity;

  const { error: updateErr } = await supabase
    .from("fi_calendar_events")
    .update({
      patient_id: patientId,
      lead_id: leadId,
      consultation_id: consultationId,
      person_id: personId,
      metadata: nextMeta,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("tenant_id", tenantId);

  if (updateErr) {
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
    patientId,
    consultationId,
    identityState,
    classification,
    auditId,
    interactionSource: "external_event_conversion",
  });

  return {
    ok: true,
    calendarEventId: row.id,
    fiosAppointmentId: bookingId,
    patientId,
    consultationId,
    identityState,
    classification,
    auditId,
    createdBooking: true,
    googleEventId: row.external_event_id ?? googleEventId,
  };
}
