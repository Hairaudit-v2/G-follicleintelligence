/**
 * ImagingOS — outcome measurement contracts (Phase IM-7).
 * Pure evidence/readiness evaluation; no I/O, AI, or pixel analysis.
 */

import type { CanonicalHairImageCategory } from "./categories";
import type { ImagingOsProgressionImage } from "./progression";
import type { ImagingOsTimepoint } from "./progression";
import type { ImagingOsProtocolType } from "./protocol";
import type { ImagingOsProgressionAssessmentType } from "./progression";
import type { ImagingOsImageQualityStatus } from "./quality";
import type {
  ImagingOsSurgicalImage,
  ImagingOsSurgicalImageEventType,
  ImagingOsSurgicalReadinessDomain,
} from "./surgical";

// ---------------------------------------------------------------------------
// Outcome measurement domain model
// ---------------------------------------------------------------------------

export const IMAGING_OUTCOME_MEASUREMENT_DOMAINS = [
  "growth_assessment",
  "density_change",
  "donor_recovery",
  "recipient_survival",
  "hairline_design_review",
  "patient_satisfaction_linkage",
  "surgical_outcome_audit",
  "revision_outcome_review",
  "longitudinal_medical_response",
  "unknown",
] as const;

export type ImagingOsOutcomeMeasurementDomain =
  (typeof IMAGING_OUTCOME_MEASUREMENT_DOMAINS)[number];

export type ImagingOutcomeMeasurementRequirements = {
  required_timepoints: ImagingOsTimepoint[];
  required_categories: CanonicalHairImageCategory[];
  optional_categories: CanonicalHairImageCategory[];
  required_surgical_events?: ImagingOsSurgicalImageEventType[];
  minimum_usable_images_per_timepoint: number;
  requires_baseline: boolean;
  requires_quality_threshold: boolean;
  description: string;
};

const IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS_MAP: Record<
  Exclude<ImagingOsOutcomeMeasurementDomain, "unknown">,
  ImagingOutcomeMeasurementRequirements
> = {
  growth_assessment: {
    required_timepoints: ["baseline", "month_6", "month_12"],
    required_categories: ["front", "top", "crown"],
    optional_categories: ["left", "right", "microscopic"],
    minimum_usable_images_per_timepoint: 2,
    requires_baseline: true,
    requires_quality_threshold: true,
    description:
      "Growth assessment comparing baseline through 6- and 12-month follow-up across primary scalp views",
  },
  density_change: {
    required_timepoints: ["baseline", "month_12"],
    required_categories: ["top", "crown", "microscopic"],
    optional_categories: ["front"],
    minimum_usable_images_per_timepoint: 2,
    requires_baseline: true,
    requires_quality_threshold: true,
    description:
      "Density change evaluation using overhead and microscopic views at baseline and 12 months",
  },
  donor_recovery: {
    required_timepoints: ["pre_op", "immediate_post_op", "day_14", "month_6"],
    required_categories: ["donor"],
    optional_categories: ["microscopic"],
    minimum_usable_images_per_timepoint: 1,
    requires_baseline: false,
    requires_quality_threshold: true,
    description: "Donor-area recovery progression across surgical milestones",
  },
  recipient_survival: {
    required_timepoints: ["immediate_post_op", "month_12"],
    required_categories: ["recipient", "front"],
    optional_categories: ["top", "crown"],
    minimum_usable_images_per_timepoint: 2,
    requires_baseline: false,
    requires_quality_threshold: true,
    description: "Recipient graft survival tracking from immediate post-op through 12-month outcome",
  },
  hairline_design_review: {
    required_timepoints: ["pre_op", "month_12"],
    required_categories: ["front"],
    optional_categories: ["hairline", "temporal"],
    minimum_usable_images_per_timepoint: 2,
    requires_baseline: false,
    requires_quality_threshold: true,
    description: "Hairline design review comparing pre-operative planning to 12-month outcome",
  },
  patient_satisfaction_linkage: {
    required_timepoints: ["baseline", "month_12"],
    required_categories: ["front"],
    optional_categories: ["top", "crown"],
    minimum_usable_images_per_timepoint: 1,
    requires_baseline: true,
    requires_quality_threshold: false,
    description:
      "Patient satisfaction linkage evidence pairing baseline and outcome front-view documentation",
  },
  surgical_outcome_audit: {
    required_timepoints: ["pre_op", "immediate_post_op", "month_12"],
    required_categories: ["front", "top", "crown", "donor", "recipient"],
    optional_categories: ["left", "right", "microscopic", "graft_tray"],
    required_surgical_events: ["graft_tray", "implantation_complete"],
    minimum_usable_images_per_timepoint: 3,
    requires_baseline: false,
    requires_quality_threshold: true,
    description:
      "Surgical outcome audit comparing pre-op, immediate post-op, and 12-month results with intraoperative evidence",
  },
  revision_outcome_review: {
    required_timepoints: ["pre_op", "month_12"],
    required_categories: ["front", "top", "crown", "donor", "recipient"],
    optional_categories: ["microscopic"],
    required_surgical_events: ["revision_review"],
    minimum_usable_images_per_timepoint: 2,
    requires_baseline: false,
    requires_quality_threshold: true,
    description: "Revision outcome review with pre-operative baseline and revision-specific documentation",
  },
  longitudinal_medical_response: {
    required_timepoints: ["baseline", "month_3", "month_6", "month_12"],
    required_categories: ["front", "top", "crown"],
    optional_categories: ["microscopic"],
    minimum_usable_images_per_timepoint: 2,
    requires_baseline: true,
    requires_quality_threshold: true,
    description:
      "Longitudinal medical treatment response across baseline and standard follow-up intervals",
  },
};

