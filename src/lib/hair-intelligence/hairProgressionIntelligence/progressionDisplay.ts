import type { HairProgressionIntelligence, HairProgressionStabilityLabel } from "./progressionEngine";

/**
 * Numeric grades/year for display tables (no unit suffix).
 * Returns "—" when the model did not produce a finite slope.
 */
export function formatVelocityGradesPerYear(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const fractionDigits = abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  return value.toFixed(fractionDigits);
}

/** Same as {@link formatVelocityGradesPerYear} with a clear clinical unit suffix. */
export function formatVelocityGradesPerYearWithUnit(value: number | null | undefined): string {
  const n = formatVelocityGradesPerYear(value);
  return n === "—" ? "—" : `${n} grades/year`;
}

/** Short heading-style label for stability chips (clinical wording). */
export function formatStabilityClinicalLabel(label: HairProgressionStabilityLabel): string {
  switch (label) {
    case "stable":
      return "Stable";
    case "slow_progression":
      return "Slow progression";
    case "rapid_progression":
      return "Rapid progression";
    case "diffuse_unstable_progression":
      return "Diffuse unstable progression";
    case "insufficient_data":
      return "Insufficient longitudinal data";
    default:
      return String(label);
  }
}

/**
 * True when the engine labels the window as non-informative for longitudinal velocity
 * (clinicians should rely on the empty-state copy, not implied slopes).
 */
export function hairProgressionIsInsufficientLongitudinalData(dto: { stability: { label: HairProgressionStabilityLabel } }): boolean {
  return dto.stability.label === "insufficient_data";
}

/** First / last analysed observation timestamps on the dominant classification system (when ordinals exist). */
export function hairProgressionAnalysedTimebounds(dto: HairProgressionIntelligence): {
  firstAt: string | null;
  lastAt: string | null;
} {
  const sys = dto.analysis_basis.classification_system_used;
  const analysed = dto.timepoints.filter(
    (t) => Boolean(sys && t.classification_system === sys) && t.progression_ordinal != null
  );
  if (analysed.length === 0) {
    const tp = dto.timepoints;
    if (!tp.length) return { firstAt: null, lastAt: null };
    return { firstAt: tp[0].at, lastAt: tp[tp.length - 1].at };
  }
  return { firstAt: analysed[0].at, lastAt: analysed[analysed.length - 1].at };
}

export function hairProgressionLatestGradePresentation(dto: HairProgressionIntelligence): {
  grade: string | null;
  ordinal: number | null;
} {
  const sys = dto.analysis_basis.classification_system_used;
  const analysed = dto.timepoints.filter(
    (t) => Boolean(sys && t.classification_system === sys) && t.progression_ordinal != null
  );
  const last = analysed.length ? analysed[analysed.length - 1] : dto.timepoints.length ? dto.timepoints[dto.timepoints.length - 1] : null;
  if (!last) return { grade: null, ordinal: null };
  return { grade: last.grade, ordinal: last.progression_ordinal };
}

export function formatSignedVelocityDeltaGradesPerYear(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0 || Object.is(value, -0)) {
    const z = formatVelocityGradesPerYear(0);
    return z === "—" ? "—" : `${z} grades/year`;
  }
  const core = formatVelocityGradesPerYear(Math.abs(value));
  if (core === "—") return "—";
  const sign = value > 0 ? "+" : "-";
  return `${sign}${core} grades/year`;
}

export function formatVerifiedPointFraction(fraction: number | null | undefined): string {
  if (fraction == null || !Number.isFinite(fraction)) return "—";
  return `${(Math.max(0, Math.min(1, fraction)) * 100).toFixed(0)}%`;
}

export function formatReviewMultiplier(mult: number | null | undefined): string {
  if (mult == null || !Number.isFinite(mult)) return "—";
  return mult.toFixed(2);
}
