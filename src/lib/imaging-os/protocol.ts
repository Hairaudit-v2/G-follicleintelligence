/**
 * ImagingOS — photo protocol compliance contract (Phase IM-1).
 * Pure helpers; no DB or session I/O.
 */

import type { CanonicalHairImageCategory } from "./categories";
import type { ImageQualityStatus } from "./quality";

export type ProtocolStatus = "compliant" | "deviation" | "non_compliant" | "not_evaluated";

export type ImageProtocolEvaluation = {
  protocol_status: ProtocolStatus;
  required_categories: CanonicalHairImageCategory[];
  present_categories: CanonicalHairImageCategory[];
  missing_categories: CanonicalHairImageCategory[];
  duplicate_categories: CanonicalHairImageCategory[];
  low_quality_categories: CanonicalHairImageCategory[];
};

export type ProtocolEvaluationInput = {
  required_categories: CanonicalHairImageCategory[];
  present_categories: CanonicalHairImageCategory[];
  /** Optional per-category quality flags for deviation detection. */
  category_quality?: Partial<Record<CanonicalHairImageCategory, ImageQualityStatus>>;
};

function uniqueCategories(values: CanonicalHairImageCategory[]): CanonicalHairImageCategory[] {
  return [...new Set(values)];
}

export function findMissingProtocolCategories(
  required: CanonicalHairImageCategory[],
  present: CanonicalHairImageCategory[]
): CanonicalHairImageCategory[] {
  const presentSet = new Set(present);
  return uniqueCategories(required).filter((cat) => !presentSet.has(cat));
}

export function findDuplicateProtocolCategories(
  present: CanonicalHairImageCategory[]
): CanonicalHairImageCategory[] {
  const seen = new Set<CanonicalHairImageCategory>();
  const dupes = new Set<CanonicalHairImageCategory>();
  for (const cat of present) {
    if (seen.has(cat)) dupes.add(cat);
    seen.add(cat);
  }
  return [...dupes];
}

export function findLowQualityProtocolCategories(
  present: CanonicalHairImageCategory[],
  categoryQuality: Partial<Record<CanonicalHairImageCategory, ImageQualityStatus>> = {}
): CanonicalHairImageCategory[] {
  return uniqueCategories(present).filter((cat) => {
    const status = categoryQuality[cat];
    return status === "warn" || status === "fail";
  });
}

/**
 * Evaluate protocol compliance from category sets (pure).
 * Single-image intake (HairAudit classify) typically yields not_evaluated.
 */
export function evaluateImageProtocol(input: ProtocolEvaluationInput): ImageProtocolEvaluation {
  const required = uniqueCategories(input.required_categories);
  const present = input.present_categories;
  const missing = findMissingProtocolCategories(required, present);
  const duplicate = findDuplicateProtocolCategories(present);
  const lowQuality = findLowQualityProtocolCategories(present, input.category_quality);

  let protocol_status: ProtocolStatus = "not_evaluated";
  if (required.length > 0) {
    if (missing.length === 0 && duplicate.length === 0 && lowQuality.length === 0) {
      protocol_status = "compliant";
    } else if (missing.length === required.length) {
      protocol_status = "non_compliant";
    } else if (missing.length > 0 || duplicate.length > 0 || lowQuality.length > 0) {
      protocol_status = "deviation";
    }
  }

  return {
    protocol_status,
    required_categories: required,
    present_categories: uniqueCategories(present),
    missing_categories: missing,
    duplicate_categories: duplicate,
    low_quality_categories: lowQuality,
  };
}

/** Stub for single-image classify paths — protocol needs a full case set (IM-3+). */
export function evaluateImageProtocolStub(): ImageProtocolEvaluation {
  return {
    protocol_status: "not_evaluated",
    required_categories: [],
    present_categories: [],
    missing_categories: [],
    duplicate_categories: [],
    low_quality_categories: [],
  };
}

// ---------------------------------------------------------------------------
// Phase IM-3 — Protocol Completeness Engine
// ---------------------------------------------------------------------------

export const IMAGING_OS_PROTOCOL_TYPES = [
  "hairaudit_baseline",
  "consultation_basic",
  "consultation_advanced",
  "surgery_planning",
  "surgery_immediate_postop",
  "surgery_followup_14day",
  "surgery_followup_6month",
  "surgery_followup_12month",
  "hli_diagnostic",
  "donor_analysis",
  "recipient_analysis",
  "microscopic_analysis",
] as const;

