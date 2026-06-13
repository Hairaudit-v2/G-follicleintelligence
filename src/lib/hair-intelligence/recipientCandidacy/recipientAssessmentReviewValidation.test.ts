import test from "node:test";
import assert from "node:assert/strict";
import { recipientAssessmentReviewBodySchema } from "./recipientAssessmentReviewValidation";

test("recipientAssessmentReviewBodySchema accepts minimal patch", () => {
  const p = recipientAssessmentReviewBodySchema.parse({
    review_status: "accepted",
    recipient_quality_rating: "moderate",
    confidence_score: 0.5,
  });
  assert.equal(p.review_status, "accepted");
});

test("recipientAssessmentReviewBodySchema rejects bad review_status", () => {
  assert.throws(() =>
    recipientAssessmentReviewBodySchema.parse({
      review_status: "nope",
    })
  );
});
