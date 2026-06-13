import test from "node:test";
import assert from "node:assert/strict";
import {
  formatReviewMultiplier,
  formatSignedVelocityDeltaGradesPerYear,
  formatStabilityClinicalLabel,
  formatVerifiedPointFraction,
  formatVelocityGradesPerYear,
  formatVelocityGradesPerYearWithUnit,
  hairProgressionAnalysedTimebounds,
  hairProgressionIsInsufficientLongitudinalData,
  hairProgressionLatestGradePresentation,
} from "./progressionDisplay";
import type { HairProgressionIntelligence } from "./progressionEngine";

test("formatVelocityGradesPerYear formats finite slopes with sensible precision", () => {
  assert.equal(formatVelocityGradesPerYear(null), "—");
  assert.equal(formatVelocityGradesPerYear(undefined), "—");
  assert.equal(formatVelocityGradesPerYear(NaN), "—");
  assert.equal(formatVelocityGradesPerYear(0.512_345), "0.512");
  assert.equal(formatVelocityGradesPerYear(2.718), "2.72");
  assert.equal(formatVelocityGradesPerYear(12.3), "12.3");
});

test("formatVelocityGradesPerYearWithUnit appends grades/year", () => {
  assert.equal(formatVelocityGradesPerYearWithUnit(null), "—");
  assert.equal(formatVelocityGradesPerYearWithUnit(0.4), "0.400 grades/year");
});

test("formatStabilityClinicalLabel uses clinical wording", () => {
  assert.equal(formatStabilityClinicalLabel("stable"), "Stable");
  assert.equal(formatStabilityClinicalLabel("slow_progression"), "Slow progression");
  assert.equal(formatStabilityClinicalLabel("rapid_progression"), "Rapid progression");
  assert.equal(formatStabilityClinicalLabel("diffuse_unstable_progression"), "Diffuse unstable progression");
  assert.equal(formatStabilityClinicalLabel("insufficient_data"), "Insufficient longitudinal data");
});

test("hairProgressionIsInsufficientLongitudinalData tracks engine insufficient_data label", () => {
  assert.equal(hairProgressionIsInsufficientLongitudinalData({ stability: { label: "insufficient_data" } }), true);
  assert.equal(hairProgressionIsInsufficientLongitudinalData({ stability: { label: "stable" } }), false);
});

test("hairProgressionAnalysedTimebounds prefers dominant-system ordinals", () => {
  const dto = {
    analysis_basis: { classification_system_used: "norwood" },
    timepoints: [
      {
        id: "1",
        at: "2024-01-01T00:00:00.000Z",
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        grade: "II",
        progression_ordinal: 2,
        confidence_score: 0.9,
        review_status: "pending",
        review_confidence_multiplier: 1,
      },
      {
        id: "2",
        at: "2025-01-01T00:00:00.000Z",
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        grade: "III",
        progression_ordinal: 3,
        confidence_score: 0.9,
        review_status: "pending",
        review_confidence_multiplier: 1,
      },
    ],
  } as HairProgressionIntelligence;
  const b = hairProgressionAnalysedTimebounds(dto);
  assert.equal(b.firstAt, "2024-01-01T00:00:00.000Z");
  assert.equal(b.lastAt, "2025-01-01T00:00:00.000Z");
});

test("hairProgressionLatestGradePresentation reads last analysed row", () => {
  const dto = {
    analysis_basis: { classification_system_used: "norwood" },
    timepoints: [
      {
        id: "1",
        at: "2024-01-01T00:00:00.000Z",
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        grade: "II",
        progression_ordinal: 2,
        confidence_score: 0.9,
        review_status: "pending",
        review_confidence_multiplier: 1,
      },
      {
        id: "2",
        at: "2025-01-01T00:00:00.000Z",
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        grade: "III",
        progression_ordinal: 3,
        confidence_score: 0.9,
        review_status: "pending",
        review_confidence_multiplier: 1,
      },
    ],
  } as HairProgressionIntelligence;
  const g = hairProgressionLatestGradePresentation(dto);
  assert.equal(g.grade, "III");
  assert.equal(g.ordinal, 3);
});

test("formatSignedVelocityDeltaGradesPerYear preserves sign", () => {
  assert.equal(formatSignedVelocityDeltaGradesPerYear(-0.25), "-0.250 grades/year");
  assert.equal(formatSignedVelocityDeltaGradesPerYear(0.25), "+0.250 grades/year");
  assert.equal(formatSignedVelocityDeltaGradesPerYear(null), "—");
});

test("formatVerifiedPointFraction and formatReviewMultiplier are finite-safe", () => {
  assert.equal(formatVerifiedPointFraction(0.333_333), "33%");
  assert.equal(formatVerifiedPointFraction(null), "—");
  assert.equal(formatReviewMultiplier(1.052), "1.05");
});
