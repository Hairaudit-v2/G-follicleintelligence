/**
 * ImagingOS — AI vision readiness contracts (Phase IM-11).
 * Pure readiness evaluation; no AI calls, image fetching, or persistence.
 */

import type { CanonicalHairImageCategory } from "./categories";
import type {
  ImagingOsComparisonDomain,
  ImagingOsComparisonImage,
  ImagingOsComparisonReadinessResult,
} from "./comparison";
import type { ImagingOsNormalizedImageIntake } from "./intake";
import type { ImagingOsMeasurementDomain, ImagingOsVisualMeasurementResult } from "./measurement";
import type { ImagingOsOutcomeEvidence, ImagingOsOutcomeMeasurementResult } from "./outcomes";
import type { ImagingOsTimepoint } from "./progression";
import type {
  ImageQualityResult,
  ImagingOsImageQualityEvaluationResult,
  ImagingOsImageQualityStatus,
} from "./quality";
import { isImagingOsMetadataQualityResult } from "./quality";
import type { ImagingOsSurgicalImageEventType } from "./surgical";
import type { ImagingOsOverallScoreResult } from "./summary";

// ---------------------------------------------------------------------------
// Task and risk models
// ---------------------------------------------------------------------------

export const IMAGING_AI_VISION_TASK_TYPES = [
  "image_category_classification",
  "image_quality_assessment",
  "protocol_gap_detection",
  "hair_loss_stage_estimation",
  "donor_area_assessment",
  "recipient_area_assessment",
  "growth_comparison",
  "density_measurement",
  "graft_survival_estimation",
  "hairline_design_review",
  "surgical_outcome_review",
  "digital_twin_summary",
  "unknown",
] as const;

export type ImagingOsAiVisionTaskType = (typeof IMAGING_AI_VISION_TASK_TYPES)[number];

export const IMAGING_AI_VISION_RISK_LEVELS = [
  "low",
  "medium",
  "high",
  "clinical_review_required",
] as const;

export type ImagingOsAiVisionRiskLevel = (typeof IMAGING_AI_VISION_RISK_LEVELS)[number];

export type ImagingOsAiVisionTaskRequirements = {
  risk_level: ImagingOsAiVisionRiskLevel;
  required_quality_statuses: ImagingOsImageQualityStatus[];
  requires_clinically_usable_images: boolean;
  requires_comparison_ready?: boolean;
  requires_outcome_measurable?: boolean;
  requires_summary_score_above?: number;
  allowed_measurement_domains: ImagingOsMeasurementDomain[];
  allowed_comparison_domains: ImagingOsComparisonDomain[];
  requires_human_review: boolean;
  description: string;
};

export const IMAGING_AI_VISION_TASK_REQUIREMENTS: Record<
  Exclude<ImagingOsAiVisionTaskType, "unknown">,
  ImagingOsAiVisionTaskRequirements
