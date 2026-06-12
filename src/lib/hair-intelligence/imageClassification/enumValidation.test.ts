import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeFiAiHairState,
  normalizeFiAiImageCategory,
  normalizeFiAiImageReviewStatus,
  normalizeFiAiShaveState,
  normalizeFiAiSurgeryStage,
  clampConfidence,
} from "./enumValidation";

describe("Hair Image Intelligence — enum validation", () => {
  it("normalises image category", () => {
    assert.equal(normalizeFiAiImageCategory("crown"), "crown");
    assert.equal(normalizeFiAiImageCategory("bogus"), "unknown");
  });

  it("normalises hair / shave / surgery", () => {
    assert.equal(normalizeFiAiHairState("wet"), "wet");
    assert.equal(normalizeFiAiHairState("x"), "unknown");
    assert.equal(normalizeFiAiShaveState("partially_shaved"), "partially_shaved");
    assert.equal(normalizeFiAiSurgeryStage("intra_op"), "intra_op");
  });

  it("normalises review status", () => {
    assert.equal(normalizeFiAiImageReviewStatus("accepted"), "accepted");
    assert.equal(normalizeFiAiImageReviewStatus("nope"), "pending");
  });

  it("clamps confidence", () => {
    assert.equal(clampConfidence(2), 1);
    assert.equal(clampConfidence(-1), 0);
    assert.equal(clampConfidence("x" as unknown as number), 0);
  });
});
