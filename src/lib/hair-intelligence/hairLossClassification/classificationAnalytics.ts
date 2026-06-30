import type { HairIntelligenceHairLossClassificationInsert } from "./types";

export type HairLossClassificationAnalyticsRow = Pick<
  HairIntelligenceHairLossClassificationInsert,
  | "pattern_type"
  | "classification_system"
  | "classification_grade"
  | "sex_classification"
  | "confidence_score"
  | "frontal_loss_score"
  | "temporal_recession_score"
  | "mid_scalp_score"
  | "crown_loss_score"
  | "diffuse_thinning_score"
>;

export type HairLossClassificationAnalyticsInput = HairLossClassificationAnalyticsRow[];

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * Pure analytics over persisted classification rows (in-memory; no I/O).
 */
export function computeHairLossClassificationAnalytics(rows: HairLossClassificationAnalyticsInput) {
  const patternCounts = new Map<string, number>();
  const systemCounts = new Map<string, number>();
  const gradeCounts = new Map<string, number>();
  let unknownPatterns = 0;
  let unknownGrades = 0;
  const sexCounts = new Map<string, number>();
  const maleish = new Set(["male_pattern_baldness", "diffuse_male_pattern", "retrograde_alopecia"]);
  const femaleish = new Set([
    "female_pattern_loss",
    "diffuse_female_thinning",
    "traction_pattern",
    "frontal_fibrosing_pattern",
  ]);
  let malePatternLike = 0;
  let femalePatternLike = 0;
  const frontal: number[] = [];
  const temporal: number[] = [];
  const mid: number[] = [];
  const crown: number[] = [];
  const diffuse: number[] = [];

  for (const r of rows) {
    increment(patternCounts, r.pattern_type);
    increment(systemCounts, r.classification_system);
    increment(gradeCounts, `${r.classification_system}:${r.classification_grade}`);
    if (r.pattern_type === "unknown") unknownPatterns += 1;
    if (r.classification_grade === "unknown") unknownGrades += 1;
    if (r.sex_classification) increment(sexCounts, r.sex_classification);
    if (maleish.has(r.pattern_type)) malePatternLike += 1;
    if (femaleish.has(r.pattern_type)) femalePatternLike += 1;
    if (r.frontal_loss_score != null) frontal.push(r.frontal_loss_score);
    if (r.temporal_recession_score != null) temporal.push(r.temporal_recession_score);
    if (r.mid_scalp_score != null) mid.push(r.mid_scalp_score);
    if (r.crown_loss_score != null) crown.push(r.crown_loss_score);
    if (r.diffuse_thinning_score != null) diffuse.push(r.diffuse_thinning_score);
  }

  const total = rows.length;
  const unknownClassificationRate =
    total === 0 ? 0 : (unknownPatterns + unknownGrades) / (2 * total);

  const mostCommonPatternTypes = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([pattern_type, count]) => ({ pattern_type, count }));

  const classificationDistribution = Array.from(systemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([classification_system, count]) => ({ classification_system, count }));

  return {
    total,
    most_common_pattern_types: mostCommonPatternTypes,
    classification_distribution: classificationDistribution,
    grade_distribution_top: Array.from(gradeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([key, count]) => ({ key, count })),
    average_severity_scores: {
      frontal_loss_score: mean(frontal),
      temporal_recession_score: mean(temporal),
      mid_scalp_score: mean(mid),
      crown_loss_score: mean(crown),
      diffuse_thinning_score: mean(diffuse),
    },
    pattern_sex_presentation_counts: {
      male_like_patterns: malePatternLike,
      female_like_patterns: femalePatternLike,
      sex_classification: Object.fromEntries(sexCounts),
    },
    unknown_classification_rate: unknownClassificationRate,
  };
}
