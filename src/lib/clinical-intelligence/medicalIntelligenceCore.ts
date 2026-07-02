/**
 * Pure FI OS adapter for @hairlongevity/medical-intelligence-core.
 * Maps fi_pathology_result_items into shared marker payloads — no local clinical rules.
 */

import {
  interpretMarkers,
  buildClinicalInsights,
  buildLongevitySignals,
  getEligibility,
  possibleIronRisk,
  possibleThyroidRisk,
  type InterpretedMarker,
  type ClinicalInsights,
  type NormalizedLongevitySignal,
  type BloodRequestEligibilityResult,
  type LongevityQuestionnaireResponses,
  type TriageFlags,
} from "@hairlongevity/medical-intelligence-core";

import type { PathologyResultItemRow } from "@/src/lib/pathology/pathologyResultTypes";

export type MedicalIntelligenceMarkerInput = {
  marker_name: string;
  value: number;
  unit?: string | null;
  reference_low?: number | null;
  reference_high?: number | null;
};

export type FiPathologyMarkerMappingSkipReason =
  | "missing_label"
  | "non_numeric_value"
  | "empty_value";

export type FiPathologyMarkerMappingResult = {
  markerInputs: MedicalIntelligenceMarkerInput[];
  skipped: Array<{
    item: Pick<
      PathologyResultItemRow,
      "id" | "test_code" | "test_label" | "result_value" | "result_unit" | "reference_range" | "flag"
    >;
    reason: FiPathologyMarkerMappingSkipReason;
  }>;
};

export type FiClinicalInsightsInput = {
  pathologyItems: PathologyResultItemRow[];
  derivedFlags?: Partial<TriageFlags> | null;
  reviewOutcome?: string | null;
  bloodRequestStatus?: string | null;
  questionnaireResponses?: LongevityQuestionnaireResponses | null;
};

export type FiLongevitySignalsInput = {
  pathologyResultId: string;
  patientId?: string | null;
  pathologyItems: PathologyResultItemRow[];
  derivedFlags?: Partial<TriageFlags> | null;
  reviewOutcome?: string | null;
  bloodRequest?: {
    id?: string | null;
    status?: string | null;
    recommended_by?: string | null;
  } | null;
  clinicalInsights?: ClinicalInsights | null;
  hasBloodResultUploadDocument?: boolean;
};

export type FiBloodworkEligibilityInput = {
  questionnaireResponses?: LongevityQuestionnaireResponses | null;
  reviewOutcome?: string | null;
  /** When FI already stores reviewed pathology for the patient. */
  hasRecentPathologyOnFile?: boolean;
};

function parseReferenceRange(input?: string | null): { low: number | null; high: number | null } {
  const raw = input?.trim();
  if (!raw) return { low: null, high: null };
  const rangeMatch = raw.match(/(\d+\.?\d*)\s*[-–to]+\s*(\d+\.?\d*)/i);
  if (rangeMatch) {
    return {
      low: Number(rangeMatch[1]),
      high: Number(rangeMatch[2]),
    };
  }
  const inequalityMatch = raw.match(/([<>])\s*(\d+\.?\d*)/);
  if (inequalityMatch) {
    return inequalityMatch[1] === "<"
      ? { low: null, high: Number(inequalityMatch[2]) }
      : { low: Number(inequalityMatch[2]), high: null };
  }
  return { low: null, high: null };
}

function parseNumericResultValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([<>≤≥]?\s*)?([\d,.]+)/);
  if (!match?.[2]) return null;
  const n = Number(match[2].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function markerNameFromFiItem(item: PathologyResultItemRow): string | null {
  const label = item.test_label?.trim();
  if (label) return label;
  const code = item.test_code?.trim();
  return code || null;
}

/** Map fi_pathology_result_items rows into medical-intelligence-core marker inputs. */
export function mapFiPathologyItemsToMarkerInputs(
  items: PathologyResultItemRow[]
): FiPathologyMarkerMappingResult {
  const markerInputs: MedicalIntelligenceMarkerInput[] = [];
  const skipped: FiPathologyMarkerMappingResult["skipped"] = [];

  for (const item of items) {
    const marker_name = markerNameFromFiItem(item);
    if (!marker_name) {
      skipped.push({
        item: {
          id: item.id,
          test_code: item.test_code,
          test_label: item.test_label,
          result_value: item.result_value,
          result_unit: item.result_unit,
          reference_range: item.reference_range,
          flag: item.flag,
        },
        reason: "missing_label",
      });
      continue;
    }

    const value = parseNumericResultValue(item.result_value);
    if (value == null) {
      skipped.push({
        item: {
          id: item.id,
          test_code: item.test_code,
          test_label: item.test_label,
          result_value: item.result_value,
          result_unit: item.result_unit,
          reference_range: item.reference_range,
          flag: item.flag,
        },
        reason: item.result_value.trim() ? "non_numeric_value" : "empty_value",
      });
      continue;
    }

    const { low, high } = parseReferenceRange(item.reference_range);
    markerInputs.push({
      marker_name,
      value,
      unit: item.result_unit,
      reference_low: low,
      reference_high: high,
    });
  }

  return { markerInputs, skipped };
}

/** Interpret FI pathology markers via shared HLI medical intelligence (no FI-local rules). */
export function interpretFiPathologyMarkers(
  items: PathologyResultItemRow[]
): {
  interpreted: InterpretedMarker[];
  mapping: FiPathologyMarkerMappingResult;
} {
  const mapping = mapFiPathologyItemsToMarkerInputs(items);
  const interpreted = interpretMarkers(mapping.markerInputs);
  return { interpreted, mapping };
}

/** Build clinical insights from FI pathology markers using shared package logic only. */
export function buildFiClinicalInsights(input: FiClinicalInsightsInput): ClinicalInsights {
  const { interpreted } = interpretFiPathologyMarkers(input.pathologyItems);
  return buildClinicalInsights({
    derivedFlags: input.derivedFlags ?? null,
    interpretedMarkers: interpreted,
    review_outcome: input.reviewOutcome ?? null,
    bloodRequest: input.bloodRequestStatus ? { status: input.bloodRequestStatus } : null,
    questionnaireResponses: input.questionnaireResponses ?? null,
    workflow: {
      hasStructuredMarkers: interpreted.length > 0,
    },
  });
}

/** Build normalized longevity signals from FI marker context via shared package logic. */
export function buildFiLongevitySignals(input: FiLongevitySignalsInput): NormalizedLongevitySignal[] {
  const { interpreted } = interpretFiPathologyMarkers(input.pathologyItems);
  const clinicalInsights =
    input.clinicalInsights ??
    buildClinicalInsights({
      derivedFlags: input.derivedFlags ?? null,
      interpretedMarkers: interpreted,
      review_outcome: input.reviewOutcome ?? null,
      workflow: { hasStructuredMarkers: interpreted.length > 0 },
    });

  return buildLongevitySignals({
    profileId: input.patientId ?? null,
    intakeId: input.pathologyResultId,
    derivedFlags: input.derivedFlags ?? null,
    clinicalInsights,
    bloodRequest: input.bloodRequest ?? null,
    reviewOutcome: input.reviewOutcome ?? null,
    hasBloodResultUploadDocument: input.hasBloodResultUploadDocument ?? false,
    hasStructuredMarkers: interpreted.length > 0,
  });
}

function questionnaireForFiEligibility(input: FiBloodworkEligibilityInput): LongevityQuestionnaireResponses {
  const base = input.questionnaireResponses ?? {};
  if (!input.hasRecentPathologyOnFile) return base;
  return {
    ...base,
    medicalHistory: {
      ...base.medicalHistory,
      priorBloodTests: "last_3_months",
    },
  };
}

/** Bloodwork eligibility via shared HLI rules — FI supplies questionnaire bridge context only. */
export function getFiBloodworkEligibility(
  input: FiBloodworkEligibilityInput
): BloodRequestEligibilityResult | null {
  return getEligibility(
    questionnaireForFiEligibility(input),
    input.reviewOutcome ?? null
  );
}

/** Lightweight bridge helper for FI UI — surfaces which shared risk domains are active. */
export function summarizeFiBloodworkRiskDomains(
  questionnaireResponses: LongevityQuestionnaireResponses
): { iron: boolean; thyroid: boolean } {
  return {
    iron: possibleIronRisk(questionnaireResponses),
    thyroid: possibleThyroidRisk(questionnaireResponses),
  };
}
