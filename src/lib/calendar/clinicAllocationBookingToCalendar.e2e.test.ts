/**
 * Booking → calendar placement E2E (in-process).
 * Models: create shape with Evolved Perth + no clinician/room → clinic resource view placement.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import { resolveAppointmentClinicId } from "@/src/lib/bookings/resolveAppointmentClinicId";
import {
  resolveDisplayResourceColumnId,
  resourceColumnIdForBooking,
} from "@/src/lib/calendar/operationalCalendarLayout";
import { appendUnassignedResourceColumnIfNeeded } from "@/src/lib/calendar/unassignedResourceColumn";

const PERTH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT = "tttttttt-tttt-4ttt-8ttt-tttttttttttt";

function createdBooking(overrides: Partial<FiBookingRow> = {}): FiBookingRow {
  const clinicId = resolveAppointmentClinicId({
    appointmentClinicId: overrides.clinic_id ?? PERTH,
    staffClinicId: null,
    roomClinicId: null,
  });
  const { clinic_id: _ignored, ...rest } = overrides;
  return {
    id: "appt-e2e-1",
    tenant_id: TENANT,
    lead_id: "llllllll-llll-4lll-8lll-llllllllllll",
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: clinicId,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: "Evolved Perth booking",
    description: null,
    start_at: "2026-08-05T03:00:00.000Z",
    end_at: "2026-08-05T03:45:00.000Z",
    timezone: "Australia/Perth",
    location: null,
    metadata: { intake: "calendar_quick_create" },
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-08-05T00:00:00.000Z",
    updated_at: "2026-08-05T00:00:00.000Z",
    room_id: null,
    room_required: true,
    ...rest,
    clinic_id: clinicId,
  };
}

function openCalendarAndAssert(booking: FiBookingRow) {
  const perthCol = `c:${PERTH}`;
  const columns = appendUnassignedResourceColumnIfNeeded(
    [{ id: perthCol, kind: "clinic", label: "Evolved Hair Restoration Perth", subtitle: "Clinic site" }],
    [booking],
    { resourceView: "clinic" }
  );

  const placed = resolveDisplayResourceColumnId(
    booking,
    columns.map((c) => c.id),
    { resourceView: "clinic" }
  );

  assert.equal(resourceColumnIdForBooking(booking, { resourceView: "clinic" }), perthCol);
  assert.equal(placed, perthCol);
  assert.equal(
    columns.some((c) => c.id === "unassigned"),
    false,
    "No clinic column must not appear when every booking has a clinic"
  );
  assert.notEqual(placed, "unassigned");
  return placed;
}

describe("booking-to-calendar E2E: Evolved Perth without clinician/room", () => {
  it("create → save → open calendar → under Evolved Perth, not No clinic", () => {
    const saved = createdBooking();
    assert.equal(saved.clinic_id, PERTH);
    assert.equal(saved.assigned_staff_id, null);
    assert.equal(saved.room_id, null);

    openCalendarAndAssert(saved);
  });

  it("reload page and repeat the assertion", () => {
    const saved = createdBooking();
    // Simulate reload by re-deriving placement from the persisted row shape.
    const reloaded: FiBookingRow = { ...saved };
    openCalendarAndAssert(reloaded);
    openCalendarAndAssert(reloaded);
  });
});
