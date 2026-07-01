import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";
import { buildStubClinicalImageAnalysis } from "./clinicalImageAnalysisCore";
import {
  buildStaffReviewRecord,
  mergeImagingStaffReviewMetadata,
  staffReviewClearsQueue,
  validateAssignedViewType,
} from "./imagingStaffReviewCore";

describe("imagingStaffReviewCore", () => {
  it("mark reviewed record clears queue", () => {
    const record = buildStaffReviewRecord({
      status: "reviewed",
      reviewedByUserId: "user-1",
    });
    assert.equal(staffReviewClearsQueue(record), true);
  });

  it("retake required does not clear queue", () => {
    const record = buildStaffReviewRecord({
      status: "retake_required",
      reviewedByUserId: "user-1",
    });
    assert.equal(staffReviewClearsQueue(record), false);
  });

  it("reassign view type clears queue", () => {
    const record = buildStaffReviewRecord({
      status: "view_reassigned",
      reviewedByUserId: "user-1",
      previousViewType: "donor",
      assignedViewType: "recipient",
    });
    assert.equal(staffReviewClearsQueue(record), true);
    assert.equal(record.assigned_view_type, "recipient");
  });

  it("preserves imaging_clinical_ai when merging staff review", () => {
    const aiRecord = clinicalAnalysisResultToMetadataRecord(
      buildStubClinicalImageAnalysis({ externalCategory: "donor", idempotencyKey: "x" })
    );
    const merged = mergeImagingStaffReviewMetadata(
      { imaging_clinical_ai: aiRecord, imaging_quality: { quality_score: 80 } },
      buildStaffReviewRecord({ status: "reviewed", reviewedByUserId: "u1" })
    );
    assert.deepEqual(merged.imaging_clinical_ai, aiRecord);
    assert.deepEqual(merged.imaging_quality, { quality_score: 80 });
    assert.equal(
      (merged.imaging_staff_review as { status: string }).status,
      "reviewed"
    );
  });

  it("rejects invalid view types", () => {
    assert.equal(validateAssignedViewType("donor"), "donor");
    assert.equal(validateAssignedViewType("not_a_real_view"), null);
  });
});