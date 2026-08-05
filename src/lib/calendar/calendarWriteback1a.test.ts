/**
 * FI-CALENDAR-WRITEBACK-1A — unit coverage for classification, policy, drop-intent, patient match.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyCalendarEvent,
  PATIENT_NOT_LINKED_LABEL,
  calendarEventClassificationLabel,
} from "@/src/lib/calendar/calendarEventClassification";
import {
  resolveCalendarAppointmentCapabilities,
  calendarCapabilitySatisfies,
} from "@/src/lib/calendar/calendarAppointmentCapabilities";
import { resolveCalendarEventEditPolicy } from "@/src/lib/calendar/calendarEventEditPolicy";
import {
  applyCalendarDropIntentToBooking,
  resolveCalendarDropIntent,
} from "@/src/lib/calendar/calendarDropIntent";
import { suggestCalendarPatientMatches } from "@/src/lib/calendar/calendarPatientMatchSuggestions";
import {
  buildCalendarMutationAuditRecord,
  diffCalendarAuditChanges,
} from "@/src/lib/calendar/calendarWritebackAudit";
import {
  mapFiCalendarEventOverlapRowToBookingRow,
  mapFiCalendarEventToBookingDisplay,
  type FiCalendarEventOverlapRow,
} from "@/src/lib/calendar/calendarOsEventsCore";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import { GOOGLE_LINKED_FIOS_FIELD_SOURCE_OF_TRUTH } from "@/src/lib/calendar/calendarFieldSourceOfTruth";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function sampleOverlap(
  overrides: Partial<FiCalendarEventOverlapRow> = {}
): FiCalendarEventOverlapRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: TENANT,
    external_event_id: "google-evt-1",
    provider: "google",
    calendar_id: "primary",
    title: "Consult — Mystery Name",
    description: null,
    location: "Room A",
    start_time: "2026-08-05T10:00:00.000Z",
    end_time: "2026-08-05T10:30:00.000Z",
    event_type: "consultation",
    google_meet_url: null,
    patient_id: null,
    lead_id: null,
    metadata: { source: "google_sync" },
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("FI-CALENDAR-WRITEBACK-1A classification", () => {
  it("classifies native bookings without CalendarOS flag", () => {
    assert.equal(
      classifyCalendarEvent({ isCalendarOsEvent: false, metadata: {} }),
      "fios_native"
    );
  });

  it("classifies FI-owned Google mirrors as google_linked_fios", () => {
    assert.equal(
      classifyCalendarEvent({
        isCalendarOsEvent: true,
        metadata: { source: "fi_appointment_create" },
        externalEventId: "g1",
        patientId: "p1",
      }),
      "google_linked_fios"
    );
  });

  it("classifies inbound Google without patient as google_external_unlinked", () => {
    assert.equal(
      classifyCalendarEvent({
        isCalendarOsEvent: true,
        metadata: { source: "google_sync" },
        externalEventId: "g1",
      }),
      "google_external_unlinked"
    );
  });

  it("isolates admin test panel events as calendaros_test", () => {
    assert.equal(
      classifyCalendarEvent({
        isCalendarOsEvent: true,
        metadata: { source: "fi_admin_test_panel" },
        externalEventId: "g1",
      }),
      "calendaros_test"
    );
  });

  it("does not infer linked-fios from externalId alone for google_external", () => {
    assert.notEqual(
      classifyCalendarEvent({
        isCalendarOsEvent: true,
        metadata: { source: "google_sync" },
        externalEventId: "has-id",
      }),
      "google_linked_fios"
    );
  });
});

describe("FI-CALENDAR-WRITEBACK-1A edit policy", () => {
  const caps = resolveCalendarAppointmentCapabilities({
    canView: true,
    canMutateBookings: true,
    googleWritebackReady: true,
    isElevatedOperator: true,
  });

  it("enables drag + quick edit for fios_native", () => {
    const policy = resolveCalendarEventEditPolicy("fios_native", caps, {
      hasPatientLink: true,
    });
    assert.equal(policy.canDrag, true);
    assert.equal(policy.canQuickEdit, true);
    assert.ok(policy.drawerActions.includes("quick_edit"));
    assert.ok(!policy.drawerActions.includes("read_only_explanation"));
  });

  it("enables write-back drag for google_linked_fios when ready", () => {
    const policy = resolveCalendarEventEditPolicy("google_linked_fios", caps, {
      hasPatientLink: true,
      googleWritebackReady: true,
      googleHtmlLink: "https://calendar.google.com/event?eid=abc",
    });
    assert.equal(policy.canDrag, true);
    assert.equal(policy.canGoogleWriteback, true);
    assert.ok(policy.drawerActions.includes("open_in_google_calendar"));
  });

  it("keeps external unlinked non-draggable with convert/link actions", () => {
    const policy = resolveCalendarEventEditPolicy("google_external_unlinked", caps, {
      googleHtmlLink: "https://calendar.google.com/event?eid=abc",
    });
    assert.equal(policy.canDrag, false);
    assert.equal(policy.showExternalBadge, true);
    assert.ok(policy.drawerActions.includes("link_patient"));
    assert.ok(policy.drawerActions.includes("convert_to_fios_appointment"));
    assert.ok(policy.readOnlyExplanation);
  });

  it("never directs calendaros_test users to a test panel for production edits", () => {
    const policy = resolveCalendarEventEditPolicy("calendaros_test", caps);
    assert.equal(policy.canDrag, false);
    assert.ok(policy.readOnlyExplanation?.includes("isolated"));
    assert.ok(!policy.readOnlyExplanation?.toLowerCase().includes("edit in google"));
  });
});

describe("FI-CALENDAR-WRITEBACK-1A capabilities", () => {
  it("does not grant convert_external from mutate alone", () => {
    const caps = resolveCalendarAppointmentCapabilities({
      canView: true,
      canMutateBookings: true,
      googleWritebackReady: true,
      isElevatedOperator: false,
    });
    assert.equal(calendarCapabilitySatisfies(caps, "appointment.edit"), true);
    assert.equal(calendarCapabilitySatisfies(caps, "appointment.convert_external"), false);
  });
});

describe("FI-CALENDAR-WRITEBACK-1A drop intent", () => {
  const booking = {
    id: "b1",
    start_at: "2026-08-05T10:00:00.000Z",
    end_at: "2026-08-05T10:30:00.000Z",
    assigned_staff_id: "staff-1",
    assigned_user_id: null,
    clinic_id: "clinic-1",
    room_id: null,
  } as unknown as FiBookingRow;

  it("clears clinician only on unassigned staff column and preserves clinic", () => {
    const intent = resolveCalendarDropIntent({
      booking,
      startAt: "2026-08-05T11:00:00.000Z",
      endAt: "2026-08-05T11:30:00.000Z",
      columnId: "unassigned",
      staffIdByUserId: new Map(),
      resourceView: "staff",
    });
    assert.equal(intent.resources.assignedStaffId, null);
    assert.ok(!Object.prototype.hasOwnProperty.call(intent.resources, "clinicId"));
    const next = applyCalendarDropIntentToBooking(booking, intent);
    assert.equal(next.assigned_staff_id, null);
    assert.equal(next.clinic_id, "clinic-1");
    assert.equal(next.start_at, "2026-08-05T11:00:00.000Z");
  });
});

describe("FI-CALENDAR-WRITEBACK-1A patient labels + match", () => {
  it("maps unlinked CalendarOS display to Patient not linked", () => {
    const display = mapFiCalendarEventToBookingDisplay(sampleOverlap());
    assert.equal(display.anchorLabel, PATIENT_NOT_LINKED_LABEL);
    assert.equal(display.patientNotLinked, true);
    assert.equal(display.calendarOsExternalTitle, "Consult — Mystery Name");
    assert.equal(display.calendarEventClassification, "google_external_unlinked");
  });

  it("stores classification on booking metadata", () => {
    const booking = mapFiCalendarEventOverlapRowToBookingRow(
      sampleOverlap({
        metadata: { source: "fi_calendar_create" },
        patient_id: "p1",
      }),
      "Australia/Sydney"
    );
    assert.ok(booking);
    assert.equal(booking!.metadata?.calendar_event_classification, "google_linked_fios");
  });

  it("suggests only exact email/phone/verified mapping — never name alone", () => {
    const suggestions = suggestCalendarPatientMatches({
      eventEmail: "jane@example.com",
      eventPhone: null,
      patients: [
        { id: "1", displayName: "Jane Doe", email: "jane@example.com" },
        { id: "2", displayName: "Jane Doe", email: "other@example.com" },
      ],
    });
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].patientId, "1");
    assert.deepEqual(suggestions[0].signals, ["exact_email"]);
  });
});

describe("FI-CALENDAR-WRITEBACK-1A audit + SoT", () => {
  it("diffs previous/next values into audit changes", () => {
    const changes = diffCalendarAuditChanges(
      { start_time: "a", title: "old" },
      { start_time: "b", title: "old" }
    );
    assert.equal(changes.length, 1);
    assert.equal(changes[0].field, "start_time");
  });

  it("builds audit record with interaction source", () => {
    const record = buildCalendarMutationAuditRecord({
      id: "audit-1",
      tenantId: TENANT,
      interactionSource: "calendar_drag",
      classification: "google_linked_fios",
      googleEventId: "g1",
      localCalendarEventId: "l1",
      previousValues: { start_time: "a" },
      nextValues: { start_time: "b" },
      writebackStatus: "synced",
      actingUserId: "user-1",
    });
    assert.equal(record.interactionSource, "calendar_drag");
    assert.equal(record.writebackStatus, "synced");
    assert.equal(record.changes.length, 1);
  });

  it("documents field source of truth entries", () => {
    assert.ok(GOOGLE_LINKED_FIOS_FIELD_SOURCE_OF_TRUTH.some((e) => e.field === "start_time"));
    assert.ok(GOOGLE_LINKED_FIOS_FIELD_SOURCE_OF_TRUTH.some((e) => e.field === "patient_id"));
    assert.equal(calendarEventClassificationLabel("google_linked_fios"), "Google-linked FiOS");
  });
});
