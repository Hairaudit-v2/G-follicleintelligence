import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveAppointmentClinicId,
  resolveAppointmentClinicIdDetailed,
  resolveClinicIdForBookingRow,
} from "./resolveAppointmentClinicId";

const PERTH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SYDNEY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OTHER_TENANT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("resolveAppointmentClinicId", () => {
  it("explicit appointment clinic wins", () => {
    assert.equal(
      resolveAppointmentClinicId({
        appointmentClinicId: PERTH,
        appointmentLocationId: SYDNEY,
        consultationClinicId: SYDNEY,
        enquiryClinicId: SYDNEY,
        patientSelectedClinicId: SYDNEY,
        roomClinicId: SYDNEY,
        staffClinicId: SYDNEY,
      }),
      PERTH
    );
  });

  it("appointment location fallback works", () => {
    assert.equal(
      resolveAppointmentClinicId({
        appointmentClinicId: null,
        appointmentLocationId: PERTH,
        staffClinicId: SYDNEY,
      }),
      PERTH
    );
  });

  it("consultation clinic fallback works", () => {
    assert.equal(
      resolveAppointmentClinicId({
        consultationClinicId: PERTH,
        enquiryClinicId: SYDNEY,
        roomClinicId: SYDNEY,
      }),
      PERTH
    );
  });

  it("enquiry clinic fallback works", () => {
    assert.equal(
      resolveAppointmentClinicId({
        enquiryClinicId: PERTH,
        patientSelectedClinicId: SYDNEY,
        roomClinicId: SYDNEY,
      }),
      PERTH
    );
  });

  it("room clinic is only a legacy fallback", () => {
    assert.equal(
      resolveAppointmentClinicId({
        appointmentClinicId: PERTH,
        roomClinicId: SYDNEY,
      }),
      PERTH
    );
    assert.equal(
      resolveAppointmentClinicId({
        roomClinicId: PERTH,
        staffClinicId: SYDNEY,
      }),
      PERTH
    );
  });

  it("staff clinic is only a legacy fallback", () => {
    assert.equal(
      resolveAppointmentClinicId({
        appointmentClinicId: PERTH,
        staffClinicId: SYDNEY,
      }),
      PERTH
    );
    assert.equal(resolveAppointmentClinicId({ staffClinicId: PERTH }), PERTH);
  });

  it("missing staff does not remove clinic", () => {
    assert.equal(
      resolveAppointmentClinicId({
        appointmentClinicId: PERTH,
        staffClinicId: null,
      }),
      PERTH
    );
  });

  it("missing room does not remove clinic", () => {
    assert.equal(
      resolveAppointmentClinicId({
        appointmentClinicId: PERTH,
        roomClinicId: null,
      }),
      PERTH
    );
  });

  it("no clinic data returns null", () => {
    assert.equal(resolveAppointmentClinicId({}), null);
    assert.equal(
      resolveAppointmentClinicId({
        appointmentClinicId: "  ",
        roomClinicId: null,
        staffClinicId: undefined,
      }),
      null
    );
  });

  it("cross-tenant clinic is rejected", () => {
    const allowed = new Set([PERTH, SYDNEY]);
    assert.equal(
      resolveAppointmentClinicId(
        {
          appointmentClinicId: OTHER_TENANT,
          roomClinicId: PERTH,
          staffClinicId: SYDNEY,
        },
        { allowedClinicIds: allowed }
      ),
      null
    );
    assert.equal(
      resolveAppointmentClinicIdDetailed(
        {
          appointmentClinicId: OTHER_TENANT,
          roomClinicId: PERTH,
        },
        { allowedClinicIds: allowed }
      ).source,
      null
    );
  });

  it("cross-tenant legacy fallbacks are skipped without clearing higher allowed sources", () => {
    const allowed = [PERTH];
    assert.equal(
      resolveAppointmentClinicId(
        {
          roomClinicId: OTHER_TENANT,
          staffClinicId: PERTH,
        },
        { allowedClinicIds: allowed }
      ),
      PERTH
    );
  });

  it("resolveClinicIdForBookingRow maps booking fields", () => {
    const r = resolveClinicIdForBookingRow(
      { clinic_id: null, room_id: "room-1", assigned_staff_id: "staff-1" },
      {
        roomClinicId: PERTH,
        staffClinicId: SYDNEY,
        allowedClinicIds: [PERTH, SYDNEY],
      }
    );
    assert.equal(r.clinicId, PERTH);
    assert.equal(r.source, "room_clinic_id");
  });
});