export type ImagingOsProtocolType = (typeof IMAGING_OS_PROTOCOL_TYPES)[number];

export type ImagingProtocolRequirements = {
  required: CanonicalHairImageCategory[];
  optional: CanonicalHairImageCategory[];
  minimum_required_count: number;
  description: string;
};

export type ImagingOsProtocolEvaluationStatus = "complete" | "partial" | "incomplete" | "invalid";

export type ImagingOsWorkflowReadiness = "ready" | "partial_ready" | "not_ready";

export type ImagingOsProtocolEvaluationResult = {
  protocol: ImagingOsProtocolType;
  protocol_description: string;
  completeness_score: number;
  total_required: number;
  present_required: number;
  missing_required: CanonicalHairImageCategory[];
  optional_present: CanonicalHairImageCategory[];
  status: ImagingOsProtocolEvaluationStatus;
  workflow_readiness: ImagingOsWorkflowReadiness;
};

export type EvaluateImageProtocolCompletenessInput = {
  protocol: ImagingOsProtocolType;
  categories: CanonicalHairImageCategory[];
};

export type EvaluateCaseImageSetInput = {
  protocol: ImagingOsProtocolType;
  images: Array<{ canonical_category: CanonicalHairImageCategory }>;
};

export type RecommendProtocolForWorkflowInput = {
  source_system: string;
  upload_surface: string;
};

const IMAGING_PROTOCOL_REQUIREMENTS_MAP: Record<
  ImagingOsProtocolType,
  ImagingProtocolRequirements
> = {
  hairaudit_baseline: {
    required: ["front", "left", "right", "top", "crown", "donor"],
    optional: ["microscopic"],
    minimum_required_count: 6,
    description: "HairAudit baseline scalp photography set for audit intake",
  },
  consultation_basic: {
    required: ["front", "left", "right", "top"],
    optional: ["crown", "donor", "hairline"],
    minimum_required_count: 4,
    description: "Basic consultation views for initial clinical assessment",
  },
  consultation_advanced: {
    required: ["front", "left", "right", "top", "crown", "donor"],
    optional: ["recipient", "hairline", "microscopic"],
    minimum_required_count: 6,
    description: "Advanced consultation set including crown and donor evaluation",
  },
  surgery_planning: {
    required: ["front", "left", "right", "top", "crown", "donor", "recipient"],
    optional: ["microscopic"],
    minimum_required_count: 7,
    description: "Pre-operative surgical planning photography set",
  },
  surgery_immediate_postop: {
    required: ["immediate_post_op", "front", "donor", "recipient"],
    optional: ["graft_tray", "top", "crown"],
    minimum_required_count: 4,
    description: "Immediate post-operative documentation set",
  },
  surgery_followup_14day: {
    required: ["follow_up", "front", "top", "crown"],
    optional: ["donor", "recipient", "left", "right"],
    minimum_required_count: 4,
    description: "14-day surgical follow-up progress photography",
  },
  surgery_followup_6month: {
    required: ["follow_up", "front", "top", "crown", "left", "right"],
    optional: ["donor", "recipient", "hairline"],
    minimum_required_count: 6,
    description: "6-month surgical follow-up progress photography",
  },
  surgery_followup_12month: {
    required: ["follow_up", "front", "top", "crown", "left", "right", "donor"],
    optional: ["recipient", "hairline", "microscopic"],
    minimum_required_count: 7,
    description: "12-month surgical follow-up progress photography",
  },
  hli_diagnostic: {
    required: ["front", "top", "crown", "left", "right", "donor"],
    optional: ["recipient", "microscopic", "hairline"],
    minimum_required_count: 6,
    description: "HLI diagnostic imaging set for hair intelligence analysis",
  },
  donor_analysis: {
    required: ["donor", "left", "right"],
    optional: ["microscopic", "top", "crown"],
    minimum_required_count: 3,
    description: "Donor-area focused analysis photography set",
  },
  recipient_analysis: {
    required: ["recipient", "front", "top", "crown", "hairline"],
    optional: ["left", "right", "microscopic"],
    minimum_required_count: 5,
    description: "Recipient-area focused analysis photography set",
  },
  microscopic_analysis: {
    required: ["microscopic"],
    optional: ["front", "donor", "top"],
    minimum_required_count: 1,
    description: "Microscopic / trichoscopy analysis set",
  },
};

