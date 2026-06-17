/**
 * ImagingOS — longitudinal progression readiness engine (Phase IM-5).
 * Pure metadata/category/timepoint evaluation; no I/O, AI, or pixel analysis.
 */

import type { CanonicalHairImageCategory } from "./categories";
import type { ImagingOsNormalizedImageIntake } from "./intake";
import type { ImagingOsProtocolType } from "./protocol";
import type {
  ImageQualityResult,
  ImagingOsImageQualityEvaluationResult,
  ImagingOsImageQualityStatus,
} from "./quality";
import { isImagingOsMetadataQualityResult } from "./quality";
import type { ImagingOsSourceSystem, ImagingOsUploadSurface } from "./types";

// ---------------------------------------------------------------------------
// Timepoint model
// ---------------------------------------------------------------------------

export const IMAGING_OS_TIMEPOINTS = [
  "baseline",
  "pre_op",
  "immediate_post_op",
  "day_14",
  "month_3",
  "month_6",
  "month_9",
  "month_12",
  "month_18",
  "month_24",
  "annual_review",
  "unknown",
] as const;

export type ImagingOsTimepoint = (typeof IMAGING_OS_TIMEPOINTS)[number];

const TIMEPOINT_ALIASES: Record<string, ImagingOsTimepoint> = {
  baseline: "baseline",
  before: "baseline",
  initial: "baseline",
  intake: "baseline",
  pre_op: "pre_op",
  preop: "pre_op",
  "pre-op": "pre_op",
  surgery_planning: "pre_op",
  immediate_post_op: "immediate_post_op",
  postop: "immediate_post_op",
  "post-op": "immediate_post_op",
  immediate_postop: "immediate_post_op",
  day_14: "day_14",
  "14_day": "day_14",
  "14-day": "day_14",
  two_week: "day_14",
  "2_week": "day_14",
  month_3: "month_3",
  "3_month": "month_3",
  "3-month": "month_3",
  m3: "month_3",
  month_6: "month_6",
  "6_month": "month_6",
  "6-month": "month_6",
  m6: "month_6",
  month_9: "month_9",
  "9_month": "month_9",
  "9-month": "month_9",
  m9: "month_9",
  month_12: "month_12",
  "12_month": "month_12",
  "12-month": "month_12",
  m12: "month_12",
  one_year: "month_12",
  "1_year": "month_12",
  month_18: "month_18",
  "18_month": "month_18",
  "18-month": "month_18",
  m18: "month_18",
  month_24: "month_24",
  "24_month": "month_24",
  "24-month": "month_24",
  m24: "month_24",
  two_year: "month_24",
  "2_year": "month_24",
  annual_review: "annual_review",
  annual: "annual_review",
  yearly: "annual_review",
  unknown: "unknown",
};

function normalizeTimepointKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Normalize external timepoint labels to canonical ImagingOS timepoints (pure). */
export function normalizeImagingOsTimepoint(value?: string | null): ImagingOsTimepoint {
  if (value == null || value.trim().length === 0) {
    return "unknown";
  }
  const key = normalizeTimepointKey(value);
  return TIMEPOINT_ALIASES[key] ?? "unknown";
}

function mapFollowupMonth(month: number): ImagingOsTimepoint {
  if (month === 3) return "month_3";
  if (month === 6) return "month_6";
  if (month === 9) return "month_9";
  if (month === 12) return "month_12";
  if (month === 14) return "day_14";
  if (month === 18) return "month_18";
  if (month === 24) return "month_24";
  return "unknown";
}