> = {
  image_category_classification: {
    risk_level: "low",
    required_quality_statuses: ["excellent", "acceptable", "borderline", "not_evaluated"],
    requires_clinically_usable_images: false,
    allowed_measurement_domains: [],
    allowed_comparison_domains: [],
    requires_human_review: false,
    description:
      "Classify scalp image into canonical category labels using intake metadata and visual cues",
  },
  image_quality_assessment: {
    risk_level: "low",
    required_quality_statuses: ["excellent", "acceptable", "borderline", "not_evaluated", "poor"],
    requires_clinically_usable_images: false,
    allowed_measurement_domains: [],
    allowed_comparison_domains: [],
    requires_human_review: false,
    description: "Assess image quality signals for clinical usability and protocol compliance",
  },
  protocol_gap_detection: {
    risk_level: "low",
    required_quality_statuses: ["excellent", "acceptable", "borderline", "not_evaluated"],
    requires_clinically_usable_images: false,
    allowed_measurement_domains: [],
    allowed_comparison_domains: [],
    requires_human_review: false,
    description: "Detect missing protocol views, timepoints, or capture gaps in a case image set",
  },
  hair_loss_stage_estimation: {
    risk_level: "medium",
    required_quality_statuses: ["excellent", "acceptable", "borderline"],
    requires_clinically_usable_images: true,
    allowed_measurement_domains: ["scalp_visibility", "miniaturization", "frontal_density"],
    allowed_comparison_domains: ["longitudinal_medical_response"],
    requires_human_review: true,
    description: "Estimate hair loss staging from standardized scalp photography",
  },
  donor_area_assessment: {
    risk_level: "medium",
    required_quality_statuses: ["excellent", "acceptable"],
    requires_clinically_usable_images: true,
    allowed_measurement_domains: ["donor_density", "scar_visibility"],
    allowed_comparison_domains: ["donor_recovery_change"],
    requires_human_review: true,
    description: "Assess donor-area density, extraction patterns, and scar visibility",
  },
  recipient_area_assessment: {
    risk_level: "medium",
    required_quality_statuses: ["excellent", "acceptable"],
    requires_clinically_usable_images: true,
    allowed_measurement_domains: ["recipient_survival", "coverage", "frontal_density"],
    allowed_comparison_domains: ["recipient_growth_change"],
    requires_human_review: true,
    description: "Assess recipient-area growth, coverage, and implant distribution",
  },
  growth_comparison: {
    risk_level: "high",
    required_quality_statuses: ["excellent", "acceptable"],
    requires_clinically_usable_images: true,
    requires_comparison_ready: true,
    allowed_measurement_domains: ["density", "coverage", "frontal_density", "caliber"],
    allowed_comparison_domains: ["growth_change", "density_change"],
    requires_human_review: true,
    description: "Compare longitudinal growth change across baseline and follow-up image pairs",
  },
  density_measurement: {
    risk_level: "high",
    required_quality_statuses: ["excellent", "acceptable"],
    requires_clinically_usable_images: true,
    requires_comparison_ready: true,
    allowed_measurement_domains: ["density", "frontal_density"],
    allowed_comparison_domains: ["density_change", "growth_change"],
    requires_human_review: true,
    description: "Measure hair density from comparison-ready baseline and follow-up evidence",
  },
  graft_survival_estimation: {
    risk_level: "high",
    required_quality_statuses: ["excellent", "acceptable"],
    requires_clinically_usable_images: true,
    requires_comparison_ready: true,
    allowed_measurement_domains: ["graft_survival", "recipient_survival"],
    allowed_comparison_domains: ["graft_survival_change", "recipient_growth_change"],
    requires_human_review: true,
    description: "Estimate graft survival from surgical outcome comparison evidence",
  },
  hairline_design_review: {
    risk_level: "high",
    required_quality_statuses: ["excellent", "acceptable"],
    requires_clinically_usable_images: true,
    requires_comparison_ready: true,
    allowed_measurement_domains: ["hairline_position", "temporal_angle"],
    allowed_comparison_domains: ["hairline_design_change"],
    requires_human_review: true,
    description: "Review hairline design execution from pre-operative and outcome photography",
  },
  surgical_outcome_review: {
    risk_level: "clinical_review_required",
    required_quality_statuses: ["excellent", "acceptable"],
    requires_clinically_usable_images: true,
    requires_comparison_ready: true,
    requires_outcome_measurable: true,
    requires_summary_score_above: 80,
    allowed_measurement_domains: [
      "graft_survival",
      "recipient_survival",
      "density",
      "coverage",
      "donor_density",
      "scar_visibility",
    ],
    allowed_comparison_domains: [
      "growth_change",
      "density_change",
      "graft_survival_change",
      "recipient_growth_change",
      "donor_recovery_change",
    ],
    requires_human_review: true,
    description:
      "Comprehensive surgical outcome review requiring measurable evidence and high case summary score",
  },
  digital_twin_summary: {
    risk_level: "clinical_review_required",
    required_quality_statuses: ["excellent", "acceptable", "borderline", "not_evaluated"],
    requires_clinically_usable_images: false,
    requires_summary_score_above: 80,
    allowed_measurement_domains: [],
    allowed_comparison_domains: [],
    requires_human_review: true,
    description: "Generate Digital Twin imaging summary narrative from case-level readiness scores",
  },
};

export function isImagingOsAiVisionTaskType(value: string): value is ImagingOsAiVisionTaskType {
  return (IMAGING_AI_VISION_TASK_TYPES as readonly string[]).includes(value);
}

export function resolveAiVisionTaskRequirements(
  taskType: ImagingOsAiVisionTaskType
): ImagingOsAiVisionTaskRequirements | undefined {
  if (taskType === "unknown") {
    return undefined;
  }
  return IMAGING_AI_VISION_TASK_REQUIREMENTS[taskType];
}

// ---------------------------------------------------------------------------
// Evidence contract
// ---------------------------------------------------------------------------

