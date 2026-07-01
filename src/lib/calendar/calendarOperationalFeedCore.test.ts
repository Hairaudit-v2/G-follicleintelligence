import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCalendarSearchParams, calendarRangeIsoForQuery } from "@/src/lib/bookings/calendarQuery";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  assertCalendarOperationalFeedPayloadIsLightweight,
  buildCalendarOperationalFeedFromBookings,
  calendarOperationalDateWindowForQuery,
  serializeCalendarOperationalFeedForSizeCheck,
} from "./calendarOperationalFeedCore";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function row(id: string, start: string, type = "consultation"): FiBookingRow {
  return {
    id,
    tenant_id: TID,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: true,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: type,
    booking_status: "scheduled",
    title: "Patient",
    description: "Should not appear in feed",
    start_at: start,
    end_at: new Date(Date.parse(start) + 60 * 60_000).toISOString(),
    timezone: "Australia/Perth",
    location: null,
    metadata: { avatar_url: "https://signed.example/x", transcript: "long" },
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: start,
    updated_at: start,
  };
}

describe("calendarOperationalFeedCore", () => {
  it("applies server-side date window for week view only", () => {
    const query = parseCalendarSearchParams({ date: "2026-06-15" }, new Date("2026-06-15"), {
      calendarTimezone: "Australia/Perth",
    });
    const week = calendarOperationalDateWindowForQuery(query);
    const parsedWeek = calendarRangeIsoForQuery(query);
    assert.equal(week.rangeStartIso, parsedWeek.rangeStartIso);
    assert.equal(week.rangeEndIso, parsedWeek.rangeEndIso);

    const monthQuery = parseCalendarSearchParams(
      { view: "month", date: "2026-06-15" },
      new Date("2026-06-15"),
      { calendarTimezone: "Australia/Perth" }
    );
    const month = calendarOperationalDateWindowForQuery(monthQuery);
    const monthParsed = calendarRangeIsoForQuery(monthQuery);
    assert.equal(month.rangeStartIso, monthParsed.rangeStartIso);
    assert.notEqual(month.rangeStartIso, week.rangeStartIso);
  });

  it("builds feed without heavy booking fields in serialized payload", () => {
    const bookings = [
      row("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "2026-06-15T01:00:00.000Z"),
      row("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-06-15T03:00:00.000Z", "surgery"),
    ];
    const feed = buildCalendarOperationalFeedFromBookings(bookings, {
      tenantId: TID,
      patientNameByBookingId: new Map([
        ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Alex"],
        ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Sam"],
      ]),
      staffNameById: {},
      roomLabelById: {},
      journeyStateByPatientId: new Map(),
      depositSatisfiedByBookingId: new Map(),
      consentSignedByPatientId: new Map(),
      preOpCompleteByBookingId: new Map(),
      readinessPercentByBookingId: new Map(),
      staffIdToUserId: new Map(),
      gridConfig: {
        dayStartHourUtc: 6,
        dayEndHourUtc: 19,
        slotMinutes: 15,
        timeZone: "Australia/Perth",
      },
      bufferMinutes: 10,
    });
    assert.equal(feed.items.length, 2);
    const json = serializeCalendarOperationalFeedForSizeCheck(feed.items);
    assert.ok(!json.includes("avatar_url"));
    assert.ok(!json.includes("transcript"));
    assert.ok(!json.includes("description"));
    assert.doesNotThrow(() => assertCalendarOperationalFeedPayloadIsLightweight(feed.items));
  });

  it("surgery feed surfaces readiness and blocker count", () => {
    const bookings = [
      row("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "2026-06-15T03:00:00.000Z", "surgery"),
    ];
    const feed = buildCalendarOperationalFeedFromBookings(bookings, {
      tenantId: TID,
      patientNameByBookingId: new Map([["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Sam"]]),
      staffNameById: {},
      roomLabelById: {},
      journeyStateByPatientId: new Map(),
      depositSatisfiedByBookingId: new Map([["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", false]]),
      consentSignedByPatientId: new Map(),
      preOpCompleteByBookingId: new Map(),
      readinessPercentByBookingId: new Map(),
      staffIdToUserId: new Map(),
      gridConfig: {
        dayStartHourUtc: 6,
        dayEndHourUtc: 19,
        slotMinutes: 15,
        timeZone: "UTC",
      },
      bufferMinutes: 10,
    });
    const item = feed.items[0];
    assert.ok(item);
    assert.equal(item.isSurgery, true);
    assert.ok(item.blockerCount > 0);
    assert.equal(feed.intelligenceByBookingId[item.id]?.paymentFlag, "due");
  });
});