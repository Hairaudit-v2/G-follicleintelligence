import test from "node:test";
import assert from "node:assert/strict";
import {
  donorAverageConfidence,
  donorQualityDistribution,
  donorRiskDistribution,
  donorSafeCapacityBandDistribution,
  donorUnknownAssessmentRate,
  donorUnsafeOrAvoidExtractionCount,
} from "./donorAnalytics";

const rows = [
  {
    donor_quality_rating: "good",
    confidence_score: 0.8,
    miniaturisation_risk: "low",
    retrograde_risk: "moderate",
    overharvesting_risk: "low",
    safe_donor_capacity_band: "2500_4000",
    extraction_caution_level: "moderate",
  },
  {
    donor_quality_rating: "unknown",
    confidence_score: 0,
    miniaturisation_risk: "unknown",
    retrograde_risk: "unknown",
    overharvesting_risk: "unknown",
    safe_donor_capacity_band: "unknown",
    extraction_caution_level: "unknown",
  },
  {
    donor_quality_rating: "unsafe",
    confidence_score: 0.2,
    miniaturisation_risk: "high",
    retrograde_risk: "high",
    overharvesting_risk: "high",
    safe_donor_capacity_band: "under_1500",
    extraction_caution_level: "avoid",
  },
];

test("donorQualityDistribution", () => {
  const d = donorQualityDistribution(rows);
  assert.ok(d.some((x) => x.donor_quality_rating === "good" && x.count === 1));
});

test("donorAverageConfidence", () => {
  const m = donorAverageConfidence(rows);
  assert.ok(m != null && m > 0.3 && m < 0.4);
});

test("donorRiskDistribution has keys", () => {
  const r = donorRiskDistribution(rows);
  assert.ok("miniaturisation" in r);
});

test("donorUnsafeOrAvoidExtractionCount", () => {
  assert.equal(donorUnsafeOrAvoidExtractionCount(rows), 1);
});

test("donorUnknownAssessmentRate", () => {
  assert.equal(donorUnknownAssessmentRate(rows), 1 / 3);
});

test("donorSafeCapacityBandDistribution", () => {
  const d = donorSafeCapacityBandDistribution(rows);
  assert.ok(d.length >= 1);
});
