import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bookingConflictsForOperationalCalendar,
  monthEmptyDayQuickCreateLocalStart,
} from "./operationalCalendarLayout";
import type { FiBookingRow } from "@/src/lib/bookings/types";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROVIDER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function row(
  p: Partial<FiBookingRow> & Pick<FiBookingRow, "id" | "start_at" | "end_at">
): FiBookingRow {
  return {
    tenant_id: TID,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: "Test",
    description: null,
    timezone: null,
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...p,
    room_id: p.room_id ?? null,
    room_required: p.room_required ?? false,
  };
}

describe("bookingConflictsForOperationalCalendar", () => {
  it("flags overlap for same provider including default buffer", () => {
    const existing = row({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      assigned_user_id: PROVIDER,
      start_at: "2026-06-10T01:00:00.000Z",
      end_at: "2026-06-10T02:00:00.000Z",
    });
    const candidate = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      start_at: "2026-06-10T02:10:00.000Z",
      end_at: "2026-06-10T02:40:00.000Z",
      assigned_staff_id: null,
      assigned_user_id: PROVIDER,
      clinic_id: null,
    };
    const conflicts = bookingConflictsForOperationalCalendar(candidate, [existing], {
      ignoreBookingId: candidate.id,
    });
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]!.id, existing.id);
  });

  it("ignores cancelled rows", () => {
    const cancelled = row({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      assigned_user_id: PROVIDER,
      booking_status: "cancelled",
      start_at: "2026-06-10T01:00:00.000Z",
      end_at: "2026-06-10T02:00:00.000Z",
    });
    const candidate = {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      start_at: "2026-06-10T01:30:00.000Z",
      end_at: "2026-06-10T02:30:00.000Z",
      assigned_staff_id: null,
      assigned_user_id: PROVIDER,
      clinic_id: null,
    };
    const conflicts = bookingConflictsForOperationalCalendar(candidate, [cancelled], {
      ignoreBookingId: candidate.id,
    });
    assert.equal(conflicts.length, 0);
  });
});

describe("monthEmptyDayQuickCreateLocalStart", () => {
  it("uses clinic-local business open hour", () => {
    assert.equal(
      monthEmptyDayQuickCreateLocalStart("2026-06-15", {
        dayStartHourUtc: 8,
        dayEndHourUtc: 18,
        slotMinutes: 30,
        timeZone: "Australia/Brisbane",
      }),
      "2026-06-15T08:00"
    );
  });

  it("falls back to 09:00 when open hour is invalid", () => {
    assert.equal(
      monthEmptyDayQuickCreateLocalStart("2026-06-15", {
        dayStartHourUtc: NaN,
        dayEndHourUtc: 18,
        slotMinutes: 30,
        timeZone: "UTC",
      }),
      "2026-06-15T09:00"
    );
  });
});
