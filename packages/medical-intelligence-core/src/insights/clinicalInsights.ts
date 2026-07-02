/**
 * Phase J: deterministic clinical insight engine.
 * Readable, auditable support logic only. No AI, no replacement of clinician judgment.
 */

import type { InterpretedMarker, InterpretationStatus } from "../biomarkers/bloodInterpretation";
import { getNormalisedMarkerKey } from "../biomarkers/bloodInterpretation";
import type { MarkerTrendRow } from "./bloodMarkerTrends";
import { getMarkerDefinition } from "../biomarkers/bloodMarkerRegistry";
import { REVIEW_OUTCOME } from "../constants/reviewOutcomes";
import type { TriageFlags } from "../types/triage";
import { getEndocrineReviewDomainsFromResponses } from "../eligibility/endocrineReviewDomains";
import type { LongevityQuestionnaireResponses } from "../types/questionnaire";

export type ClinicalInsights = {
  clinicianInsights: string[];
  patientSafeInsights: string[];
  activeDrivers: string[];
  improvedAreas: string[];
  followUpConsiderations: string[];
};

export type ClinicalInsightInput = {
  derivedFlags?: Partial<TriageFlags> | null;
  interpretedMarkers?: InterpretedMarker[] | null;
  markerTrends?: MarkerTrendRow[] | null;
  review_outcome?: string | null;
  bloodRequest?: { status: string | null } | null;
  questionnaireResponses?: LongevityQuestionnaireResponses | null;
  workflow?: {
    hasBloodResultUploadDocument?: boolean;
    hasStructuredMarkers?: boolean;
  } | null;
  longitudinalSignals?: {
    symptomChanges?: string[];
    scalpChanges?: string[];
    treatmentResponseChanges?: string[];
  } | null;
};

type TrendAssessment = "improved" | "worsened" | "stable" | null;

const LOW_STATUSES: InterpretationStatus[] = ["low", "critical"];
const HIGH_STATUSES: InterpretationStatus[] = ["high", "critical"];
const OUTSIDE_STATUSES: InterpretationStatus[] = ["low", "high", "critical"];

function pushUnique(target: string[], value: string) {
  if (!value) return;
  if (!target.includes(value)) target.push(value);
}

function markerMap(markers: InterpretedMarker[]): Map<string, InterpretedMarker> {
  const map = new Map<string, InterpretedMarker>();
  for (const marker of markers) {
    const key = getNormalisedMarkerKey(marker.marker);
    if (!map.has(key)) {
      map.set(key, marker);
    }
  }
  return map;
}

function hasStatus(
  markersByKey: Map<string, InterpretedMarker>,
  keys: string[],
  statuses: InterpretationStatus[]
): boolean {
  return keys.some((key) => {
    const marker = markersByKey.get(key);
    return !!marker && statuses.includes(marker.status);
  });
}

function getLabelsWithStatus(
  markersByKey: Map<string, InterpretedMarker>,
  keys: string[],
  statuses: InterpretationStatus[]
): string[] {
  return keys
    .map((key) => markersByKey.get(key))
    .filter((marker): marker is InterpretedMarker => !!marker && statuses.includes(marker.status))
    .map((marker) => marker.marker);
}

function distanceFromPreferredRange(key: string, value: number): number | null {
  const optimal = getMarkerDefinition(key)?.hairOptimal;
  if (!optimal) return null;
  if (value < optimal.optimalLow) return optimal.optimalLow - value;
  if (optimal.optimalHigh > 0 && value > optimal.optimalHigh) return value - optimal.optimalHigh;
  return 0;
}

