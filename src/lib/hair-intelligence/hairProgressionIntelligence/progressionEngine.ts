import type { HieHairLossClassificationSystem } from "../hairLossClassification/types";
import { isHieHairLossClassificationSystem } from "../hairLossClassification/enumValidation";
import { HAIR_PROGRESSION_TRACKED_THERAPY_CODES } from "./constants";
import {
  buildHairProgressionCohortSignature,
  dateOfBirthToAgeBand,
  type HairProgressionAgeBand,
} from "./cohortSignature";
import {
  classificationGradeToProgressionOrdinal,
  norwoodOrdinalToGradeLabel,
} from "./gradeOrdinal";
import {
  describeReviewWeighting,
  hairLossReviewStatusToConfidenceMultiplier,
} from "./reviewConfidenceWeight";

export type HairProgressionTimepointInput = {
  id: string;
  created_at: string;
  classification_system: string;
  pattern_type: string;
  classification_grade: string;
  confidence_score: number;
  review_status: string;
  sex_classification?: string | null;
  diffuse_thinning_score?: number | null;
};

export type HairProgressionTherapyEventInput = {
  occurred_at: string;
  event_type: string;
  canonical_code: string | null;
};

export type HairProgressionStabilityLabel =
  | "stable"
  | "slow_progression"
  | "rapid_progression"
  | "diffuse_unstable_progression"
  | "insufficient_data";

export type HairProgressionIntelligence = {
  engine_version: string;
  timeline_point_cap: number;
  timepoints: Array<{
    id: string;
    at: string;
    classification_system: string;
    pattern_type: string;
    grade: string;
    progression_ordinal: number | null;
    confidence_score: number;
    review_status: string;
    review_confidence_multiplier: number;
  }>;
  analysis_basis: {
    classification_system_used: string | null;
    point_count: number;
    span_days: number | null;
    span_months: number | null;
  };
  progression_velocity: {
    grades_per_year: number | null;
    confidence_weighted_grades_per_year: number | null;
    method: "weighted_linear_regression_years_vs_ordinal";
  };
  stability: {
    label: HairProgressionStabilityLabel;
    rationale: string;
    segment_velocity_std_grades_per_year: number | null;
  };
  treatment_response: Array<{
    canonical_code: string;
    display_label: string;
    first_exposure_at: string | null;
    velocity_before_grades_per_year: number | null;
    velocity_after_grades_per_year: number | null;
    delta_velocity_after_minus_before: number | null;
    notes: string;
  }>;
  forecast: {
    classification_system: "norwood";
    current_grade: string;
    current_ordinal: number;
    velocity_grades_per_year: number;
    predicted_reach_grade: string;
    predicted_reach_ordinal: number;
    estimated_years_to_target: number;
    target_grade: string;
  } | null;
  cohort_context: {
    cohort_signature: string;
    age_band: HairProgressionAgeBand;
    population_mean_velocity: number | null;
    population_sample_count: number | null;
    population_week_bucket: string | null;
  };
  clinician_review_weighting: {
    average_review_multiplier: number;
    verified_point_fraction: number;
  };
  global_network: {
    cohort_signature: string;
    matched_bucket: boolean;
    population_mean_velocity: number | null;
    population_sample_count: number | null;
    week_bucket: string | null;
  };
};

export type BuildHairProgressionParams = {
  engineVersion: string;
  timelineCap: number;
  timepointsRaw: HairProgressionTimepointInput[];
  therapyEvents?: HairProgressionTherapyEventInput[];
  patientDateOfBirthIso?: string | null;
  /** Best-effort sex for cohorting (foundation person or last model tag). */
  patientSexClassification?: string | null;
  /** Latest anonymised cohort bucket from `hair_intelligence_progression_network_buckets` (optional). */
  networkBucket?: {
    week_bucket: string;
    sample_count: number;
    mean_velocity: number | null;
  } | null;
};

function dominantSystem(
  rows: HairProgressionTimepointInput[]
): HieHairLossClassificationSystem | null {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const sys = String(r.classification_system ?? "").trim();
    if (!isHieHairLossClassificationSystem(sys) || sys === "custom") continue;
    const ord = classificationGradeToProgressionOrdinal(sys, r.classification_grade);
    if (ord == null) continue;
    counts.set(sys, (counts.get(sys) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    } else if (n === bestN && best) {
      const pref = ["norwood", "ludwig", "sinclair", "olsen"] as const;
      const ib = pref.indexOf(k as (typeof pref)[number]);
      const ia = pref.indexOf(best as (typeof pref)[number]);
      if (ib >= 0 && ia >= 0 && ib < ia) best = k;
    }
  }
  return best && isHieHairLossClassificationSystem(best) ? best : null;
}

