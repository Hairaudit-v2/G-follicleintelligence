import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";

import {
  appointmentPayloadExposesStaffFields,
  classifyPatientGatewayAppointments,
  mapBookingRowToPatientGatewayAppointment,
} from "./patientGatewayAppointmentsCore";

const NOW = "2026-07-27T12:00:00.000Z";

function booking(overrides: Partial<FiBookingRow>): FiBookingRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    lead_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    person_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    patient_id: "11111111-1111-4111-8111-111111111111",
    case_id: null,
    clinic_id: null,
    room_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    room_required: false,
    assigned_staff_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    assigned_user_id: null,
    booking_type: "prp",
    booking_status: "confirmed",
    financial_os_status: "deposit_due",
    title: "PRP Treatment",
    description: "Staff-only clinical note: hypertension discussed",
    start_at: "2026-08-01T01:00:00.000Z",
    end_at: "2026-08-01T02:00:00.000Z",
    timezone: "Australia/Brisbane",
    location: "Room 2",
    metadata: { internal: true },
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: "reschedule privately",
    created_by_user_id: "99999999-9999-4999-8999-999999999999",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("patientGatewayAppointmentsCore", () => {
  it("P. staff-only appointment notes/fields are absent", () => {
    const dto = mapBookingRowToPatientGatewayAppointment(booking({}), "Evolved Hair", NOW);
    assert.equal(appointmentPayloadExposesStaffFields(dto), false);
    assert.equal(dto.title, "PRP Treatment");
    assert.equal(dto.location.name, "Evolved Hair");
    assert.equal(dto.status, "confirmed");
    assert.equal(dto.canRequestChange, true);
  });

  it("Q. past/future classification is deterministic and instant-based", () => {
    const rows = [
      booking({
        id: "11111111-1111-4111-8111-111111111111",
        start_at: "2026-08-01T01:00:00.000Z",
        booking_status: "scheduled",
      }),
      booking({
        id: "22222222-2222-4222-8222-222222222222",
        start_at: "2026-07-01T01:00:00.000Z",
        booking_status: "completed",
      }),
      booking({
        id: "33333333-3333-4333-8333-333333333333",
        start_at: "2026-08-05T01:00:00.000Z",
        booking_status: "cancelled",
        cancelled_at: "2026-07-20T00:00:00.000Z",
      }),
    ];
    const a = classifyPatientGatewayAppointments(rows, "Clinic", NOW);
    const b = classifyPatientGatewayAppointments(rows, "Clinic", NOW);
    assert.deepEqual(a, b);
    assert.equal(a.upcoming.length, 1);
    assert.equal(a.upcoming[0]?.id, "11111111-1111-4111-8111-111111111111");
    assert.equal(a.past.length, 2);
  });

  it("maps arrived to patient-safe confirmed", () => {
    const dto = mapBookingRowToPatientGatewayAppointment(
      booking({ booking_status: "arrived", start_at: "2026-08-01T01:00:00.000Z" }),
      null,
      NOW
    );
    assert.equal(dto.status, "confirmed");
  });
});
