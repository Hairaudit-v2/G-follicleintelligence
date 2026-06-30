/**
 * Dual-read helpers for Hair Transplant Consultation v1 (16-section) and v2 (adaptive pathway).
 * Keeps completion summaries, handoffs, and automation stable across template versions.
 */

import { getClinicalNoteText } from "../consultationFormNoteModel";
import {
  mergeUniqueStrings,
  parseGraftRangeText,
  readNumber,
  readString,
  readStringArray,
} from "../completion/consultationCompletionExtractors";

/** Raw duration key from either v2 `duration_band` or legacy `duration_months`. */
export function canonicalHairTransplantDurationKey(values: Record<string, unknown>): string {
  return readString(values.duration_band).trim() || readString(values.duration_months).trim();
}

/** Single Norwood / pattern key — legacy confirm field defers to structured classification when present. */
export function canonicalHairTransplantNorwoodKey(values: Record<string, unknown>): string {
  const fromClass = readString(values.norwood_classification).trim();
  if (fromClass) return fromClass;
  return readString(values.diagnosis_norwood_confirm).trim();
}

/** Risk / medical flags: one checklist in v2; legacy forms may also store `risk_flags_confirmed`. */
export function canonicalHairTransplantRiskFlagValues(values: Record<string, unknown>): string[] {
  return mergeUniqueStrings(
    readStringArray(values.medical_flags),
    readStringArray(values.risk_flags_confirmed)
  );
}

/** Structured treatment selections: recommendations win; else legacy interest list. */
export function canonicalHairTransplantTreatmentValues(values: Record<string, unknown>): string[] {
  const rec = readStringArray(values.recommended_treatments);
  if (rec.length > 0) return rec;
  return readStringArray(values.treatment_interest);
}

function readTreatmentRecommendationPlain(values: Record<string, unknown>): string {
  const raw = values.treatment_recommendation_block;
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const note = readString(o.summary ?? o.notes ?? o.planSummary);
    if (note) return note;
  }
  return "";
}

/**
 * Canonical “recommended procedure / plan” line for completion summaries.
 * Prefers explicit plan text, then v2 AI placeholder field, then legacy treatment block text.
 */
export function canonicalHairTransplantRecommendedPlanText(
  values: Record<string, unknown>
): string {
  const a = readString(values.recommended_plan_summary).trim();
  if (a) return a;
  const b = readString(values.ai_recommended_plan_summary).trim();
  if (b) return b;
  return readTreatmentRecommendationPlain(values);
}

/**
 * Canonical free-text diagnosis / impression body (excluding Norwood prefix handled separately).
 */
export function canonicalHairTransplantDiagnosisBody(values: Record<string, unknown>): string {
  const structured = getClinicalNoteText(values.structured_clinical_note).trim();
  if (structured) return structured;
  const finalC = readString(values.final_clinician_comments).trim();
  if (finalC) return finalC;
  const dn = getClinicalNoteText(values.diagnosis_clinical_note).trim();
  if (dn) return dn;
  return readString(values.diagnosis_free_text).trim();
}

/** Graft min/max from explicit completion numbers and/or legacy text range. */
export function canonicalHairTransplantGraftBounds(values: Record<string, unknown>): {
  min: number | null;
  max: number | null;
} {
  let min = readNumber(values.completion_estimated_grafts_min);
  let max = readNumber(values.completion_estimated_grafts_max);
  if (min == null && max == null) {
    const parsed = parseGraftRangeText(readString(values.graft_range_estimate));
    if (parsed) {
      min = parsed.min;
      max = parsed.max;
    }
  }
  return { min, max };
}

/**
 * Shallow-normalized value map for debugging / future adapters.
 * Does not mutate the input object.
 */
export function normalizeHairTransplantConsultationValues(
  values: Record<string, unknown>
): Record<string, unknown> {
  const { min, max } = canonicalHairTransplantGraftBounds(values);
  return {
    ...values,
    _canonical: {
      durationKey: canonicalHairTransplantDurationKey(values),
      norwoodKey: canonicalHairTransplantNorwoodKey(values),
      riskFlags: canonicalHairTransplantRiskFlagValues(values),
      treatments: canonicalHairTransplantTreatmentValues(values),
      recommendedPlan: canonicalHairTransplantRecommendedPlanText(values),
      diagnosisBody: canonicalHairTransplantDiagnosisBody(values),
      estimatedGraftsMin: min,
      estimatedGraftsMax: max,
    },
  };
}
