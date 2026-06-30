import type { HairlinePatternValue, LudwigScaleValue, NorwoodScaleValue } from "./hairLossScales";
import {
  isHairlinePatternValue,
  isLudwigScaleValue,
  isNorwoodScaleValue,
} from "./hairLossScales";

const CONSULTATION_NORWOOD_TO_PATIENT: Record<string, NorwoodScaleValue> = {
  nw1: "I",
  nw2: "II",
  nw2a: "IIa",
  nw3: "III",
  nw3v: "IIIvertex",
  nw3a: "IIIa",
  nw4: "IV",
  nw4a: "IVa",
  nw5: "V",
  nw5a: "Va",
  nw6: "VI",
  nw7: "VII",
  unsure: "unknown",
  unknown: "unknown",
};

const CONSULTATION_LUDWIG_TO_PATIENT: Record<string, LudwigScaleValue> = {
  l1: "I",
  l2: "II",
  l3: "III",
  unsure: "I",
};

const CONSULTATION_SINCLAIR_CODES = new Set(["s1", "s2", "s3", "s4", "s5", "unsure", "unknown"]);

/** Normalizes consultation Sinclair codes (`s3`, …) for patient metadata storage. */
export function mapConsultationSinclairToPatient(
  raw: string | null | undefined
): string | null {
  const key = raw?.trim().toLowerCase();
  if (!key || key === "unsure" || key === "unknown") return null;
  return CONSULTATION_SINCLAIR_CODES.has(key) ? key : null;
}

const PATTERN_TYPE_TO_HAIRLINE: Record<string, HairlinePatternValue> = {
  hairline: "receding",
  crown: "vertex_thinning",
  diffuse: "diffuse",
  female_pattern: "diffuse",
  patchy: "unknown",
  inflammatory: "unknown",
  unknown: "unknown",
  part_widening: "diffuse",
  frontal_hairline: "receding",
  temporal_thinning: "temporal_recession",
  traction: "stable",
  mixed: "diffuse",
  unclear: "unknown",
};

/** Maps consultation form Norwood codes (`nw3`, …) to patient `fi_patient_clinical_details` values (`III`, …). */
export function mapConsultationNorwoodToPatient(
  raw: string | null | undefined
): NorwoodScaleValue | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (isNorwoodScaleValue(trimmed)) return trimmed;
  const key = trimmed.toLowerCase();
  return CONSULTATION_NORWOOD_TO_PATIENT[key] ?? null;
}

/** Maps consultation Ludwig codes (`l2`, …) to patient column values (`II`, …). */
export function mapConsultationLudwigToPatient(
  raw: string | null | undefined
): LudwigScaleValue | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (isLudwigScaleValue(trimmed)) return trimmed;
  const key = trimmed.toLowerCase();
  return CONSULTATION_LUDWIG_TO_PATIENT[key] ?? null;
}

/** Maps HLI / female pattern type keys to `hairline_pattern` when no explicit pattern is stored. */
export function mapConsultationPatternTypeToHairline(
  raw: string | null | undefined
): HairlinePatternValue | null {
  const key = raw?.trim().toLowerCase();
  if (!key) return null;
  if (isHairlinePatternValue(key)) return key;
  return PATTERN_TYPE_TO_HAIRLINE[key] ?? null;
}

function readString(values: Record<string, unknown>, key: string): string {
  const v = values[key];
  if (v == null) return "";
  return String(v).trim();
}

/**
 * Builds a patient clinical-details patch from guided consultation form `values`.
 * Only includes fields present in the form payload; invalid mapped values are omitted.
 */
export type ConsultationFormClinicalPatch = {
  fields: Record<string, string | null>;
  /** Sinclair has no dedicated patient column — stored under `metadata.sinclair_scale`. */
  sinclairScale: string | null;
};

export function buildPatientClinicalPatchFromConsultationFormValues(
  values: Record<string, unknown>
): ConsultationFormClinicalPatch {
  const fields: Record<string, string | null> = {};

  const norwood = mapConsultationNorwoodToPatient(readString(values, "norwood_classification"));
  if (norwood) fields.norwood_scale = norwood;

  const ludwig = mapConsultationLudwigToPatient(readString(values, "ludwig_classification"));
  if (ludwig) fields.ludwig_scale = ludwig;

  const patternKey =
    readString(values, "pattern_type") || readString(values, "female_pattern_type");
  const hairline = mapConsultationPatternTypeToHairline(patternKey);
  if (hairline) fields.hairline_pattern = hairline;

  const concern =
    readString(values, "priority_focus") ||
    readString(values, "female_priority_focus") ||
    readString(values, "current_primary_concern") ||
    readString(values, "primary_hair_concern");
  if (concern) fields.primary_concern = concern.slice(0, 2000);

  const sinclairScale = mapConsultationSinclairToPatient(
    readString(values, "sinclair_classification")
  );

  return { fields, sinclairScale };
}