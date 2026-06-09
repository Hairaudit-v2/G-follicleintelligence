import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEvolvedPerthServiceEligibilitySeedPlan,
  isNonRoomRequiredService,
  matchEligibilityProfileId,
} from "@/src/lib/rooms/evolvedPerthServiceEligibilitySeedPlan";

const PERTH_ROOMS = [
  { id: "r1", room_code: "cons_1", display_name: "Consult Room 1", is_active: true },
  { id: "r2", room_code: "cons_2", display_name: "Consult Room 2", is_active: true },
  { id: "r3", room_code: "prp_1", display_name: "PRP Room 1", is_active: true },
  { id: "r4", room_code: "prp_2", display_name: "PRP Room 2", is_active: true },
  { id: "r5", room_code: "surgery_1", display_name: "Surgery 1", is_active: true },
  { id: "r6", room_code: "surgery_2", display_name: "Surgery 2", is_active: true },
  { id: "r7", room_code: "patient_room_1", display_name: "Patient Room 1", is_active: true },
  { id: "r8", room_code: "patient_room_2", display_name: "Patient Room 2", is_active: true },
];

function svc(
  name: string,
  booking_type: string | null,
  id = name
): { id: string; name: string; booking_type: string | null; category: string | null; is_active: boolean } {
  return { id, name, booking_type, category: null, is_active: true };
}

describe("evolvedPerthServiceEligibilitySeedPlan", () => {
  it("maps PRP by booking_type with PRP Room 1 preferred", () => {
    const profile = matchEligibilityProfileId(svc("PRP Treatment", "prp"));
    assert.equal(profile, "regenerative");
    const { planned } = buildEvolvedPerthServiceEligibilitySeedPlan([svc("PRP Treatment", "prp")], PERTH_ROOMS);
    assert.equal(planned.length, 1);
    assert.equal(planned[0]!.preferredRoomCode, "prp_1");
    assert.deepEqual(planned[0]!.roomCodes, ["prp_1", "prp_2"]);
  });

  it("maps consultation by booking_type with Consult Room 1 preferred", () => {
    const { planned } = buildEvolvedPerthServiceEligibilitySeedPlan(
      [svc("In-Clinic Consultation", "consultation")],
      PERTH_ROOMS
    );
    assert.equal(planned[0]!.profileId, "consult");
    assert.equal(planned[0]!.preferredRoomCode, "cons_1");
  });

  it("maps surgery by booking_type with Surgery 1 preferred", () => {
    const { planned } = buildEvolvedPerthServiceEligibilitySeedPlan(
      [svc("Hair Transplant Surgery - One Day", "surgery")],
      PERTH_ROOMS
    );
    assert.equal(planned[0]!.profileId, "surgery");
    assert.equal(planned[0]!.preferredRoomCode, "surgery_1");
  });

  it("maps trichology consultation by name keyword", () => {
    assert.equal(matchEligibilityProfileId(svc("Trichology Consultation", null)), "consult");
  });

  it("skips room eligibility for phone consultation with warning", () => {
    assert.equal(isNonRoomRequiredService(svc("Phone Consultation", null)), true);
    const { planned } = buildEvolvedPerthServiceEligibilitySeedPlan([svc("Phone Consultation", null)], PERTH_ROOMS);
    assert.equal(planned[0]!.skipRoomEligibility, true);
    assert.match(planned[0]!.warning ?? "", /room_required=false/i);
  });

  it("maps block time to all active rooms with no preferred room", () => {
    const { planned } = buildEvolvedPerthServiceEligibilitySeedPlan(
      [svc("Block Time / Admin Hold", "other")],
      PERTH_ROOMS
    );
    assert.equal(planned[0]!.profileId, "block_time");
    assert.equal(planned[0]!.preferredRoomCode, null);
    assert.equal(planned[0]!.roomCodes.length, PERTH_ROOMS.length);
  });

  it("reports missing room codes without failing the plan", () => {
    const { planned, missingRoomCodes } = buildEvolvedPerthServiceEligibilitySeedPlan(
      [svc("PRP Treatment", "prp")],
      PERTH_ROOMS.filter((r) => r.room_code !== "prp_1")
    );
    assert.ok(missingRoomCodes.includes("prp_1"));
    assert.equal(planned[0]!.resolvedRoomIds.length, 1);
  });
});
