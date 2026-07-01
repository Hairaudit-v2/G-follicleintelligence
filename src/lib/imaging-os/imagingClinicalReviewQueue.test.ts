import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { imageNeedsClinicalReview } from "./imagingClinicalReviewQueue.server";

describe("imagingClinicalReviewQueue", () => {
  it("flags low confidence and poor quality", () => {
    const review = imageNeedsClinicalReview({
      metadata: {
        imaging_quality: {
          quality_score: 40,
          quality_status: "fail",
          blur_status: "blurred",
          exposure_status: "normal",
          duplicate_status: "unique",
          evaluated_at: new Date().toISOString(),
          evaluator_version: "imagingos_quality_v1",
        },
      },
      aiImageCategoryConfidence: 0.4,
      aiImageReviewStatus: "pending",
    });
    assert.equal(review.needsReview, true);
    assert.ok(review.reasons.includes("low_classification_confidence"));
    assert.ok(review.reasons.includes("poor_quality_metadata"));
  });

  it("respects staff reviewed marker", () => {
    const review = imageNeedsClinicalReview({
      metadata: {
        imaging_clinical_review: { reviewed_at: "2026-01-01T00:00:00.000Z" },
        imaging_clinical_ai: {
          provider: "stub",
          status: "needs_review",
          confidence: 0.4,
          review_required: true,
          reasons: ["low_classification_confidence"],
          clinical_findings: {},
          analysis_version: "imagingos_clinical_v1",
          analysed_at: new Date().toISOString(),
        },
      },
      aiImageCategoryConfidence: 0.4,
    });
    assert.equal(review.needsReview, false);
  });

  it("flags missing scalp region from clinical AI reasons", () => {
    const review = imageNeedsClinicalReview({
      metadata: {
        imaging_clinical_ai: {
          provider: "hli_openai",
          status: "needs_review",
          confidence: 0.9,
          review_required: true,
          reasons: ["missing_scalp_region"],
          clinical_findings: {},
          analysis_version: "imagingos_clinical_v1",
          analysed_at: new Date().toISOString(),
        },
      },
      aiImageCategoryConfidence: 0.9,
    });
    assert.equal(review.needsReview, true);
    assert.ok(review.reasons.includes("missing_scalp_region"));
  });
});