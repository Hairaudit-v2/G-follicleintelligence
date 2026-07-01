import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import { evaluateCalendarConflicts } from "./calendarConflictEngineCore";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAFF = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function row(p: Partial<FiBookingRow> & Pick<FiBookingRow, "id" | "start_at" | "end_at">): FiBookingRow {
  return {
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
    created_at: p.start_at,
    updated_at: p.start_at,
    ...p,
  };
}

describe("calendarConflictEngineCore", () => {
  it("blocks surgeon overlap", () => {
    const existing = row({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      assigned_staff_id: STAFF,
      start_at: "2026-06-10T08:00:00.000Z",
      end_at: "2026-06-10T10:00:00.000Z",
    });
    const candidate = row({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      assigned_staff_id: STAFF,
      start_at: "2026-06-10T09:00:00.000Z",
      end_at: "2026-06-10T11:00:00.000Z",
    });
    const result = evaluateCalendarConflicts({
      candidate,
      existing: [existing],
      gridConfig: {
        dayStartHourUtc: 0,
        dayEndHourUtc: 24,
        slotMinutes: 15,
        timeZone: "UTC",
      },
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.violations.some((v) => v.kind === "surgeon_overlap"));
  });

  it("blocks surgery without required staff", () => {
    const candidate = row({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      booking_type: "surgery",
      start_at: "2026-06-10T09:00:00.000Z",
      end_at: "2026-06-10T17:00:00.000Z",
    });
    const result = evaluateCalendarConflicts({
      candidate,
      existing: [],
      gridConfig: {
        dayStartHourUtc: 0,
        dayEndHourUtc: 24,
        slotMinutes: 15,
        timeZone: "UTC",
      },
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.violations.some((v) => v.kind === "surgery_without_required_staff"));
  });
});