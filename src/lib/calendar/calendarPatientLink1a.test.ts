/**
 * FI-CALENDAR-PATIENT-LINK-1A — Michael Berry Google hydration + link acceptance.
 *
 * Evidence:
 * docs/audits/calendar-patient-link/fi-calendar-patient-link-1a-michael-berry-google-event.png
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FI_CALENDAR_PATIENT_LINK_1A_EVIDENCE_PATH,
  MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE,
} from "@/src/lib/calendar/calendarPatientLink1aFixture";
import {
  hydratePatientFromGoogleEvent,
  parsePhoneFromGoogleDescription,
  parseEmailFromGoogleDescription,
  parseAppointmentTypeHintFromGoogleDescription,
  isClinicSideEmail,
  selectPatientAttendee,
  googlePatientHydrationToMetadata,
  readPersistedGooglePatientHydration,
} from "@/src/lib/calendar/calendarGooglePatientHydration";
import { normalizeCalendarIdentityPhone } from "@/src/lib/calendar/calendarPersonIdentityNormalize";
import {
  mapFiCalendarEventToBookingDisplay,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";
import { PATIENT_NOT_LINKED_LABEL } from "@/src/lib/calendar/calendarEventClassification";
import { suggestCalendarPatientMatches } from "@/src/lib/calendar/calendarPatientMatchSuggestions";
import { classifyCalendarEvent } from "@/src/lib/calendar/calendarEventClassification";
import { existsSync } from "node:fs";
import path from "node:path";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLINIC = MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.clinicCalendarEmail;
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const GOOGLE_EVENT_ID = "google-michael-berry-1";
const PATIENT_ID = "33333333-3333-4333-8333-333333333333";

function michaelBerryOverlap(
  overrides: Partial<FiCalendarEventOverlapRow> = {}
): FiCalendarEventOverlapRow {
  const hydration = hydratePatientFromGoogleEvent({
    summary: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.summary,
    description: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.description,
    location: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.location,
    attendees: [
      { email: CLINIC, organizer: true, self: true },
      { email: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.guestEmail, responseStatus: "accepted" },
    ],
    organizerEmail: CLINIC,
    clinicAccountEmail: CLINIC,
    calendarId: CLINIC,
  });

  return {
    id: EVENT_ID,
    tenant_id: TENANT,
    external_event_id: GOOGLE_EVENT_ID,
    provider: "google",
    calendar_id: CLINIC,
    title: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.summary,
    description: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.description,
    location: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.location,
    start_time: "2026-08-06T08:00:00.000Z",
    end_time: "2026-08-06T08:30:00.000Z",
    event_type: "consultation",
    google_meet_url: null,
    patient_id: null,
    lead_id: null,
    metadata: {
      source: "google_sync",
      ...googlePatientHydrationToMetadata(hydration),
    },
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("FI-CALENDAR-PATIENT-LINK-1A Michael Berry", () => {
  it("retains evidence screenshot on disk", () => {
    const evidencePath = path.join(process.cwd(), FI_CALENDAR_PATIENT_LINK_1A_EVIDENCE_PATH);
    assert.equal(existsSync(evidencePath), true, `missing evidence at ${evidencePath}`);
  });

  it("parses SMS: 421412307 and AU mobile equivalents", () => {
    assert.equal(
      parsePhoneFromGoogleDescription(MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.description),
      MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.expectedPhoneDigits
    );
    assert.equal(normalizeCalendarIdentityPhone("421412307"), "61421412307");
    assert.equal(normalizeCalendarIdentityPhone("0421412307"), "61421412307");
    assert.equal(normalizeCalendarIdentityPhone("+61 421 412 307"), "61421412307");
  });

  it("parses Email: and appointment type from description", () => {
    assert.equal(
      parseEmailFromGoogleDescription(MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.description),
      "m.berry2011@hotmail.com"
    );
    const typeHint = parseAppointmentTypeHintFromGoogleDescription(
      MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.description
    );
    assert.match(typeHint ?? "", /Follow[\s-]?Up Consultation/i);
  });

  it("hydrates Michael Berry from Google event without treating clinic as patient", () => {
    assert.equal(isClinicSideEmail(CLINIC, [CLINIC]), true);
    const attendee = selectPatientAttendee(
      [
        { email: CLINIC, organizer: true, self: true },
        { email: "m.berry2011@hotmail.com", responseStatus: "accepted" },
      ],
      [CLINIC]
    );
    assert.equal(attendee?.email, "m.berry2011@hotmail.com");

    const hydration = hydratePatientFromGoogleEvent({
      summary: "Michael Berry",
      description: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.description,
      location: "South Perth Evolved Surgery",
      attendees: [
        { email: CLINIC, organizer: true, self: true },
        { email: "m.berry2011@hotmail.com" },
      ],
      organizerEmail: CLINIC,
      clinicAccountEmail: CLINIC,
      calendarId: CLINIC,
    });

    assert.equal(hydration.displayName, "Michael Berry");
    assert.equal(hydration.email, "m.berry2011@hotmail.com");
    assert.equal(hydration.phone, "61421412307");
    assert.equal(hydration.location, "South Perth Evolved Surgery");
    assert.match(hydration.appointmentTypeHint ?? "", /Follow[\s-]?Up Consultation/i);
  });

  it("drawer shows Michael Berry + Google contact before linking (not Patient not linked as title)", () => {
    const display = mapFiCalendarEventToBookingDisplay(michaelBerryOverlap());
    assert.equal(display.anchorLabel, "Michael Berry");
    assert.notEqual(display.anchorLabel, PATIENT_NOT_LINKED_LABEL);
    assert.equal(display.patientNotLinked, true);
    assert.equal(display.googleHydratedDisplayName, "Michael Berry");
    assert.equal(display.googleHydratedEmail, "m.berry2011@hotmail.com");
    assert.equal(display.googleHydratedPhone, "61421412307");
    assert.equal(display.googleHydratedLocation, "South Perth Evolved Surgery");
    assert.match(display.googleHydratedAppointmentType ?? "", /Follow[\s-]?Up Consultation/i);
    assert.equal(display.calendarOsExternalEventId, GOOGLE_EVENT_ID);
    assert.equal(display.calendarOsCalendarId, CLINIC);
  });

  it("search finds Michael Berry by exact email after create (and name as low-confidence)", () => {
    const byEmail = suggestCalendarPatientMatches({
      eventEmail: "m.berry2011@hotmail.com",
      eventPhone: "61421412307",
      eventDisplayName: "Michael Berry",
      patients: [
        {
          id: PATIENT_ID,
          displayName: "Michael Berry",
          email: "m.berry2011@hotmail.com",
          phone: "0421412307",
        },
      ],
    });
    assert.equal(byEmail.length, 1);
    assert.equal(byEmail[0]!.patientId, PATIENT_ID);
    assert.ok(byEmail[0]!.signals.includes("exact_email"));
    assert.equal(byEmail[0]!.confidence, "high");

    const byNameOnly = suggestCalendarPatientMatches({
      eventDisplayName: "Michael Berry",
      patients: [{ id: PATIENT_ID, displayName: "Michael Berry", email: null }],
    });
    assert.equal(byNameOnly.length, 1);
    assert.deepEqual(byNameOnly[0]!.signals, ["exact_normalised_name"]);
    assert.equal(byNameOnly[0]!.confidence, "low");
  });

  it("after link: google_linked_fios, Google ids preserved, reopen does not invent another patient key", () => {
    const linked = michaelBerryOverlap({
      patient_id: PATIENT_ID,
      metadata: {
        source: "fi_appointment_create",
        ownership: "fi_system",
        person_identity_state: "patient_linked",
        google_calendar_id: CLINIC,
        google_event_id_preserved: GOOGLE_EVENT_ID,
      },
    });
    assert.equal(linked.external_event_id, GOOGLE_EVENT_ID);
    assert.equal(linked.calendar_id, CLINIC);
    assert.equal(linked.patient_id, PATIENT_ID);

    const classification = classifyCalendarEvent({
      isCalendarOsEvent: true,
      metadata: linked.metadata,
      patientId: PATIENT_ID,
      externalEventId: GOOGLE_EVENT_ID,
    });
    assert.equal(classification, "google_linked_fios");

    // Idempotency key for createFromGoogleHydration is the Google external id.
    const sourceKey = linked.external_event_id;
    assert.equal(sourceKey, GOOGLE_EVENT_ID);
    assert.equal(sourceKey, GOOGLE_EVENT_ID); // reopen uses same key → same patient
  });

  it("persisted hydration round-trips through metadata", () => {
    const hydration = hydratePatientFromGoogleEvent({
      summary: "Michael Berry",
      description: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.description,
      location: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.location,
      attendees: [{ email: "m.berry2011@hotmail.com" }],
      clinicAccountEmail: CLINIC,
    });
    const meta = googlePatientHydrationToMetadata(hydration);
    const roundTrip = readPersistedGooglePatientHydration(meta, {
      title: "Michael Berry",
      description: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.description,
      location: MICHAEL_BERRY_GOOGLE_EVENT_FIXTURE.location,
    });
    assert.equal(roundTrip.email, "m.berry2011@hotmail.com");
    assert.equal(roundTrip.phone, "61421412307");
    assert.equal(roundTrip.displayName, "Michael Berry");
  });
});
