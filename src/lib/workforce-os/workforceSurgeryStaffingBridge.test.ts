import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildWorkforceCandidateAssignments } from "@/src/lib/workforce-os/workforceClinicalEventMapping";

describe("workforce surgery staffing bridge candidates", () => {
  it("deduplicates the same staff and role across primary and existing rows", () => {
    const staffId = "11111111-1111-1111-1111-111111111111";
    const candidates = buildWorkforceCandidateAssignments({
      primaryStaffId: staffId,
      primaryStaffRole: "surgeon",
      bookingType: "surgery",
      resourceStaff: [],
      existingAssignments: [{ staffId, assignedRole: "surgeon" }],
    });

    assert.equal(candidates.length, 1);
    assert.deepEqual(candidates[0], { staffId, assignedRole: "surgeon" });
  });

  it("lists only new resource staff when primary surgeon is already assigned", () => {
    const surgeonId = "11111111-1111-1111-1111-111111111111";
    const nurseId = "22222222-2222-2222-2222-222222222222";
    const candidates = buildWorkforceCandidateAssignments({
      primaryStaffId: surgeonId,
      primaryStaffRole: "surgeon",
      bookingType: "surgery",
      resourceStaff: [{ staffId: nurseId, roleLabel: "Nurse", staffRole: "nurse" }],
      existingAssignments: [{ staffId: surgeonId, assignedRole: "surgeon" }],
    });

    assert.equal(candidates.length, 2);
    assert.deepEqual(candidates[1], { staffId: nurseId, assignedRole: "nurse" });
  });

  it("returns empty candidates when booking has no assigned staff", () => {
    const candidates = buildWorkforceCandidateAssignments({
      primaryStaffId: null,
      primaryStaffRole: null,
      bookingType: "surgery",
      resourceStaff: [],
      existingAssignments: [],
    });

    assert.deepEqual(candidates, []);
  });
});
