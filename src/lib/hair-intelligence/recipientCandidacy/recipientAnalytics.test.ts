import test from "node:test";
import assert from "node:assert/strict";
import {
  recipientCandidacyQualityDistribution,
  recipientDocumentationGapRate,
  recipientMedicationStabilisationRecommendationRate,
  recipientPathologyReviewRecommendationRate,
  recipientUnsuitableRate,
} from "./recipientAnalytics";

const rows = [
  {
    recipient_quality_rating: "good",
    medication_stabilisation_needed: true,
    pathology_review_recommended: false,
    documentation_gap_detected: false,
  },
  {
    recipient_quality_rating: "unsuitable",
    medication_stabilisation_needed: false,
    pathology_review_recommended: true,
    documentation_gap_detected: true,
  },
];

test("recipientCandidacyQualityDistribution", () => {
  const d = recipientCandidacyQualityDistribution(rows);
  assert.ok(d.some((x) => x.recipient_quality_rating === "unsuitable" && x.count === 1));
});

test("rates", () => {
  assert.equal(recipientMedicationStabilisationRecommendationRate(rows), 0.5);
  assert.equal(recipientPathologyReviewRecommendationRate(rows), 0.5);
  assert.equal(recipientUnsuitableRate(rows), 0.5);
  assert.equal(recipientDocumentationGapRate(rows), 0.5);
});

test("empty rows return zero rates", () => {
  assert.equal(recipientMedicationStabilisationRecommendationRate([]), 0);
});
