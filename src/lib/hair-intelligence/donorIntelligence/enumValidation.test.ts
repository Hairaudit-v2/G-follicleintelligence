import test from "node:test";
import assert from "node:assert/strict";
import {
  clampDonorConfidence,
  normalizeHieDonorDensityBand,
  normalizeHieDonorQualityRating,
  normalizeHieDonorRegion,
  normalizeHieDonorRiskLevel,
  normalizeHieExtractionCautionLevel,
  normalizeHieLifetimeGraftBudgetBand,
  normalizeHieSafeDonorCapacityBand,
} from "./enumValidation";

test("clampDonorConfidence", () => {
  assert.equal(clampDonorConfidence(1.2), 1);
  assert.equal(clampDonorConfidence(-0.1), 0);
  assert.equal(clampDonorConfidence("x"), 0);
});

test("normalize donor enums", () => {
  assert.equal(normalizeHieDonorRegion("OCCIPITAL"), "occipital");
  assert.equal(normalizeHieDonorRegion("nope"), "unknown");
  assert.equal(normalizeHieDonorQualityRating("GOOD"), "good");
  assert.equal(normalizeHieDonorQualityRating("nope"), "unknown");
  assert.equal(normalizeHieDonorDensityBand("high"), "high");
  assert.equal(normalizeHieDonorDensityBand("nope"), "unknown");
  assert.equal(normalizeHieDonorRiskLevel(null), null);
  assert.equal(normalizeHieDonorRiskLevel("HIGH"), "high");
  assert.equal(normalizeHieSafeDonorCapacityBand("4000_6000"), "4000_6000");
  assert.equal(normalizeHieLifetimeGraftBudgetBand("5000_7000"), "5000_7000");
  assert.equal(normalizeHieExtractionCautionLevel("avoid"), "avoid");
});
