import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";
import { buildStubClinicalImageAnalysis } from "./clinicalImageAnalysisCore";
import {
  matchesImagingReviewQueueFilters,
  parseImagingReviewQueueFiltersFromSearchParams,
  type ReviewQueueFilterRow,
} from "./imagingClinicalReviewQueueFilters";

function baseRow(overrides: Partial<ReviewQueueFilterRow> = {}): ReviewQueueFilterRow {
  return {
    imageId: "img-1",
    patientId: "patient-1",
    caseId: null,
    metadata: {},
    aiImageCategory: "donor",
    aiImageCategoryConfidence: 0.5,
    aiImageReviewStatus: "pending",
    createdAt: "2026-07-01T12:00:00.000Z",
    reviewReasons: ["low_classification_confidence"],
    ...overrides,
  };
}

describe("imagingClinicalReviewQueueFilters", () => {
  it("filters by review reason", () => {
    assert.equal(
      matchesImagingReviewQueueFilters(baseRow(), { reviewReason: "low_classification_confidence" }),
      true
    );
    assert.equal(
      matchesImagingReviewQueueFilters(baseRow(), { reviewReason: "retake_required" }),
      false
    );
  });

  it("filters by quality status", () => {
    const row = baseRow({
      metadata: {
        imaging_quality: {
          quality_score: 40,
          quality_status: "fail",
          blur_status: "blurred",
          exposure_status: "normal",
          duplicate_status: "unique",
          evaluated_at: "2026-07-01T00:00:00.000Z",
          evaluator_version: "imagingos_quality_v1",
        },
      },
    });
    assert.equal(matchesImagingReviewQueueFilters(row, { qualityStatus: "fail" }), true);
    assert.equal(matchesImagingReviewQueueFilters(row, { qualityStatus: "pass" }), false);
  });

  it("filters by confidence band and assigned reviewer", () => {
    const row = baseRow({
      aiImageCategoryConfidence: 0.4,
      metadata: {
        imaging_review_assignment: {
          assigned_to: "reviewer-1",
          assigned_by: "admin-1",
          assigned_at: "2026-07-01T00:00:00.000Z",
          assignment_status: "assigned",
          assignment_version: "imagingos_review_assignment_v1",
        },
      },
    });
    assert.equal(matchesImagingReviewQueueFilters(row, { confidenceBand: "low" }), true);
    assert.equal(matchesImagingReviewQueueFilters(row, { confidenceBand: "high" }), false);
    assert.equal(matchesImagingReviewQueueFilters(row, { assignedReviewerId: "reviewer-1" }), true);
    assert.equal(matchesImagingReviewQueueFilters(row, { assignedReviewerId: "other" }), false);
  });

  it("filters by view type and capture source", () => {
    const aiMeta = clinicalAnalysisResultToMetadataRecord(
      buildStubClinicalImageAnalysis({ externalCategory: "donor", idempotencyKey: "img-1" })
    );
    const row = baseRow({
      metadata: {
        imaging_clinical_ai: aiMeta,
        capture_source: "surgery_os",
      },
      aiImageCategory: "donor",
    });
    assert.equal(matchesImagingReviewQueueFilters(row, { viewType: "donor" }), true);
    assert.equal(matchesImagingReviewQueueFilters(row, { captureSource: "surgery_os" }), true);
    assert.equal(matchesImagingReviewQueueFilters(row, { captureSource: "guided_capture" }), false);
  });

  it("parses search params into filter object", () => {
    const params = new URLSearchParams({
      reason: "retake_required",
      quality: "review",
      confidence: "low",
      assigned: "user-abc",
      retake: "1",
    });
    const filters = parseImagingReviewQueueFiltersFromSearchParams(params);
    assert.equal(filters.reviewReason, "retake_required");
    assert.equal(filters.qualityStatus, "review");
    assert.equal(filters.confidenceBand, "low");
    assert.equal(filters.assignedReviewerId, "user-abc");
    assert.equal(filters.retakeRequired, true);
  });
});