import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fiImageAiReviewBodySchema } from "./fiImageAiReviewValidation";

describe("fiImageAiReviewBodySchema", () => {
  it("accepts a valid review payload", () => {
    const parsed = fiImageAiReviewBodySchema.parse({
      ai_image_category: "crown",
      ai_hair_state: "dry",
      ai_shave_state: "shaved",
      ai_surgery_stage: "follow_up",
      ai_image_review_status: "corrected",
    });
    assert.equal(parsed.ai_image_category, "crown");
  });

  it("rejects invalid enum", () => {
    assert.throws(() =>
      fiImageAiReviewBodySchema.parse({
        ai_image_review_status: "maybe",
      })
    );
  });
});
