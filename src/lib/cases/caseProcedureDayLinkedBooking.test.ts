import assert from "node:assert/strict";
import test from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import { pickPrimaryLinkedSurgeryBookingYmd } from "@/src/lib/cases/caseProcedureDayLinkedBooking";

function row(
  partial: Partial<FiBookingRow> &
    Pick<FiBookingRow, "id" | "start_at" | "booking_type" | "booking_status">
): FiBookingRow {
  return {
    tenant_id: "t",
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: "c",
    clinic_id: null,
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    title: null,
    description: null,
    end_at: partial.start_at,
    timezone: null,
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: partial.start_at,
    updated_at: partial.start_at,
    ...partial,
  };
}

test("pickPrimaryLinkedSurgeryBookingYmd: picks earliest surgery by start_at", () => {
  const bookings = [
    row({
      id: "b2",
      start_at: "2026-06-15T10:00:00.000Z",
      booking_type: "surgery",
      booking_status: "confirmed",
    }),
    row({
      id: "b1",
      start_at: "2026-06-12T08:00:00.000Z",
      booking_type: "surgery",
      booking_status: "confirmed",
    }),
  ];
  const r = pickPrimaryLinkedSurgeryBookingYmd(bookings, "UTC");
  assert.equal(r.bookingId, "b1");
  assert.equal(r.ymd, "2026-06-12");
});

test("pickPrimaryLinkedSurgeryBookingYmd: ignores cancelled", () => {
  const bookings = [
    row({
      id: "b1",
      start_at: "2026-06-12T08:00:00.000Z",
      booking_type: "surgery",
      booking_status: "cancelled",
    }),
    row({
      id: "b2",
      start_at: "2026-06-14T08:00:00.000Z",
      booking_type: "surgery",
      booking_status: "confirmed",
    }),
  ];
  const r = pickPrimaryLinkedSurgeryBookingYmd(bookings, "Australia/Brisbane");
  assert.equal(r.bookingId, "b2");
});
