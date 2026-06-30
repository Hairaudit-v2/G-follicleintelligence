import {
  FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
  FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG,
  HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG,
  SCALP_PATHOLOGY_CONSULTATION_TEMPLATE_SLUG,
} from "../consultationFormConstants";
import type {
  ConsultationCompletionInput,
  ConsultationCompletionSummary,
} from "./consultationCompletionTypes";
import { buildFemaleHairLossCompletionSummary } from "./femaleHairLossCompletionRules";
import { buildFollowUpReviewCompletionSummary } from "./followUpReviewCompletionRules";
import { buildHairLossTreatmentCompletionSummary } from "./hairLossTreatmentCompletionRules";
import { buildHairTransplantRepairCompletionSummary } from "./hairTransplantRepairCompletionRules";
import { buildHairTransplantCompletionSummary } from "./hairTransplantCompletionRules";
import { buildScalpPathologyCompletionSummary } from "./scalpPathologyCompletionRules";

/**
 * Dispatches rules-based completion summary by global template slug.
 */
export function buildConsultationCompletionSummary(
  input: ConsultationCompletionInput
): ConsultationCompletionSummary {
  if (input.templateSlug.trim() === HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG) {
    return buildHairLossTreatmentCompletionSummary(input);
  }
  if (input.templateSlug.trim() === FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG) {
    return buildFemaleHairLossCompletionSummary(input);
  }
  if (input.templateSlug.trim() === HAIR_TRANSPLANT_REPAIR_CONSULTATION_TEMPLATE_SLUG) {
    return buildHairTransplantRepairCompletionSummary(input);
  }
  if (input.templateSlug.trim() === FOLLOW_UP_REVIEW_CONSULTATION_TEMPLATE_SLUG) {
    return buildFollowUpReviewCompletionSummary(input);
  }
  if (input.templateSlug.trim() === SCALP_PATHOLOGY_CONSULTATION_TEMPLATE_SLUG) {
    return buildScalpPathologyCompletionSummary(input);
  }
  return buildHairTransplantCompletionSummary(input);
}
