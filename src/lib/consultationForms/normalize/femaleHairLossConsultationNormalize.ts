/**
 * Normalization helpers for Female Hair Loss consultation (pathway 3).
 */

import { getClinicalNoteText } from "../consultationFormNoteModel";
import {
  mergeUniqueStrings,
  readBoolean,
  readString,
  readStringArray,
} from "../completion/consultationCompletionExtractors";

export function canonicalFemaleRiskFlagValues(values: Record<string, unknown>): string[] {
  return mergeUniqueStrings(
    readStringArray(values.medical_flags),
    readStringArray(values.hormonal_flags)
  );
}

export function canonicalFemaleRecommendedTreatments(values: Record<string, unknown>): string[] {
  return readStringArray(values.recommended_treatments);
}

export function canonicalFemaleDiagnosisBody(values: Record<string, unknown>): string {
  return getClinicalNoteText(values.structured_clinical_note).trim();
}

export function canonicalFemalePatternClassificationLines(
  values: Record<string, unknown>
): string[] {
  const lines: string[] = [];
  const pt = readString(values.female_pattern_type).trim();
  if (pt) lines.push(`Pattern: ${pt.replace(/_/g, " ")}.`);

  const lw = readString(values.ludwig_classification).trim();
  if (lw) lines.push(`Ludwig: ${lw}.`);

  const sn = readString(values.sinclair_classification).trim();
  if (sn) lines.push(`Sinclair: ${sn}.`);

  const traction = readBoolean(values.traction_pattern_present);
  if (traction === true) lines.push("Traction pattern: suspected / present.");

  const mini = readString(values.miniaturisation_clinical).trim();
  if (mini) lines.push(`Miniaturisation (clinical): ${mini}.`);

  const cal = readString(values.hair_calibre).trim();
  if (cal) lines.push(`Calibre: ${cal}.`);

  const sc = readString(values.scalp_condition).trim();
  if (sc) lines.push(`Scalp: ${sc}.`);

  return lines;
}

export function canonicalFemaleRecommendedPlanText(values: Record<string, unknown>): string {
  const ai = readString(values.ai_recommended_plan_summary).trim();
  if (ai) return ai;
  const body = canonicalFemaleDiagnosisBody(values);
  if (body) return body;
  return "";
}

export function normalizeFemaleHairLossConsultationValues(
  values: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...values,
    _canonical: {
      femalePatternType: readString(values.female_pattern_type).trim(),
      riskFlags: canonicalFemaleRiskFlagValues(values),
      treatments: canonicalFemaleRecommendedTreatments(values),
      recommendedPlan: canonicalFemaleRecommendedPlanText(values),
      diagnosisBody: canonicalFemaleDiagnosisBody(values),
      classificationLines: canonicalFemalePatternClassificationLines(values),
    },
  };
}