export type ImagingOsAiVisionEvidence = {
  evidence_id: string;
  image_id?: string;
  patient_id?: string;
  surgical_case_id?: string;
  canonical_category?: CanonicalHairImageCategory;
  timepoint?: ImagingOsTimepoint;
  surgical_event?: ImagingOsSurgicalImageEventType;
  quality_status?: ImagingOsImageQualityStatus | "not_evaluated";
  is_clinically_usable?: boolean;
  storage_bucket?: string;
  storage_path?: string;
  public_url?: string;
  signed_url_present?: boolean;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Request contract
// ---------------------------------------------------------------------------

export const IMAGING_AI_OUTPUT_CONTRACT_VERSION = "imaging-ai-output-contract-v1" as const;
export const IMAGING_AI_AUDIT_CONTRACT_VERSION = "imaging-ai-audit-contract-v1" as const;

export type ImagingOsAiVisionReadinessStatus = "ready" | "partial" | "blocked" | "invalid";

export type ImagingOsAiVisionHumanReviewPolicy =
  | "not_required"
  | "recommended"
  | "required"
  | "clinical_sign_off_required";

export type ImagingOsAiVisionSummaryResultInput = {
  overall_score: number;
  overall_status: string;
  blockers?: string[];
  warnings?: string[];
};

export type ImagingOsAiVisionRequestContract = {
  request_id: string;
  task_type: ImagingOsAiVisionTaskType;
  risk_level: ImagingOsAiVisionRiskLevel;
  evidence: ImagingOsAiVisionEvidence[];
  comparison_result?: ImagingOsComparisonReadinessResult;
  outcome_result?: ImagingOsOutcomeMeasurementResult;
  summary_result?: ImagingOsOverallScoreResult | ImagingOsAiVisionSummaryResultInput;
  allowed_measurement_domains: ImagingOsMeasurementDomain[];
  allowed_comparison_domains: ImagingOsComparisonDomain[];
  requires_human_review: boolean;
  human_review_policy: ImagingOsAiVisionHumanReviewPolicy;
  model_output_contract_version: typeof IMAGING_AI_OUTPUT_CONTRACT_VERSION;
  audit_contract_version: typeof IMAGING_AI_AUDIT_CONTRACT_VERSION;
  warnings: string[];
  blockers: string[];
  readiness_status: ImagingOsAiVisionReadinessStatus;
};

// ---------------------------------------------------------------------------
// Model output contract
// ---------------------------------------------------------------------------

export type ImagingOsAiVisionModelOutputStatus = "completed" | "partial" | "failed" | "rejected";

export type ImagingOsAiVisionFindingSeverity = "low" | "medium" | "high" | "review_required";

export type ImagingOsAiVisionModelOutputContract = {
  request_id: string;
  task_type: ImagingOsAiVisionTaskType;
  model_name?: string;
  model_version?: string;
  output_status: ImagingOsAiVisionModelOutputStatus;
  measurements?: ImagingOsVisualMeasurementResult[];
  classifications?: Array<{
    category?: CanonicalHairImageCategory;
    confidence: number;
    notes?: string;
  }>;
  findings?: Array<{
    finding_type: string;
    severity: ImagingOsAiVisionFindingSeverity;
    confidence: number;
    description: string;
  }>;
  requires_human_review: boolean;
  warnings: string[];
  blockers: string[];
  generated_at: string;
  output_contract_version: typeof IMAGING_AI_OUTPUT_CONTRACT_VERSION;
};

// ---------------------------------------------------------------------------
// Audit log contract
// ---------------------------------------------------------------------------

export type ImagingOsAiVisionAuditLogContract = {
  audit_id: string;
  request_id: string;
  task_type: ImagingOsAiVisionTaskType;
  risk_level: ImagingOsAiVisionRiskLevel;
  evidence_count: number;
  measurement_domains_requested: ImagingOsMeasurementDomain[];
  comparison_domains_requested: ImagingOsComparisonDomain[];
  human_review_required: boolean;
  readiness_status: ImagingOsAiVisionReadinessStatus;
  model_name?: string;
  model_version?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  audit_contract_version: typeof IMAGING_AI_AUDIT_CONTRACT_VERSION;
};

// ---------------------------------------------------------------------------
// Evaluation input
// ---------------------------------------------------------------------------

export type EvaluateAiVisionReadinessInput = {
  task_type: ImagingOsAiVisionTaskType;
  evidence: ImagingOsAiVisionEvidence[];
  comparison_result?: ImagingOsComparisonReadinessResult;
  outcome_result?: ImagingOsOutcomeMeasurementResult;
  summary_result?: ImagingOsAiVisionSummaryResultInput;
};

export type BuildAiVisionRequestContractInput = EvaluateAiVisionReadinessInput & {
  request_id?: string;
  timestamp?: string;
};

export type AiVisionModelOutputValidationResult = {
  valid: boolean;
  warnings: string[];
  blockers: string[];
  requires_human_review: boolean;
};

export type RecommendAiVisionTasksInput = {
  summary_result?: ImagingOsAiVisionSummaryResultInput;
  comparison_result?: ImagingOsComparisonReadinessResult;
  outcome_result?: ImagingOsOutcomeMeasurementResult;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const CLINICAL_QUALITY_STATUSES = new Set<ImagingOsImageQualityStatus>(["excellent", "acceptable"]);

function hashAiVisionSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function generateEvidenceId(anchor: string): string {
  return `ai-evidence-${hashAiVisionSeed(anchor)}`;
}

function generateRequestId(input: BuildAiVisionRequestContractInput): string {
  if (input.request_id?.trim()) {
    return input.request_id.trim();
  }

  const evidenceIds = input.evidence
    .map((item) => item.evidence_id || item.image_id || "")
    .filter((id) => id.length > 0)
    .sort()
    .join("|");
  const timestamp = input.timestamp?.trim() || "no-timestamp";
  const seed = `${input.task_type}|${evidenceIds}|${timestamp}`;
  return `ai-vision-${hashAiVisionSeed(seed)}`;
}

function generateAuditId(requestId: string, createdAt: string): string {
  return `ai-audit-${hashAiVisionSeed(`${requestId}|${createdAt}`)}`;
}

function resolveHumanReviewPolicy(
  riskLevel: ImagingOsAiVisionRiskLevel,
  requiresHumanReview: boolean
): ImagingOsAiVisionHumanReviewPolicy {
  if (riskLevel === "clinical_review_required") {
    return "clinical_sign_off_required";
  }
  if (!requiresHumanReview) {
    return "not_required";
  }
  if (riskLevel === "high") {
    return "required";
  }
  return "recommended";
}

function isEvidenceClinicallyUsable(evidence: ImagingOsAiVisionEvidence): boolean {
  if (evidence.is_clinically_usable === true) {
    return true;
  }
  const status = evidence.quality_status ?? "not_evaluated";
  return CLINICAL_QUALITY_STATUSES.has(status as ImagingOsImageQualityStatus);
}

function isComparisonReady(
  comparisonResult: ImagingOsComparisonReadinessResult | undefined
): boolean {
  if (!comparisonResult) {
    return false;
  }
  return (
    comparisonResult.comparison_status === "ready" ||
    comparisonResult.comparison_status === "partial"
  );
}

function isOutcomeMeasurable(
  outcomeResult: ImagingOsOutcomeMeasurementResult | undefined
): boolean {
  if (!outcomeResult) {
    return false;
  }
  return (
    outcomeResult.measurement_status === "measurable" ||
    outcomeResult.measurement_status === "partially_measurable"
  );
}

function resolveReadinessStatus(
  blockers: string[],
  warnings: string[],
  isInvalid: boolean
): ImagingOsAiVisionReadinessStatus {
  if (isInvalid) {
    return "invalid";
  }
  if (blockers.length > 0) {
    return "blocked";
  }
  if (warnings.length > 0) {
    return "partial";
  }
  return "ready";
}

function resolveQualityFromIntake(
  quality: ImagingOsImageQualityEvaluationResult | ImageQualityResult | undefined
): Pick<ImagingOsAiVisionEvidence, "quality_status" | "is_clinically_usable"> {
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

// ---------------------------------------------------------------------------
// Readiness evaluator
// ---------------------------------------------------------------------------

/** Evaluate AI vision readiness for a task and evidence set (pure). */
export function evaluateAiVisionReadiness(
  input: EvaluateAiVisionReadinessInput
): ImagingOsAiVisionRequestContract {
  const warnings: string[] = [];
  const blockers: string[] = [];

  const requirements = resolveAiVisionTaskRequirements(input.task_type);
  if (!requirements || input.task_type === "unknown") {
    blockers.push(`Unknown or unsupported AI vision task type: ${input.task_type}.`);
    return {
      request_id: "",
      task_type: input.task_type,
      risk_level: "high",
      evidence: input.evidence,
      ...(input.comparison_result ? { comparison_result: input.comparison_result } : {}),
      ...(input.outcome_result ? { outcome_result: input.outcome_result } : {}),
      ...(input.summary_result ? { summary_result: input.summary_result } : {}),
      allowed_measurement_domains: [],
      allowed_comparison_domains: [],
      requires_human_review: true,
      human_review_policy: "required",
      model_output_contract_version: IMAGING_AI_OUTPUT_CONTRACT_VERSION,
      audit_contract_version: IMAGING_AI_AUDIT_CONTRACT_VERSION,
      warnings,
      blockers,
      readiness_status: "invalid",
    };
  }

  if (input.evidence.length === 0) {
    blockers.push("At least one evidence item is required for AI vision analysis.");
  }

  for (const [index, item] of input.evidence.entries()) {
    const status = item.quality_status ?? "not_evaluated";
    if (!requirements.required_quality_statuses.includes(status as ImagingOsImageQualityStatus)) {
      blockers.push(
        `Evidence item ${index + 1} quality_status "${status}" does not meet task requirements.`
      );
    }
  }

  if (requirements.requires_clinically_usable_images) {
    for (const [index, item] of input.evidence.entries()) {
      if (!isEvidenceClinicallyUsable(item)) {
        blockers.push(
          `Evidence item ${index + 1} is not clinically usable for task ${input.task_type}.`
        );
      }
    }
  }

  if (requirements.requires_comparison_ready) {
    if (!input.comparison_result) {
      blockers.push("Comparison readiness result is required but was not provided.");
    } else if (!isComparisonReady(input.comparison_result)) {
      blockers.push(
        `Comparison status "${input.comparison_result.comparison_status}" is not ready for AI vision.`
      );
    }
  }

  if (requirements.requires_outcome_measurable) {
    if (!input.outcome_result) {
      blockers.push("Outcome measurement result is required but was not provided.");
    } else if (!isOutcomeMeasurable(input.outcome_result)) {
      blockers.push(
        `Outcome measurement status "${input.outcome_result.measurement_status}" is not measurable.`
      );
    }
  }

  if (requirements.requires_summary_score_above != null) {
    const threshold = requirements.requires_summary_score_above;
    if (!input.summary_result) {
      blockers.push(`Case summary score is required (minimum ${threshold}).`);
    } else if (input.summary_result.overall_score < threshold) {
      blockers.push(
        `Case summary score ${input.summary_result.overall_score} is below required threshold ${threshold}.`
      );
    }
  }

  if (
    requirements.risk_level === "high" ||
    requirements.risk_level === "clinical_review_required"
  ) {
    warnings.push(`Task ${input.task_type} is classified as ${requirements.risk_level} risk.`);
  }

  const readinessStatus = resolveReadinessStatus(blockers, warnings, false);

  return {
    request_id: "",
    task_type: input.task_type,
    risk_level: requirements.risk_level,
    evidence: input.evidence,
    ...(input.comparison_result ? { comparison_result: input.comparison_result } : {}),
    ...(input.outcome_result ? { outcome_result: input.outcome_result } : {}),
    ...(input.summary_result ? { summary_result: input.summary_result } : {}),
    allowed_measurement_domains: [...requirements.allowed_measurement_domains],
    allowed_comparison_domains: [...requirements.allowed_comparison_domains],
    requires_human_review: requirements.requires_human_review,
    human_review_policy: resolveHumanReviewPolicy(
      requirements.risk_level,
      requirements.requires_human_review
    ),
    model_output_contract_version: IMAGING_AI_OUTPUT_CONTRACT_VERSION,
    audit_contract_version: IMAGING_AI_AUDIT_CONTRACT_VERSION,
    warnings,
    blockers,
    readiness_status: readinessStatus,
  };
}

/** Build a full AI vision request contract with deterministic request_id (pure). */
export function buildAiVisionRequestContract(
  input: BuildAiVisionRequestContractInput
): ImagingOsAiVisionRequestContract {
  const evaluation = evaluateAiVisionReadiness(input);
  return {
    ...evaluation,
    request_id: generateRequestId(input),
  };
}

// ---------------------------------------------------------------------------
// Evidence bridge helpers
// ---------------------------------------------------------------------------

export type BuildAiVisionEvidenceFromIntakeInput = {
  intake: ImagingOsNormalizedImageIntake;
  quality?: ImagingOsImageQualityEvaluationResult | ImageQualityResult;
};

/** Build AI vision evidence from normalized intake and optional quality result (pure). */
export function buildAiVisionEvidenceFromIntake(
  input: BuildAiVisionEvidenceFromIntakeInput
): ImagingOsAiVisionEvidence {
  const { intake, quality } = input;
  const qualityFields = resolveQualityFromIntake(quality);
  const anchor =
    intake.external_image_id ||
    intake.intake_id ||
    intake.storage_path ||
    intake.public_url ||
    "no-anchor";
  const surgicalCaseId = intake.surgery_id ?? intake.case_id;
  const timepointRaw = intake.metadata.timepoint;
  const timepoint =
    typeof timepointRaw === "string" && timepointRaw.trim().length > 0
      ? (timepointRaw.trim() as ImagingOsTimepoint)
      : undefined;

  return {
    evidence_id: generateEvidenceId(anchor),
    ...(intake.external_image_id ? { image_id: intake.external_image_id } : {}),
    ...(intake.patient_id ? { patient_id: intake.patient_id } : {}),
    ...(surgicalCaseId ? { surgical_case_id: surgicalCaseId } : {}),
    canonical_category: intake.canonical_photo_category,
    ...(timepoint ? { timepoint } : {}),
    ...qualityFields,
    ...(intake.storage_bucket ? { storage_bucket: intake.storage_bucket } : {}),
    ...(intake.storage_path ? { storage_path: intake.storage_path } : {}),
    ...(intake.public_url ? { public_url: intake.public_url } : {}),
    ...(intake.signed_url ? { signed_url_present: true } : {}),
    metadata: intake.metadata,
  };
}

/** Build AI vision evidence from outcome evidence (pure). */
export function buildAiVisionEvidenceFromOutcomeEvidence(
  evidence: ImagingOsOutcomeEvidence
): ImagingOsAiVisionEvidence {
  const anchor = evidence.image_id || `${evidence.timepoint}-${evidence.canonical_category}`;
  return {
    evidence_id: generateEvidenceId(anchor),
    ...(evidence.image_id ? { image_id: evidence.image_id } : {}),
    ...(evidence.patient_id ? { patient_id: evidence.patient_id } : {}),
    ...(evidence.surgical_case_id ? { surgical_case_id: evidence.surgical_case_id } : {}),
    canonical_category: evidence.canonical_category,
    timepoint: evidence.timepoint,
    ...(evidence.surgical_event ? { surgical_event: evidence.surgical_event } : {}),
    ...(evidence.quality_status != null ? { quality_status: evidence.quality_status } : {}),
    ...(evidence.is_clinically_usable != null
      ? { is_clinically_usable: evidence.is_clinically_usable }
      : {}),
    ...(evidence.metadata ? { metadata: evidence.metadata } : {}),
  };
}

/** Build AI vision evidence from a comparison image (pure). */
export function buildAiVisionEvidenceFromComparisonImage(
  image: ImagingOsComparisonImage
): ImagingOsAiVisionEvidence {
  const anchor = image.image_id || `${image.timepoint}-${image.canonical_category}`;
  return {
    evidence_id: generateEvidenceId(anchor),
    ...(image.image_id ? { image_id: image.image_id } : {}),
    ...(image.patient_id ? { patient_id: image.patient_id } : {}),
    ...(image.surgical_case_id ? { surgical_case_id: image.surgical_case_id } : {}),
    canonical_category: image.canonical_category,
    timepoint: image.timepoint,
    ...(image.quality_status != null ? { quality_status: image.quality_status } : {}),
    ...(image.is_clinically_usable != null
      ? { is_clinically_usable: image.is_clinically_usable }
      : {}),
    ...(image.metadata ? { metadata: image.metadata } : {}),
  };
}

// ---------------------------------------------------------------------------
// Audit contract builder
// ---------------------------------------------------------------------------

export type BuildAiVisionAuditLogContractInput = {
  request: ImagingOsAiVisionRequestContract;
  model_name?: string;
  model_version?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
};

/** Build an audit log contract from a request (pure, no persistence). */
export function buildAiVisionAuditLogContract(
  input: BuildAiVisionAuditLogContractInput | ImagingOsAiVisionRequestContract
): ImagingOsAiVisionAuditLogContract {
  const request = "request" in input ? input.request : input;
  const createdAt = ("created_at" in input && input.created_at) || new Date(0).toISOString();
  const modelName = "model_name" in input ? input.model_name : undefined;
  const modelVersion = "model_version" in input ? input.model_version : undefined;
  const metadata = "metadata" in input ? input.metadata : undefined;

  return {
    audit_id: generateAuditId(request.request_id, createdAt),
    request_id: request.request_id,
    task_type: request.task_type,
    risk_level: request.risk_level,
    evidence_count: request.evidence.length,
    measurement_domains_requested: [...request.allowed_measurement_domains],
    comparison_domains_requested: [...request.allowed_comparison_domains],
    human_review_required: request.requires_human_review,
    readiness_status: request.readiness_status,
    ...(modelName ? { model_name: modelName } : {}),
    ...(modelVersion ? { model_version: modelVersion } : {}),
    created_at: createdAt,
    ...(metadata ? { metadata } : {}),
    audit_contract_version: IMAGING_AI_AUDIT_CONTRACT_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Output validation
// ---------------------------------------------------------------------------

function isConfidenceInRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Validate model output against the request contract (pure). */
export function validateAiVisionModelOutputContract(
  output: ImagingOsAiVisionModelOutputContract,
  request: ImagingOsAiVisionRequestContract
): AiVisionModelOutputValidationResult {
  const warnings: string[] = [...(output.warnings ?? [])];
  const blockers: string[] = [...(output.blockers ?? [])];
  let requiresHumanReview = output.requires_human_review;

  if (output.request_id !== request.request_id) {
    blockers.push("Model output request_id does not match request contract.");
  }

  if (output.task_type !== request.task_type) {
    blockers.push("Model output task_type does not match request contract.");
  }

  if (output.output_contract_version !== IMAGING_AI_OUTPUT_CONTRACT_VERSION) {
    blockers.push(`Unsupported output contract version: ${output.output_contract_version}.`);
  }

  const allowedDomains = new Set(request.allowed_measurement_domains);
  for (const measurement of output.measurements ?? []) {
    if (!allowedDomains.has(measurement.domain)) {
      blockers.push(
        `Measurement domain "${measurement.domain}" is not allowed for task ${request.task_type}.`
      );
    }
  }

  for (const [index, classification] of (output.classifications ?? []).entries()) {
    if (!isConfidenceInRange(classification.confidence)) {
      blockers.push(`Classification ${index + 1} confidence must be between 0 and 1.`);
    }
  }

  for (const [index, finding] of (output.findings ?? []).entries()) {
    if (!isConfidenceInRange(finding.confidence)) {
      blockers.push(`Finding ${index + 1} confidence must be between 0 and 1.`);
    }
  }

  if (request.risk_level === "clinical_review_required") {
    requiresHumanReview = true;
    if (!output.requires_human_review) {
      warnings.push("Clinical review required risk level mandates human review.");
    }
  }

  if (request.risk_level === "high" && (output.measurements?.length ?? 0) > 0) {
    requiresHumanReview = true;
    if (!output.requires_human_review) {
      warnings.push("High-risk task with measurements requires human review.");
    }
  }

  return {
    valid: blockers.length === 0,
    warnings,
    blockers,
    requires_human_review: requiresHumanReview,
  };
}

// ---------------------------------------------------------------------------
// Task recommendation
// ---------------------------------------------------------------------------

/** Recommend AI vision tasks from case summary and readiness outputs (pure). */
export function recommendAiVisionTasksForSummary(
  input: RecommendAiVisionTasksInput
): ImagingOsAiVisionTaskType[] {
  const tasks = new Set<ImagingOsAiVisionTaskType>([
    "image_category_classification",
    "image_quality_assessment",
  ]);

  const summaryScore = input.summary_result?.overall_score ?? 0;
  const comparisonReady = isComparisonReady(input.comparison_result);
  const outcomeMeasurable = isOutcomeMeasurable(input.outcome_result);

  if (summaryScore >= 80 && comparisonReady) {
    tasks.add("growth_comparison");
    tasks.add("density_measurement");
  }

  if (outcomeMeasurable) {
    tasks.add("surgical_outcome_review");
  }

  const insufficient = summaryScore < 80 || !comparisonReady || !outcomeMeasurable;
  if (insufficient) {
    tasks.add("protocol_gap_detection");
  }

  return [...tasks];
}
