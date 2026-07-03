import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBookingForTenant } from "@/src/lib/bookings/bookings";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  buildLegacyPatientDuplicateIndex,
  checkLegacyPatientDuplicates,
  resolveBlockingPatientMatch,
} from "./legacyPatientCore";
import {
  bookingContinuityLabel,
  buildVisitReasonFromBooking,
  deriveBookingContinuityStatus,
  encounterTypeForBookingType,
  formatBookingAppointmentWhen,
  parsePersonNameFromMetadata,
  readContactFromPersonMetadata,
  type BookingContinuityStatus,
  type BookingFollowUpPrefill,
} from "./bookingFollowUpContextCore";
import {
  loadFollowUpEncountersForBooking,
  loadFollowUpEncountersForPatient,
  loadFollowUpImagingSessionsForPatient,
  loadLegacyPatientCandidates,
} from "./followUpEncounterServer";
import type { FollowUpEncounterRow } from "./followUpEncounterTypes";

export type BookingFollowUpContext = {
  booking: FiBookingRow;
  prefill: BookingFollowUpPrefill;
  continuityStatus: BookingContinuityStatus | null;
  continuityLabel: string | null;
  matchedPatientId: string | null;
  duplicatePrevented: boolean;
  duplicateSummary: string | null;
  encountersForBooking: FollowUpEncounterRow[];
};

async function loadEncountersForBooking(
  tenantId: string,
  bookingId: string,
  patientId: string | null
): Promise<FollowUpEncounterRow[]> {
  const byBooking = await loadFollowUpEncountersForBooking(tenantId, bookingId);
  if (!patientId) return byBooking;
  const all = await loadFollowUpEncountersForPatient(tenantId, patientId);
  const bookingIds = new Set(byBooking.map((e) => e.id));
  for (const e of all) {
    if (e.booking_id === bookingId && !bookingIds.has(e.id)) {
      byBooking.push(e);
      bookingIds.add(e.id);
    }
  }
  return byBooking;
}

