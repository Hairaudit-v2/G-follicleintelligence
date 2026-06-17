/**
 * ImagingOS — surgical image intelligence hooks (Phase IM-6).
 * Pure metadata/event/category evaluation; no I/O, AI, or pixel analysis.
 */

import type { CanonicalHairImageCategory } from "./categories";
import type { ImagingOsNormalizedImageIntake } from "./intake";
import { normalizeImagingOsTimepoint, type ImagingOsTimepoint } from "./progression";
import type { ImagingOsProgressionAssessmentType } from "./progression";
import type { ImagingOsProtocolType } from "./protocol";
import type {
  ImageQualityResult,
  ImagingOsImageQualityEvaluationResult,
  ImagingOsImageQualityStatus,
} from "./quality";
import { isImagingOsMetadataQualityResult } from "./quality";

// ---------------------------------------------------------------------------
// Surgical event model
// ---------------------------------------------------------------------------

export const IMAGING_OS_SURGICAL_IMAGE_EVENT_TYPES = [
  "pre_op",
  "recipient_design",
  "donor_mapping",
  "graft_tray",
  "extraction_documentation",
  "implantation_documentation",
  "implantation_complete",
  "immediate_post_op",
  "day_14_review",
  "month_3_review",
  "month_6_review",
  "month_12_outcome",
  "revision_review",
  "unknown",
] as const;

export type ImagingOsSurgicalImageEventType =
  (typeof IMAGING_OS_SURGICAL_IMAGE_EVENT_TYPES)[number];

const SURGICAL_EVENT_ALIASES: Record<string, ImagingOsSurgicalImageEventType> = {
  pre_op: "pre_op",
  before: "pre_op",
  baseline: "pre_op",
  preop: "pre_op",
  "pre-op": "pre_op",
  recipient_design: "recipient_design",
  hairline_design: "recipient_design",
  recipient_plan: "recipient_design",
  recipient_mapping: "recipient_design",
  donor_mapping: "donor_mapping",
  donor_plan: "donor_mapping",
  donor_zone: "donor_mapping",
  donor_marking: "donor_mapping",
  graft_tray: "graft_tray",
  grafts: "graft_tray",
  graft_count: "graft_tray",
  graft_table: "graft_tray",
  graft_photo: "graft_tray",
  extraction_documentation: "extraction_documentation",
  extraction: "extraction_documentation",
  extraction_phase: "extraction_documentation",
  donor_extraction: "extraction_documentation",
  implantation_documentation: "implantation_documentation",
  implantation: "implantation_documentation",
  implanting: "implantation_documentation",
  recipient_implantation: "implantation_documentation",
  implantation_complete: "implantation_complete",
  complete: "implantation_complete",
  final_implantation: "implantation_complete",
  placement_complete: "implantation_complete",
  immediate_post_op: "immediate_post_op",
  postop: "immediate_post_op",
  "post-op": "immediate_post_op",
  immediate_postop: "immediate_post_op",
  day_14_review: "day_14_review",
  "14_day": "day_14_review",
  day14: "day_14_review",
  two_week: "day_14_review",
  "2_week": "day_14_review",
  month_3_review: "month_3_review",
  "3_month": "month_3_review",
  m3: "month_3_review",
  month_6_review: "month_6_review",
  "6_month": "month_6_review",
  m6: "month_6_review",
  month_12_outcome: "month_12_outcome",
  "12_month": "month_12_outcome",
  month_12: "month_12_outcome",
  m12: "month_12_outcome",
  one_year: "month_12_outcome",
  revision_review: "revision_review",
  revision: "revision_review",
  repair: "revision_review",
  correction: "revision_review",
  unknown: "unknown",
  missing: "unknown",
};

function normalizeSurgicalEventKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Normalize external surgical event labels to canonical ImagingOS surgical events (pure). */
export function normalizeSurgicalImageEventType(
  value?: string | null
): ImagingOsSurgicalImageEventType {
  if (value == null || value.trim().length === 0) {
    return "unknown";
  }
  const key = normalizeSurgicalEventKey(value);
  return SURGICAL_EVENT_ALIASES[key] ?? "unknown";
}

// ---------------------------------------------------------------------------
// Surgical image model
// ---------------------------------------------------------------------------

export type ImagingOsSurgicalImage = {
  image_id?: string;
  surgical_case_id?: string;
  patient_id?: string;
  canonical_category: CanonicalHairImageCategory;
  surgical_event: ImagingOsSurgicalImageEventType;
  timepoint?: ImagingOsTimepoint;
  captured_at?: string;
  uploaded_at?: string;
  quality_status?: ImagingOsImageQualityStatus | "not_evaluated";
  is_clinically_usable?: boolean;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Surgical readiness domain registry
// ---------------------------------------------------------------------------

export const IMAGING_SURGICAL_READINESS_DOMAINS = [
  "surgery_planning",
  "intraoperative_documentation",
  "donor_recovery",
  "recipient_growth",
  "outcome_audit",
  "revision_review",
] as const;

export type ImagingOsSurgicalReadinessDomain =
  (typeof IMAGING_SURGICAL_READINESS_DOMAINS)[number];

export type ImagingSurgicalReadinessRequirements = {
  required_events: ImagingOsSurgicalImageEventType[];
  required_categories: CanonicalHairImageCategory[];
  optional_categories: CanonicalHairImageCategory[];
  minimum_usable_images_per_event: number;
  description: string;
};

const IMAGING_SURGICAL_READINESS_REQUIREMENTS_MAP: Record<
  ImagingOsSurgicalReadinessDomain,
  ImagingSurgicalReadinessRequirements
> = {
  surgery_planning: {
    required_events: ["pre_op", "recipient_design", "donor_mapping"],
    required_categories: ["front", "top", "crown", "donor", "recipient"],
    optional_categories: ["left", "right", "microscopic"],
    minimum_usable_images_per_event: 2,
    description:
      "Pre-operative planning evidence across recipient design and donor mapping milestones",
  },
  intraoperative_documentation: {
    required_events: ["graft_tray", "extraction_documentation", "implantation_complete"],
    required_categories: ["graft_tray", "donor", "recipient"],
    optional_categories: ["immediate_post_op"],
    minimum_usable_images_per_event: 1,
    description: "Intraoperative graft, extraction, and implantation documentation",
  },
  donor_recovery: {
    required_events: ["pre_op", "immediate_post_op", "day_14_review", "month_6_review", "month_12_outcome"],
    required_categories: ["donor"],
    optional_categories: ["microscopic"],
    minimum_usable_images_per_event: 1,
    description: "Donor-area recovery progression across surgical milestones",
  },
  recipient_growth: {
    required_events: ["pre_op", "immediate_post_op", "month_6_review", "month_12_outcome"],
    required_categories: ["front", "top", "crown", "recipient"],
    optional_categories: ["left", "right"],
    minimum_usable_images_per_event: 2,
    description: "Recipient-area growth tracking from pre-op through 12-month outcome",
  },
  outcome_audit: {
    required_events: ["pre_op", "immediate_post_op", "month_12_outcome"],
    required_categories: ["front", "top", "crown", "donor", "recipient"],
    optional_categories: ["left", "right", "microscopic", "graft_tray"],
    minimum_usable_images_per_event: 3,
    description: "Outcome audit evidence comparing pre-op, immediate post-op, and 12-month results",
  },
  revision_review: {
    required_events: ["revision_review", "pre_op"],
    required_categories: ["front", "top", "crown", "donor", "recipient"],
    optional_categories: ["microscopic"],
    minimum_usable_images_per_event: 2,
    description: "Revision case review with baseline pre-op and revision-specific documentation",
  },
};

/** Read-only surgical readiness requirement registry (Phase IM-6). */
export const IMAGING_SURGICAL_READINESS_REQUIREMENTS: Readonly<
  Record<ImagingOsSurgicalReadinessDomain, ImagingSurgicalReadinessRequirements>
> = IMAGING_SURGICAL_READINESS_REQUIREMENTS_MAP;

export function isImagingOsSurgicalReadinessDomain(
  value: string
): value is ImagingOsSurgicalReadinessDomain {
  return (IMAGING_SURGICAL_READINESS_DOMAINS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

export type ImagingOsSurgicalReadinessStatus = "ready" | "partial" | "not_ready" | "invalid";

export const IMAGING_SURGICAL_READINESS_EVALUATOR_VERSION =
  "imaging-surgical-readiness-v1" as const;

export type ImagingOsSurgicalReadinessResult = {
  domain: ImagingOsSurgicalReadinessDomain;
  domain_description: string;
  readiness_status: ImagingOsSurgicalReadinessStatus;
  completeness_score: number;
  required_events: ImagingOsSurgicalImageEventType[];
  present_events: ImagingOsSurgicalImageEventType[];
  missing_events: ImagingOsSurgicalImageEventType[];
  required_categories: CanonicalHairImageCategory[];
  missing_categories_by_event: Partial<
    Record<ImagingOsSurgicalImageEventType, CanonicalHairImageCategory[]>
  >;
  usable_images_by_event: Partial<Record<ImagingOsSurgicalImageEventType, number>>;
  unusable_images_by_event: Partial<Record<ImagingOsSurgicalImageEventType, number>>;
  quality_blockers: string[];
  warnings: string[];
  evaluator_version: typeof IMAGING_SURGICAL_READINESS_EVALUATOR_VERSION;
};

export type EvaluateSurgicalImageReadinessInput = {
  domain: ImagingOsSurgicalReadinessDomain;
  images: ImagingOsSurgicalImage[];
};

function isSurgicalImageUsable(image: ImagingOsSurgicalImage): boolean {
  if (image.is_clinically_usable === true) {
    return true;
  }
  if (image.is_clinically_usable === false) {
    return false;
  }
  return image.quality_status === "excellent" || image.quality_status === "acceptable";
}

function uniqueEvents(values: ImagingOsSurgicalImageEventType[]): ImagingOsSurgicalImageEventType[] {
  return [...new Set(values)];
}

function buildInvalidSurgicalResult(
  domain: ImagingOsSurgicalReadinessDomain
): ImagingOsSurgicalReadinessResult {
  return {
    domain,
    domain_description: "",
    readiness_status: "invalid",
    completeness_score: 0,
    required_events: [],
    present_events: [],
    missing_events: [],
    required_categories: [],
    missing_categories_by_event: {},
    usable_images_by_event: {},
    unusable_images_by_event: {},
    quality_blockers: [],
    warnings: ["Unknown or unsupported surgical readiness domain."],
    evaluator_version: IMAGING_SURGICAL_READINESS_EVALUATOR_VERSION,
  };
}

/**
 * Evaluate whether a surgical case image set meets readiness for a domain (pure).
 */
export function evaluateSurgicalImageReadiness(
  input: EvaluateSurgicalImageReadinessInput
): ImagingOsSurgicalReadinessResult {
  const requirements = IMAGING_SURGICAL_READINESS_REQUIREMENTS_MAP[input.domain];
  if (!requirements) {
    return buildInvalidSurgicalResult(input.domain);
  }

  const requiredEvents = uniqueEvents(requirements.required_events);
  const requiredCategories = [...new Set(requirements.required_categories)];
  const minimumUsable = requirements.minimum_usable_images_per_event;

  const usableImagesByEvent: Partial<Record<ImagingOsSurgicalImageEventType, number>> = {};
  const unusableImagesByEvent: Partial<Record<ImagingOsSurgicalImageEventType, number>> = {};
  const missingCategoriesByEvent: Partial<
    Record<ImagingOsSurgicalImageEventType, CanonicalHairImageCategory[]>
  > = {};
  const qualityBlockers: string[] = [];
  const warnings: string[] = [];

  const usableCategoriesByEvent = new Map<
    ImagingOsSurgicalImageEventType,
    Set<CanonicalHairImageCategory>
  >();

  for (const image of input.images) {
    const event = image.surgical_event;
    const usable = isSurgicalImageUsable(image);

    if (usable) {
      usableImagesByEvent[event] = (usableImagesByEvent[event] ?? 0) + 1;
      const categorySet = usableCategoriesByEvent.get(event) ?? new Set();
      categorySet.add(image.canonical_category);
      usableCategoriesByEvent.set(event, categorySet);
    } else {
      unusableImagesByEvent[event] = (unusableImagesByEvent[event] ?? 0) + 1;
      if (requiredEvents.includes(event)) {
        const label = image.image_id ?? image.canonical_category;
        qualityBlockers.push(
          `Image at ${event} (${label}) is not clinically usable for surgical readiness.`
        );
      }
    }
  }

  const presentEvents = requiredEvents.filter((event) => (usableImagesByEvent[event] ?? 0) > 0);
  const missingEvents = requiredEvents.filter((event) => !presentEvents.includes(event));

  let totalCategorySlots = 0;
  let satisfiedCategorySlots = 0;
  let allCategoriesPresent = true;
  let allMinimumCountsMet = true;

  for (const event of requiredEvents) {
    const presentCategories = usableCategoriesByEvent.get(event) ?? new Set();
    const missingCategories = requiredCategories.filter((cat) => !presentCategories.has(cat));
    if (missingCategories.length > 0) {
      missingCategoriesByEvent[event] = missingCategories;
      allCategoriesPresent = false;
    }

    totalCategorySlots += requiredCategories.length;
    satisfiedCategorySlots += requiredCategories.filter((cat) => presentCategories.has(cat)).length;

    const usableCount = usableImagesByEvent[event] ?? 0;
    if (usableCount < minimumUsable) {
      allMinimumCountsMet = false;
      if (usableCount > 0) {
        warnings.push(
          `Event ${event} has ${usableCount} usable image(s); minimum is ${minimumUsable}.`
        );
      }
    }
  }

  const eventCoverage =
    requiredEvents.length === 0 ? 100 : (presentEvents.length / requiredEvents.length) * 100;

  const categoryCoverage =
    totalCategorySlots === 0 ? 100 : (satisfiedCategorySlots / totalCategorySlots) * 100;

  const minCountRatios = requiredEvents.map((event) => {
    const usableCount = usableImagesByEvent[event] ?? 0;
    if (minimumUsable <= 0) return 100;
    return Math.min(100, (usableCount / minimumUsable) * 100);
  });
  const minCountCoverage =
    minCountRatios.length === 0
      ? 100
      : minCountRatios.reduce((sum, value) => sum + value, 0) / minCountRatios.length;

  const completenessScore = Math.round((eventCoverage + categoryCoverage + minCountCoverage) / 3);

  const isReady =
    missingEvents.length === 0 && allCategoriesPresent && allMinimumCountsMet;

  let readinessStatus: ImagingOsSurgicalReadinessStatus;
  if (isReady) {
    readinessStatus = "ready";
  } else if (completenessScore >= 50) {
    readinessStatus = "partial";
  } else {
    readinessStatus = "not_ready";
  }

  if (missingEvents.length > 0) {
    warnings.push(`Missing required surgical events: ${missingEvents.join(", ")}.`);
  }

  return {
    domain: input.domain,
    domain_description: requirements.description,
    readiness_status: readinessStatus,
    completeness_score: completenessScore,
    required_events: requiredEvents,
    present_events: presentEvents,
    missing_events: missingEvents,
    required_categories: requiredCategories,
    missing_categories_by_event: missingCategoriesByEvent,
    usable_images_by_event: usableImagesByEvent,
    unusable_images_by_event: unusableImagesByEvent,
    quality_blockers: qualityBlockers,
    warnings,
    evaluator_version: IMAGING_SURGICAL_READINESS_EVALUATOR_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Workflow recommendation
// ---------------------------------------------------------------------------

export type RecommendSurgicalReadinessDomainInput = {
  surgical_event?: ImagingOsSurgicalImageEventType;
  timepoint?: ImagingOsTimepoint;
  protocol?: ImagingOsProtocolType;
  assessment_type?: ImagingOsProgressionAssessmentType;
};

/** Recommend a surgical readiness domain from workflow context (pure, conservative). */
export function recommendSurgicalReadinessDomain(
  input: RecommendSurgicalReadinessDomainInput
): ImagingOsSurgicalReadinessDomain | undefined {
  const event = input.surgical_event;

  if (event === "revision_review") {
    return "revision_review";
  }

  if (
    event === "graft_tray" ||
    event === "extraction_documentation" ||
    event === "implantation_complete"
  ) {
    return "intraoperative_documentation";
  }

  const protocol = input.protocol;
  if (protocol === "surgery_planning") {
    return "surgery_planning";
  }
  if (protocol === "donor_analysis") {
    return "donor_recovery";
  }

  const assessment = input.assessment_type;
  if (assessment === "donor_recovery_tracking") {
    return "donor_recovery";
  }
  if (assessment === "surgery_growth_tracking") {
    return "recipient_growth";
  }
  if (assessment === "hairaudit_outcome_12month") {
    return "outcome_audit";
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Intake adapter
// ---------------------------------------------------------------------------

export type BuildSurgicalImageFromIntakeInput = {
  intake: ImagingOsNormalizedImageIntake;
  quality?: ImagingOsImageQualityEvaluationResult | ImageQualityResult;
};

function detectSurgicalEventFromMetadata(
  metadata: Record<string, unknown>
): ImagingOsSurgicalImageEventType | undefined {
  const candidates = [metadata.surgical_event, metadata.event_type, metadata.workflow_stage];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      const normalized = normalizeSurgicalImageEventType(candidate);
      if (normalized !== "unknown") {
        return normalized;
      }
    }
  }
  return undefined;
}

function resolveQualityFromIntake(
  quality: ImagingOsImageQualityEvaluationResult | ImageQualityResult | undefined
): Pick<ImagingOsSurgicalImage, "quality_status" | "is_clinically_usable"> {
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

/** Build a surgical image from normalized intake and optional quality evaluation (pure). */
export function buildSurgicalImageFromIntake(
  input: BuildSurgicalImageFromIntakeInput
): ImagingOsSurgicalImage {
  const { intake, quality } = input;
  const detectedEvent = detectSurgicalEventFromMetadata(intake.metadata);
  const surgicalEvent = detectedEvent ?? "unknown";
  const qualityFields = resolveQualityFromIntake(quality);

  const timepointRaw = intake.metadata.timepoint;
  const timepoint =
    typeof timepointRaw === "string" && timepointRaw.trim().length > 0
      ? normalizeImagingOsTimepoint(timepointRaw)
      : undefined;

  const surgicalCaseId = intake.surgery_id ?? intake.case_id;

  return {
    ...(intake.external_image_id ? { image_id: intake.external_image_id } : {}),
    ...(surgicalCaseId ? { surgical_case_id: surgicalCaseId } : {}),
    ...(intake.patient_id ? { patient_id: intake.patient_id } : {}),
    canonical_category: intake.canonical_photo_category,
    surgical_event: surgicalEvent,
    ...(timepoint && timepoint !== "unknown" ? { timepoint } : {}),
    ...(intake.captured_at ? { captured_at: intake.captured_at } : {}),
    ...(intake.uploaded_at ? { uploaded_at: intake.uploaded_at } : {}),
    ...qualityFields,
    metadata: intake.metadata,
  };
}
