/**
 * FI-DEMO-DAY-2A.1 — Pure showcase fixture readiness completeness scorer.
 *
 * Categories mirror the eight Patient Intelligence Overview areas.
 * Target band for a Demo Day-ready James Chen fixture: excellent (≥ 85).
 *
 * This is independent of `calculatePatientTwinCompleteness` (live Twin DTO).
 * Seeds/validators (2A.2+) map SoR presence → these flags, then score.
 */

export const SHOWCASE_COMPLETENESS_EXCELLENT_MIN = 85 as const;

export type ShowcaseIntelligenceCategory =
  | "baseline"
  | "treatment"
  | "surgical_plan"
  | "procedure"
  | "outcomes"
  | "governance"
  | "workforce"
  | "economics";

export const SHOWCASE_INTELLIGENCE_CATEGORIES: readonly ShowcaseIntelligenceCategory[] = [
  "baseline",
  "treatment",
  "surgical_plan",
  "procedure",
  "outcomes",
  "governance",
  "workforce",
  "economics",
] as const;

/** Points per category — sums to 100. */
export const SHOWCASE_CATEGORY_WEIGHTS: Readonly<
  Record<ShowcaseIntelligenceCategory, number>
> = {
  baseline: 15,
  treatment: 10,
  surgical_plan: 15,
  procedure: 15,
  outcomes: 15,
  governance: 10,
  workforce: 10,
  economics: 10,
};

export type ShowcaseCompletenessBand = "poor" | "partial" | "good" | "excellent";

export type ShowcaseFixturePresence = Record<ShowcaseIntelligenceCategory, boolean>;

export type ShowcaseFixtureCompletenessResult = {
  score: number;
  band: ShowcaseCompletenessBand;
  present: ShowcaseIntelligenceCategory[];
  missing: ShowcaseIntelligenceCategory[];
  weights_earned: number;
  weights_total: number;
  meets_excellent_target: boolean;
};

export function emptyShowcaseFixturePresence(): ShowcaseFixturePresence {
  return {
    baseline: false,
    treatment: false,
    surgical_plan: false,
    procedure: false,
    outcomes: false,
    governance: false,
    workforce: false,
    economics: false,
  };
}

export function fullShowcaseFixturePresence(): ShowcaseFixturePresence {
  return {
    baseline: true,
    treatment: true,
    surgical_plan: true,
    procedure: true,
    outcomes: true,
    governance: true,
    workforce: true,
    economics: true,
  };
}

export function bandForShowcaseCompletenessScore(score: number): ShowcaseCompletenessBand {
  if (score >= SHOWCASE_COMPLETENESS_EXCELLENT_MIN) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "partial";
  return "poor";
}

/**
 * Score fixture readiness from explicit category presence flags.
 * Identity/Norwood consistency is enforced via constants tests + seed metadata, not this scorer.
 */
export function scoreShowcaseFixtureCompleteness(
  presence: ShowcaseFixturePresence
): ShowcaseFixtureCompletenessResult {
  let weights_earned = 0;
  const present: ShowcaseIntelligenceCategory[] = [];
  const missing: ShowcaseIntelligenceCategory[] = [];

  for (const category of SHOWCASE_INTELLIGENCE_CATEGORIES) {
    const weight = SHOWCASE_CATEGORY_WEIGHTS[category];
    if (presence[category]) {
      weights_earned += weight;
      present.push(category);
    } else {
      missing.push(category);
    }
  }

  const weights_total = SHOWCASE_INTELLIGENCE_CATEGORIES.reduce(
    (sum, c) => sum + SHOWCASE_CATEGORY_WEIGHTS[c],
    0
  );
  const score = Math.max(0, Math.min(100, Math.round(weights_earned)));
  const band = bandForShowcaseCompletenessScore(score);

  return {
    score,
    band,
    present,
    missing,
    weights_earned,
    weights_total,
    meets_excellent_target: score >= SHOWCASE_COMPLETENESS_EXCELLENT_MIN && band === "excellent",
  };
}

/** Minimum presence set that still clears excellent (≥ 85). */
export function minimalExcellentShowcaseFixturePresence(): ShowcaseFixturePresence {
  // Drop treatment (10) → 90; still excellent.
  return {
    ...fullShowcaseFixturePresence(),
    treatment: false,
  };
}
