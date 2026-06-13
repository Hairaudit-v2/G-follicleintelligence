import type { DonorAssessmentModelResult } from "./types";

export function donorAssessmentNotConfiguredResult(reason: "no_api_key" | "no_image"): DonorAssessmentModelResult {
  const note =
    reason === "no_api_key"
      ? "Donor assessor unavailable (OPENAI_API_KEY missing). Bands and risks default to unknown pending clinical review."
      : "No donor image URL available for assessment. Bands and risks default to unknown pending clinical review.";
  return {
    donor_region: "unknown",
    donor_quality_rating: "unknown",
    confidence_score: 0,
    estimated_density_band: "unknown",
    miniaturisation_risk: "unknown",
    retrograde_risk: "unknown",
    overharvesting_risk: "unknown",
    safe_donor_capacity_band: "unknown",
    lifetime_graft_budget_band: "unknown",
    extraction_caution_level: "unknown",
    clinical_observations: "",
    ai_notes: note,
  };
}
