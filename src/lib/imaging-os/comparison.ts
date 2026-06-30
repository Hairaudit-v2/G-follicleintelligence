/**
 * ImagingOS — visual comparison contracts (Phase IM-8).
 * Pure comparison readiness evaluation; no I/O, AI, or pixel analysis.
 */

import type { CanonicalHairImageCategory } from "./categories";
import type { ImagingOsOutcomeEvidence } from "./outcomes";
import type { ImagingOsProgressionImage } from "./progression";
import type { ImagingOsTimepoint } from "./progression";
import type { ImagingOsProgressionAssessmentType } from "./progression";
import type { ImagingOsImageQualityStatus } from "./quality";
import type { ImagingOsOutcomeMeasurementDomain } from "./outcomes";
import type { ImagingOsSurgicalReadinessDomain } from "./surgical";

// ---------------------------------------------------------------------------
// Comparison domain model
// ---------------------------------------------------------------------------

export const IMAGING_COMPARISON_DOMAINS = [
  "growth_change",
  "density_change",
  "donor_recovery_change",
  "recipient_growth_change",
  "hairline_design_change",
  "scalp_visibility_change",
  "graft_survival_change",
  "longitudinal_medical_response",
  "revision_comparison",
  "unknown",
] as const;

export type ImagingOsComparisonDomain = (typeof IMAGING_COMPARISON_DOMAINS)[number];

export type ImagingComparisonRequirements = {
  required_baseline_timepoint: ImagingOsTimepoint;
  allowed_followup_timepoints: ImagingOsTimepoint[];
  required_categories: CanonicalHairImageCategory[];
  minimum_images_per_comparison: number;
  requires_same_category_match: boolean;
  requires_quality_threshold: boolean;
  description: string;
};

const IMAGING_COMPARISON_REQUIREMENTS_MAP: Record<
  Exclude<ImagingOsComparisonDomain, "unknown">,
  ImagingComparisonRequirements