function detectTimepointFromMetadata(metadata: Record<string, unknown>): ImagingOsTimepoint | undefined {
  const timepointRaw = metadata.timepoint ?? metadata.assessment_timepoint;
  if (typeof timepointRaw === "string" && timepointRaw.trim().length > 0) {
    const normalized = normalizeImagingOsTimepoint(timepointRaw);
    if (normalized !== "unknown") {
      return normalized;
    }
  }

  const followupMonth = metadata.followup_month;
  if (typeof followupMonth === "number" && Number.isFinite(followupMonth)) {
    const mapped = mapFollowupMonth(Math.round(followupMonth));
    if (mapped !== "unknown") {
      return mapped;
    }
  }
  if (typeof followupMonth === "string" && followupMonth.trim().length > 0) {
    const parsed = Number.parseInt(followupMonth.trim(), 10);
    if (Number.isFinite(parsed)) {
      const mapped = mapFollowupMonth(parsed);
      if (mapped !== "unknown") {
        return mapped;
      }
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Progression image model
// ---------------------------------------------------------------------------

export type ImagingOsProgressionImage = {
  image_id?: string;
  canonical_category: CanonicalHairImageCategory;
  timepoint: ImagingOsTimepoint;
  captured_at?: string;
  uploaded_at?: string;
  quality_status?: ImagingOsImageQualityStatus | "not_evaluated";
  is_clinically_usable?: boolean;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Progression assessment registry
// ---------------------------------------------------------------------------

export const IMAGING_PROGRESSION_ASSESSMENT_TYPES = [
  "hair_loss_monitoring",
  "medical_treatment_response",
  "surgery_growth_tracking",
  "donor_recovery_tracking",
  "hairaudit_outcome_12month",
  "hli_longitudinal_review",
] as const;

export type ImagingOsProgressionAssessmentType =
  (typeof IMAGING_PROGRESSION_ASSESSMENT_TYPES)[number];

export type ImagingProgressionRequirements = {
  required_timepoints: ImagingOsTimepoint[];
  required_categories: CanonicalHairImageCategory[];
  optional_categories: CanonicalHairImageCategory[];
  minimum_usable_images_per_timepoint: number;
  description: string;
};

const IMAGING_PROGRESSION_REQUIREMENTS_MAP: Record<
  ImagingOsProgressionAssessmentType,
  ImagingProgressionRequirements
> = {
  hair_loss_monitoring: {
    required_timepoints: ["baseline", "month_6", "month_12"],
    required_categories: ["front", "top", "crown"],
    optional_categories: ["left", "right", "microscopic"],
    minimum_usable_images_per_timepoint: 2,
    description: "Longitudinal hair loss monitoring across baseline and follow-up intervals",
  },
  medical_treatment_response: {
    required_timepoints: ["baseline", "month_3", "month_6"],
    required_categories: ["front", "top", "crown"],
    optional_categories: ["microscopic"],
    minimum_usable_images_per_timepoint: 2,
    description: "Medical treatment response tracking at baseline and early follow-up",
  },
  surgery_growth_tracking: {
    required_timepoints: ["pre_op", "immediate_post_op", "month_6", "month_12"],
    required_categories: ["front", "top", "crown", "donor", "recipient"],
    optional_categories: ["left", "right", "graft_tray"],
    minimum_usable_images_per_timepoint: 3,
    description: "Surgical growth and outcome tracking from pre-op through 12-month follow-up",
  },
  donor_recovery_tracking: {
    required_timepoints: ["pre_op", "immediate_post_op", "day_14", "month_6", "month_12"],
    required_categories: ["donor"],
    optional_categories: ["microscopic"],
    minimum_usable_images_per_timepoint: 1,
    description: "Donor-area recovery progression across surgical milestones",
  },
  hairaudit_outcome_12month: {
    required_timepoints: ["baseline", "month_12"],
    required_categories: ["front", "top", "crown", "donor"],
    optional_categories: ["left", "right", "microscopic"],
    minimum_usable_images_per_timepoint: 3,
    description: "HairAudit 12-month outcome assessment comparing baseline to one-year follow-up",
  },
  hli_longitudinal_review: {
    required_timepoints: ["baseline", "month_6", "month_12"],
    required_categories: ["front", "top", "crown"],
    optional_categories: ["microscopic"],
    minimum_usable_images_per_timepoint: 2,
    description: "HLI longitudinal review across baseline and standard follow-up intervals",
  },
};

/** Read-only longitudinal progression requirement registry (Phase IM-5). */
export const IMAGING_PROGRESSION_REQUIREMENTS: Readonly<
  Record<ImagingOsProgressionAssessmentType, ImagingProgressionRequirements>
> = IMAGING_PROGRESSION_REQUIREMENTS_MAP;

export function isImagingOsProgressionAssessmentType(
  value: string
): value is ImagingOsProgressionAssessmentType {
  return (IMAGING_PROGRESSION_ASSESSMENT_TYPES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

export type ImagingOsProgressionReadinessStatus = "ready" | "partial" | "not_ready" | "invalid";

export type ImagingOsProgressionDirection =
  | "improving"
  | "stable"
  | "worsening"
  | "insufficient_data"
  | "not_evaluated";

export const IMAGING_PROGRESSION_EVALUATOR_VERSION = "imaging-progression-readiness-v1" as const;

export type ImagingOsProgressionEvaluationResult = {
  assessment_type: ImagingOsProgressionAssessmentType;
  assessment_description: string;
  readiness_status: ImagingOsProgressionReadinessStatus;
  progression_direction: ImagingOsProgressionDirection;
  completeness_score: number;
  required_timepoints: ImagingOsTimepoint[];
  present_timepoints: ImagingOsTimepoint[];
  missing_timepoints: ImagingOsTimepoint[];
  required_categories: CanonicalHairImageCategory[];
  missing_categories_by_timepoint: Partial<Record<ImagingOsTimepoint, CanonicalHairImageCategory[]>>;
  usable_images_by_timepoint: Partial<Record<ImagingOsTimepoint, number>>;
  unusable_images_by_timepoint: Partial<Record<ImagingOsTimepoint, number>>;
  quality_blockers: string[];
  warnings: string[];
  evaluator_version: typeof IMAGING_PROGRESSION_EVALUATOR_VERSION;
};

export type EvaluateLongitudinalProgressionReadinessInput = {
  assessment_type: ImagingOsProgressionAssessmentType;
  images: ImagingOsProgressionImage[];
};

function isProgressionImageUsable(image: ImagingOsProgressionImage): boolean {
  if (image.is_clinically_usable === true) {
    return true;
  }
  if (image.is_clinically_usable === false) {
    return false;
  }
  return image.quality_status === "excellent" || image.quality_status === "acceptable";
}

function uniqueTimepoints(values: ImagingOsTimepoint[]): ImagingOsTimepoint[] {
  return [...new Set(values)];
}

function buildInvalidProgressionResult(
  assessmentType: ImagingOsProgressionAssessmentType
): ImagingOsProgressionEvaluationResult {
  return {
    assessment_type: assessmentType,
    assessment_description: "",
    readiness_status: "invalid",
    progression_direction: "not_evaluated",
    completeness_score: 0,
    required_timepoints: [],
    present_timepoints: [],
    missing_timepoints: [],
    required_categories: [],
    missing_categories_by_timepoint: {},
    usable_images_by_timepoint: {},
    unusable_images_by_timepoint: {},
    quality_blockers: [],
    warnings: ["Unknown or unsupported progression assessment type."],
    evaluator_version: IMAGING_PROGRESSION_EVALUATOR_VERSION,
  };
}

function resolveProgressionDirection(
  readinessStatus: ImagingOsProgressionReadinessStatus
): ImagingOsProgressionDirection {
  if (readinessStatus === "ready" || readinessStatus === "partial") {
    return "insufficient_data";
  }
  return "not_evaluated";
}

/**
 * Evaluate whether a case image set supports longitudinal progression assessment (pure).
 */
export function evaluateLongitudinalProgressionReadiness(
  input: EvaluateLongitudinalProgressionReadinessInput
): ImagingOsProgressionEvaluationResult {
  const requirements = IMAGING_PROGRESSION_REQUIREMENTS_MAP[input.assessment_type];
  if (!requirements) {
    return buildInvalidProgressionResult(input.assessment_type);
  }

  const requiredTimepoints = uniqueTimepoints(requirements.required_timepoints);
  const requiredCategories = [...new Set(requirements.required_categories)];
  const minimumUsable = requirements.minimum_usable_images_per_timepoint;

  const usableImagesByTimepoint: Partial<Record<ImagingOsTimepoint, number>> = {};
  const unusableImagesByTimepoint: Partial<Record<ImagingOsTimepoint, number>> = {};
  const missingCategoriesByTimepoint: Partial<
    Record<ImagingOsTimepoint, CanonicalHairImageCategory[]>
  > = {};
  const qualityBlockers: string[] = [];
  const warnings: string[] = [];

  const usableCategoriesByTimepoint = new Map<
    ImagingOsTimepoint,
    Set<CanonicalHairImageCategory>
  >();

  for (const image of input.images) {
    const timepoint = image.timepoint;
    const usable = isProgressionImageUsable(image);

    if (usable) {
      usableImagesByTimepoint[timepoint] = (usableImagesByTimepoint[timepoint] ?? 0) + 1;
      const categorySet = usableCategoriesByTimepoint.get(timepoint) ?? new Set();
      categorySet.add(image.canonical_category);
      usableCategoriesByTimepoint.set(timepoint, categorySet);
    } else {
      unusableImagesByTimepoint[timepoint] = (unusableImagesByTimepoint[timepoint] ?? 0) + 1;
      if (requiredTimepoints.includes(timepoint)) {
        const label = image.image_id ?? image.canonical_category;
        qualityBlockers.push(
          `Image at ${timepoint} (${label}) is not clinically usable for progression assessment.`
        );
      }
    }
  }

  const presentTimepoints = requiredTimepoints.filter(
    (timepoint) => (usableImagesByTimepoint[timepoint] ?? 0) > 0
  );
  const missingTimepoints = requiredTimepoints.filter(
    (timepoint) => !presentTimepoints.includes(timepoint)
  );

  let totalCategorySlots = 0;
  let satisfiedCategorySlots = 0;
  let allCategoriesPresent = true;
  let allMinimumCountsMet = true;

  for (const timepoint of requiredTimepoints) {
    const presentCategories = usableCategoriesByTimepoint.get(timepoint) ?? new Set();
    const missingCategories = requiredCategories.filter((cat) => !presentCategories.has(cat));
    if (missingCategories.length > 0) {
      missingCategoriesByTimepoint[timepoint] = missingCategories;
      allCategoriesPresent = false;
    }

    totalCategorySlots += requiredCategories.length;
    satisfiedCategorySlots += requiredCategories.filter((cat) => presentCategories.has(cat)).length;

    const usableCount = usableImagesByTimepoint[timepoint] ?? 0;
    if (usableCount < minimumUsable) {
      allMinimumCountsMet = false;
      if (usableCount > 0) {
        warnings.push(
          `Timepoint ${timepoint} has ${usableCount} usable image(s); minimum is ${minimumUsable}.`
        );
      }
    }
  }

  const timepointCoverage =
    requiredTimepoints.length === 0
      ? 100
      : (presentTimepoints.length / requiredTimepoints.length) * 100;

  const categoryCoverage =
    totalCategorySlots === 0 ? 100 : (satisfiedCategorySlots / totalCategorySlots) * 100;

  const minCountRatios = requiredTimepoints.map((timepoint) => {
    const usableCount = usableImagesByTimepoint[timepoint] ?? 0;
    if (minimumUsable <= 0) return 100;
    return Math.min(100, (usableCount / minimumUsable) * 100);
  });
  const minCountCoverage =
    minCountRatios.length === 0
      ? 100
      : minCountRatios.reduce((sum, value) => sum + value, 0) / minCountRatios.length;

  const completenessScore = Math.round(
    (timepointCoverage + categoryCoverage + minCountCoverage) / 3
  );

  const isReady =
    missingTimepoints.length === 0 &&
    allCategoriesPresent &&
    allMinimumCountsMet;

  let readinessStatus: ImagingOsProgressionReadinessStatus;
  if (isReady) {
    readinessStatus = "ready";
  } else if (completenessScore >= 50) {
    readinessStatus = "partial";
  } else {
    readinessStatus = "not_ready";
  }

  if (missingTimepoints.length > 0) {
    warnings.push(`Missing required timepoints: ${missingTimepoints.join(", ")}.`);
  }

  return {
    assessment_type: input.assessment_type,
    assessment_description: requirements.description,
    readiness_status: readinessStatus,
    progression_direction: resolveProgressionDirection(readinessStatus),
    completeness_score: completenessScore,
    required_timepoints: requiredTimepoints,
    present_timepoints: presentTimepoints,
    missing_timepoints: missingTimepoints,
    required_categories: requiredCategories,
    missing_categories_by_timepoint: missingCategoriesByTimepoint,
    usable_images_by_timepoint: usableImagesByTimepoint,
    unusable_images_by_timepoint: unusableImagesByTimepoint,
    quality_blockers: qualityBlockers,
    warnings,
    evaluator_version: IMAGING_PROGRESSION_EVALUATOR_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Workflow recommendation
// ---------------------------------------------------------------------------

export type RecommendProgressionAssessmentForWorkflowInput = {
  source_system?: ImagingOsSourceSystem;
  upload_surface?: ImagingOsUploadSurface;
  protocol?: ImagingOsProtocolType;
};

/** Recommend a longitudinal progression assessment from workflow context (pure, conservative). */
export function recommendProgressionAssessmentForWorkflow(
  input: RecommendProgressionAssessmentForWorkflowInput
): ImagingOsProgressionAssessmentType | undefined {
  const source = input.source_system?.trim().toLowerCase();
  const surface = input.upload_surface?.trim().toLowerCase();
  const protocol = input.protocol;

  if (protocol === "donor_analysis") {
    return "donor_recovery_tracking";
  }

  const isHairAuditSource =
    source === "hairaudit" || surface === "audit_upload" || surface === "hairaudit_case_upload";

  if (isHairAuditSource && protocol === "surgery_followup_12month") {
    return "hairaudit_outcome_12month";
  }

  if (source === "hli" || surface === "hli_intake") {
    return "hli_longitudinal_review";
  }

  if (source === "surgery_os" || surface === "surgery_workflow") {
    return "surgery_growth_tracking";
  }

  if (
    source === "consultation_os" ||
    surface === "consultation_form" ||
    surface === "fi_consultation"
  ) {
    return "hair_loss_monitoring";
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Intake adapter
// ---------------------------------------------------------------------------

export type BuildProgressionImageFromIntakeInput = {
  intake: ImagingOsNormalizedImageIntake;
  quality?: ImagingOsImageQualityEvaluationResult | ImageQualityResult;
};

function resolveQualityFromIntake(
  quality: ImagingOsImageQualityEvaluationResult | ImageQualityResult | undefined
): Pick<ImagingOsProgressionImage, "quality_status" | "is_clinically_usable"> {
  if (quality == null) {
    return { quality_status: "not_evaluated", is_clinically_usable: false };
  }

  if (isImagingOsMetadataQualityResult(quality)) {
    return {
      quality_status: quality.quality_status,
      is_clinically_usable: quality.is_clinically_usable,
    };
  }

  return { quality_status: "not_evaluated", is_clinically_usable: false };
}

/** Build a progression image from normalized intake and optional quality evaluation (pure). */
export function buildProgressionImageFromIntake(
  input: BuildProgressionImageFromIntakeInput
): ImagingOsProgressionImage {
  const { intake, quality } = input;
  const detectedTimepoint = detectTimepointFromMetadata(intake.metadata);
  const timepoint = detectedTimepoint ?? "unknown";
  const qualityFields = resolveQualityFromIntake(quality);

  return {
    ...(intake.external_image_id ? { image_id: intake.external_image_id } : {}),
    canonical_category: intake.canonical_photo_category,
    timepoint,
    ...(intake.captured_at ? { captured_at: intake.captured_at } : {}),
    ...(intake.uploaded_at ? { uploaded_at: intake.uploaded_at } : {}),
    ...qualityFields,
    metadata: intake.metadata,
  };
}

// ---------------------------------------------------------------------------
// Case-level orchestration
// ---------------------------------------------------------------------------

export type RunImagingOsCaseProgressionEvaluationInput = {
  assessment_type: ImagingOsProgressionAssessmentType;
  images: ImagingOsProgressionImage[];
};

/** Run case-level longitudinal progression evaluation (pure). */
export function runImagingOsCaseProgressionEvaluation(
  input: RunImagingOsCaseProgressionEvaluationInput
): ImagingOsProgressionEvaluationResult {
  return evaluateLongitudinalProgressionReadiness(input);
}
