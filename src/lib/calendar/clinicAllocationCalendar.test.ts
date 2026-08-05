import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import {
  resolveDisplayResourceColumnId,
  resourceColumnIdForBooking,
} from "@/src/lib/calendar/operationalCalendarLayout";
import { assigneeMetaFromResourceColumnId } from "@/src/lib/calendar/operationalCalendarColumns";
import {
  appendUnassignedResourceColumnIfNeeded,
  unassignedResourceColumnCopy,
} from "@/src/lib/calendar/unassignedResourceColumn";

const PERTH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT = "tttttttt-tttt-4ttt-8ttt-tttttttttttt";

function booking(p: Partial<FiBookingRow>): FiBookingRow {
  return {
    id: "b1",
    tenant_id: TENANT,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "scheduled",
    title: "Perth consult",
    description: null,
    start_at: "2026-08-05T02:00:00.000Z",
    end_at: "2026-08-05T02:30:00.000Z",
    timezone: "Australia/Perth",
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    room_id: null,
    room_required: false,
    ...p,
  };
}

describe("calendar clinic allocation (FI-CALENDAR-CLINIC-ALLOCATION-FIX-1A)", () => {
  const perthColumn = `c:${PERTH}`;
  const clinicColumns = [perthColumn];

  it("Perth appointment with no staff appears under Evolved Perth", () => {
    const b = booking({ clinic_id: PERTH, assigned_staff_id: null, room_id: null });
    assert.equal(resourceColumnIdForBooking(b, { resourceView: "clinic" }), perthColumn);
    assert.equal(
      resolveDisplayResourceColumnId(b, clinicColumns, { resourceView: "clinic" }),
      perthColumn
    );
  });

  it("Perth appointment with no room appears under Evolved Perth", () => {
    const b = booking({
      clinic_id: PERTH,
      assigned_staff_id: "ssssssss-ssss-4sss-8sss-ssssssssssss",
      room_id: null,
    });
    assert.equal(resourceColumnIdForBooking(b, { resourceView: "clinic" }), perthColumn);
  });

  it("Perth appointment with no staff or room appears under Evolved Perth", () => {
    const b = booking({ clinic_id: PERTH, assigned_staff_id: null, room_id: null });
    assert.equal(resourceColumnIdForBooking(b, { resourceView: "clinic" }), perthColumn);
    assert.notEqual(
      resolveDisplayResourceColumnId(b, [...clinicColumns, "unassigned"], {
        resourceView: "clinic",
      }),
      "unassigned"
    );
  });

  it("appointment without any clinic appears under No clinic", () => {
    const b = booking({ clinic_id: null, assigned_staff_id: null, room_id: null });
    assert.equal(resourceColumnIdForBooking(b, { resourceView: "clinic" }), "unassigned");
    const copy = unassignedResourceColumnCopy("clinic");
    assert.equal(copy.label, "No clinic");
  });

  it("clinic filter placement keeps unassigned-resource appointments for that clinic", () => {
    const b = booking({ clinic_id: PERTH, assigned_staff_id: null });
    // Staff view: clinician unassigned lane, clinic_id retained on the row.
    assert.equal(resourceColumnIdForBooking(b, { resourceView: "staff" }), "unassigned");
    assert.equal(b.clinic_id, PERTH);
    assert.equal(resourceColumnIdForBooking(b, { resourceView: "clinic" }), perthColumn);
  });

  it("moving staff does not silently change the appointment clinic", () => {
    const metaUnassign = assigneeMetaFromResourceColumnId(
      "unassigned",
      new Map(),
      { resourceView: "staff" }
    );
    assert.equal(metaUnassign.assignedStaffId, null);
    assert.equal(Object.prototype.hasOwnProperty.call(metaUnassign, "clinicId"), false);

    const metaToStaff = assigneeMetaFromResourceColumnId(
      "s:ssssssss-ssss-4sss-8sss-ssssssssssss",
      new Map(),
      { resourceView: "staff" }
    );
    assert.equal(metaToStaff.assignedStaffId, "ssssssss-ssss-4sss-8sss-ssssssssssss");
    assert.equal(Object.prototype.hasOwnProperty.call(metaToStaff, "clinicId"), false);
  });

  it("room clinic map places null-clinic bookings under Perth when room belongs there", () => {
    const roomId = "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr";
    const b = booking({ clinic_id: null, room_id: roomId });
    assert.equal(
      resourceColumnIdForBooking(b, {
        resourceView: "clinic",
        roomClinicById: new Map([[roomId, PERTH]]),
        allowedClinicIds: [PERTH],
      }),
      perthColumn
    );
  });

  it("omits empty No clinic column", () => {
    const b = booking({ clinic_id: PERTH });
    const cols = appendUnassignedResourceColumnIfNeeded(
      [{ id: perthColumn, kind: "clinic", label: "Evolved Perth", subtitle: "Clinic site" }],
      [b],
      { resourceView: "clinic" }
    );
    assert.equal(cols.some((c) => c.id === "unassigned"), false);
  });

  it("keeps No clinic column when a clinic-less appointment exists", () => {
    const cols = appendUnassignedResourceColumnIfNeeded(
      [{ id: perthColumn, kind: "clinic", label: "Evolved Perth", subtitle: "Clinic site" }],
      [booking({ clinic_id: null })],
      { resourceView: "clinic" }
    );
    const unassigned = cols.find((c) => c.id === "unassigned");
    assert.ok(unassigned);
    assert.equal(unassigned?.label, "No clinic");
  });
});
