import type { HairLossClassificationModelResult } from "./types";

export function hairLossClassificationNotConfiguredResult(): HairLossClassificationModelResult {
  return {
    sex_classification: "unknown",
    classification_system: "custom",
    classification_grade: "unknown",
    pattern_type: "unknown",
    confidence_score: 0,
    frontal_loss_score: null,
    temporal_recession_score: null,
    mid_scalp_score: null,
    crown_loss_score: null,
    diffuse_thinning_score: null,
    retrograde_pattern_detected: false,
    suspected_scarring_pattern: false,
    notes: "Hair loss classifier unavailable (OPENAI_API_KEY missing).",
  };
}