function assessTrend(row: MarkerTrendRow): TrendAssessment {
  if (!row.previous) return null;

  const preferredDistanceNow = distanceFromPreferredRange(row.markerKey, row.current.value);
  const preferredDistancePrev = distanceFromPreferredRange(row.markerKey, row.previous.value);
  if (preferredDistanceNow != null && preferredDistancePrev != null) {
    if (preferredDistanceNow < preferredDistancePrev) return "improved";
    if (preferredDistanceNow > preferredDistancePrev) return "worsened";
    return "stable";
  }

  if (row.markerKey === "esr" || row.markerKey === "crp" || row.markerKey === "hba1c") {
    if (row.direction === "down") return "improved";
    if (row.direction === "up") return "worsened";
    return "stable";
  }

  return null;
}

function findTrend(markerTrends: MarkerTrendRow[], key: string): TrendAssessment {
  const row = markerTrends.find((item) => item.markerKey === key);
  return row ? assessTrend(row) : null;
}

export function buildClinicalInsights(input: ClinicalInsightInput): ClinicalInsights {
  const clinicianInsights: string[] = [];
  const patientSafeInsights: string[] = [];
  const activeDrivers: string[] = [];
  const improvedAreas: string[] = [];
  const followUpConsiderations: string[] = [];

  const markers = input.interpretedMarkers ?? [];
  const markerTrends = input.markerTrends ?? [];
  const flags = input.derivedFlags ?? {};
  const markersByKey = markerMap(markers);

  const ferritinLow = hasStatus(markersByKey, ["ferritin"], LOW_STATUSES);
  const ferritinTrend = findTrend(markerTrends, "ferritin");
  if (ferritinLow) {
    pushUnique(activeDrivers, "Iron / oxygen delivery");
    pushUnique(clinicianInsights, "Ferritin remains below the preferred range for hair growth support.");
    pushUnique(patientSafeInsights, "Iron stores may still be below the preferred range for hair health.");
  }
  if (ferritinTrend === "improved") pushUnique(improvedAreas, "Ferritin improved");
  if (ferritinTrend === "worsened") {
    pushUnique(followUpConsiderations, "Ferritin has moved further away from the preferred range.");
  }

  const nutritionLabels = getLabelsWithStatus(
    markersByKey,
    ["vitamin_d_25oh", "vitamin_b12", "folate", "zinc", "magnesium"],
    LOW_STATUSES
  );
  if (nutritionLabels.length > 0) {
    pushUnique(clinicianInsights, `Nutritional support markers remain suboptimal (${nutritionLabels.join(", ")}).`);
    pushUnique(patientSafeInsights, "Some nutrient-related markers may still be below the preferred range for hair health.");
    pushUnique(activeDrivers, "Nutritional / follicular support");
  }

  const tshOutside = hasStatus(markersByKey, ["tsh"], OUTSIDE_STATUSES);
  const tshTrend = findTrend(markerTrends, "tsh");
  const freeThyroidLabels = getLabelsWithStatus(markersByKey, ["free_t3", "free_t4"], OUTSIDE_STATUSES);
  const thyroidAntibodiesRaised = hasStatus(markersByKey, ["tpo_antibodies", "tg_antibodies"], HIGH_STATUSES);
  if (tshOutside || freeThyroidLabels.length > 0 || thyroidAntibodiesRaised) {
    pushUnique(activeDrivers, "Thyroid");
  }
  if (tshOutside) {
    pushUnique(clinicianInsights, "TSH remains outside the preferred range for hair health.");
    pushUnique(patientSafeInsights, "Thyroid-related markers may still benefit from follow-up.");
  }
  if (freeThyroidLabels.length > 0) {
    pushUnique(clinicianInsights, `Supporting thyroid markers remain suboptimal (${freeThyroidLabels.join(", ")}).`);
  }
  if (thyroidAntibodiesRaised) {
    pushUnique(clinicianInsights, "Thyroid autoimmunity markers may be contributing to the overall picture.");
    pushUnique(patientSafeInsights, "Some thyroid-related immune markers may still benefit from follow-up.");
  }
  if (tshTrend === "improved") pushUnique(improvedAreas, "TSH moved closer to the preferred range");
  if (tshTrend === "worsened") {
    pushUnique(followUpConsiderations, "TSH has moved further away from the preferred range.");
  }

  const inflammatoryRaised = hasStatus(markersByKey, ["crp", "esr"], HIGH_STATUSES);
  const metabolicRaised = hasStatus(markersByKey, ["hba1c", "fasting_glucose", "fasting_insulin"], HIGH_STATUSES);
  if (inflammatoryRaised || metabolicRaised) {
    pushUnique(activeDrivers, "Inflammation / metabolic stress");
    pushUnique(clinicianInsights, "Inflammatory or metabolic markers may be contributing to hair health stress.");
    pushUnique(patientSafeInsights, "Some metabolic or inflammation-related markers may benefit from follow-up.");
  }
  if (findTrend(markerTrends, "crp") === "improved" || findTrend(markerTrends, "esr") === "improved") {
    pushUnique(improvedAreas, "Inflammatory markers improved");
  }
  if (findTrend(markerTrends, "hba1c") === "improved") {
    pushUnique(improvedAreas, "HbA1c improved");
  }

  const androgenSignals = [
    hasStatus(markersByKey, ["total_testosterone"], HIGH_STATUSES),
    hasStatus(markersByKey, ["free_testosterone"], HIGH_STATUSES),
    hasStatus(markersByKey, ["shbg"], LOW_STATUSES),
    hasStatus(markersByKey, ["dheas"], HIGH_STATUSES),
    hasStatus(markersByKey, ["androstenedione"], HIGH_STATUSES),
  ].filter(Boolean).length;
  const prolactinRaised = hasStatus(markersByKey, ["prolactin"], HIGH_STATUSES);
  const cycleHormonesOutside = hasStatus(markersByKey, ["lh", "fsh", "estradiol", "progesterone"], OUTSIDE_STATUSES);
  const endocrineDomains = getEndocrineReviewDomainsFromResponses(
    input.questionnaireResponses
  );
  const hasFemaleEndocrineReview =
    endocrineDomains.includes("female_endocrine_review") || cycleHormonesOutside;
  const hasAndrogenAdrenalReview =
    endocrineDomains.includes("androgen_adrenal_review") ||
    androgenSignals >= 2 ||
    flags.possibleAndrogenPattern;
  const hasThyroidIronNutritionReview =
    endocrineDomains.includes("thyroid_iron_nutrition_review");
  const hasStressTriggerOverlapReview =
    endocrineDomains.includes("stress_trigger_overlap_review");
  const hasPituitaryProlactinFollowup =
    endocrineDomains.includes("pituitary_prolactin_followup") || prolactinRaised;

  if (hasFemaleEndocrineReview) {
    pushUnique(activeDrivers, "Female endocrine review");
    pushUnique(
      clinicianInsights,
      "Female endocrine-context follow-up may help interpret the current hair-loss pattern."
    );
    pushUnique(
      patientSafeInsights,
      "Some hormone-related history details may be worth reviewing alongside your hair changes."
    );
  }
  if (hasAndrogenAdrenalReview) {
    pushUnique(activeDrivers, "Androgen / adrenal-androgen review");
    pushUnique(
      clinicianInsights,
      "Androgen or adrenal-androgen contributors may warrant more specific follow-up."
    );
    pushUnique(
      patientSafeInsights,
      "Some androgen-sensitive features may be worth reviewing alongside your hair pattern."
    );
  }
  if (hasThyroidIronNutritionReview) {
    pushUnique(followUpConsiderations, "Review thyroid, iron, and nutritional overlap alongside endocrine context.");
  }
  if (hasStressTriggerOverlapReview) {
    pushUnique(activeDrivers, "Stress-trigger / delayed-shedding overlap review");
    pushUnique(
      clinicianInsights,
      "Trigger-related shedding overlap may still need to be separated from endocrine-pattern contributors."
    );
    pushUnique(
      patientSafeInsights,
      "A trigger-related shedding pattern may overlap with other contributors and may benefit from review."
    );
  }
  if (hasPituitaryProlactinFollowup) {
    pushUnique(activeDrivers, "Pituitary / prolactin follow-up review");
    pushUnique(
      clinicianInsights,
      "Specific endocrine follow-up may be warranted rather than treating this as routine shedding alone."
    );
    pushUnique(
      patientSafeInsights,
      "A few answers suggest more direct clinician follow-up would be sensible."
    );
  }
  if (
    !hasFemaleEndocrineReview &&
    !hasAndrogenAdrenalReview &&
    !hasPituitaryProlactinFollowup &&
    flags.possibleHormonalPattern
  ) {
    pushUnique(activeDrivers, "Hormonal / androgen-related");
    pushUnique(clinicianInsights, "Hormonal / androgen-related drivers may still be active.");
    pushUnique(patientSafeInsights, "Hormonal factors may still be influencing your hair health.");
  }

  const proteinSupportSuboptimal = hasStatus(markersByKey, ["albumin", "globulin", "total_protein"], OUTSIDE_STATUSES);
  if (proteinSupportSuboptimal) {
    pushUnique(activeDrivers, "Protein / systemic support");
    pushUnique(clinicianInsights, "Protein or broader systemic support markers may be suboptimal.");
    pushUnique(patientSafeInsights, "Some broader nutrition or systemic support markers may benefit from follow-up.");
  }

  if (flags.possibleStressTrigger) pushUnique(activeDrivers, "Stress / trigger-related");
  if (flags.postpartumFlag) pushUnique(activeDrivers, "Postpartum context");

  const hasStructuredMarkers = input.workflow?.hasStructuredMarkers ?? markers.length > 0;
  const hasBloodResultUploadDocument = input.workflow?.hasBloodResultUploadDocument ?? false;
  if (input.review_outcome === REVIEW_OUTCOME.BLOODS_RECOMMENDED && !hasStructuredMarkers) {
    pushUnique(clinicianInsights, "Structured blood result review is still pending.");
  }
  if ((hasBloodResultUploadDocument || input.bloodRequest?.status === "results_uploaded") && !hasStructuredMarkers) {
    pushUnique(clinicianInsights, "Blood results document has been uploaded but structured marker entry is incomplete.");
  }
  if (markerTrends.length === 0 && flags.bloodsLikelyNeeded && markers.length === 0) {
    pushUnique(followUpConsiderations, "Structured blood work may still help clarify likely drivers.");
  }
  if (markers.length > 0 && activeDrivers.length === 0 && !markers.some((m) => OUTSIDE_STATUSES.includes(m.status))) {
    pushUnique(clinicianInsights, "Current structured blood markers are broadly reassuring within the available ranges.");
    pushUnique(patientSafeInsights, "Several tracked blood results are currently within expected ranges.");
  }
  if (markerTrends.some((row) => row.previous) && improvedAreas.length === 0 && activeDrivers.length > 0) {
    pushUnique(followUpConsiderations, "Key markers remain active without a clear interval improvement pattern.");
  }

  for (const item of input.longitudinalSignals?.scalpChanges ?? []) {
    pushUnique(clinicianInsights, item);
    const lower = item.toLowerCase();
    if (
      lower.includes("limited by image quality") ||
      lower.includes("follow-up") ||
      lower.includes("repeat scalp photos")
    ) {
      pushUnique(followUpConsiderations, item);
    }
  }

  for (const item of input.longitudinalSignals?.treatmentResponseChanges ?? []) {
    pushUnique(clinicianInsights, item);
  }

  return {
    clinicianInsights,
    patientSafeInsights,
    activeDrivers,
    improvedAreas,
    followUpConsiderations,
  };
}

export const generateClinicalInsights = buildClinicalInsights;
