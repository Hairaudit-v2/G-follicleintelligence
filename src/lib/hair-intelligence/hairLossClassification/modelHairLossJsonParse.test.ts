import test from "node:test";
import assert from "node:assert/strict";
import { parseHairLossClassificationModelJson } from "./modelHairLossJsonParse";

test("parses valid model json", () => {
  const r = parseHairLossClassificationModelJson({
    sex_classification: "male",
    classification_system: "norwood",
    classification_grade: "V",
    pattern_type: "male_pattern_baldness",
    confidence_score: 0.91,
    frontal_loss_score: 8,
    temporal_recession_score: 7,
    mid_scalp_score: 5,
    crown_loss_score: 6,
    diffuse_thinning_score: 3,
    retrograde_pattern_detected: false,
    suspected_scarring_pattern: false,
    notes: "Test",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.classification_grade, "V");
    assert.equal(r.data.confidence_score, 0.91);
  }
});

test("fails on invalid json shape", () => {
  const r = parseHairLossClassificationModelJson({ foo: 1 });
  assert.equal(r.ok, false);
});