function parseMs(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function weightedRegressionSlopePerYear(pts: Array<{ tMs: number; ordinal: number; w: number }>): {
  slope: number | null;
  t0Ms: number;
} {
  if (pts.length < 2) return { slope: null, t0Ms: pts[0]?.tMs ?? 0 };
  const t0Ms = Math.min(...pts.map((p) => p.tMs));
  const mapped = pts
    .map((p) => ({
      tYears: (p.tMs - t0Ms) / (365.25 * 24 * 3600 * 1000),
      ordinal: p.ordinal,
      w: p.w,
    }))
    .sort((a, b) => a.tYears - b.tYears);

  const sumW = mapped.reduce((a, p) => a + p.w, 0);
  if (sumW <= 0) return { slope: null, t0Ms };
  const tMean = mapped.reduce((a, p) => a + p.w * p.tYears, 0) / sumW;
  const oMean = mapped.reduce((a, p) => a + p.w * p.ordinal, 0) / sumW;
  let num = 0;
  let den = 0;
  for (const p of mapped) {
    const dt = p.tYears - tMean;
    num += p.w * dt * (p.ordinal - oMean);
    den += p.w * dt * dt;
  }
  if (Math.abs(den) < 1e-12) return { slope: null, t0Ms };
  return { slope: num / den, t0Ms };
}

function segmentSlopesPerYear(pts: Array<{ tMs: number; ordinal: number }>): number[] {
  const sorted = [...pts].sort((a, b) => a.tMs - b.tMs);
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const dy = b.ordinal - a.ordinal;
    const dtMs = b.tMs - a.tMs;
    const years = dtMs / (365.25 * 24 * 3600 * 1000);
    if (years > 1 / 365) out.push(dy / years);
  }
  return out;
}

function std(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(Math.max(0, v));
}

function therapyDisplayLabel(code: string): string {
  const map: Record<string, string> = {
    finasteride: "Finasteride",
    dutasteride: "Dutasteride",
    oral_minoxidil: "Oral minoxidil",
    topical_minoxidil: "Topical minoxidil",
    prp: "PRP",
    exosomes: "Exosomes",
  };
  return map[code] ?? code;
}

function firstExposureAtForTherapy(
  events: HairProgressionTherapyEventInput[] | undefined,
  canonicalCode: string
): string | null {
  if (!events?.length) return null;
  const interested = new Set(["therapy_started", "session_completed", "plan_activated"]);
  let best: string | null = null;
  let bestMs = Infinity;
  for (const e of events) {
    if ((e.canonical_code ?? "").trim() !== canonicalCode) continue;
    if (!interested.has(e.event_type)) continue;
    const ms = parseMs(e.occurred_at);
    if (ms == null) continue;
    if (ms < bestMs) {
      bestMs = ms;
      best = e.occurred_at;
    }
  }
  return best;
}

function slopeForSubset(
  pts: Array<{ tMs: number; ordinal: number; w: number }>,
  pred: (tMs: number) => boolean
): number | null {
  const sub = pts.filter((p) => pred(p.tMs));
  return weightedRegressionSlopePerYear(sub).slope;
}