/** Read-only outcome measurement requirement registry (Phase IM-7). */
export const IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS: Readonly<
  Record<
    Exclude<ImagingOsOutcomeMeasurementDomain, "unknown">,
    ImagingOutcomeMeasurementRequirements
  >
> = IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS_MAP;

export function isImagingOsOutcomeMeasurementDomain(
  value: string
): value is ImagingOsOutcomeMeasurementDomain {
  return (IMAGING_OUTCOME_MEASUREMENT_DOMAINS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Unified outcome evidence model
// ---------------------------------------------------------------------------

export type ImagingOsOutcomeEvidence = {
  image_id?: string;
  patient_id?: string;
  surgical_case_id?: string;
  canonical_category: CanonicalHairImageCategory;
  timepoint: ImagingOsTimepoint;
  surgical_event?: ImagingOsSurgicalImageEventType;
  quality_status?: ImagingOsImageQualityStatus;
  is_clinically_usable?: boolean;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

export type ImagingOsOutcomeMeasurementStatus =
  | "measurable"
  | "partially_measurable"
  | "insufficient_evidence"
  | "invalid";

export const IMAGING_OUTCOME_MEASUREMENT_EVALUATOR_VERSION =
  "imaging-outcome-contract-v1" as const;

export type ImagingOsOutcomeMeasurementResult = {
  domain: ImagingOsOutcomeMeasurementDomain;
  description: string;
  measurement_status: ImagingOsOutcomeMeasurementStatus;
  readiness_score: number;
  required_timepoints: ImagingOsTimepoint[];
  present_timepoints: ImagingOsTimepoint[];
  missing_timepoints: ImagingOsTimepoint[];
  required_categories: CanonicalHairImageCategory[];
  missing_categories_by_timepoint: Partial<
    Record<ImagingOsTimepoint, CanonicalHairImageCategory[]>
  >;
  required_surgical_events: ImagingOsSurgicalImageEventType[];
  missing_surgical_events: ImagingOsSurgicalImageEventType[];
  usable_evidence_count: number;
  unusable_evidence_count: number;
  quality_blockers: string[];
  recommended_next_capture: string;
  evaluator_version: typeof IMAGING_OUTCOME_MEASUREMENT_EVALUATOR_VERSION;
};

export type EvaluateOutcomeMeasurementReadinessInput = {
  domain: ImagingOsOutcomeMeasurementDomain;
  evidence: ImagingOsOutcomeEvidence[];
};

export type RecommendNextCaptureRequirementsResult = {
  missing_timepoints: ImagingOsTimepoint[];
  missing_categories: Partial<Record<ImagingOsTimepoint, CanonicalHairImageCategory[]>>;
  next_recommended_capture: string;
  priority_level?: "high" | "medium" | "low";
};

function isOutcomeEvidenceUsable(evidence: ImagingOsOutcomeEvidence): boolean {
  if (evidence.is_clinically_usable === true) {
    return true;
  }
  if (evidence.is_clinically_usable === false) {
    return false;
  }
  return evidence.quality_status === "excellent" || evidence.quality_status === "acceptable";
}

function uniqueTimepoints(values: ImagingOsTimepoint[]): ImagingOsTimepoint[] {
  return [...new Set(values)];
}

function uniqueEvents(
  values: ImagingOsSurgicalImageEventType[]
): ImagingOsSurgicalImageEventType[] {
  return [...new Set(values)];
}

function buildInvalidOutcomeResult(
  domain: ImagingOsOutcomeMeasurementDomain
): ImagingOsOutcomeMeasurementResult {
  return {
    domain,
    description: "",
    measurement_status: "invalid",
    readiness_score: 0,
    required_timepoints: [],
    present_timepoints: [],
    missing_timepoints: [],
    required_categories: [],
    missing_categories_by_timepoint: {},
    required_surgical_events: [],
    missing_surgical_events: [],
    usable_evidence_count: 0,
    unusable_evidence_count: 0,
    quality_blockers: [],
    recommended_next_capture: "Unknown or unsupported outcome measurement domain.",
    evaluator_version: IMAGING_OUTCOME_MEASUREMENT_EVALUATOR_VERSION,
  };
}

function formatTimepointCategoryLabel(
  timepoint: ImagingOsTimepoint,
  category: CanonicalHairImageCategory
): string {
  return `${timepoint} ${category}`;
}

/**
 * Evaluate whether a case evidence set supports objective outcome measurement (pure).
 */
export function evaluateOutcomeMeasurementReadiness(
  input: EvaluateOutcomeMeasurementReadinessInput
): ImagingOsOutcomeMeasurementResult {
  if (input.domain === "unknown") {
    return buildInvalidOutcomeResult(input.domain);
  }

  const requirements = IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS_MAP[input.domain];
  if (!requirements) {
    return buildInvalidOutcomeResult(input.domain);
  }

  const requiredTimepoints = uniqueTimepoints(requirements.required_timepoints);
  const requiredCategories = [...new Set(requirements.required_categories)];
  const requiredSurgicalEvents = uniqueEvents(requirements.required_surgical_events ?? []);
  const minimumUsable = requirements.minimum_usable_images_per_timepoint;

  const missingCategoriesByTimepoint: Partial<
    Record<ImagingOsTimepoint, CanonicalHairImageCategory[]>
  > = {};
  const qualityBlockers: string[] = [];

  const usableCategoriesByTimepoint = new Map<
    ImagingOsTimepoint,
    Set<CanonicalHairImageCategory>
  >();
  const usableImagesByTimepoint: Partial<Record<ImagingOsTimepoint, number>> = {};
  const presentSurgicalEvents = new Set<ImagingOsSurgicalImageEventType>();

  let usableEvidenceCount = 0;
  let unusableEvidenceCount = 0;

  for (const item of input.evidence) {
    const usable = isOutcomeEvidenceUsable(item);

    if (usable) {
      usableEvidenceCount += 1;
      const timepoint = item.timepoint;
      usableImagesByTimepoint[timepoint] = (usableImagesByTimepoint[timepoint] ?? 0) + 1;
      const categorySet = usableCategoriesByTimepoint.get(timepoint) ?? new Set();
      categorySet.add(item.canonical_category);
      usableCategoriesByTimepoint.set(timepoint, categorySet);
      if (item.surgical_event != null && item.surgical_event !== "unknown") {
        presentSurgicalEvents.add(item.surgical_event);
      }
    } else {
      unusableEvidenceCount += 1;
      if (requiredTimepoints.includes(item.timepoint)) {
        const label = item.image_id ?? item.canonical_category;
        qualityBlockers.push(
          `Evidence at ${item.timepoint} (${label}) is not clinically usable for outcome measurement.`
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
    }
  }

  const presentSurgicalEventList = requiredSurgicalEvents.filter((event) =>
    presentSurgicalEvents.has(event)
  );
  const missingSurgicalEvents = requiredSurgicalEvents.filter(
    (event) => !presentSurgicalEvents.has(event)
  );

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

  const surgicalEventCoverage =
    requiredSurgicalEvents.length === 0
      ? 100
      : (presentSurgicalEventList.length / requiredSurgicalEvents.length) * 100;

  const coverageDimensions =
    requiredSurgicalEvents.length > 0
      ? [timepointCoverage, categoryCoverage, surgicalEventCoverage, minCountCoverage]
      : [timepointCoverage, categoryCoverage, minCountCoverage];

  const readinessScore = Math.round(
    coverageDimensions.reduce((sum, value) => sum + value, 0) / coverageDimensions.length
  );

  const baselineRequirementMet =
    !requirements.requires_baseline ||
    presentTimepoints.includes("baseline") ||
    (usableImagesByTimepoint.baseline ?? 0) >= minimumUsable;

  const allRequiredElementsPresent =
    missingTimepoints.length === 0 &&
    allCategoriesPresent &&
    allMinimumCountsMet &&
    missingSurgicalEvents.length === 0 &&
    baselineRequirementMet;

  let measurementStatus: ImagingOsOutcomeMeasurementStatus;
  if (readinessScore >= 90 && allRequiredElementsPresent) {
    measurementStatus = "measurable";
  } else if (readinessScore >= 50) {
    measurementStatus = "partially_measurable";
  } else {
    measurementStatus = "insufficient_evidence";
  }

  const resultWithoutRecommendation: Omit<ImagingOsOutcomeMeasurementResult, "recommended_next_capture"> =
    {
      domain: input.domain,
      description: requirements.description,
      measurement_status: measurementStatus,
      readiness_score: readinessScore,
      required_timepoints: requiredTimepoints,
      present_timepoints: presentTimepoints,
      missing_timepoints: missingTimepoints,
      required_categories: requiredCategories,
      missing_categories_by_timepoint: missingCategoriesByTimepoint,
      required_surgical_events: requiredSurgicalEvents,
      missing_surgical_events: missingSurgicalEvents,
      usable_evidence_count: usableEvidenceCount,
      unusable_evidence_count: unusableEvidenceCount,
      quality_blockers: qualityBlockers,
      evaluator_version: IMAGING_OUTCOME_MEASUREMENT_EVALUATOR_VERSION,
    };

  const recommendation = recommendNextCaptureRequirements(resultWithoutRecommendation);

  return {
    ...resultWithoutRecommendation,
    recommended_next_capture: recommendation.next_recommended_capture,
  };
}

/**
 * Recommend the next capture action from an outcome measurement result (pure).
 */
export function recommendNextCaptureRequirements(
  result: Omit<ImagingOsOutcomeMeasurementResult, "recommended_next_capture">
): RecommendNextCaptureRequirementsResult {
  if (result.measurement_status === "measurable") {
    return {
      missing_timepoints: [],
      missing_categories: {},
      next_recommended_capture: "Outcome dataset complete.",
    };
  }

  if (result.measurement_status === "invalid") {
    return {
      missing_timepoints: [],
      missing_categories: {},
      next_recommended_capture: "Unknown or unsupported outcome measurement domain.",
    };
  }

  const missingTimepoints = [...result.missing_timepoints];
  const missingCategories = { ...result.missing_categories_by_timepoint };

  if (result.missing_surgical_events.length > 0) {
    const event = result.missing_surgical_events[0];
    const priorityLevel: RecommendNextCaptureRequirementsResult["priority_level"] =
      result.readiness_score < 50 ? "high" : "medium";
    return {
      missing_timepoints: missingTimepoints,
      missing_categories: missingCategories,
      next_recommended_capture: `Capture ${event} surgical event documentation to complete ${result.domain.replace(/_/g, " ")} dataset.`,
      priority_level: priorityLevel,
    };
  }

  for (const timepoint of result.required_timepoints) {
    const missing = missingCategories[timepoint];
    if (missing != null && missing.length > 0) {
      const category = missing[0];
      const priorityLevel: RecommendNextCaptureRequirementsResult["priority_level"] =
        timepoint === "month_12" || timepoint === "baseline" ? "high" : "medium";
      return {
        missing_timepoints: missingTimepoints,
        missing_categories: missingCategories,
        next_recommended_capture: `Capture ${formatTimepointCategoryLabel(timepoint, category)} image to complete ${result.domain.replace(/_/g, " ")} dataset.`,
        priority_level: priorityLevel,
      };
    }
  }

  if (missingTimepoints.length > 0) {
    const timepoint = missingTimepoints[0];
    const priorityLevel: RecommendNextCaptureRequirementsResult["priority_level"] =
      timepoint === "month_12" || timepoint === "baseline" ? "high" : "medium";
    return {
      missing_timepoints: missingTimepoints,
      missing_categories: missingCategories,
      next_recommended_capture: `Capture ${timepoint} images to complete ${result.domain.replace(/_/g, " ")} dataset.`,
      priority_level: priorityLevel,
    };
  }

  return {
    missing_timepoints: missingTimepoints,
    missing_categories: missingCategories,
    next_recommended_capture: `Additional usable images required to complete ${result.domain.replace(/_/g, " ")} dataset.`,
    priority_level: "low",
  };
}

// ---------------------------------------------------------------------------
// Evidence bridge helpers
// ---------------------------------------------------------------------------

/** Build unified outcome evidence from a progression image (pure). */
export function buildOutcomeEvidenceFromProgressionImage(
  image: ImagingOsProgressionImage
): ImagingOsOutcomeEvidence {
  return {
    ...(image.image_id ? { image_id: image.image_id } : {}),
    canonical_category: image.canonical_category,
    timepoint: image.timepoint,
    ...(image.quality_status != null && image.quality_status !== "not_evaluated"
      ? { quality_status: image.quality_status }
      : image.quality_status === "not_evaluated"
        ? {}
        : {}),
    ...(image.is_clinically_usable != null
      ? { is_clinically_usable: image.is_clinically_usable }
      : {}),
    ...(image.metadata ? { metadata: image.metadata } : {}),
  };
}

/** Build unified outcome evidence from a surgical image (pure). */
export function buildOutcomeEvidenceFromSurgicalImage(
  image: ImagingOsSurgicalImage
): ImagingOsOutcomeEvidence {
  const timepoint =
    image.timepoint != null && image.timepoint !== "unknown"
      ? image.timepoint
      : mapSurgicalEventToTimepoint(image.surgical_event);

  return {
    ...(image.image_id ? { image_id: image.image_id } : {}),
    ...(image.patient_id ? { patient_id: image.patient_id } : {}),
    ...(image.surgical_case_id ? { surgical_case_id: image.surgical_case_id } : {}),
    canonical_category: image.canonical_category,
    timepoint,
    surgical_event: image.surgical_event,
    ...(image.quality_status != null && image.quality_status !== "not_evaluated"
      ? { quality_status: image.quality_status }
      : {}),
    ...(image.is_clinically_usable != null
      ? { is_clinically_usable: image.is_clinically_usable }
      : {}),
    ...(image.metadata ? { metadata: image.metadata } : {}),
  };
}

function mapSurgicalEventToTimepoint(
  event: ImagingOsSurgicalImageEventType
): ImagingOsTimepoint {
  switch (event) {
    case "pre_op":
    case "recipient_design":
    case "donor_mapping":
      return "pre_op";
    case "immediate_post_op":
      return "immediate_post_op";
    case "day_14_review":
      return "day_14";
    case "month_3_review":
      return "month_3";
    case "month_6_review":
      return "month_6";
    case "month_12_outcome":
      return "month_12";
    case "revision_review":
      return "pre_op";
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Domain recommendation
// ---------------------------------------------------------------------------

export type RecommendOutcomeMeasurementDomainInput = {
  progression_assessment?: ImagingOsProgressionAssessmentType;
  surgical_domain?: ImagingOsSurgicalReadinessDomain;
  protocol?: ImagingOsProtocolType;
};

/** Recommend an outcome measurement domain from workflow context (pure, conservative). */
export function recommendOutcomeMeasurementDomain(
  input: RecommendOutcomeMeasurementDomainInput
): ImagingOsOutcomeMeasurementDomain | undefined {
  const assessment = input.progression_assessment;
  if (assessment === "surgery_growth_tracking" || assessment === "hairaudit_outcome_12month") {
    return "growth_assessment";
  }
  if (assessment === "donor_recovery_tracking") {
    return "donor_recovery";
  }
  if (assessment === "hli_longitudinal_review") {
    return "longitudinal_medical_response";
  }

  const surgicalDomain = input.surgical_domain;
  if (surgicalDomain === "donor_recovery") {
    return "donor_recovery";
  }
  if (surgicalDomain === "recipient_growth") {
    return "recipient_survival";
  }
  if (surgicalDomain === "outcome_audit") {
    return "surgical_outcome_audit";
  }
  if (surgicalDomain === "revision_review") {
    return "revision_outcome_review";
  }

  return undefined;
}
