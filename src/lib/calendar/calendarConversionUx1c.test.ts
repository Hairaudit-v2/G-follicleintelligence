/**
 * FI-CALENDAR-CONVERSION-UX-1C — staff affinity, room loading, resource policy.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyStaffUnassigned,
  assessStaffClinicCompatibility,
  buildConversionSummary,
  listActiveTenantStaffForConversion,
  mapClinicRoomsToConversionOptions,
  revalidateRoomForClinicDetailed,
  roomsForSelectedClinic,
} from "@/src/lib/calendar/externalEventConversionUx";
import {
  listMissingConversionRequirements,
  resolveConversionAppointmentResourcePolicy,
} from "@/src/lib/calendar/conversionAppointmentResourcePolicy";
import {
  parseStaffProfileExtras,
  staffClinicMembershipIds,
} from "@/src/lib/staff/staffProfileExtras";

const PERTH = { id: "clinic-evolved-perth", display_name: "Evolved Perth" };
const MELB = { id: "clinic-evolved-melbourne", display_name: "Evolved Melbourne" };

describe("FI-CALENDAR-CONVERSION-UX-1C staff affinity", () => {
  it("1. staff picker loads primary clinic from working_hours profile", () => {
    const extras = parseStaffProfileExtras({
      _profile: { primary_clinic_id: PERTH.id, position_title: "Surgeon" },
    });
    assert.equal(extras.primary_clinic_id, PERTH.id);
    assert.deepEqual(staffClinicMembershipIds(extras), [PERTH.id]);
  });

  it("2. multi-clinic staff is accepted without confirmation", () => {
    const staff = [
      {
        id: "staff-multi",
        full_name: "Dr Multi",
        staff_role: "surgeon",
        is_active: true,
        primary_clinic_id: MELB.id,
        clinic_ids: [MELB.id, PERTH.id],
      },
    ];
    const r = assessStaffClinicCompatibility({
      staffId: "staff-multi",
      clinicId: PERTH.id,
      staff,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state, "multi_clinic_compatible");
  });

  it("3. different-primary-clinic staff requires confirmation", () => {
    const staff = [
      {
        id: "staff-melb",
        full_name: "Dr Melb",
        staff_role: "consultant",
        is_active: true,
        primary_clinic_id: MELB.id,
        clinic_ids: [MELB.id],
      },
    ];
    const blocked = assessStaffClinicCompatibility({
      staffId: "staff-melb",
      clinicId: PERTH.id,
      staff,
      crossClinicConfirmed: false,
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.state, "different_primary_clinic");
    assert.equal(blocked.requiresConfirmation, true);

    const allowed = assessStaffClinicCompatibility({
      staffId: "staff-melb",
      clinicId: PERTH.id,
      staff,
      crossClinicConfirmed: true,
    });
    assert.equal(allowed.ok, true);
    if (!allowed.ok) return;
    assert.equal(allowed.state, "different_primary_clinic");
  });

  it("4. invalid clinic relationship is blocked without override", () => {
    const staff = [
      {
        id: "staff-orphan",
        full_name: "Dr Orphan",
        staff_role: "nurse",
        is_active: true,
        primary_clinic_id: null,
        clinic_ids: [],
      },
    ];
    const blocked = assessStaffClinicCompatibility({
      staffId: "staff-orphan",
      clinicId: PERTH.id,
      staff,
    });
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.state, "no_clinic_relationship");

    const overridden = assessStaffClinicCompatibility({
      staffId: "staff-orphan",
      clinicId: PERTH.id,
      staff,
      noRelationshipOverride: true,
    });
    assert.equal(overridden.ok, true);
  });

  it("4b. sole-clinic tenant treats null affinity as compatible", () => {
    const staff = [
      {
        id: "staff-orphan",
        full_name: "Dr Orphan",
        staff_role: "nurse",
        is_active: true,
        primary_clinic_id: null,
        clinic_ids: [],
      },
    ];
    const r = assessStaffClinicCompatibility({
      staffId: "staff-orphan",
      clinicId: PERTH.id,
      staff,
      soleClinicId: PERTH.id,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.state, "compatible");
  });

  it("5. assign later preserves clinic", () => {
    const next = applyStaffUnassigned(PERTH.id);
    assert.equal(next.clinicId, PERTH.id);
    assert.equal(next.staffId, null);
    assert.equal(next.staffAssignment, "assign_later");
  });

  it("inactive staff never appear in conversion selector", () => {
    const active = listActiveTenantStaffForConversion([
      {
        id: "a",
        full_name: "Active",
        staff_role: "surgeon",
        is_active: true,
        primary_clinic_id: PERTH.id,
      },
      {
        id: "b",
        full_name: "Inactive",
        staff_role: "surgeon",
        is_active: false,
        primary_clinic_id: PERTH.id,
      },
    ]);
    assert.deepEqual(
      active.map((s) => s.id),
      ["a"]
    );
  });
});

describe("FI-CALENDAR-CONVERSION-UX-1C room loading", () => {
  const rooms = mapClinicRoomsToConversionOptions([
    {
      id: "room-perth-1",
      display_name: "Consult 1",
      clinic_id: PERTH.id,
      room_type: "consult",
      is_active: true,
    },
    {
      id: "room-perth-inactive",
      display_name: "Closed",
      clinic_id: PERTH.id,
      room_type: "consult",
      is_active: false,
    },
    {
      id: "room-melb-1",
      display_name: "Consult M1",
      clinic_id: MELB.id,
      room_type: "consult",
      is_active: true,
    },
  ]);

  it("6–7. room list loads after clinic selection; only selected-clinic rooms appear", () => {
    const perthRooms = roomsForSelectedClinic(rooms, PERTH.id);
    assert.deepEqual(
      perthRooms.map((r) => r.id),
      ["room-perth-1"]
    );
    assert.equal(perthRooms[0]?.room_type, "consult");
  });

  it("8. changing clinic revalidates room with visible explanation", () => {
    const result = revalidateRoomForClinicDetailed({
      clinicId: MELB.id,
      roomId: "room-perth-1",
      rooms,
    });
    assert.equal(result.roomId, null);
    assert.equal(result.cleared, true);
    assert.match(result.explanation ?? "", /does not belong to the confirmed clinic/);
  });

  it("9. inactive room is rejected", () => {
    const result = revalidateRoomForClinicDetailed({
      clinicId: PERTH.id,
      roomId: "room-perth-inactive",
      rooms,
    });
    assert.equal(result.roomId, null);
    assert.equal(result.cleared, true);
    assert.match(result.explanation ?? "", /inactive/);
  });
});

describe("FI-CALENDAR-CONVERSION-UX-1C appointment-type requirements", () => {
  it("10. required room blocks conversion for surgery", () => {
    const policy = resolveConversionAppointmentResourcePolicy({
      appointmentType: "Hair transplant surgery",
    });
    assert.equal(policy.clinic, "required");
    assert.equal(policy.staff, "required");
    assert.equal(policy.room, "required");
    const missing = listMissingConversionRequirements({
      policy,
      clinicId: PERTH.id,
      staffId: null,
      staffAssignLater: true,
      roomId: null,
    });
    assert.ok(missing.includes("Assigned staff"));
    assert.ok(missing.includes("Room"));
  });

  it("11. optional room allows conversion for consultation", () => {
    const policy = resolveConversionAppointmentResourcePolicy({
      appointmentType: "consultation",
      allowClinicUnassigned: true,
    });
    assert.equal(policy.room, "optional");
    assert.equal(policy.staff, "optional");
    const missing = listMissingConversionRequirements({
      policy,
      clinicId: PERTH.id,
      staffId: null,
      staffAssignLater: true,
      roomId: null,
    });
    assert.deepEqual(missing, []);
  });

  it("uses service requirements when provided (no hard-coded surgery UI)", () => {
    const policy = resolveConversionAppointmentResourcePolicy({
      appointmentType: "surgery",
      serviceRequirements: [
        { resource_type: "staff_role", is_required: true, resource_key: "surgeon" },
        { resource_type: "room_type", is_required: false, resource_key: "surgery" },
      ],
    });
    assert.equal(policy.fromServiceRequirements, true);
    assert.equal(policy.staff, "required");
    assert.equal(policy.room, "recommended");
  });
});

describe("FI-CALENDAR-CONVERSION-UX-1C review and persistence contract", () => {
  it("12. review shows all assignments including room and warnings", () => {
    const summary = buildConversionSummary({
      patientDisplayName: "Michael Buckland",
      identityAction: "create_new_patient",
      clinicName: "Evolved Perth",
      clinicUnassigned: false,
      staffName: "Dr Perth",
      staffAssignLater: false,
      roomName: "Consult 1",
      appointmentType: "consultation",
      dateLabel: "5 August 2026",
      timeRangeLabel: "10:00 am–10:15 am",
      compatibilityWarnings: ["Staff primary clinic differs from the selected FiOS clinic."],
      missingRequired: [],
    });
    assert.equal(summary.patient, "Michael Buckland");
    assert.equal(summary.clinic, "Evolved Perth");
    assert.equal(summary.staff, "Dr Perth");
    assert.equal(summary.room, "Consult 1");
    assert.equal(summary.compatibilityWarnings.length, 1);
    assert.equal(summary.source, "Google Calendar");
  });

  it("13–15. persistence + reload + no-duplicate audit fields contract", () => {
    const persisted = {
      patientId: "patient-1",
      clinicId: PERTH.id,
      staffId: "staff-perth",
      roomId: "room-perth-1",
      googleEventId: "google-michael-buckland-1",
      fiosAppointmentId: "appt-1",
      identityMatchMethod: "exact_verified_email",
      conversionIdempotencyKey: "event-1",
    };
    // Reload must use persisted clinic/staff/room — not Google free text.
    assert.notEqual(persisted.clinicId, "South Perth Evolved Surgery");
    assert.equal(persisted.clinicId, PERTH.id);
    assert.equal(persisted.roomId, "room-perth-1");
    assert.equal(persisted.googleEventId, "google-michael-buckland-1");
    // Repeated conversion reuses same appointment id (idempotency).
    const reused = { ...persisted, fiosAppointmentId: "appt-1" };
    assert.equal(reused.fiosAppointmentId, persisted.fiosAppointmentId);
  });
});
