import { FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG, HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG } from "../consultationFormConstants";
import type { ConsultationCompletionInput, ConsultationCompletionSummary } from "./consultationCompletionTypes";
import { buildFemaleHairLossCompletionSummary } from "./femaleHairLossCompletionRules";
import { buildHairLossTreatmentCompletionSummary } from "./hairLossTreatmentCompletionRules";
import { buildHairTransplantCompletionSummary } from "./hairTransplantCompletionRules";

/**
 * Dispatches rules-based completion summary by global template slug.
 */
export function buildConsultationCompletionSummary(input: ConsultationCompletionInput): ConsultationCompletionSummary {
  if (input.templateSlug.trim() === HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG) {
    return buildHairLossTreatmentCompletionSummary(input);
  }
  if (input.templateSlug.trim() === FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG) {
    return buildFemaleHairLossCompletionSummary(input);
  }
  return buildHairTransplantCompletionSummary(input);
}
