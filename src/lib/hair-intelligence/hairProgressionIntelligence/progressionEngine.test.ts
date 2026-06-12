import test from "node:test";
import assert from "node:assert/strict";
import { buildHairProgressionIntelligence } from "./progressionEngine";
import { HAIR_PROGRESSION_ENGINE_VERSION } from "./constants";

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

test("Norwood II → III over ~18 months yields positive velocity", () => {
  const t0 = isoMonthsAgo(20);
  const t1 = isoMonthsAgo(2);
  const out = buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: 50,
    timepointsRaw: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        created_at: t0,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "II",
        confidence_score: 0.85,
        review_status: "pending",
        sex_classification: "male",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        created_at: t1,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "III",
        confidence_score: 0.88,
        review_status: "pending",
        sex_classification: "male",
      },
    ],
  });
  assert.equal(out.analysis_basis.classification_system_used, "norwood");
  const v = out.progression_velocity.confidence_weighted_grades_per_year;
  assert.ok(v != null && v > 0.15 && v < 3, `expected moderate velocity, got ${v}`);
  assert.ok(
    out.stability.label === "slow_progression" ||
      out.stability.label === "stable" ||
      out.stability.label === "rapid_progression"
  );
});

test("clinician accepted review increases weighting stats", () => {
  const t0 = isoMonthsAgo(14);
  const t1 = isoMonthsAgo(1);
  const pending = buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: 50,
    timepointsRaw: [
      {
        id: "00000000-0000-4000-8000-000000000011",
        created_at: t0,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "III",
        confidence_score: 0.9,
        review_status: "pending",
      },
      {
        id: "00000000-0000-4000-8000-000000000012",
        created_at: t1,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "IV",
        confidence_score: 0.9,
        review_status: "pending",
      },
    ],
  });
  const accepted = buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: 50,
    timepointsRaw: [
      {
        id: "00000000-0000-4000-8000-000000000021",
        created_at: t0,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "III",
        confidence_score: 0.9,
        review_status: "accepted",
      },
      {
        id: "00000000-0000-4000-8000-000000000022",
        created_at: t1,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "IV",
        confidence_score: 0.9,
        review_status: "accepted",
      },
    ],
  });
  assert.ok(accepted.clinician_review_weighting.average_review_multiplier > pending.clinician_review_weighting.average_review_multiplier);
  assert.ok(accepted.clinician_review_weighting.verified_point_fraction > pending.clinician_review_weighting.verified_point_fraction);
});

test("finasteride exposure splits before / after velocity when enough points", () => {
  const t0 = isoMonthsAgo(30);
  const tMid = isoMonthsAgo(15);
  const tRx = isoMonthsAgo(14);
  const t2 = isoMonthsAgo(8);
  const t3 = isoMonthsAgo(1);
  const out = buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: 50,
    timepointsRaw: [
      {
        id: "00000000-0000-4000-8000-000000000031",
        created_at: t0,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "II",
        confidence_score: 0.8,
        review_status: "pending",
      },
      {
        id: "00000000-0000-4000-8000-000000000032",
        created_at: tMid,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "II",
        confidence_score: 0.8,
        review_status: "pending",
      },
      {
        id: "00000000-0000-4000-8000-000000000033",
        created_at: t2,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "III",
        confidence_score: 0.8,
        review_status: "pending",
      },
      {
        id: "00000000-0000-4000-8000-000000000034",
        created_at: t3,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "III",
        confidence_score: 0.8,
        review_status: "pending",
      },
    ],
    therapyEvents: [
      { occurred_at: tRx, event_type: "therapy_started", canonical_code: "finasteride" },
    ],
  });
  const fin = out.treatment_response.find((x) => x.canonical_code === "finasteride");
  assert.ok(fin);
  assert.ok(fin!.first_exposure_at);
  assert.ok(fin!.velocity_before_grades_per_year != null || fin!.velocity_after_grades_per_year != null);
});

test("Norwood forecast toward V when velocity is high enough", () => {
  const t0 = isoMonthsAgo(8);
  const t1 = isoMonthsAgo(0);
  const out = buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: 50,
    timepointsRaw: [
      {
        id: "00000000-0000-4000-8000-000000000041",
        created_at: t0,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "III",
        confidence_score: 0.9,
        review_status: "pending",
      },
      {
        id: "00000000-0000-4000-8000-000000000042",
        created_at: t1,
        classification_system: "norwood",
        pattern_type: "male_pattern_baldness",
        classification_grade: "IV",
        confidence_score: 0.9,
        review_status: "pending",
      },
    ],
  });
  assert.ok(out.forecast);
  assert.equal(out.forecast!.predicted_reach_grade, "V");
  assert.equal(out.forecast!.current_grade, "IV");
  assert.ok(out.forecast!.estimated_years_to_target > 0);
});

test("network bucket surfaces population mean on second-phase context", () => {
  const t0 = isoMonthsAgo(10);
  const t1 = isoMonthsAgo(0);
  const base = buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: 50,
    timepointsRaw: [
      {
        id: "00000000-0000-4000-8000-000000000051",
        created_at: t0,
        classification_system: "norwood",
        pattern_type: "diffuse_male_pattern",
        classification_grade: "III",
        confidence_score: 0.85,
        review_status: "pending",
        sex_classification: "male",
      },
      {
        id: "00000000-0000-4000-8000-000000000052",
        created_at: t1,
        classification_system: "norwood",
        pattern_type: "diffuse_male_pattern",
        classification_grade: "IV",
        confidence_score: 0.85,
        review_status: "pending",
        sex_classification: "male",
      },
    ],
    patientDateOfBirthIso: "1998-01-15T00:00:00.000Z",
    patientSexClassification: "male",
  });
  const enriched = buildHairProgressionIntelligence({
    engineVersion: HAIR_PROGRESSION_ENGINE_VERSION,
    timelineCap: 50,
    timepointsRaw: [
      {
        id: "00000000-0000-4000-8000-000000000051",
        created_at: t0,
        classification_system: "norwood",
        pattern_type: "diffuse_male_pattern",
        classification_grade: "III",
        confidence_score: 0.85,
        review_status: "pending",
        sex_classification: "male",
      },
      {
        id: "00000000-0000-4000-8000-000000000052",
        created_at: t1,
        classification_system: "norwood",
        pattern_type: "diffuse_male_pattern",
        classification_grade: "IV",
        confidence_score: 0.85,
        review_status: "pending",
        sex_classification: "male",
      },
    ],
    patientDateOfBirthIso: "1998-01-15T00:00:00.000Z",
    patientSexClassification: "male",
    networkBucket: { week_bucket: "2026-06-09", sample_count: 120, mean_velocity: 1.2 },
  });
  assert.equal(base.global_network.matched_bucket, false);
  assert.equal(enriched.global_network.matched_bucket, true);
  assert.equal(enriched.cohort_context.population_mean_velocity, 1.2);
  assert.equal(enriched.cohort_context.population_sample_count, 120);
});
