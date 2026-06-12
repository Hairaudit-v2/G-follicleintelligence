import test from "node:test";
import assert from "node:assert/strict";
import { hairLossClassificationReviewBodySchema } from "./classificationReviewValidation";

test("accepts minimal review body", () => {
  const p = hairLossClassificationReviewBodySchema.parse({ review_status: "accepted" });
  assert.equal(p.review_status, "accepted");
});

test("rejects unknown review status", () => {
  assert.throws(() => hairLossClassificationReviewBodySchema.parse({ review_status: "maybe" }));
});