> = {
  growth_change: {
    required_baseline_timepoint: "baseline",
    allowed_followup_timepoints: ["month_3", "month_6", "month_12"],
    required_categories: ["front", "top", "crown"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description:
      "Growth change comparison from baseline through standard follow-up intervals across primary scalp views",
  },
  density_change: {
    required_baseline_timepoint: "baseline",
    allowed_followup_timepoints: ["month_6", "month_12"],
    required_categories: ["top", "crown", "microscopic"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description:
      "Density change comparison using overhead and microscopic views at baseline and follow-up",
  },
  donor_recovery_change: {
    required_baseline_timepoint: "pre_op",
    allowed_followup_timepoints: ["immediate_post_op", "day_14", "month_6", "month_12"],
    required_categories: ["donor"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description: "Donor-area recovery comparison across surgical milestones",
  },
  recipient_growth_change: {
    required_baseline_timepoint: "immediate_post_op",
    allowed_followup_timepoints: ["month_6", "month_12"],
    required_categories: ["recipient", "front"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description:
      "Recipient growth comparison from immediate post-operative documentation through outcome follow-up",
  },
  hairline_design_change: {
    required_baseline_timepoint: "pre_op",
    allowed_followup_timepoints: ["month_12"],
    required_categories: ["front"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description: "Hairline design comparison from pre-operative planning to 12-month outcome",
  },
  scalp_visibility_change: {
    required_baseline_timepoint: "baseline",
    allowed_followup_timepoints: ["month_6", "month_12"],
    required_categories: ["top", "crown", "front"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description: "Scalp visibility comparison across baseline and follow-up overhead views",
  },
  graft_survival_change: {
    required_baseline_timepoint: "immediate_post_op",
    allowed_followup_timepoints: ["month_12"],
    required_categories: ["recipient", "graft_tray"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description:
      "Graft survival comparison from immediate post-operative recipient documentation to 12-month outcome",
  },
  longitudinal_medical_response: {
    required_baseline_timepoint: "baseline",
    allowed_followup_timepoints: ["month_3", "month_6", "month_12"],
    required_categories: ["front", "top", "crown"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description:
      "Longitudinal medical treatment response visual comparison across baseline and follow-up intervals",
  },
  revision_comparison: {
    required_baseline_timepoint: "pre_op",
    allowed_followup_timepoints: ["month_12"],
    required_categories: ["front", "top", "crown", "donor", "recipient"],
    minimum_images_per_comparison: 2,
    requires_same_category_match: true,
    requires_quality_threshold: true,
    description:
      "Revision outcome visual comparison from pre-operative baseline to 12-month follow-up",
  },
};

/** Read-only visual comparison requirement registry (Phase IM-8). */
export const IMAGING_COMPARISON_REQUIREMENTS: Readonly<
  Record<Exclude<ImagingOsComparisonDomain, "unknown">, ImagingComparisonRequirements>
> = IMAGING_COMPARISON_REQUIREMENTS_MAP;

export function isImagingOsComparisonDomain(value: string): value is ImagingOsComparisonDomain {
  return (IMAGING_COMPARISON_DOMAINS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Comparison image and candidate models
// ---------------------------------------------------------------------------

export type ImagingOsComparisonImage = {
  image_id?: string;
  patient_id?: string;
  surgical_case_id?: string;
  canonical_category: CanonicalHairImageCategory;
  timepoint: ImagingOsTimepoint;
  quality_status?: ImagingOsImageQualityStatus;
  is_clinically_usable?: boolean;
  captured_at?: string;
  metadata?: Record<string, unknown>;
};

export const IMAGING_COMPARISON_MEASUREMENT_TARGETS = [
  "density",
  "coverage",
  "caliber",
  "donor_density",
  "extraction_healing",
  "scar_visibility",
  "donor_recovery",
  "graft_survival",
  "hairline_position",
  "temporal_angle",
  "frontal_density",
  "recipient_survival",
  "scalp_visibility",
] as const;

export type ImagingOsComparisonMeasurementTarget =
  (typeof IMAGING_COMPARISON_MEASUREMENT_TARGETS)[number];

export type ImagingOsComparisonCandidate = {
  baseline_image: ImagingOsComparisonImage;
  followup_image: ImagingOsComparisonImage;
  category_match: boolean;
  timepoint_delta: string;
  quality_gate_passed: boolean;
  comparison_ready: boolean;
  measurement_targets: ImagingOsComparisonMeasurementTarget[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

export type ImagingOsComparisonReadinessStatus =
  | "ready"
  | "partial"
  | "insufficient_data"
  | "invalid";

export const IMAGING_COMPARISON_EVALUATOR_VERSION = "imaging-comparison-contract-v1" as const;

export type ImagingOsComparisonReadinessResult = {
  domain: ImagingOsComparisonDomain;
  description: string;
  comparison_status: ImagingOsComparisonReadinessStatus;
  readiness_score: number;
  required_baseline_timepoint: ImagingOsTimepoint;
  detected_followup_timepoints: ImagingOsTimepoint[];
  missing_required_categories: CanonicalHairImageCategory[];
  valid_comparison_pairs: ImagingOsComparisonCandidate[];
  invalid_comparison_pairs: ImagingOsComparisonCandidate[];
  measurement_targets_available: ImagingOsComparisonMeasurementTarget[];
  quality_blockers: string[];
  warnings: string[];
  evaluator_version: typeof IMAGING_COMPARISON_EVALUATOR_VERSION;
};

export type EvaluateVisualComparisonReadinessInput = {
  domain: ImagingOsComparisonDomain;
  images: ImagingOsComparisonImage[];
};

const TIMEPOINT_ORDER: Partial<Record<ImagingOsTimepoint, number>> = {
  baseline: 0,
  pre_op: 1,
  immediate_post_op: 2,
  day_14: 3,
  month_3: 4,
  month_6: 5,
  month_9: 6,
  month_12: 7,
  month_18: 8,
  month_24: 9,
  annual_review: 10,
  unknown: 99,
};

function isComparisonImageUsable(image: ImagingOsComparisonImage): boolean {
  if (image.is_clinically_usable === true) {
    return true;
  }
  if (image.is_clinically_usable === false) {
    return false;
  }
  return image.quality_status === "excellent" || image.quality_status === "acceptable";
}

function passesQualityGate(image: ImagingOsComparisonImage): boolean {
  return isComparisonImageUsable(image);
}

function timepointOrder(timepoint: ImagingOsTimepoint): number {
  return TIMEPOINT_ORDER[timepoint] ?? 50;
}

function formatTimepointDelta(baseline: ImagingOsTimepoint, followup: ImagingOsTimepoint): string {
  return `${baseline} → ${followup}`;
}

function uniqueTimepoints(values: ImagingOsTimepoint[]): ImagingOsTimepoint[] {
  return [...new Set(values)];
}

function findBestUsableImage(
  images: ImagingOsComparisonImage[],
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): ImagingOsComparisonImage | undefined {
  return images.find(
    (image) =>
      isComparisonImageUsable(image) &&
      image.timepoint === timepoint &&
      image.canonical_category === category
  );
}

function findBestFollowupImage(
  images: ImagingOsComparisonImage[],
  allowedFollowups: ImagingOsTimepoint[],
  category: CanonicalHairImageCategory,
  requiresSameCategory: boolean
): ImagingOsComparisonImage | undefined {
  const sortedFollowups = [...allowedFollowups].sort(
    (a, b) => timepointOrder(b) - timepointOrder(a)
  );

  for (const followupTimepoint of sortedFollowups) {
    const match = images.find((image) => {
      if (!isComparisonImageUsable(image) || image.timepoint !== followupTimepoint) {
        return false;
      }
      if (requiresSameCategory) {
        return image.canonical_category === category;
      }
      return true;
    });
    if (match) {
      return match;
    }
  }

  return undefined;
}

function buildInvalidComparisonResult(
  domain: ImagingOsComparisonDomain
): ImagingOsComparisonReadinessResult {
  return {
    domain,
    description: "",
    comparison_status: "invalid",
    readiness_score: 0,
    required_baseline_timepoint: "unknown",
    detected_followup_timepoints: [],
    missing_required_categories: [],
    valid_comparison_pairs: [],
    invalid_comparison_pairs: [],
    measurement_targets_available: [],
    quality_blockers: [],
    warnings: ["Unknown or unsupported visual comparison domain."],
    evaluator_version: IMAGING_COMPARISON_EVALUATOR_VERSION,
  };
}

function buildComparisonCandidate(
  baselineImage: ImagingOsComparisonImage,
  followupImage: ImagingOsComparisonImage,
  requiredCategory: CanonicalHairImageCategory,
  requiresSameCategory: boolean,
  domain: ImagingOsComparisonDomain
): ImagingOsComparisonCandidate {
  const categoryMatch = requiresSameCategory
    ? baselineImage.canonical_category === followupImage.canonical_category &&
      baselineImage.canonical_category === requiredCategory
    : true;

  const baselineQualityPass = passesQualityGate(baselineImage);
  const followupQualityPass = passesQualityGate(followupImage);
  const qualityGatePassed = baselineQualityPass && followupQualityPass;

  const warnings: string[] = [];
  if (!categoryMatch) {
    warnings.push(
      `Category mismatch: baseline ${baselineImage.canonical_category} vs follow-up ${followupImage.canonical_category} (required ${requiredCategory}).`
    );
  }
  if (!baselineQualityPass) {
    warnings.push("Baseline image failed quality gate.");
  }
  if (!followupQualityPass) {
    warnings.push("Follow-up image failed quality gate.");
  }

  const comparisonReady =
    categoryMatch && qualityGatePassed && baselineImage != null && followupImage != null;

  return {
    baseline_image: baselineImage,
    followup_image: followupImage,
    category_match: categoryMatch,
    timepoint_delta: formatTimepointDelta(baselineImage.timepoint, followupImage.timepoint),
    quality_gate_passed: qualityGatePassed,
    comparison_ready: comparisonReady,
    measurement_targets: determineMeasurementTargets(domain),
    warnings,
  };
}

/**
 * Evaluate whether an image set supports scientific visual comparison (pure).
 */
export function evaluateVisualComparisonReadiness(
  input: EvaluateVisualComparisonReadinessInput
): ImagingOsComparisonReadinessResult {
  if (input.domain === "unknown") {
    return buildInvalidComparisonResult(input.domain);
  }

  const requirements = IMAGING_COMPARISON_REQUIREMENTS_MAP[input.domain];
  if (!requirements) {
    return buildInvalidComparisonResult(input.domain);
  }

  const requiredCategories = [...new Set(requirements.required_categories)];
  const measurementTargets = determineMeasurementTargets(input.domain);
  const qualityBlockers: string[] = [];
  const warnings: string[] = [];

  for (const image of input.images) {
    if (!isComparisonImageUsable(image)) {
      const label = image.image_id ?? image.canonical_category;
      qualityBlockers.push(
        `Image at ${image.timepoint} (${label}) is not clinically usable for visual comparison.`
      );
    }
  }

  const validPairs: ImagingOsComparisonCandidate[] = [];
  const invalidPairs: ImagingOsComparisonCandidate[] = [];
  const missingCategories: CanonicalHairImageCategory[] = [];
  const detectedFollowups = new Set<ImagingOsTimepoint>();

  let baselineImagesPresent = 0;

  for (const category of requiredCategories) {
    const baselineImage = findBestUsableImage(
      input.images,
      requirements.required_baseline_timepoint,
      category
    );

    if (baselineImage) {
      baselineImagesPresent += 1;
    }

    const followupImage = findBestFollowupImage(
      input.images,
      requirements.allowed_followup_timepoints,
      category,
      requirements.requires_same_category_match
    );

    if (followupImage) {
      detectedFollowups.add(followupImage.timepoint);
    }

    if (!baselineImage || !followupImage) {
      if (baselineImage && !followupImage && requirements.requires_same_category_match) {
        const mismatchedFollowup = findBestFollowupImage(
          input.images,
          requirements.allowed_followup_timepoints,
          category,
          false
        );
        if (mismatchedFollowup && mismatchedFollowup.canonical_category !== category) {
          detectedFollowups.add(mismatchedFollowup.timepoint);
          const candidate = buildComparisonCandidate(
            baselineImage,
            mismatchedFollowup,
            category,
            requirements.requires_same_category_match,
            input.domain
          );
          invalidPairs.push(candidate);
          warnings.push(
            `Category mismatch for ${category}: follow-up image is ${mismatchedFollowup.canonical_category}.`
          );
        }
      }

      missingCategories.push(category);
      if (baselineImage && followupImage) {
        // unreachable but keeps structure clear
      } else if (baselineImage && !followupImage) {
        warnings.push(
          `Missing follow-up image for ${category} at allowed timepoints: ${requirements.allowed_followup_timepoints.join(", ")}.`
        );
      } else if (!baselineImage && followupImage) {
        warnings.push(
          `Missing baseline image for ${category} at ${requirements.required_baseline_timepoint}.`
        );
      } else {
        warnings.push(`Missing baseline and follow-up images for ${category} comparison pair.`);
      }
      continue;
    }

    const candidate = buildComparisonCandidate(
      baselineImage,
      followupImage,
      category,
      requirements.requires_same_category_match,
      input.domain
    );

    if (candidate.comparison_ready) {
      validPairs.push(candidate);
    } else {
      invalidPairs.push(candidate);
    }
  }

  const readinessScore =
    requiredCategories.length === 0
      ? 0
      : Math.round((validPairs.length / requiredCategories.length) * 100);

  let comparisonStatus: ImagingOsComparisonReadinessStatus;
  if (readinessScore === 100) {
    comparisonStatus = "ready";
  } else if (baselineImagesPresent === 0) {
    comparisonStatus = "insufficient_data";
  } else if (readinessScore >= 50 || baselineImagesPresent > 0) {
    comparisonStatus = "partial";
  } else {
    comparisonStatus = "insufficient_data";
  }

  return {
    domain: input.domain,
    description: requirements.description,
    comparison_status: comparisonStatus,
    readiness_score: readinessScore,
    required_baseline_timepoint: requirements.required_baseline_timepoint,
    detected_followup_timepoints: uniqueTimepoints([...detectedFollowups]),
    missing_required_categories: missingCategories,
    valid_comparison_pairs: validPairs,
    invalid_comparison_pairs: invalidPairs,
    measurement_targets_available: measurementTargets,
    quality_blockers: qualityBlockers,
    warnings,
    evaluator_version: IMAGING_COMPARISON_EVALUATOR_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Measurement target helper
// ---------------------------------------------------------------------------

const MEASUREMENT_TARGETS_BY_DOMAIN: Record<
  Exclude<ImagingOsComparisonDomain, "unknown">,
  ImagingOsComparisonMeasurementTarget[]
> = {
  growth_change: ["density", "coverage", "caliber"],
  density_change: ["density", "coverage", "caliber"],
  donor_recovery_change: ["donor_density", "extraction_healing", "scar_visibility"],
  recipient_growth_change: ["recipient_survival", "density", "coverage"],
  hairline_design_change: ["hairline_position", "temporal_angle", "frontal_density"],
  scalp_visibility_change: ["scalp_visibility", "coverage"],
  graft_survival_change: ["graft_survival", "density"],
  longitudinal_medical_response: ["density", "coverage", "caliber"],
  revision_comparison: [
    "density",
    "coverage",
    "hairline_position",
    "donor_recovery",
    "graft_survival",
  ],
};

/** Return possible future measurement targets for a comparison domain (pure). */
export function determineMeasurementTargets(
  domain: ImagingOsComparisonDomain
): ImagingOsComparisonMeasurementTarget[] {
  if (domain === "unknown") {
    return [];
  }
  return [...MEASUREMENT_TARGETS_BY_DOMAIN[domain]];
}

// ---------------------------------------------------------------------------
// Bridge helpers
// ---------------------------------------------------------------------------

/** Build comparison image from unified outcome evidence (pure). */
export function buildComparisonImageFromOutcomeEvidence(
  evidence: ImagingOsOutcomeEvidence
): ImagingOsComparisonImage {
  return {
    ...(evidence.image_id ? { image_id: evidence.image_id } : {}),
    ...(evidence.patient_id ? { patient_id: evidence.patient_id } : {}),
    ...(evidence.surgical_case_id ? { surgical_case_id: evidence.surgical_case_id } : {}),
    canonical_category: evidence.canonical_category,
    timepoint: evidence.timepoint,
    ...(evidence.quality_status != null ? { quality_status: evidence.quality_status } : {}),
    ...(evidence.is_clinically_usable != null
      ? { is_clinically_usable: evidence.is_clinically_usable }
      : {}),
    ...(evidence.metadata ? { metadata: evidence.metadata } : {}),
  };
}

/** Build comparison image from a progression image (pure). */
export function buildComparisonImageFromProgressionImage(
  image: ImagingOsProgressionImage
): ImagingOsComparisonImage {
  return {
    ...(image.image_id ? { image_id: image.image_id } : {}),
    canonical_category: image.canonical_category,
    timepoint: image.timepoint,
    ...(image.captured_at ? { captured_at: image.captured_at } : {}),
    ...(image.quality_status != null && image.quality_status !== "not_evaluated"
      ? { quality_status: image.quality_status }
      : {}),
    ...(image.is_clinically_usable != null
      ? { is_clinically_usable: image.is_clinically_usable }
      : {}),
    ...(image.metadata ? { metadata: image.metadata } : {}),
  };
}

// ---------------------------------------------------------------------------
// Domain recommendation
// ---------------------------------------------------------------------------

export type RecommendComparisonDomainInput = {
  outcome_domain?: ImagingOsOutcomeMeasurementDomain;
  progression_assessment?: ImagingOsProgressionAssessmentType;
  surgical_domain?: ImagingOsSurgicalReadinessDomain;
};

/** Recommend a visual comparison domain from workflow context (pure, conservative). */
export function recommendComparisonDomain(
  input: RecommendComparisonDomainInput
): ImagingOsComparisonDomain | undefined {
  const outcomeDomain = input.outcome_domain;
  if (outcomeDomain === "growth_assessment") {
    return "growth_change";
  }
  if (outcomeDomain === "density_change") {
    return "density_change";
  }
  if (outcomeDomain === "donor_recovery") {
    return "donor_recovery_change";
  }
  if (outcomeDomain === "recipient_survival") {
    return "recipient_growth_change";
  }
  if (outcomeDomain === "hairline_design_review") {
    return "hairline_design_change";
  }
  if (outcomeDomain === "surgical_outcome_audit") {
    return "graft_survival_change";
  }
  if (outcomeDomain === "longitudinal_medical_response") {
    return "longitudinal_medical_response";
  }
  if (outcomeDomain === "revision_outcome_review") {
    return "revision_comparison";
  }

  const assessment = input.progression_assessment;
  if (assessment === "surgery_growth_tracking" || assessment === "hairaudit_outcome_12month") {
    return "growth_change";
  }
  if (assessment === "donor_recovery_tracking") {
    return "donor_recovery_change";
  }
  if (assessment === "hli_longitudinal_review" || assessment === "medical_treatment_response") {
    return "longitudinal_medical_response";
  }

  const surgicalDomain = input.surgical_domain;
  if (surgicalDomain === "donor_recovery") {
    return "donor_recovery_change";
  }
  if (surgicalDomain === "recipient_growth") {
    return "recipient_growth_change";
  }
  if (surgicalDomain === "outcome_audit") {
    return "graft_survival_change";
  }
  if (surgicalDomain === "revision_review") {
    return "revision_comparison";
  }

  return undefined;
}
