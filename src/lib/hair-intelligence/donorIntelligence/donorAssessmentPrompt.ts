/**
 * Single prompt source for donor-region vision assessment (HIE Stage 9C).
 * Output must be strict JSON only — parsed by `modelDonorAssessmentJsonParse`.
 */
export function buildDonorAssessmentUserPrompt(): string {
  return `You analyse donor-region photographs for hair restoration decision support only.

Scope:
- Photographs must show donor scalp or beard/body donor areas. If the image is clearly NOT a donor-region view (e.g. pure frontal scalp only), set donor_region to "unknown", donor_quality_rating to "unknown", confidence_score low, and explain in clinical_observations.

You must NOT:
- Claim exact graft density or follicular counts.
- Claim exact total graft numbers or surgical plans.
- Diagnose medical conditions or replace clinical examination.

You MUST:
- Use qualitative bands only for density, capacity, and lifetime budget estimates.
- Mention image quality limits (blur, glare, wet hair, distance, occlusion) when they reduce reliability.
- Treat output as non-diagnostic clinical decision support requiring clinician review.

Return ONE JSON object with exactly these keys (no markdown, no commentary):
{
  "donor_region": "occipital",
  "donor_quality_rating": "good",
  "confidence_score": 0.82,
  "estimated_density_band": "high",
  "miniaturisation_risk": "low",
  "retrograde_risk": "moderate",
  "overharvesting_risk": "low",
  "safe_donor_capacity_band": "4000_6000",
  "lifetime_graft_budget_band": "5000_7000",
  "extraction_caution_level": "moderate",
  "clinical_observations": "Occipital donor appears dense with mild lower-nape thinning.",
  "ai_notes": "Assessment is image-based and should be clinically reviewed."
}

Allowed values:
- donor_region: occipital | left_parietal | right_parietal | nape | beard | body | mixed | unknown
- donor_quality_rating: excellent | good | moderate | poor | unsafe | unknown
- confidence_score: number from 0 to 1
- estimated_density_band: very_low | low | moderate | high | very_high | unknown
- miniaturisation_risk | retrograde_risk | overharvesting_risk: low | moderate | high | unknown
- safe_donor_capacity_band: under_1500 | 1500_2500 | 2500_4000 | 4000_6000 | over_6000 | unknown
- lifetime_graft_budget_band: under_3000 | 3000_5000 | 5000_7000 | over_7000 | unknown
- extraction_caution_level: low | moderate | high | avoid | unknown
- clinical_observations: concise visible findings (string)
- ai_notes: limitations / cautions (string); include that bands are not exact measurements.`;
}
