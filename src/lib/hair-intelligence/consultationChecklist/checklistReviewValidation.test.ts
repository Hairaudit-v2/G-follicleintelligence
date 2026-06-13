import test from "node:test";
import assert from "node:assert/strict";
import { consultationChecklistReviewBodySchema } from "./checklistReviewValidation";

test("consultationChecklistReviewBodySchema accepts minimal corrected review", () => {
  const p = consultationChecklistReviewBodySchema.parse({
    review_status: "corrected",
    priority_level: "moderate",
    checklist_items: ["Topic"],
  });
  assert.equal(p.review_status, "corrected");
});

test("consultationChecklistReviewBodySchema rejects bad review_status", () => {
  assert.throws(() =>
    consultationChecklistReviewBodySchema.parse({
      review_status: "maybe",
    })
  );
});
