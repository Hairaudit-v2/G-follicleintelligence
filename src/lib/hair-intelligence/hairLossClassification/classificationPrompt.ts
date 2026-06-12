/**
 * Single shared user prompt for OpenAI vision hair loss pattern analysis.
 * System message (in OpenAI caller) sets safety / JSON-only behaviour.
 */
export function buildHairLossClassificationUserPrompt(): string {
  return [
    "You analyse clinical scalp photographs for hair restoration triage (photography / pattern description only).",
    "You are not diagnosing disease; describe visible hair density patterns conservatively.",
    "",
    "Determine:",
    "- sex_classification: male | female | unknown (visual presentation / framing cues; use unknown if unclear).",
    "- classification_system: norwood | ludwig | sinclair | olsen | custom (pick the single best-known scale match; use custom if none fit).",
    "- classification_grade: must match the chosen system:",
    "  * norwood: I | II | III | III Vertex | IV | V | VI | VII | unknown",
    "  * ludwig: I | II | III | unknown",
    "  * sinclair: I | II | III | IV | V | unknown",
    "  * olsen: mild | moderate | severe | unknown",
    "  * custom: short free-text label (max 32 chars) or unknown",
    "- pattern_type: one of:",
    "  male_pattern_baldness | diffuse_male_pattern | retrograde_alopecia |",
    "  female_pattern_loss | diffuse_female_thinning | traction_pattern | frontal_fibrosing_pattern | unknown",
    "- confidence_score: number 0..1 for overall grading confidence.",
    "Severity scores (integers 0..10 each, 0 = none / not visible, 10 = most severe visible in frame):",
    "- frontal_loss_score",
    "- temporal_recession_score",
    "- mid_scalp_score",
    "- crown_loss_score",
    "- diffuse_thinning_score",
    "- retrograde_pattern_detected: boolean (lower occipital / reverse male pattern thinning cue).",
    "- suspected_scarring_pattern: boolean (only if features suggest scarring alopecia; otherwise false).",
    "- notes: concise clinical observation string (max 400 chars), no patient identifiers.",
    "",
    "Output strict JSON only with keys:",
    "sex_classification, classification_system, classification_grade, pattern_type, confidence_score,",
    "frontal_loss_score, temporal_recession_score, mid_scalp_score, crown_loss_score, diffuse_thinning_score,",
    "retrograde_pattern_detected, suspected_scarring_pattern, notes",
    "",
    "Example shape:",
    '{"sex_classification":"male","classification_system":"norwood","classification_grade":"V","pattern_type":"male_pattern_baldness","confidence_score":0.91,"frontal_loss_score":8,"temporal_recession_score":7,"mid_scalp_score":5,"crown_loss_score":6,"diffuse_thinning_score":3,"retrograde_pattern_detected":false,"suspected_scarring_pattern":false,"notes":"Moderate frontal recession with crown involvement"}',
  ].join("\n");
}
