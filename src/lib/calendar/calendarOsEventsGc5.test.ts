import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  calendarOsBookingRowExposesSecrets,
  calendarOsClientFieldsFromEvent,
  isCalendarOsEventRow,
  mapFiCalendarEventOverlapRowToBookingRow,
  mapFiCalendarEventToBookingDisplay,
  mapFiCalendarEventsToOperationalCalendar,
  resolveCalendarOsProviderKind,
  sanitizeCalendarOsMetadataForClient,
  FI_CALENDAR_EVENTS_OVERLAP_SELECT,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function sampleEventRow(overrides: Partial<FiCalendarEventOverlapRow> = {}): FiCalendarEventOverlapRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT_A,
    external_event_id: "google-event-123",
    provider: "google",
    calendar_id: "primary",
    title: "Consultation — Jane Doe",
    description: null,
    location: "Room 2",
    start_time: "2026-06-26T10:00:00.000Z",
    end_time: "2026-06-26T10:30:00.000Z",
    event_type: "consultation",
    google_meet_url: "https://meet.google.com/abc-defg-hij",
    patient_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    lead_id: null,
    metadata: { source: "google_sync" },
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CalendarOS GC-5 — calendar event mapping", () => {
  it("maps fi_calendar_events into FiBookingRow calendar shape", () => {
    const row = sampleEventRow();
    const booking = mapFiCalendarEventOverlapRowToBookingRow(row, "Europe/London");
    assert.ok(booking);
    assert.equal(booking!.id, row.id);
    assert.equal(booking!.tenant_id, TENANT_A);
    assert.equal(booking!.title, row.title);
    assert.equal(booking!.start_at, row.start_time);
    assert.equal(booking!.end_at, row.end_time);
    assert.equal(booking!.booking_type, "consultation");
    assert.equal(booking!.location, "Room 2");
    assert.equal(booking!.patient_id, row.patient_id);
    assert.equal(booking!.lead_id, null);
    assert.equal(isCalendarOsEventRow(booking!), true);
  });

  it("labels Google-synced vs FI-created source correctly", () => {
    const google = calendarOsClientFieldsFromEvent(sampleEventRow({ metadata: { source: "google_sync" } }));
    assert.equal(google.calendarOsProvider, "google");
    assert.equal(google.calendarOsSourceLabel, "Google Calendar");

    const fi = calendarOsClientFieldsFromEvent(
      sampleEventRow({ metadata: { source: "fi_calendar_create" } })
    );
    assert.equal(fi.calendarOsProvider, "fi");
    assert.equal(fi.calendarOsSourceLabel, "FI OS");
    assert.equal(resolveCalendarOsProviderKind({ source: "fi_calendar_create" }), "fi");
  });

  it("includes Google Meet link in booking display when present", () => {
    const display = mapFiCalendarEventToBookingDisplay(sampleEventRow());
    assert.equal(display.googleMeetUrl, "https://meet.google.com/abc-defg-hij");
    assert.equal(display.calendarOsEventTypeLabel, "Consultation");
    assert.equal(display.calendarOsCalendarId, "primary");
  });

  it("preserves linked patient and lead ids on mapped booking rows", () => {
    const leadId = randomUUID();
    const patientId = randomUUID();
    const booking = mapFiCalendarEventOverlapRowToBookingRow(
      sampleEventRow({ patient_id: patientId, lead_id: leadId }),
      "UTC"
    );
    assert.equal(booking!.patient_id, patientId);
    assert.equal(booking!.lead_id, leadId);
  });

  it("does not expose tokens or raw Google payloads on mapped rows", () => {
    const booking = mapFiCalendarEventOverlapRowToBookingRow(
      sampleEventRow({
        metadata: {
          source: "google_sync",
          access_token: "secret-token",
          refresh_token: "secret-refresh",
          raw_google_event: { summary: "hidden" },
          provider_payload: { id: "evt" },
        },
      }),
      "UTC"
    );
    assert.ok(booking);
    assert.equal(calendarOsBookingRowExposesSecrets(booking!), false);
    assert.equal(sanitizeCalendarOsMetadataForClient(booking!.metadata).access_token, undefined);
    assert.equal(sanitizeCalendarOsMetadataForClient(booking!.metadata).raw_google_event, undefined);
  });

  it("skips deleted mirror rows and invalid datetimes", () => {
    assert.equal(
      mapFiCalendarEventOverlapRowToBookingRow(
        sampleEventRow({ metadata: { deleted_from_provider: true } }),
        "UTC"
      ),
      null
    );
    assert.equal(
      mapFiCalendarEventOverlapRowToBookingRow(sampleEventRow({ start_time: null }), "UTC"),
      null
    );
  });

  it("merges calendar events alongside existing bookings without replacing them", () => {
    const existingBooking: FiBookingRow = {
      id: randomUUID(),
      tenant_id: TENANT_A,
      lead_id: null,
      person_id: null,
      patient_id: null,
      case_id: null,
      clinic_id: null,
      room_id: null,
      room_required: false,
      assigned_staff_id: null,
      assigned_user_id: null,
      booking_type: "consultation",
      booking_status: "scheduled",
      title: "FI booking",
      description: null,
      start_at: "2026-06-26T11:00:00.000Z",
      end_at: "2026-06-26T11:30:00.000Z",
      timezone: "UTC",
      location: null,
      metadata: {},
      cancelled_at: null,
      cancelled_by_user_id: null,
      cancellation_reason: null,
      created_by_user_id: null,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    };

    const mapped = mapFiCalendarEventsToOperationalCalendar([sampleEventRow()], {
      tenantId: TENANT_A,
      calendarTimezone: "UTC",
      displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
      services: [],
    });

    const combined = [existingBooking, ...mapped.bookings];
    assert.equal(combined.length, 2);
    assert.ok(combined.some((b) => b.id === existingBooking.id));
    assert.ok(combined.some((b) => isCalendarOsEventRow(b)));
    const calendarOsId = mapped.bookings[0]!.id;
    assert.equal(mapped.bookingDisplay[calendarOsId]?.googleMeetUrl?.includes("meet.google.com"), true);
  });

  it("mapFiCalendarEventsToOperationalCalendar ignores cross-tenant rows", () => {
    const mapped = mapFiCalendarEventsToOperationalCalendar(
      [sampleEventRow({ tenant_id: TENANT_B })],
      {
        tenantId: TENANT_A,
        calendarTimezone: "UTC",
        displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
        services: [],
      }
    );
    assert.equal(mapped.bookings.length, 0);
  });

  it("overlap select projection includes description and excludes token fields", () => {
    assert.equal(FI_CALENDAR_EVENTS_OVERLAP_SELECT.includes("description"), true);
    assert.equal(FI_CALENDAR_EVENTS_OVERLAP_SELECT.includes("access_token"), false);
    assert.equal(FI_CALENDAR_EVENTS_OVERLAP_SELECT.includes("refresh_token"), false);
  });

  it("empty calendar event list yields no mapped bookings safely", () => {
    const mapped = mapFiCalendarEventsToOperationalCalendar([], {
      tenantId: TENANT_A,
      calendarTimezone: "UTC",
      displayMaps: { patients: new Map(), leads: new Map(), persons: new Map() },
      services: [],
    });
    assert.deepEqual(mapped.bookings, []);
    assert.deepEqual(mapped.bookingDisplay, {});
  });
});
