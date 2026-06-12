import { z } from "zod";

const hairProgressionStabilitySchema = z.enum([
  "stable",
  "slow_progression",
  "rapid_progression",
  "diffuse_unstable_progression",
  "insufficient_data",
]);

const hairProgressionForecastSchema = z
  .object({
    classification_system: z.literal("norwood"),
    current_grade: z.string(),
    current_ordinal: z.number(),
    velocity_grades_per_year: z.number(),
    predicted_reach_grade: z.string(),
    predicted_reach_ordinal: z.number(),
    estimated_years_to_target: z.number(),
    target_grade: z.string(),
  })
  .nullable();

/** Zod mirror of `HairProgressionIntelligence` (HIE Stage 9B) for Patient Twin validation. */
export const patientTwinHairProgressionSectionSchema = z.object({
  engine_version: z.string(),
  timeline_point_cap: z.number(),
  timepoints: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      classification_system: z.string(),
      pattern_type: z.string(),
      grade: z.string(),
      progression_ordinal: z.number().nullable(),
      confidence_score: z.number(),
      review_status: z.string(),
      review_confidence_multiplier: z.number(),
    })
  ),
  analysis_basis: z.object({
    classification_system_used: z.string().nullable(),
    point_count: z.number(),
    span_days: z.number().nullable(),
    span_months: z.number().nullable(),
  }),
  progression_velocity: z.object({
    grades_per_year: z.number().nullable(),
    confidence_weighted_grades_per_year: z.number().nullable(),
    method: z.literal("weighted_linear_regression_years_vs_ordinal"),
  }),
  stability: z.object({
    label: hairProgressionStabilitySchema,
    rationale: z.string(),
    segment_velocity_std_grades_per_year: z.number().nullable(),
  }),
  treatment_response: z.array(
    z.object({
      canonical_code: z.string(),
      display_label: z.string(),
      first_exposure_at: z.string().nullable(),
      velocity_before_grades_per_year: z.number().nullable(),
      velocity_after_grades_per_year: z.number().nullable(),
      delta_velocity_after_minus_before: z.number().nullable(),
      notes: z.string(),
    })
  ),
  forecast: hairProgressionForecastSchema,
  cohort_context: z.object({
    cohort_signature: z.string(),
    age_band: z.enum(["under_25", "25_35", "36_45", "46_55", "56_plus", "unknown"]),
    population_mean_velocity: z.number().nullable(),
    population_sample_count: z.number().nullable(),
    population_week_bucket: z.string().nullable(),
  }),
  clinician_review_weighting: z.object({
    average_review_multiplier: z.number(),
    verified_point_fraction: z.number(),
  }),
  global_network: z.object({
    cohort_signature: z.string(),
    matched_bucket: z.boolean(),
    population_mean_velocity: z.number().nullable(),
    population_sample_count: z.number().nullable(),
    week_bucket: z.string().nullable(),
  }),
});
