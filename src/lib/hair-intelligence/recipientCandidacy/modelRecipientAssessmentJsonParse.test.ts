import test from "node:test";
import assert from "node:assert/strict";
import { parseRecipientAssessmentModelJson } from "./modelRecipientAssessmentJsonParse";

test("parseRecipientAssessmentModelJson success", () => {
  const r = parseRecipientAssessmentModelJson({
    recipient_quality_rating: "good",
    confidence_score: 0.7,
    diffuse_thinning_risk: "low",
    shock_loss_risk: null,
    density_expectation_risk: "moderate",
    medication_stabilisation_needed: false,
    pathology_review_recommended: false,
    surgical_timing_risk: "delay_recommended",
    patient_expectation_risk: "high",
    documentation_gap_detected: true,
    review_topics: ["Discuss expectations"],
    candidacy_summary: "Summary",
    ai_notes: "Notes",
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.recipient_quality_rating, "good");
    assert.equal(r.data.review_topics.length, 1);
    assert.equal(r.data.documentation_gap_detected, true);
  }
});

test("parseRecipientAssessmentModelJson rejects bad shape", () => {
  const r = parseRecipientAssessmentModelJson({ foo: 1 });
  assert.equal(r.ok, false);
});
