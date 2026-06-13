import test from "node:test";
import assert from "node:assert/strict";
import { parseDonorAssessmentModelJson } from "./modelDonorAssessmentJsonParse";

test("parseDonorAssessmentModelJson accepts valid payload", () => {
  const r = parseDonorAssessmentModelJson({
    donor_region: "occipital",
    donor_quality_rating: "good",
    confidence_score: 0.82,
    estimated_density_band: "high",
    miniaturisation_risk: "low",
    retrograde_risk: "moderate",
    overharvesting_risk: "low",
    safe_donor_capacity_band: "4000_6000",
    lifetime_graft_budget_band: "5000_7000",
    extraction_caution_level: "moderate",
    clinical_observations: "Dense occipital donor.",
    ai_notes: "Review clinically.",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.donor_region, "occipital");
  assert.equal(r.data.donor_quality_rating, "good");
  assert.equal(r.data.confidence_score, 0.82);
});

test("parseDonorAssessmentModelJson coerces invalid bands to unknown", () => {
  const r = parseDonorAssessmentModelJson({
    donor_region: "occipital",
    donor_quality_rating: "good",
    confidence_score: 2,
    estimated_density_band: "not_a_band",
    miniaturisation_risk: "low",
    retrograde_risk: "low",
    overharvesting_risk: "low",
    safe_donor_capacity_band: "4000_6000",
    lifetime_graft_budget_band: "5000_7000",
    extraction_caution_level: "moderate",
    clinical_observations: "x",
    ai_notes: "y",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.data.confidence_score, 1);
  assert.equal(r.data.estimated_density_band, "unknown");
});

test("parseDonorAssessmentModelJson rejects missing keys", () => {
  const r = parseDonorAssessmentModelJson({ donor_region: "occipital" });
  assert.equal(r.ok, false);
});
