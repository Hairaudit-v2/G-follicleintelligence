/**
 * Pure policy for Stage 4B patient clinical details: bounds, JSON object shape, editable keys.
 */

import { isHairlinePatternValue, isLudwigScaleValue, isNorwoodScaleValue } from "./hairLossScales";

export const CLINICAL_DETAILS_TEXT_MAX: Record<string, number> = {
  primary_hair_concern: 300,
  treatment_interest: 300,
  hair_loss_duration: 200,
  family_history: 1000,
  relevant_medical_history: 2000,
  current_medications: 2000,
  allergies: 1000,
  contraindications: 1500,
  scalp_conditions: 1500,
  previous_hair_treatments: 1500,
  norwood_scale: 16,
  ludwig_scale: 8,
  hairline_pattern: 40,
  primary_concern: 500,
} as const;

export const EDITABLE_CLINICAL_DETAIL_TEXT_KEYS = [
  "primary_hair_concern",
  "treatment_interest",
  "hair_loss_duration",
  "family_history",
  "relevant_medical_history",
  "current_medications",
  "allergies",
  "contraindications",
  "scalp_conditions",
  "previous_hair_treatments",
  "norwood_scale",
  "ludwig_scale",
  "hairline_pattern",
  "primary_concern",
] as const;

export type EditableClinicalDetailTextKey = (typeof EDITABLE_CLINICAL_DETAIL_TEXT_KEYS)[number];

export const EDITABLE_CLINICAL_DETAIL_KEYS = [
  ...EDITABLE_CLINICAL_DETAIL_TEXT_KEYS,
  "clinical_flags",
  "metadata",
] as const;

export type EditableClinicalDetailKey = (typeof EDITABLE_CLINICAL_DETAIL_KEYS)[number];

export type EditableClinicalDetailsPayload = {
  primary_hair_concern: string | null;
  treatment_interest: string | null;
  hair_loss_duration: string | null;
  family_history: string | null;
  relevant_medical_history: string | null;
  current_medications: string | null;
  allergies: string | null;
  contraindications: string | null;
  scalp_conditions: string | null;
  previous_hair_treatments: string | null;
  norwood_scale: string | null;
  ludwig_scale: string | null;
  hairline_pattern: string | null;
  primary_concern: string | null;
  clinical_flags: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

const TEXT_KEY_SET = new Set<string>(EDITABLE_CLINICAL_DETAIL_TEXT_KEYS);

export function isEditableClinicalDetailTextKey(k: string): k is EditableClinicalDetailTextKey {
  return TEXT_KEY_SET.has(k);
}

export function isEditableClinicalDetailKey(k: string): k is EditableClinicalDetailKey {
  return k === "clinical_flags" || k === "metadata" || TEXT_KEY_SET.has(k);
}

/** True when value is a non-null plain object (not array). */
export function isJsonObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assertJsonObjectField(name: string, value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isJsonObjectRecord(value)) {
    throw new Error(`${name} must be a JSON object.`);
  }
  return value;
}

export function normalizeClinicalTextInput(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s;
}

export function assertClinicalTextWithinBounds(field: EditableClinicalDetailTextKey, value: string | null): string | null {
  if (value == null) return null;
  const max = CLINICAL_DETAILS_TEXT_MAX[field];
  if (value.length > max) {
    throw new Error(`${field} exceeds ${max} characters.`);
  }
  return value;
}

/** Strips unknown keys; validates lengths and JSON object fields. */
export function normalizeEditableClinicalDetailsPayload(input: Record<string, unknown>): EditableClinicalDetailsPayload {
  const out: EditableClinicalDetailsPayload = {
    primary_hair_concern: null,
    treatment_interest: null,
    hair_loss_duration: null,
    family_history: null,
    relevant_medical_history: null,
    current_medications: null,
    allergies: null,
    contraindications: null,
    scalp_conditions: null,
    previous_hair_treatments: null,
    norwood_scale: null,
    ludwig_scale: null,
    hairline_pattern: null,
    primary_concern: null,
    clinical_flags: {},
    metadata: {},
  };

  for (const key of EDITABLE_CLINICAL_DETAIL_TEXT_KEYS) {
    if (!(key in input)) continue;
    const raw = input[key];
    const norm = normalizeClinicalTextInput(raw == null ? null : String(raw));
    out[key] = assertClinicalTextWithinBounds(key, norm);
  }

  if (out.norwood_scale != null && !isNorwoodScaleValue(out.norwood_scale)) {
    throw new Error("Invalid norwood_scale.");
  }
  if (out.ludwig_scale != null && !isLudwigScaleValue(out.ludwig_scale)) {
    throw new Error("Invalid ludwig_scale.");
  }
  if (out.hairline_pattern != null && !isHairlinePatternValue(out.hairline_pattern)) {
    throw new Error("Invalid hairline_pattern.");
  }

  if ("clinical_flags" in input) {
    out.clinical_flags = assertJsonObjectField("clinical_flags", input.clinical_flags);
  }
  if ("metadata" in input) {
    out.metadata = assertJsonObjectField("metadata", input.metadata);
  }

  return out;
}

/**
 * When no DB row exists, staff may create one with all-null text and empty objects (bounded, safe shell).
 */
export function canCreateEmptyClinicalDetailsRow(payload: EditableClinicalDetailsPayload): boolean {
  const textsEmpty = EDITABLE_CLINICAL_DETAIL_TEXT_KEYS.every((k) => payload[k] == null);
  const flagsEmpty = Object.keys(payload.clinical_flags).length === 0;
  const metaEmpty = Object.keys(payload.metadata).length === 0;
  return textsEmpty && flagsEmpty && metaEmpty;
}

/** Pure tenant/patient ownership check for a fetched patient row. */
export function clinicalDetailsPatientRowMatchesTenant(
  expectedTenantId: string,
  expectedPatientId: string,
  row: { tenant_id?: unknown; id?: unknown } | null | undefined
): boolean {
  if (!row) return false;
  return String(row.tenant_id) === expectedTenantId.trim() && String(row.id) === expectedPatientId.trim();
}
