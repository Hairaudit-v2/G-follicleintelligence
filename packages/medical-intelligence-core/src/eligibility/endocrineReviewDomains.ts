import type {
  AdaptiveDerivedSummary,
  LongevityQuestionnaireResponses,
} from "../types/questionnaire";
import {
  possibleIronRisk,
  possibleStressTrigger,
  possibleThyroidRisk,
} from "./derivedFlags";

export type EndocrineReviewDomain =
  | "female_endocrine_review"
  | "androgen_adrenal_review"
  | "thyroid_iron_nutrition_review"
  | "stress_trigger_overlap_review"
  | "pituitary_prolactin_followup";

function has(arr: string[] | undefined, ...keys: string[]): boolean {
  if (!arr?.length) return false;
  return keys.some((key) => arr.includes(key));
}

function isYes(value: unknown): boolean {
  return value === true || value === "yes";
}

function uniq<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function hasSupportingHirsutismSignal(adaptiveAnswers: RawAdaptiveAnswers): boolean {
  const severity = adaptiveAnswers.hirsutism_severity;
  const structuredRegions = asStringArray(adaptiveAnswers.hirsutism_structured_regions).filter(
    (value) => value !== "none"
  );
  return (
    severity === "moderate" ||
    severity === "marked" ||
    structuredRegions.length >= 2
  );
}

type RawAdaptiveAnswers = Record<string, string | string[] | boolean | null | undefined>;

function getRawAdaptiveAnswers(
  responses: LongevityQuestionnaireResponses
): RawAdaptiveAnswers {
  const answers = responses.adaptiveEngine?.answers;
  const adaptiveAnswers = responses.adaptiveEngine?.adaptive_answers;
  return {
    ...(answers && typeof answers === "object" ? answers : {}),
    ...(adaptiveAnswers && typeof adaptiveAnswers === "object" ? adaptiveAnswers : {}),
  } as RawAdaptiveAnswers;
}

export function getEndocrineReviewDomainsFromResponses(
  responses: LongevityQuestionnaireResponses | null | undefined
): EndocrineReviewDomain[] {
  if (!responses) return [];

  const femaleHistory = responses.femaleHistory;
  const medicalHistory = responses.medicalHistory;
  const timeline = responses.timelineTriggers;
  const lifestyle = responses.lifestyleTreatments;
  const adaptiveAnswers = getRawAdaptiveAnswers(responses);
  const domains: EndocrineReviewDomain[] = [];
  const supportingHirsutismSignal = hasSupportingHirsutismSignal(adaptiveAnswers);

  const femaleEndocrineContext =
    responses.aboutYou?.sexAtBirth === "female" &&
    (femaleHistory?.cycles === "irregular" ||
      femaleHistory?.cycles === "not_occurring" ||
      femaleHistory?.cycleChangeAroundHairChange === "yes" ||
      has(
        femaleHistory?.lifeStage,
        "postpartum",
        "perimenopausal",
        "menopausal",
        "hormonal_contraception",
        "hrt"
      ) ||
      has(medicalHistory?.diagnoses, "pcos", "endometriosis") ||
      isYes(adaptiveAnswers.female_hormonal_context) ||
      (supportingHirsutismSignal && has(medicalHistory?.diagnoses, "pcos")) ||
      adaptiveAnswers.hormonal_contraception_change_gate === "yes");

  const androgenAdrenalContext =
    has(
      femaleHistory?.features,
      "acne",
      "increased_facial_or_body_hair",
      "fertility_issues",
      "missed_periods"
    ) ||
    femaleHistory?.newWorseningHyperandrogenFeatures === "yes" ||
    has(medicalHistory?.diagnoses, "pcos") ||
    isYes(adaptiveAnswers.unwanted_facial_hair) ||
    isYes(adaptiveAnswers.increased_body_hair) ||
    isYes(adaptiveAnswers.jawline_acne_or_oily_skin) ||
    (supportingHirsutismSignal &&
      (isYes(adaptiveAnswers.unwanted_facial_hair) ||
        isYes(adaptiveAnswers.increased_body_hair) ||
        has(medicalHistory?.diagnoses, "pcos")));

  const thyroidIronNutritionContext =
    possibleThyroidRisk(responses) ||
    possibleIronRisk(responses) ||
    has(medicalHistory?.diagnoses, "vitamin_d_deficiency") ||
    lifestyle?.enoughProtein === "no" ||
    has(lifestyle?.dietPattern, "vegetarian", "vegan", "restrictive_dieting");

  const stressTriggerOverlap =
    possibleStressTrigger(responses) &&
    (femaleEndocrineContext ||
      adaptiveAnswers.stress_shedding_delay_pattern === "yes" ||
      has(
        timeline?.triggers,
        "childbirth_postpartum",
        "starting_contraception",
        "stopping_contraception",
        "menopause_perimenopause"
      ));

  const pituitaryProlactinFollowup =
    adaptiveAnswers.pituitary_red_flag_followup === "yes" ||
    ((femaleHistory?.cycles === "not_occurring" ||
      has(femaleHistory?.features, "missed_periods")) &&
      femaleHistory?.cycleChangeAroundHairChange === "yes");

  if (femaleEndocrineContext) domains.push("female_endocrine_review");
  if (androgenAdrenalContext) domains.push("androgen_adrenal_review");
  if (thyroidIronNutritionContext && (femaleEndocrineContext || stressTriggerOverlap)) {
    domains.push("thyroid_iron_nutrition_review");
  }
  if (stressTriggerOverlap) domains.push("stress_trigger_overlap_review");
  if (pituitaryProlactinFollowup) {
    domains.push("pituitary_prolactin_followup");
  }

  return uniq(domains);
}

