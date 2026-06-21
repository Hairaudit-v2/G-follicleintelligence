import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildWorkforceCandidateAssignments,
  getWorkforceEventWindow,
  isBookingActiveForStaffing,
  resolveWorkforceAssignedRole,
  resolveWorkforceEventSource,
  resolveWorkforceEventTypeFromBooking,
  resolveWorkforceEventTypeFromSurgery,
} from "@/src/lib/workforce-os/workforceClinicalEventMapping";
import type { FiBookingRow } from "@/src/lib/bookings/types";

function booking(partial: Partial<FiBookingRow> & Pick<FiBookingRow, "booking_type">): FiBookingRow {
  const { booking_type, ...rest } = partial;
  return {
    id: "b1",
    tenant_id: "t1",
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type,
    booking_status: "scheduled",
    title: null,
    description: null,
    start_at: "2026-06-09T01:00:00.000Z",
    end_at: "2026-06-09T02:00:00.000Z",
    timezone: "Australia/Perth",
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...rest,
  };
}

test("resolveWorkforceEventTypeFromBooking maps known booking types", () => {
  assert.equal(resolveWorkforceEventTypeFromBooking(booking({ booking_type: "surgery" })), "surgery");
  assert.equal(resolveWorkforceEventTypeFromBooking(booking({ booking_type: "consultation" })), "consultation");
  assert.equal(resolveWorkforceEventTypeFromBooking(booking({ booking_type: "prp" })), "prp");
  assert.equal(resolveWorkforceEventTypeFromBooking(booking({ booking_type: "exosomes" })), "exosomes");
  assert.equal(resolveWorkforceEventTypeFromBooking(booking({ booking_type: "review" })), "review");
  assert.equal(resolveWorkforceEventTypeFromBooking(booking({ booking_type: "prf" })), "prp");
  assert.equal(resolveWorkforceEventTypeFromBooking(booking({ booking_type: "follow_up" })), "review");
});

test("resolveWorkforceEventTypeFromBooking falls back safely for unknown types", () => {
  assert.equal(resolveWorkforceEventTypeFromBooking(booking({ booking_type: "mystery_type" })), "consultation");
});

test("resolveWorkforceEventTypeFromBooking maps procedure day metadata", () => {
  assert.equal(
    resolveWorkforceEventTypeFromBooking(
      booking({ booking_type: "consultation", metadata: { procedure_day_kind: "procedure_day" } })
    ),
    "theatre_day"
  );
  assert.equal(
    resolveWorkforceEventTypeFromBooking(
      booking({ booking_type: "surgery", metadata: { event_kind: "surgery_day" } })
    ),
    "surgery"
  );
});

test("resolveWorkforceEventTypeFromSurgery defaults to surgery", () => {
  assert.equal(resolveWorkforceEventTypeFromSurgery({ procedure_phase: "extraction" }), "surgery");
  assert.equal(resolveWorkforceEventTypeFromSurgery({ procedure_phase: "theatre_day" }), "theatre_day");
});

test("resolveWorkforceEventSource is deterministic", () => {
  assert.equal(resolveWorkforceEventSource({ kind: "booking" }), "booking");
  assert.equal(resolveWorkforceEventSource({ kind: "surgery" }), "surgery");
});

test("getWorkforceEventWindow returns booking window", () => {
  const row = booking({ booking_type: "consultation" });
  assert.deepEqual(getWorkforceEventWindow(row), {
    startsAt: row.start_at,
    endsAt: row.end_at,
  });
});

test("resolveWorkforceAssignedRole prefers role label and aliases", () => {
  assert.equal(resolveWorkforceAssignedRole({ roleLabel: "Nurse" }), "nurse");
  assert.equal(resolveWorkforceAssignedRole({ staffRole: "tech", bookingType: "surgery" }), "technician");
  assert.equal(resolveWorkforceAssignedRole({ staffRole: "consultant", bookingType: "consultation" }), "consultant");
});

test("buildWorkforceCandidateAssignments deduplicates primary, resource, and existing rows", () => {
  const candidates = buildWorkforceCandidateAssignments({
    primaryStaffId: "staff-1",
    primaryStaffRole: "consultant",
    bookingType: "consultation",
    resourceStaff: [{ staffId: "staff-2", roleLabel: "nurse" }],
    existingAssignments: [{ staffId: "staff-1", assignedRole: "consultant" }],
  });
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates[0], { staffId: "staff-1", assignedRole: "consultant" });
  assert.deepEqual(candidates[1], { staffId: "staff-2", assignedRole: "nurse" });
});

test("isBookingActiveForStaffing ignores cancelled bookings", () => {
  assert.equal(isBookingActiveForStaffing(booking({ booking_type: "surgery", booking_status: "scheduled" })), true);
  assert.equal(
    isBookingActiveForStaffing(booking({ booking_type: "surgery", booking_status: "cancelled", cancelled_at: "2026-06-01T00:00:00.000Z" })),
    false
  );
});
