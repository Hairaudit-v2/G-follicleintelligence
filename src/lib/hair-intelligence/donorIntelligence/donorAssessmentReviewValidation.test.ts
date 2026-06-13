import test from "node:test";
import assert from "node:assert/strict";
import { donorAssessmentReviewBodySchema } from "./donorAssessmentReviewValidation";

test("donorAssessmentReviewBodySchema accepts minimal corrected review", () => {
  const r = donorAssessmentReviewBodySchema.safeParse({
    review_status: "corrected",
    donor_quality_rating: "moderate",
    confidence_score: 0.5,
  });
  assert.equal(r.success, true);
});

test("donorAssessmentReviewBodySchema rejects invalid review_status", () => {
  const r = donorAssessmentReviewBodySchema.safeParse({ review_status: "maybe" });
  assert.equal(r.success, false);
});
