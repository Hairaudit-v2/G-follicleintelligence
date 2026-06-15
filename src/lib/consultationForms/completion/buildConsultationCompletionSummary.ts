import { HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import type { ConsultationCompletionInput, ConsultationCompletionSummary } from "./consultationCompletionTypes";
import { buildHairLossTreatmentCompletionSummary } from "./hairLossTreatmentCompletionRules";
import { buildHairTransplantCompletionSummary } from "./hairTransplantCompletionRules";

/**
 * Dispatches rules-based completion summary by global template slug.
 */
export function buildConsultationCompletionSummary(input: ConsultationCompletionInput): ConsultationCompletionSummary {
  if (input.templateSlug.trim() === HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG) {
    return buildHairLossTreatmentCompletionSummary(input);
  }
  return buildHairTransplantCompletionSummary(input);
}
