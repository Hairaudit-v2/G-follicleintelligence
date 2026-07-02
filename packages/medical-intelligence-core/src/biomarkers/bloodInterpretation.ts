/**
 * Phase G: Blood result interpretation engine. Deterministic clinical logic only (no AI).
 * Uses blood marker registry for normalization, display labels, and hair-optimal ranges.
 */

import {
  resolveMarkerKey,
  getMarkerDefinition,
  getDisplayLabel,
  type ClinicalFlagChar,
} from "./bloodMarkerRegistry";

export type InterpretationStatus =
  | "optimal"
  | "normal"
  | "low"
  | "high"
  | "critical"
  | "unknown";

export type { ClinicalFlagChar };

export type InterpretedMarker = {
  /** Display label (registry label when known, else raw marker name). */
  marker: string;
  value: number;
  unit: string | null;
  status: InterpretationStatus;
  clinical_flag: ClinicalFlagChar;
  explanation: string;
};

/** Re-export for grouping/trends. Use registry-based resolution. */
export { resolveMarkerKey as getNormalisedMarkerKey, KEY_MARKERS_FOR_TRENDS } from "./bloodMarkerRegistry";
export { getDisplayLabel } from "./bloodMarkerRegistry";

/**
 * Interpret a single blood marker using registry hair-optimal ranges when available.
 * Uses lab reference range when provided and marker not in registry.
 */
export function interpretMarker(
  markerName: string,
  value: number,
  unit: string | null,
  referenceLow: number | null,
  referenceHigh: number | null
): InterpretedMarker {
  const key = resolveMarkerKey(markerName);
  const def = getMarkerDefinition(markerName);
  const displayLabel = def ? def.label : (markerName?.trim() || "");
  const opt = def?.hairOptimal;

  const displayUnit = unit ?? opt?.unit ?? null;

  if (opt) {
    const { optimalLow, optimalHigh, explanationLow, explanationHigh, explanationOptimal } = opt;
    const isLow = value < optimalLow;
    const isHigh = optimalHigh > 0 && value > optimalHigh;
    const isCriticalLow = value < optimalLow * 0.5 || (key === "Ferritin" && value < 15);
    const isCriticalHigh =
      (key === "TSH" && value > 10) ||
      (key === "CRP" && value > 50) ||
      (key === "HbA1c %" && value > 10) ||
      (key === "HbA1c" && value > 86);

    let status: InterpretationStatus = "optimal";
    let explanation = explanationOptimal;

    if (isCriticalLow || isCriticalHigh) {
      status = "critical";
      explanation = isCriticalLow ? explanationLow : explanationHigh;
    } else if (isLow) {
      status = "low";
      explanation = explanationLow;
    } else if (isHigh) {
      status = "high";
      explanation = explanationHigh;
    }

    return {
      marker: displayLabel,
      value,
      unit: displayUnit,
      status,
      clinical_flag: def.clinicalFlag,
      explanation,
    };
  }

  // Unknown marker: use lab reference if provided
  if (referenceLow != null && referenceHigh != null) {
    let status: InterpretationStatus = "normal";
    let explanation = "Within lab reference range.";
    if (value < referenceLow) {
      status = value < referenceLow * 0.7 ? "critical" : "low";
      explanation = "Below lab reference range.";
    } else if (value > referenceHigh) {
      status = value > referenceHigh * 1.3 ? "critical" : "high";
      explanation = "Above lab reference range.";
    }
    return {
      marker: displayLabel || markerName,
      value,
      unit: displayUnit,
      status,
      clinical_flag: null,
      explanation,
    };
  }

  return {
    marker: displayLabel || markerName,
    value,
    unit: displayUnit,
    status: "unknown",
    clinical_flag: null,
    explanation: "No hair-specific or lab reference available; interpret clinically.",
  };
}

/**
 * Interpret multiple raw markers (e.g. from hli_longevity_blood_result_markers).
 */
export function interpretMarkers(
  raw: Array<{
    marker_name: string;
    value: number;
    unit?: string | null;
    reference_low?: number | null;
    reference_high?: number | null;
  }>
): InterpretedMarker[] {
  return raw.map((m) =>
    interpretMarker(
      m.marker_name,
      m.value,
      m.unit ?? null,
      m.reference_low ?? null,
      m.reference_high ?? null
    )
  );
}

/** Get triage flag character for a marker name (for display only). */
export function getClinicalFlagForMarker(markerName: string): ClinicalFlagChar {
  const def = getMarkerDefinition(markerName);
  return def?.clinicalFlag ?? null;
}