/** Read-only protocol requirement registry (Phase IM-3). */
export const IMAGING_PROTOCOL_REQUIREMENTS: Readonly<
  Record<ImagingOsProtocolType, ImagingProtocolRequirements>
> = IMAGING_PROTOCOL_REQUIREMENTS_MAP;

export function isImagingOsProtocolType(value: string): value is ImagingOsProtocolType {
  return (IMAGING_OS_PROTOCOL_TYPES as readonly string[]).includes(value);
}

function uniquePresentCategories(
  categories: CanonicalHairImageCategory[]
): CanonicalHairImageCategory[] {
  return uniqueCategories(categories);
}

function resolveProtocolStatus(
  completenessScore: number
): Pick<ImagingOsProtocolEvaluationResult, "status" | "workflow_readiness"> {
  if (completenessScore >= 100) {
    return { status: "complete", workflow_readiness: "ready" };
  }
  if (completenessScore >= 70) {
    return { status: "partial", workflow_readiness: "partial_ready" };
  }
  return { status: "incomplete", workflow_readiness: "not_ready" };
}

function buildInvalidProtocolResult(protocol: ImagingOsProtocolType): ImagingOsProtocolEvaluationResult {
  return {
    protocol,
    protocol_description: "",
    completeness_score: 0,
    total_required: 0,
    present_required: 0,
    missing_required: [],
    optional_present: [],
    status: "invalid",
    workflow_readiness: "not_ready",
  };
}

/**
 * Evaluate whether uploaded image categories satisfy a clinical workflow protocol (pure).
 */
export function evaluateImageProtocolCompleteness(
  input: EvaluateImageProtocolCompletenessInput
): ImagingOsProtocolEvaluationResult {
  const requirements = IMAGING_PROTOCOL_REQUIREMENTS_MAP[input.protocol];
  if (!requirements) {
    return buildInvalidProtocolResult(input.protocol);
  }

  const presentSet = new Set(uniquePresentCategories(input.categories));
  const required = uniqueCategories(requirements.required);
  const optional = uniqueCategories(requirements.optional);
  const totalRequired = required.length;
  const presentRequired = required.filter((cat) => presentSet.has(cat));
  const missingRequired = required.filter((cat) => !presentSet.has(cat));
  const optionalPresent = optional.filter((cat) => presentSet.has(cat));

  const completenessScore =
    totalRequired === 0 ? 100 : Math.round((presentRequired.length / totalRequired) * 100);

  const { status, workflow_readiness } = resolveProtocolStatus(completenessScore);

  return {
    protocol: input.protocol,
    protocol_description: requirements.description,
    completeness_score: completenessScore,
    total_required: totalRequired,
    present_required: presentRequired.length,
    missing_required: missingRequired,
    optional_present: optionalPresent,
    status,
    workflow_readiness,
  };
}

/** Evaluate protocol completeness for a case-level image set (pure). */
export function evaluateCaseImageSet(
  input: EvaluateCaseImageSetInput
): ImagingOsProtocolEvaluationResult {
  const categories = input.images.map((image) => image.canonical_category);
  return evaluateImageProtocolCompleteness({
    protocol: input.protocol,
    categories,
  });
}

/** Recommend a clinical imaging protocol from source system and upload surface (pure). */
export function recommendProtocolForWorkflow(
  input: RecommendProtocolForWorkflowInput
): ImagingOsProtocolType | undefined {
  const source = input.source_system.trim().toLowerCase();
  const surface = input.upload_surface.trim().toLowerCase();

  if (source === "manual_upload") {
    return undefined;
  }

  if (source === "hairaudit" || surface === "audit_upload" || surface === "hairaudit_case_upload") {
    return "hairaudit_baseline";
  }
  if (source === "consultation_os" || surface === "consultation_form" || surface === "fi_consultation") {
    return "consultation_basic";
  }
  if (source === "surgery_os" || surface === "surgery_workflow") {
    return "surgery_planning";
  }
  if (source === "hli" || surface === "hli_intake") {
    return "hli_diagnostic";
  }

  return undefined;
}
