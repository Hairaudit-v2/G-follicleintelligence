import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";

import {
  getPatientGatewayAppointment,
  listPatientGatewayAppointments,
  requirePatientGatewayOwnedAppointment,
} from "./patientGatewayAppointments.server";
import { appointmentPayloadExposesStaffFields } from "./patientGatewayAppointmentsCore";
import type { PatientGatewayContext } from "./patientGatewayTypes";

const AUTH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTH_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const TENANT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const APPT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const CTX_A: PatientGatewayContext = {
  authUserId: AUTH_A,
  patientId: PATIENT_A,
  tenantId: TENANT_A,
  personId: "55555555-5555-4555-8555-555555555555",
  patientStatus: "active",
  clinicName: "Clinic A",
};

const CTX_B: PatientGatewayContext = {
  ...CTX_A,
  authUserId: AUTH_B,
  patientId: PATIENT_B,
  tenantId: TENANT_B,
  clinicName: "Clinic B",
};

const NOW = "2026-07-27T12:00:00.000Z";

function booking(overrides: Partial<FiBookingRow>): FiBookingRow {
  return {
    id: APPT_A,
    tenant_id: TENANT_A,
    lead_id: null,
    person_id: null,
    patient_id: PATIENT_A,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: false,
    assigned_staff_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    assigned_user_id: null,
    booking_type: "prp",
    booking_status: "confirmed",
    financial_os_status: "paid",
    title: "PRP Treatment",
    description: "Staff note",
    start_at: "2026-08-01T01:00:00.000Z",
    end_at: "2026-08-01T02:00:00.000Z",
    timezone: "Australia/Brisbane",
    location: "Suite 1",
    metadata: { secret: true },
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("patientGatewayAppointments.server", () => {
  it("K. Patient A lists only Patient A appointments", async () => {
    const result = await listPatientGatewayAppointments(CTX_A, {
      writeAudit: false,
      nowIso: NOW,
      loadBookings: async (tenantId, patientId) => {
        assert.equal(tenantId, TENANT_A);
        assert.equal(patientId, PATIENT_A);
        return [
          booking({}),
          booking({
            id: "99999999-9999-4999-8999-999999999999",
            start_at: "2026-07-01T01:00:00.000Z",
            booking_status: "completed",
          }),
        ];
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.upcoming.length, 1);
    assert.equal(result.past.length, 1);
    assert.equal(appointmentPayloadExposesStaffFields(result), false);
  });

  it("L. Patient A cannot read Patient B appointment id", async () => {
    const result = await getPatientGatewayAppointment(CTX_A, APPT_B, {
      writeAudit: false,
      nowIso: NOW,
      loadBooking: async () =>
        booking({
          id: APPT_B,
          tenant_id: TENANT_B,
          patient_id: PATIENT_B,
        }),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.code === "ownership_denied" || result.code === "wrong_tenant");
  });

  it("M. appointment from wrong tenant is denied", async () => {
    const result = await getPatientGatewayAppointment(CTX_A, APPT_A, {
      writeAudit: false,
      nowIso: NOW,
      loadBooking: async () =>
        booking({
          tenant_id: TENANT_B,
          patient_id: PATIENT_A,
        }),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "wrong_tenant");
  });

  it("N. orphaned/unowned appointment is not exposed", async () => {
    const result = await getPatientGatewayAppointment(CTX_A, APPT_A, {
      writeAudit: false,
      nowIso: NOW,
      loadBooking: async () => booking({ patient_id: null }),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "ownership_denied");
  });

  it("O. client-supplied patientId cannot alter ownership wrapper", () => {
    const deny = requirePatientGatewayOwnedAppointment(
      CTX_A,
      { tenant_id: TENANT_A, patient_id: PATIENT_B },
      APPT_A,
      false
    );
    assert.equal(deny?.code, "ownership_denied");
    const ok = requirePatientGatewayOwnedAppointment(
      CTX_A,
      { tenant_id: TENANT_A, patient_id: PATIENT_A },
      APPT_A,
      false
    );
    assert.equal(ok, null);
  });

  it("P. staff-only notes absent from single read", async () => {
    const result = await getPatientGatewayAppointment(CTX_A, APPT_A, {
      writeAudit: false,
      nowIso: NOW,
      loadBooking: async () => booking({}),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(appointmentPayloadExposesStaffFields(result), false);
  });

  it("cross-patient list context B does not see A bookings from load seam", async () => {
    const result = await listPatientGatewayAppointments(CTX_B, {
      writeAudit: false,
      nowIso: NOW,
      loadBookings: async (tenantId, patientId) => {
        assert.equal(tenantId, TENANT_B);
        assert.equal(patientId, PATIENT_B);
        return [];
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.upcoming.length, 0);
    assert.equal(result.past.length, 0);
  });

  it("R. staff booking loaders remain available (unchanged surface)", async () => {
    const bookings = await import("@/src/lib/bookings/bookings");
    assert.equal(typeof bookings.loadBookingsForPatient, "function");
    assert.equal(typeof bookings.loadBookingForTenant, "function");
    const api = await import("@/src/lib/bookings/appointmentsApi");
    assert.ok(api);
  });

  it("S. patient portal access module remains available", async () => {
    const portal = await import("@/src/lib/patientPortal/patientPortalAccess.server");
    assert.ok(portal);
  });
});
