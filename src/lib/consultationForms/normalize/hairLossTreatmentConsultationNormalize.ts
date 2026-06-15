/**
 * Normalization helpers for Hair Loss Treatment / HLI consultation (pathway 2).
 */

import { getClinicalNoteText } from "../consultationFormNoteModel";
import { mergeUniqueStrings, readString, readStringArray } from "../completion/consultationCompletionExtractors";

export function canonicalHliRiskFlagValues(values: Record<string, unknown>): string[] {
  return mergeUniqueStrings(
    readStringArray(values.medical_flags),
    readStringArray(values.hormonal_flags),
    readStringArray(values.stress_sleep_flags),
    readStringArray(values.nutrition_flags)
  );
}

export function canonicalHliRecommendedTreatments(values: Record<string, unknown>): string[] {
  return readStringArray(values.recommended_treatments);
}

export function canonicalHliDiagnosisBody(values: Record<string, unknown>): string {
  return getClinicalNoteText(values.structured_clinical_note).trim();
}

export function canonicalHliPatternClassificationLines(values: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const pt = readString(values.pattern_type).trim();
  if (pt) lines.push(`Pattern: ${pt.replace(/_/g, " ")}.`);

  const nw = readString(values.norwood_classification).trim();
  if (nw) lines.push(`Norwood: ${nw}.`);

  const lw = readString(values.ludwig_classification).trim();
  if (lw) lines.push(`Ludwig: ${lw}.`);

  const sn = readString(values.sinclair_classification).trim();
  if (sn) lines.push(`Sinclair: ${sn}.`);

  const mini = readString(values.miniaturisation_clinical).trim();
  if (mini) lines.push(`Miniaturisation (clinical): ${mini}.`);

  const cal = readString(values.hair_calibre).trim();
  if (cal) lines.push(`Calibre: ${cal}.`);

  const sc = readString(values.scalp_condition).trim();
  if (sc) lines.push(`Scalp: ${sc}.`);

  return lines;
}

export function canonicalHliRecommendedPlanText(values: Record<string, unknown>): string {
  const ai = readString(values.ai_recommended_plan_summary).trim();
  if (ai) return ai;
  const body = canonicalHliDiagnosisBody(values);
  if (body) return body;
  return "";
}

/**
 * Shallow-normalized value map for adapters / debugging.
 */
export function normalizeHairLossTreatmentConsultationValues(values: Record<string, unknown>): Record<string, unknown> {
  return {
    ...values,
    _canonical: {
      patternType: readString(values.pattern_type).trim(),
      riskFlags: canonicalHliRiskFlagValues(values),
      treatments: canonicalHliRecommendedTreatments(values),
      recommendedPlan: canonicalHliRecommendedPlanText(values),
      diagnosisBody: canonicalHliDiagnosisBody(values),
      classificationLines: canonicalHliPatternClassificationLines(values),
    },
  };
}