export async function loadBookingFollowUpContext(
  tenantId: string,
  bookingId: string
): Promise<BookingFollowUpContext | null> {
  const tid = tenantId.trim();
  const bid = bookingId.trim();
  const booking = await loadBookingForTenant(tid, bid);
  if (!booking) return null;

  const supabase = supabaseAdmin();
  let patientId = booking.patient_id?.trim() || null;
  let personMeta: Record<string, unknown> = {};
  let patientMeta: Record<string, unknown> = {};
  let patientLabel: string | null = null;

  if (patientId) {
    const { data: pat } = await supabase
      .from("fi_patients")
      .select("id, person_id, metadata")
      .eq("tenant_id", tid)
      .eq("id", patientId)
      .maybeSingle();
    if (pat) {
      patientMeta =
        pat.metadata && typeof pat.metadata === "object" && !Array.isArray(pat.metadata)
          ? (pat.metadata as Record<string, unknown>)
          : {};
      const personId = String((pat as { person_id: string }).person_id);
      const { data: person } = await supabase
        .from("fi_persons")
        .select("metadata")
        .eq("tenant_id", tid)
        .eq("id", personId)
        .maybeSingle();
      personMeta =
        person?.metadata && typeof person.metadata === "object" && !Array.isArray(person.metadata)
          ? (person.metadata as Record<string, unknown>)
          : {};
      patientLabel = parsePersonNameFromMetadata({ ...personMeta, ...patientMeta }).displayName;
    }
  } else if (booking.lead_id) {
    const { data: lead } = await supabase
      .from("fi_crm_leads")
      .select("person_id, patient_id, summary, metadata")
      .eq("tenant_id", tid)
      .eq("id", booking.lead_id)
      .maybeSingle();
    if (lead) {
      if ((lead as { patient_id?: string }).patient_id) {
        patientId = String((lead as { patient_id: string }).patient_id);
      }
      const personId = String((lead as { person_id: string }).person_id);
      const { data: person } = await supabase
        .from("fi_persons")
        .select("metadata")
        .eq("tenant_id", tid)
        .eq("id", personId)
        .maybeSingle();
      personMeta =
        person?.metadata && typeof person.metadata === "object" && !Array.isArray(person.metadata)
          ? (person.metadata as Record<string, unknown>)
          : {};
      const leadMeta =
        lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
          ? (lead.metadata as Record<string, unknown>)
          : {};
      patientLabel =
        (lead as { summary?: string }).summary?.trim() ||
        parsePersonNameFromMetadata({ ...personMeta, ...leadMeta }).displayName;
    }
  } else if (booking.person_id) {
    const { data: person } = await supabase
      .from("fi_persons")
      .select("metadata")
      .eq("tenant_id", tid)
      .eq("id", booking.person_id)
      .maybeSingle();
    personMeta =
      person?.metadata && typeof person.metadata === "object" && !Array.isArray(person.metadata)
        ? (person.metadata as Record<string, unknown>)
        : {};
    patientLabel = parsePersonNameFromMetadata(personMeta).displayName;
  }

  const contact = readContactFromPersonMetadata({ ...personMeta, ...patientMeta });
  const nameParts = parsePersonNameFromMetadata({ ...personMeta, ...patientMeta });

  const bookingMeta =
    booking.metadata && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};
  const timelyFromBooking = String(
    bookingMeta.timely_patient_id ?? bookingMeta.legacy_external_id ?? ""
  ).trim();

  let matchedPatientId = patientId;
  let duplicatePrevented = false;
  let duplicateSummary: string | null = null;

  if (!patientId && (contact.email || contact.mobile || nameParts.displayName)) {
    const candidates = await loadLegacyPatientCandidates(supabase, tid);
    const index = buildLegacyPatientDuplicateIndex(candidates);
    const dupResult = checkLegacyPatientDuplicates(
      {
        email: contact.email,
        phone: contact.mobile,
        displayName: nameParts.displayName,
        dateOfBirth: contact.dateOfBirth,
        legacyExternalId: contact.legacyExternalId || timelyFromBooking,
      },
      index
    );
    const existing = resolveBlockingPatientMatch(dupResult, candidates);
    if (existing) {
      matchedPatientId = existing.patientId;
      duplicatePrevented = true;
      duplicateSummary = dupResult.summary;
      patientLabel = existing.displayName;
    }
  }

  const effectivePatientId = matchedPatientId ?? patientId;
  const encountersForBooking = await loadEncountersForBooking(tid, bid, effectivePatientId);

  let imagingSessions: Awaited<ReturnType<typeof loadFollowUpImagingSessionsForPatient>> = [];
  let followUpImageCount = 0;
  if (effectivePatientId) {
    imagingSessions = await loadFollowUpImagingSessionsForPatient(tid, effectivePatientId);
    const encounterIds = new Set(encountersForBooking.map((e) => e.id));
    imagingSessions = imagingSessions.filter(
      (s) => s.follow_up_encounter_id && encounterIds.has(s.follow_up_encounter_id)
    );

    const { count } = await supabase
      .from("fi_patient_images")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("patient_id", effectivePatientId)
      .eq("image_status", "active");
    followUpImageCount = count ?? 0;
  }

  const legacySource =
    contact.legacySource ??
    (patientMeta.legacy_source != null ? String(patientMeta.legacy_source) : null);

  const continuityStatus = deriveBookingContinuityStatus({
    patientId: effectivePatientId,
    patientLegacySource: legacySource,
    encounters: encountersForBooking,
    imagingSessions,
    followUpImageCount: encountersForBooking.length ? followUpImageCount : 0,
  });

  const prefill: BookingFollowUpPrefill = {
    bookingId: bid,
    patientId: effectivePatientId,
    patientLabel,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    mobile: contact.mobile,
    email: contact.email,
    dateOfBirth: contact.dateOfBirth,
    legacyExternalId: contact.legacyExternalId || timelyFromBooking,
    isLegacyTimely: legacySource === "timely" || Boolean(timelyFromBooking) || !effectivePatientId,
    encounterType: encounterTypeForBookingType(booking.booking_type),
    visitReason: buildVisitReasonFromBooking({
      bookingType: booking.booking_type,
      title: booking.title,
      startAt: booking.start_at,
    }),
    clinicId: booking.clinic_id,
    staffId: booking.assigned_staff_id,
    appointmentWhenLabel: formatBookingAppointmentWhen(
      booking.start_at,
      booking.end_at,
      booking.timezone
    ),
  };

  return {
    booking,
    prefill,
    continuityStatus,
    continuityLabel: bookingContinuityLabel(continuityStatus),
    matchedPatientId: effectivePatientId,
    duplicatePrevented,
    duplicateSummary,
    encountersForBooking,
  };
}
