import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLocalRescheduleMetadataPatch,
  externalRescheduleRequiresFiOnlyConfirmation,
  isBookingDragMutable,
  isTimelyImportedBooking,
  parseCalendarOsDayDropId,
  parseCalendarOsWeekDropId,
  planWeekCellDragReschedule,
} from "./calendarOsBookingInteractionCore";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { CalendarDayLane } from "@/src/lib/bookings/calendarView";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function booking(p: Partial<FiBookingRow> & Pick<FiBookingRow, "id">): FiBookingRow {
  return {
    tenant_id: TID,
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
    title: "Test",
    description: null,
    timezone: "UTC",
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-07-07T00:00:00.000Z",
    updated_at: "2026-07-07T00:00:00.000Z",
    start_at: "2026-07-07T09:00:00.000Z",
    end_at: "2026-07-07T10:00:00.000Z",
    ...p,
  };
}

describe("calendarOsBookingInteractionCore", () => {
  it("blocks drag for imported Google CalendarOS events", () => {
    const row = booking({
      id: "g1",
      metadata: { calendar_os_event: true, source: "google" },
    });
    assert.equal(isBookingDragMutable(row), false);
  });

  it("allows drag for FI bookings and Timely imports", () => {
    assert.equal(isBookingDragMutable(booking({ id: "fi-1" })), true);
    assert.equal(
      isBookingDragMutable(
        booking({ id: "t1", metadata: { source_system: "timely", external_appointment_id: "TA-1" } })
      ),
      true
    );
  });

  it("detects Timely imports and confirmation requirement", () => {
    const timely = booking({ id: "t1", metadata: { source_system: "timely" } });
    assert.equal(isTimelyImportedBooking(timely), true);
    assert.equal(externalRescheduleRequiresFiOnlyConfirmation(timely), true);
    assert.equal(externalRescheduleRequiresFiOnlyConfirmation(booking({ id: "fi-1" })), false);
  });

  it("patches local override metadata for Timely reschedules", () => {
    const timely = booking({
      id: "t1",
      metadata: { source_system: "timely", external_appointment_id: "TA-99" },
    });
    const next = buildLocalRescheduleMetadataPatch(
      timely.metadata,
      timely,
      timely.start_at,
      timely.end_at
    );
    assert.equal(next.rescheduled_in_fi_os, true);
    assert.equal(next.source_sync_status, "local_override");
    assert.equal(next.original_external_start_at, timely.start_at);
  });

  it("parses day and week drop ids", () => {
    assert.deepEqual(parseCalendarOsDayDropId("drop:2026-07-07:s:staff-1"), {
      dayKey: "2026-07-07",
      columnId: "s:staff-1",
    });
    assert.deepEqual(parseCalendarOsWeekDropId("week-drop:2026-07-08:r:room-2"), {
      dayKey: "2026-07-08",
      resourceId: "r:room-2",
    });
  });

  it("plans week-cell drag preserving duration and clock time", () => {
    const lane: CalendarDayLane = {
      dayKey: "2026-07-08",
      startMs: Date.parse("2026-07-08T00:00:00.000Z"),
      endMs: Date.parse("2026-07-09T00:00:00.000Z"),
    };
    const plan = planWeekCellDragReschedule({
      booking: booking({
        id: "b1",
        start_at: "2026-07-07T09:00:00.000Z",
        end_at: "2026-07-07T10:00:00.000Z",
      }),
      drop: { dayKey: "2026-07-08", resourceId: "s:staff-2" },
      lane,
      gridConfig: {
        dayStartHourUtc: 8,
        dayEndHourUtc: 18,
        slotMinutes: 15,
        timeZone: "UTC",
      },
    });
    assert.ok(plan);
    assert.equal(plan!.columnId, "s:staff-2");
    assert.equal(plan!.startIso, "2026-07-08T09:00:00.000Z");
    assert.equal(plan!.endIso, "2026-07-08T10:00:00.000Z");
  });
});
