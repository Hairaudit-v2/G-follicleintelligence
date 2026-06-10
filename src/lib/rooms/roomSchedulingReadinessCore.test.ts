import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRoomSchedulingReadinessResult,
  computeOverallReadinessStatus,
  type RoomSchedulingReadinessCheck,
} from "@/src/lib/rooms/roomSchedulingReadinessCore";
import type { FiClinicRoomRow } from "@/src/lib/rooms/roomTypes";
import type { FiServiceRow } from "@/src/lib/services/fiServiceTypes";

const TENANT = "00000000-0000-4000-8000-000000000001";
const CLINIC = "00000000-0000-4000-8000-000000000002";

function room(
  code: string,
  type: FiClinicRoomRow["room_type"],
  physicalKey: string,
  overrides?: Partial<FiClinicRoomRow>
): FiClinicRoomRow {
  return {
    id: `id-${code}`,
    tenant_id: TENANT,
    clinic_id: CLINIC,
    room_code: code,
    display_name: code,
    physical_room_key: physicalKey,
    room_type: type,
    capabilities: [],
    is_active: true,
    sort_order: 0,
    metadata: {},
    ...overrides,
  };
}

const PERTH_ROOMS: FiClinicRoomRow[] = [
  room("cons_1", "consult", "perth_phys_cons_1"),
  room("cons_2", "consult", "perth_phys_cons_2"),
  room("prp_1", "prp", "perth_phys_prp_1"),
  room("prp_2", "prp", "perth_phys_surgery_2"),
  room("surgery_1", "surgery", "perth_phys_surgery_1"),
  room("surgery_2", "surgery", "perth_phys_surgery_2"),
  room("patient_room_1", "patient", "perth_phys_patient_1"),
  room("patient_room_2", "patient", "perth_phys_cons_2"),
];

function prpService(overrides?: Partial<FiServiceRow>): FiServiceRow {
  return {
    id: "s1",
    tenant_id: TENANT,
    name: "PRP Treatment",
    duration_minutes: 30,
    base_price: 0,
    color: null,
    category: "Treatment",
    is_active: true,
    booking_type: "prp",
    ...overrides,
  };
}

describe("roomSchedulingReadinessCore", () => {
  it("shows needs_setup when no rooms exist", () => {
    const result = buildRoomSchedulingReadinessResult({
      tenantId: TENANT,
      clinicId: CLINIC,
      clinicName: "Perth",
      rooms: [],
      services: [prpService()],
      roomEligibilityByServiceId: new Map(),
      staffEligibilityByServiceId: new Map(),
      staff: [],
    });
    assert.equal(result.overallStatus, "needs_setup");
    assert.equal(result.checks.find((c) => c.key === "active_rooms")?.status, "fail");
  });

  it("shows warning when rooms exist but services lack room eligibility", () => {
    const result = buildRoomSchedulingReadinessResult({
      tenantId: TENANT,
      clinicId: CLINIC,
      clinicName: "Perth",
      rooms: PERTH_ROOMS,
      services: [prpService()],
      roomEligibilityByServiceId: new Map(),
      staffEligibilityByServiceId: new Map([["s1", [{ staff_id: null, staff_role: "nurse", is_active: true }]]]),
      staff: [{ id: "st1", full_name: "Nurse A", staff_role: "nurse", is_active: true, calendar_visible: null }],
    });
    assert.equal(result.overallStatus, "warning");
    assert.equal(result.checks.find((c) => c.key === "service_room_eligibility")?.status, "warning");
  });

  it("warns when physical alias keys do not match", () => {
    const badRooms = PERTH_ROOMS.map((r) =>
      r.room_code === "prp_2" ? { ...r, physical_room_key: "wrong_key" } : r
    );
    const result = buildRoomSchedulingReadinessResult({
      tenantId: TENANT,
      clinicId: CLINIC,
      clinicName: "Perth",
      rooms: badRooms,
      services: [],
      roomEligibilityByServiceId: new Map(),
      staffEligibilityByServiceId: new Map(),
      staff: [],
    });
    assert.equal(result.checks.find((c) => c.key === "physical_room_aliases")?.status, "warning");
    assert.equal(result.overallStatus, "warning");
  });

  it("shows ready when rooms, mappings, staff, and aliases are configured", () => {
    const prpRoomId = "id-prp_1";
    const result = buildRoomSchedulingReadinessResult({
      tenantId: TENANT,
      clinicId: CLINIC,
      clinicName: "Perth",
      rooms: PERTH_ROOMS,
      services: [prpService()],
      roomEligibilityByServiceId: new Map([
        ["s1", [{ room_id: prpRoomId, is_preferred: true, is_active: true }]],
      ]),
      staffEligibilityByServiceId: new Map([
        ["s1", [{ staff_id: null, staff_role: "nurse", is_active: true }]],
      ]),
      staff: [{ id: "st1", full_name: "Nurse A", staff_role: "nurse", is_active: true, calendar_visible: null }],
    });
    assert.equal(result.overallStatus, "ready");
  });

  it("computeOverallReadinessStatus respects fail before warning", () => {
    const checks: RoomSchedulingReadinessCheck[] = [
      { key: "active_rooms", label: "", status: "pass", message: "" },
      { key: "x", label: "", status: "warning", message: "" },
    ];
    assert.equal(computeOverallReadinessStatus(checks), "warning");

    checks.push({ key: "consult_room", label: "", status: "fail", message: "" });
    assert.equal(computeOverallReadinessStatus(checks), "needs_setup");
  });
});
