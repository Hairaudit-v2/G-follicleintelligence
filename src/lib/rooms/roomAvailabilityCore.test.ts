import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRoomOverlapContext,
  findRoomOverlapConflict,
  findStaffOverlapConflict,
  isStaffEligibleForServiceRules,
  resolveDefaultRoomFromOptions,
  roomPickerDisabledReason,
} from "@/src/lib/rooms/roomAvailabilityCore";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";

function room(id: string, physicalKey: string, overrides?: Partial<FiClinicRoomRow>): FiClinicRoomRow {
  return {
    id,
    tenant_id: "t1",
    clinic_id: "c1",
    room_code: id,
    display_name: id,
    physical_room_key: physicalKey,
    room_type: "consult",
    capabilities: [],
    is_active: true,
    sort_order: 0,
    metadata: {},
    ...overrides,
  };
}

describe("roomAvailabilityCore", () => {
  const rooms = [
    room("r-prp-1", "phys-prp-1", { room_type: "prp", display_name: "PRP Room 1" }),
    room("r-prp-2", "phys-surg-2", { room_type: "prp", display_name: "PRP Room 2" }),
    room("r-surg-2", "phys-surg-2", { room_type: "surgery", display_name: "Surgery 2" }),
    room("r-cons-2", "phys-cons-2", { display_name: "Consult Room 2" }),
    room("r-patient-2", "phys-cons-2", { room_type: "patient", display_name: "Patient Room 2" }),
    room("r-inactive", "phys-inactive", { is_active: false }),
  ];
  const ctx = buildRoomOverlapContext(rooms);

  it("rejects same room overlap", () => {
    const conflict = findRoomOverlapConflict({
      candidateRoomId: "r-prp-1",
      candidateStartIso: "2026-06-09T10:00:00.000Z",
      candidateEndIso: "2026-06-09T11:00:00.000Z",
      existing: [
        {
          id: "b1",
          room_id: "r-prp-1",
          start_at: "2026-06-09T10:30:00.000Z",
          end_at: "2026-06-09T11:30:00.000Z",
          booking_status: "scheduled",
        },
      ],
      ctx,
    });
    assert.ok(conflict);
  });

  it("rejects same physical_room_key overlap across labels (PRP Room 2 vs Surgery 2)", () => {
    const conflict = findRoomOverlapConflict({
      candidateRoomId: "r-surg-2",
      candidateStartIso: "2026-06-09T10:00:00.000Z",
      candidateEndIso: "2026-06-09T11:00:00.000Z",
      existing: [
        {
          id: "b1",
          room_id: "r-prp-2",
          start_at: "2026-06-09T09:30:00.000Z",
          end_at: "2026-06-09T10:30:00.000Z",
          booking_status: "scheduled",
        },
      ],
      ctx,
    });
    assert.ok(conflict);
  });

  it("rejects Consult Room 2 vs Patient Room 2 shared physical key", () => {
    const conflict = findRoomOverlapConflict({
      candidateRoomId: "r-patient-2",
      candidateStartIso: "2026-06-09T12:00:00.000Z",
      candidateEndIso: "2026-06-09T13:00:00.000Z",
      existing: [
        {
          id: "b1",
          room_id: "r-cons-2",
          start_at: "2026-06-09T12:30:00.000Z",
          end_at: "2026-06-09T13:30:00.000Z",
          booking_status: "scheduled",
        },
      ],
      ctx,
    });
    assert.ok(conflict);
  });

  it("allows Consult Room 1 while Consult Room 2 is occupied", () => {
    const conflict = findRoomOverlapConflict({
      candidateRoomId: "r-prp-1",
      candidateStartIso: "2026-06-09T10:00:00.000Z",
      candidateEndIso: "2026-06-09T11:00:00.000Z",
      existing: [
        {
          id: "b1",
          room_id: "r-cons-2",
          start_at: "2026-06-09T10:00:00.000Z",
          end_at: "2026-06-09T11:00:00.000Z",
          booking_status: "scheduled",
        },
      ],
      ctx,
    });
    assert.equal(conflict, null);
  });

  it("rejects same staff overlap", () => {
    const conflict = findStaffOverlapConflict({
      candidateStaffId: "staff-1",
      candidateStartIso: "2026-06-09T10:00:00.000Z",
      candidateEndIso: "2026-06-09T11:00:00.000Z",
      existing: [
        {
          id: "b1",
          assigned_staff_id: "staff-1",
          start_at: "2026-06-09T10:30:00.000Z",
          end_at: "2026-06-09T11:30:00.000Z",
          booking_status: "scheduled",
          cancelled_at: null,
        },
      ],
    });
    assert.ok(conflict);
  });

  it("marks inactive rooms in picker disabled reason", () => {
    const reason = roomPickerDisabledReason({
      room: room("r-inactive", "phys-inactive", { is_active: false }),
      eligible: true,
      available: true,
    });
    assert.equal(reason, "Room inactive");
  });

  it("enforces service staff role eligibility", () => {
    assert.equal(
      isStaffEligibleForServiceRules("s1", "nurse", [{ staff_id: null, staff_role: "doctor", is_active: true }]),
      false
    );
    assert.equal(
      isStaffEligibleForServiceRules("s1", "nurse", [{ staff_id: null, staff_role: "nurse", is_active: true }]),
      true
    );
  });

  it("auto-selects available preferred room", () => {
    const pick = resolveDefaultRoomFromOptions([
      {
        room: room("a", "k1", { sort_order: 2 }),
        eligible: true,
        available: true,
        preferred: false,
      },
      {
        room: room("b", "k2", { sort_order: 1 }),
        eligible: true,
        available: true,
        preferred: true,
      },
    ]);
    assert.equal(pick?.room.id, "b");
  });
});
