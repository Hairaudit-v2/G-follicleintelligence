/**
 * Derived flags for longevity decisioning (e.g. blood work, review).
 * No GP letter generation in this module; flags only.
 */

import type { LongevityQuestionnaireResponses } from "../types/questionnaire";

function has(arr: string[] | undefined, ...keys: string[]): boolean {
  if (!arr) return false;
  return keys.some((k) => arr.includes(k));
}

function adaptiveYes(
  r: LongevityQuestionnaireResponses,
  key: string
): boolean {
  const answers = r.adaptiveEngine?.answers;
  const adaptiveAnswers = r.adaptiveEngine?.adaptive_answers;
  return answers?.[key] === "yes" || adaptiveAnswers?.[key] === "yes";
}

/** Possible iron-related risk (diet, history, symptoms, pattern). */
export function possibleIronRisk(r: LongevityQuestionnaireResponses): boolean {
  const m = r.medicalHistory;
  const mc = r.mainConcern;
  const f = r.femaleHistory;
  const l = r.lifestyleTreatments;
  if (has(m?.diagnoses, "iron_deficiency", "low_ferritin", "anaemia")) return true;
  if (has(f?.features, "heavy_periods")) return true;
  if (has(l?.dietPattern, "vegetarian", "vegan")) return true;
  if (has(m?.currentSymptoms, "fatigue")) return true;
  if (has(mc?.primaryConcerns, "diffuse_thinning", "increased_shedding")) return true;
  return false;
}

/** Possible thyroid-related risk. */
export function possibleThyroidRisk(r: LongevityQuestionnaireResponses): boolean {
  const m = r.medicalHistory;
  const mc = r.mainConcern;
  if (has(m?.diagnoses, "thyroid_disorder")) return true;
  if (has(m?.familyHistory, "thyroid_disease")) return true;
  if (has(m?.currentSymptoms, "cold_intolerance", "fatigue")) return true;
  if (has(mc?.primaryConcerns, "diffuse_thinning", "eyebrow_thinning")) return true;
  return false;
}

/** Possible hormonal pattern (female-specific). */
export function possibleHormonalPattern(r: LongevityQuestionnaireResponses): boolean {
  const f = r.femaleHistory;
  const m = r.medicalHistory;
  if (!f && !m) return false;
  if (f?.cycles === "irregular") return true;
  if (f?.cycles === "not_occurring") return true;
  if (f?.cycleChangeAroundHairChange === "yes") return true;
  if (has(m?.diagnoses, "pcos", "endometriosis")) return true;
  if (
    has(
      f?.features,
      "acne",
      "increased_facial_or_body_hair",
      "fertility_issues",
      "missed_periods"
    )
  ) {
    return true;
  }
  if (f?.newWorseningHyperandrogenFeatures === "yes") return true;
  if (has(f?.lifeStage, "postpartum", "perimenopausal", "menopausal", "hormonal_contraception", "hrt")) return true;
  if (adaptiveYes(r, "female_hormonal_context")) return true;
  if (adaptiveYes(r, "pituitary_red_flag_followup")) return true;
  if (adaptiveYes(r, "hormonal_contraception_change_gate")) return true;
  return false;
}

/** Possible inflammatory pattern (scalp/skin). */
export function possibleInflammatoryPattern(r: LongevityQuestionnaireResponses): boolean {
  const mc = r.mainConcern;
  if (has(mc?.primaryConcerns, "scalp_irritation_or_inflammation")) return true;
  if (has(mc?.symptoms, "itch", "burning", "tenderness", "flaking")) return true;
  if (has(r.medicalHistory?.diagnoses, "scalp_psoriasis", "seborrhoeic_dermatitis", "eczema", "autoimmune_condition")) return true;
  return false;
}

/** Possible androgen-related pattern (distribution + family + onset). */
export function possibleAndrogenPattern(r: LongevityQuestionnaireResponses): boolean {
  const mc = r.mainConcern;
  const m = r.medicalHistory;
  if (!mc?.primaryConcerns?.length) return false;
  const patternAreas = ["frontal_hairline_recession", "temple_recession", "crown_thinning", "widening_part"];
  const hasPattern = patternAreas.some((a) => mc.primaryConcerns?.includes(a));
  const hasFamily = has(m?.familyHistory, "male_pattern_hair_loss", "female_pattern_thinning");
  const gradual = mc.onsetPattern === "gradual";
  return !!(hasPattern && (hasFamily || gradual));
}

/** Possible stress/trigger-driven shedding. */
export function possibleStressTrigger(r: LongevityQuestionnaireResponses): boolean {
  const t = r.timelineTriggers;
  if (has(t?.triggers, "major_stress", "recent_illness_or_infection", "fever", "surgery_or_anaesthetic", "childbirth_postpartum", "rapid_weight_loss", "new_medication", "stopping_medication")) return true;
  if (has(t?.pastYearEvents, "covid_or_major_viral_illness", "hospital_admission", "significant_emotional_stress", "crash_dieting")) return true;
  return false;
}

/** Postpartum flag. */
export function postpartumFlag(r: LongevityQuestionnaireResponses): boolean {
  if (has(r.timelineTriggers?.triggers, "childbirth_postpartum")) return true;
  if (has(r.femaleHistory?.lifeStage, "postpartum")) return true;
  return false;
}

/** Blood work likely needed (no recent bloods or unsure, and at least one risk flag). */
export function bloodsLikelyNeeded(r: LongevityQuestionnaireResponses): boolean {
  const prior = r.medicalHistory?.priorBloodTests;
  if (prior === "last_3_months") return false;
  const hasRisk =
    possibleIronRisk(r) ||
    possibleThyroidRisk(r) ||
    possibleHormonalPattern(r) ||
    possibleAndrogenPattern(r) ||
    possibleStressTrigger(r);
  return !!hasRisk;
}

/** Manual review recommended (atypical or complex presentation). */
export function manualReviewRecommended(r: LongevityQuestionnaireResponses): boolean {
  const mc = r.mainConcern;
  if (has(mc?.primaryConcerns, "patchy_hair_loss")) return true;
  if (has(mc?.symptoms, "burning", "tenderness")) return true;
  if (has(r.medicalHistory?.diagnoses, "autoimmune_condition")) return true;
  const riskCount = [
    possibleIronRisk(r),
    possibleThyroidRisk(r),
    possibleHormonalPattern(r),
    possibleInflammatoryPattern(r),
    possibleAndrogenPattern(r),
    possibleStressTrigger(r),
  ].filter(Boolean).length;
  if (riskCount >= 3) return true;
  return false;
}

/** Legacy: recent pathology (v1 priorBloodTests). */
export function hasRecentPathology(r: LongevityQuestionnaireResponses): boolean {
  return r.medicalHistory?.priorBloodTests === "last_3_months";
}

/** Legacy: may need blood request (for future letter flow). */
export function needsBloodLetter(r: LongevityQuestionnaireResponses): boolean {
  return !hasRecentPathology(r) && bloodsLikelyNeeded(r);
}