export function buildHairProgressionIntelligence(
  params: BuildHairProgressionParams
): HairProgressionIntelligence {
  const cap = Math.max(1, params.timelineCap);
  const sortedRaw = [...params.timepointsRaw]
    .filter((r) => r.id && r.created_at)
    .sort((a, b) => (parseMs(a.created_at) ?? 0) - (parseMs(b.created_at) ?? 0))
    .slice(0, cap);

  const systemUsed = dominantSystem(sortedRaw);

  const timepoints = sortedRaw.map((r) => {
    const sys = String(r.classification_system ?? "").trim();
    const cs = isHieHairLossClassificationSystem(sys) ? sys : "custom";
    const ord =
      systemUsed && cs === systemUsed
        ? classificationGradeToProgressionOrdinal(systemUsed, r.classification_grade)
        : null;
    const rm = hairLossReviewStatusToConfidenceMultiplier(r.review_status);
    return {
      id: r.id,
      at: r.created_at,
      classification_system: r.classification_system,
      pattern_type: r.pattern_type,
      grade: r.classification_grade,
      progression_ordinal: ord,
      confidence_score: Math.max(0, Math.min(1, Number(r.confidence_score) || 0)),
      review_status: r.review_status,
      review_confidence_multiplier: rm,
    };
  });

  const regressionPts: Array<{ tMs: number; ordinal: number; w: number }> = [];
  for (const r of sortedRaw) {
    if (!systemUsed) continue;
    const sys = String(r.classification_system ?? "").trim();
    if (sys !== systemUsed) continue;
    const ord = classificationGradeToProgressionOrdinal(systemUsed, r.classification_grade);
    if (ord == null) continue;
    const tMs = parseMs(r.created_at);
    if (tMs == null) continue;
    const rm = hairLossReviewStatusToConfidenceMultiplier(r.review_status);
    const conf = Math.max(0, Math.min(1, Number(r.confidence_score) || 0));
    const w = Math.max(0.05, conf * rm);
    regressionPts.push({ tMs, ordinal: ord, w });
  }

  const tFirst = regressionPts.length ? Math.min(...regressionPts.map((p) => p.tMs)) : null;
  const tLast = regressionPts.length ? Math.max(...regressionPts.map((p) => p.tMs)) : null;
  const spanDays =
    tFirst != null && tLast != null ? Math.max(0, (tLast - tFirst) / (24 * 3600 * 1000)) : null;
  const spanMonths = spanDays != null ? spanDays / 30.4375 : null;

  const { slope: wSlope } = weightedRegressionSlopePerYear(regressionPts);
  const unweightedPts = regressionPts.map((p) => ({
    tMs: p.tMs,
    ordinal: p.ordinal,
    w: 1,
  }));
  const { slope: rawSlope } = weightedRegressionSlopePerYear(unweightedPts);

  const seg = segmentSlopesPerYear(regressionPts.map((p) => ({ tMs: p.tMs, ordinal: p.ordinal })));
  const segStd = std(seg);

  const lastPattern = sortedRaw.length
    ? String(sortedRaw[sortedRaw.length - 1].pattern_type ?? "")
    : "";
  const lastDiffuseScore = sortedRaw.length
    ? sortedRaw[sortedRaw.length - 1].diffuse_thinning_score
    : null;
  const diffusePattern =
    lastPattern === "diffuse_male_pattern" ||
    lastPattern === "diffuse_female_thinning" ||
    (typeof lastDiffuseScore === "number" && lastDiffuseScore >= 6);

  let stabilityLabel: HairProgressionStabilityLabel = "insufficient_data";
  let rationale = "Not enough comparable timepoints to estimate stability.";
  const absV = wSlope != null ? Math.abs(wSlope) : null;

  if (regressionPts.length < 2 || spanDays == null || spanDays < 45) {
    stabilityLabel = "insufficient_data";
    rationale = "Need at least two graded observations spanning ~6 weeks on the same scale.";
  } else if (diffusePattern && segStd != null && segStd >= 0.55) {
    stabilityLabel = "diffuse_unstable_progression";
    rationale =
      "Diffuse-weighted pattern with high variance between segment velocities — treat longitudinal grade trends cautiously.";
  } else if (absV != null && absV < 0.07 && (segStd == null || segStd < 0.2)) {
    stabilityLabel = "stable";
    rationale = "Low absolute velocity and low segment-to-segment variance.";
  } else if (absV != null && absV < 0.38) {
    stabilityLabel = "slow_progression";
    rationale = "Meaningful but moderate mean grade velocity for the chosen classification system.";
  } else if (absV != null) {
    stabilityLabel = "rapid_progression";
    rationale = "High mean grade velocity across the observation window.";
  }

  const therapyEvents = params.therapyEvents ?? [];
  const treatment_response = HAIR_PROGRESSION_TRACKED_THERAPY_CODES.map((code) => {
    const firstAt = firstExposureAtForTherapy(therapyEvents, code);
    const firstMs = firstAt ? parseMs(firstAt) : null;
    let before: number | null = null;
    let after: number | null = null;
    let notes = "";
    if (firstMs != null && regressionPts.length >= 2) {
      before = slopeForSubset(regressionPts, (t) => t < firstMs);
      after = slopeForSubset(regressionPts, (t) => t >= firstMs);
      const nBefore = regressionPts.filter((p) => p.tMs < firstMs).length;
      const nAfter = regressionPts.filter((p) => p.tMs >= firstMs).length;
      if (nBefore < 2) {
        before = null;
        notes = "Insufficient pre-exposure grade points.";
      }
      if (nAfter < 2) {
        after = null;
        notes = notes
          ? `${notes} Insufficient post-exposure grade points.`
          : "Insufficient post-exposure grade points.";
      }
    } else if (!firstAt) {
      notes = "No therapy exposure events recorded for this code.";
    } else {
      notes = "Insufficient graded timeline for before/after comparison.";
    }
    const delta =
      before != null && after != null && Number.isFinite(before) && Number.isFinite(after)
        ? after - before
        : null;
    return {
      canonical_code: code,
      display_label: therapyDisplayLabel(code),
      first_exposure_at: firstAt,
      velocity_before_grades_per_year: before,
      velocity_after_grades_per_year: after,
      delta_velocity_after_minus_before: delta,
      notes,
    };
  });

  const asOf = new Date();
  const ageBand = dateOfBirthToAgeBand(params.patientDateOfBirthIso ?? null, asOf);
  let modelSex: string | null = null;
  for (let i = sortedRaw.length - 1; i >= 0; i--) {
    const sc = sortedRaw[i].sex_classification;
    if (sc && String(sc).trim() && String(sc).trim() !== "unknown") {
      modelSex = String(sc).trim();
      break;
    }
  }
  const cohortSex = modelSex ?? params.patientSexClassification ?? null;
  const cohort_signature = buildHairProgressionCohortSignature({
    pattern_type: lastPattern || "unknown",
    sex_classification: cohortSex,
    age_band: ageBand,
    classification_system: systemUsed ?? "unknown",
  });

  let forecast: HairProgressionIntelligence["forecast"] = null;
  if (systemUsed === "norwood" && regressionPts.length >= 2 && wSlope != null && wSlope > 0.05) {
    const last = [...regressionPts].sort((a, b) => b.tMs - a.tMs)[0];
    const currentOrdinal = last.ordinal;
    const currentGrade = norwoodOrdinalToGradeLabel(currentOrdinal);
    const targetOrdinal = 6;
    const targetGrade = "V";
    if (currentOrdinal < targetOrdinal && currentGrade) {
      const years = (targetOrdinal - currentOrdinal) / wSlope;
      if (Number.isFinite(years) && years > 0 && years < 80) {
        forecast = {
          classification_system: "norwood",
          current_grade: currentGrade,
          current_ordinal: currentOrdinal,
          velocity_grades_per_year: wSlope,
          predicted_reach_grade: targetGrade,
          predicted_reach_ordinal: targetOrdinal,
          estimated_years_to_target: years,
          target_grade: targetGrade,
        };
      }
    }
  }

  const reviewStats = describeReviewWeighting(
    sortedRaw.map((r) => ({ review_status: r.review_status }))
  );

  const nb = params.networkBucket;
  const population_mean = nb?.mean_velocity ?? null;
  const population_n = nb?.sample_count ?? null;

  return {
    engine_version: params.engineVersion,
    timeline_point_cap: cap,
    timepoints,
    analysis_basis: {
      classification_system_used: systemUsed,
      point_count: regressionPts.length,
      span_days: spanDays != null ? Math.round(spanDays) : null,
      span_months: spanMonths != null ? Math.round(spanMonths * 10) / 10 : null,
    },
    progression_velocity: {
      grades_per_year: rawSlope,
      confidence_weighted_grades_per_year: wSlope,
      method: "weighted_linear_regression_years_vs_ordinal",
    },
    stability: {
      label: stabilityLabel,
      rationale,
      segment_velocity_std_grades_per_year: segStd,
    },
    treatment_response,
    forecast,
    cohort_context: {
      cohort_signature,
      age_band: ageBand,
      population_mean_velocity: population_mean,
      population_sample_count: population_n,
      population_week_bucket: nb?.week_bucket ?? null,
    },
    clinician_review_weighting: reviewStats,
    global_network: {
      cohort_signature,
      matched_bucket: Boolean(nb && (nb.sample_count ?? 0) > 0),
      population_mean_velocity: population_mean,
      population_sample_count: population_n,
      week_bucket: nb?.week_bucket ?? null,
    },
  };
}
