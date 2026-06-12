import test from "node:test";
import assert from "node:assert/strict";
import { computeHairLossClassificationAnalytics } from "./classificationAnalytics";

test("analytics aggregates patterns and averages", () => {
  const a = computeHairLossClassificationAnalytics([
    {
      pattern_type: "male_pattern_baldness",
      classification_system: "norwood",
      classification_grade: "V",
      sex_classification: "male",
      confidence_score: 0.9,
      frontal_loss_score: 8,
      temporal_recession_score: 7,
      mid_scalp_score: null,
      crown_loss_score: 6,
      diffuse_thinning_score: 2,
    },
    {
      pattern_type: "unknown",
      classification_system: "custom",
      classification_grade: "unknown",
      sex_classification: "unknown",
      confidence_score: 0,
      frontal_loss_score: null,
      temporal_recession_score: null,
      mid_scalp_score: null,
      crown_loss_score: null,
      diffuse_thinning_score: null,
    },
  ]);
  assert.equal(a.total, 2);
  assert.equal(a.most_common_pattern_types[0]?.pattern_type, "male_pattern_baldness");
  assert.equal(a.pattern_sex_presentation_counts.male_like_patterns, 1);
  assert.ok(a.average_severity_scores.frontal_loss_score === 8);
});