export function getEndocrineReviewDomainsFromTriage(
  triage: AdaptiveDerivedSummary | null | undefined
): EndocrineReviewDomain[] {
  if (!triage) return [];

  const primary = typeof triage.primary_pathway === "string" ? triage.primary_pathway : "";
  const secondary = asStringArray(triage.secondary_pathways);
  const drivers = asStringArray(triage.possible_drivers);
  const flags = asStringArray(triage.clinician_attention_flags);
  const considerations = asStringArray(triage.bloodwork_considerations);
  const hasPathway = (pathway: string) => primary === pathway || secondary.includes(pathway);
  const domains: EndocrineReviewDomain[] = [];

  if (
    hasPathway("female_hormonal_pattern") ||
    drivers.includes("female_endocrine_context") ||
    drivers.includes("cycle_irregularity") ||
    (drivers.includes("hirsutism_supporting_signal") &&
      (drivers.includes("female_endocrine_context") ||
        drivers.includes("cycle_irregularity") ||
        flags.includes("possible_pcos_signal")))
  ) {
    domains.push("female_endocrine_review");
  }

  if (
    flags.includes("possible_pcos_signal") ||
    drivers.includes("hyperandrogen_features") ||
    (drivers.includes("hirsutism_supporting_signal") &&
      (drivers.includes("hyperandrogen_features") ||
        flags.includes("possible_pcos_signal"))) ||
    considerations.includes("androgen_hormone_review_if_clinically_appropriate")
  ) {
    domains.push("androgen_adrenal_review");
  }

  if (
    hasPathway("thyroid_metabolic_pattern") ||
    hasPathway("nutritional_deficiency_pattern") ||
    flags.includes("heavy_period_related_iron_risk") ||
    considerations.some((item) =>
      ["iron_studies", "thyroid_panel", "vitamin_d", "b12_folate"].includes(item)
    )
  ) {
    domains.push("thyroid_iron_nutrition_review");
  }

  if (
    hasPathway("postpartum_pattern") ||
    hasPathway("telogen_effluvium_acute") ||
    hasPathway("telogen_effluvium_chronic") ||
    drivers.includes("stress_trigger_delay_overlap") ||
    (drivers.includes("recent_trigger_burden") &&
      (hasPathway("female_hormonal_pattern") || hasPathway("postpartum_pattern")))
  ) {
    domains.push("stress_trigger_overlap_review");
  }

  if (drivers.includes("pituitary_followup_prompt")) {
    domains.push("pituitary_prolactin_followup");
  }

  return uniq(domains);
}
