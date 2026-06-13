import type { RecipientAssessmentModelResult } from "./types";

export function recipientAssessmentNotConfiguredResult(reason: "no_api_key" | "no_image"): RecipientAssessmentModelResult {
  const note =
    reason === "no_api_key"
      ? "Recipient candidacy assessor unavailable (OPENAI_API_KEY missing). Values default to unknown pending clinical review."
      : "No recipient-area image URL available for assessment. Values default to unknown pending clinical review.";
  return {
    recipient_quality_rating: "unknown",
    confidence_score: 0,
    diffuse_thinning_risk: "unknown",
    shock_loss_risk: "unknown",
    density_expectation_risk: "unknown",
    medication_stabilisation_needed: false,
    pathology_review_recommended: false,
    surgical_timing_risk: "unknown",
    patient_expectation_risk: "unknown",
    documentation_gap_detected: false,
    review_topics: [],
    candidacy_summary: "",
    ai_notes: note,
  };
}
