/**
 * FI Scorecard schema (engine-first). Versioned, stable format.
 */

export const FI_SCORECARD_VERSION = 1 as const;

/** Section keys matching FI_SCORECARD_V1 */
export const FI_SCORECARD_SECTIONS = [
  "hormonal_androgen",
  "inflammation",
  "thyroid_iron",
  "nutrition_markers",
  "image_miniaturization_density",
  "progression_timeline",
  "surgical_readiness",
] as const;

export type FiScorecardSectionId = (typeof FI_SCORECARD_SECTIONS)[number];

/** Human-readable labels for report display */
export const FI_SCORECARD_SECTION_LABELS: Record<FiScorecardSectionId, string> = {
  hormonal_androgen: "Hormonal / Androgen Exposure",
  inflammation: "Inflammation",
  thyroid_iron: "Thyroid / Iron",
  nutrition_markers: "Nutrition Markers",
  image_miniaturization_density: "Image-derived Miniaturization / Density",
  progression_timeline: "Progression Timeline Model",
  surgical_readiness: "Surgical Readiness",
};

export type FiScorecardSectionScore = {
  score: number;
  raw_value?: number | string;
  interpretation?: string;
};

export type FiScorecardV1 = {
  version: typeof FI_SCORECARD_VERSION;
  sections: Record<FiScorecardSectionId, FiScorecardSectionScore>;
  overall_score: number;
  risk_tier: "low" | "medium" | "high";
  explainability: Record<string, string[]>;
  weights_applied: Record<FiScorecardSectionId, number>;
};

/** Default global weights (sum to 1.0) */
export const FI_SCORECARD_DEFAULT_WEIGHTS: Record<FiScorecardSectionId, number> = {
  hormonal_androgen: 0.22,
  inflammation: 0.15,
  thyroid_iron: 0.12,
  nutrition_markers: 0.1,
  image_miniaturization_density: 0.2,
  progression_timeline: 0.13,
  surgical_readiness: 0.08,
};

/** Default empty section score */
export const EMPTY_SECTION_SCORE: FiScorecardSectionScore = {
  score: 0,
  interpretation: "No data",
};

export function createEmptyScorecardV1(): FiScorecardV1 {
  const sections = {} as Record<FiScorecardSectionId, FiScorecardSectionScore>;
  for (const id of FI_SCORECARD_SECTIONS) {
    sections[id] = { ...EMPTY_SECTION_SCORE };
  }
  return {
    version: FI_SCORECARD_VERSION,
    sections,
    overall_score: 0,
    risk_tier: "low",
    explainability: {},
    weights_applied: { ...FI_SCORECARD_DEFAULT_WEIGHTS },
  };
}

/** Resolve weights: tenant config overrides, fallback to defaults */
export function resolveScorecardWeights(
  tenantConfig: { scorecard_weights?: Partial<Record<FiScorecardSectionId, number>> } | null
): Record<FiScorecardSectionId, number> {
  const weights = { ...FI_SCORECARD_DEFAULT_WEIGHTS };
  const overrides = tenantConfig?.scorecard_weights;
  if (overrides && typeof overrides === "object") {
    for (const id of FI_SCORECARD_SECTIONS) {
      const w = overrides[id];
      if (typeof w === "number" && w >= 0 && w <= 1) {
        weights[id] = w;
      }
    }
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const id of FI_SCORECARD_SECTIONS) {
      weights[id] = weights[id] / sum;
    }
  }
  return weights;
}

/** Compute weighted overall score from section scores */
export function computeOverallScore(
  sections: Record<FiScorecardSectionId, FiScorecardSectionScore>,
  weights: Record<FiScorecardSectionId, number>
): number {
  let total = 0;
  for (const id of FI_SCORECARD_SECTIONS) {
    total += (sections[id]?.score ?? 0) * (weights[id] ?? 0);
  }
  return Math.min(1, Math.max(0, total));
}

export function tierFromScore(score: number): "low" | "medium" | "high" {
  if (score < 0.3) return "low";
  if (score < 0.7) return "medium";
  return "high";
}
