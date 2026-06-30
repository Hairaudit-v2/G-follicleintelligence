import type { ConsultationChecklistModelResult } from "./types";

export type ConsultationChecklistFallbackReason =
  | "no_api_key"
  | "openai_unavailable"
  | "parse_error"
  | "no_patient_context";

export function consultationChecklistFallbackResult(
  reason: ConsultationChecklistFallbackReason
): ConsultationChecklistModelResult {
  const notesByReason: Record<ConsultationChecklistFallbackReason, string> = {
    no_api_key:
      "OpenAI is not configured (missing OPENAI_API_KEY). Checklist generation unavailable; clinician may prepare topics manually.",
    openai_unavailable:
      "Checklist model call failed or OpenAI was unreachable. No automated topics were generated.",
    parse_error:
      "Model output could not be validated. No checklist items were stored from this run.",
    no_patient_context: "Tenant and patient context are required to assemble intelligence inputs.",
  };
  return {
    confidence_score: 0,
    priority_level: "low",
    medication_discussion_required: false,
    stabilisation_discussion_required: false,
    donor_preservation_discussion_required: false,
    expectation_management_required: false,
    consent_complexity_level: null,
    documentation_required: false,
    follow_up_required: false,
    delay_recommended: false,
    checklist_items: [],
    risk_flags: [],
    consultation_summary: "",
    ai_notes: notesByReason[reason],
  };
}
