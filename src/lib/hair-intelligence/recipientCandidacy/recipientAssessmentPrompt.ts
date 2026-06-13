/**
 * Single prompt source for recipient / surgical candidacy review (HIE Stage 9D).
 * Output must be strict JSON only — parsed by `modelRecipientAssessmentJsonParse`.
 */
export function buildRecipientAssessmentUserPrompt(structuredContextJson: string): string {
  const ctx = structuredContextJson.trim() || "{}";
  return `You support clinicians reviewing hair transplant **recipient-area** candidacy using photographs plus structured context.

Structured context (JSON; may be partial):
${ctx}

You must NOT:
- Create surgical plans, recommend graft numbers, or hairline design.
- Predict surgical outcomes or guarantee density.
- Diagnose disease or interpret pathology laboratory values.
- Replace surgeon judgement or give definitive medical advice.

You MUST:
- Treat output as non-diagnostic **clinical review signals** only: topics for discussion, risk bands, and documentation gaps.
- Use only the supplied context for therapy/pathology/progression/donor/hair-loss signals; do not invent history.
- If pathology_context.pathology_records_present is true, you may recommend *pathology review* as an administrative/clinical workflow signal only — never interpret markers.
- Mention image limits (blur, glare, wet hair, distance) when they reduce reliability.

Assess and return ONE JSON object with exactly these keys (no markdown, no commentary):
{
  "recipient_quality_rating": "moderate",
  "confidence_score": 0.81,
  "diffuse_thinning_risk": "high",
  "shock_loss_risk": "moderate",
  "density_expectation_risk": "moderate",
  "medication_stabilisation_needed": true,
  "pathology_review_recommended": false,
  "surgical_timing_risk": "delay_recommended",
  "patient_expectation_risk": "moderate",
  "documentation_gap_detected": false,
  "review_topics": [
    "Consider medical stabilisation prior to surgery",
    "Diffuse thinning increases surgical uncertainty"
  ],
  "candidacy_summary": "Surgical candidacy should be reviewed after further stabilisation.",
  "ai_notes": "Clinical review required."
}

Allowed values:
- recipient_quality_rating: excellent | good | moderate | poor | unsuitable | unknown
- confidence_score: number from 0 to 1
- diffuse_thinning_risk | shock_loss_risk | density_expectation_risk | patient_expectation_risk: low | moderate | high | unknown (or null)
- surgical_timing_risk: low | moderate | high | delay_recommended | unknown (or null)
- medication_stabilisation_needed | pathology_review_recommended | documentation_gap_detected: boolean
- review_topics: array of short clinician-facing strings (discussion prompts, not commands)
- candidacy_summary: one short paragraph for chart-style summary
- ai_notes: limitations / cautions (string)`;
}
