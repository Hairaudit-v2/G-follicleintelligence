import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReviewAssignmentRecord,
  IMAGINGOS_REVIEW_ASSIGNMENT_VERSION,
  mergeImagingReviewAssignmentMetadata,
  readImagingReviewAssignmentRecord,
} from "./imagingReviewAssignmentCore";

describe("imagingReviewAssignmentCore", () => {
  it("builds and reads assignment record", () => {
    const record = buildReviewAssignmentRecord({
      assignedTo: "user-reviewer",
      assignedBy: "user-admin",
      status: "assigned",
      assignedAt: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(record.assigned_to, "user-reviewer");
    assert.equal(record.assignment_status, "assigned");
    assert.equal(record.assignment_version, IMAGINGOS_REVIEW_ASSIGNMENT_VERSION);

    const merged = mergeImagingReviewAssignmentMetadata({ capture_source: "guided_capture" }, record);
    const read = readImagingReviewAssignmentRecord(merged);
    assert.equal(read?.assigned_to, "user-reviewer");
    assert.equal(merged.capture_source, "guided_capture");
  });

  it("unassign clears assigned_to while preserving metadata", () => {
    const existing = mergeImagingReviewAssignmentMetadata(
      { imaging_clinical_ai: { provider: "stub" } },
      buildReviewAssignmentRecord({
        assignedTo: "user-1",
        assignedBy: "user-2",
        status: "assigned",
      })
    );
    const unassigned = mergeImagingReviewAssignmentMetadata(
      existing,
      buildReviewAssignmentRecord({
        assignedTo: null,
        assignedBy: "user-2",
        status: "unassigned",
      })
    );
    const read = readImagingReviewAssignmentRecord(unassigned);
    assert.equal(read?.assignment_status, "unassigned");
    assert.equal(read?.assigned_to, null);
    assert.deepEqual(unassigned.imaging_clinical_ai, { provider: "stub" });
  });
});