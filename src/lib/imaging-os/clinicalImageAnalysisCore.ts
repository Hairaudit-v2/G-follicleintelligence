/**
 * ImagingOS Phase 3 — clinical image intelligence (pure logic).
 * Staff-facing metadata only; no patient-facing diagnostic claims.
 */

import {
  confidenceBandForScore,
  mapExternalCategoryToCanonical,
  type CanonicalHairImageCategory,
} from "./categories";
import { classifyImageCategoryStub, stubConfidenceFromSeed } from "./classification";
import type { FiAiImageCategory } from "@/src/lib/hair-intelligence/imageClassification/types";

export const IMAGINGOS_CLINICAL_ANALYSIS_VERSION = "imagingos_clinical_v1" as const;

export type ClinicalImageAnalysisProviderName = "hli_openai" | "stub" | "unavailable";

export type ClinicalImageAnalysisStatus = "complete" | "needs_review" | "failed";

export type DonorRecipientAssessmentSummary = {
  status: ClinicalImageAnalysisStatus | "unavailable";
  confidence: number;
  observations: string[];
  review_required: boolean;
};

export type ClinicalImageAnalysisResult = {
  provider: ClinicalImageAnalysisProviderName;
  status: ClinicalImageAnalysisStatus;
  viewType?: string;
  confidence: number;
  clinicalFindings: {
    donor?: Record<string, unknown>;
    recipient?: Record<string, unknown>;
    scalpRegion?: Record<string, unknown>;
    classification?: Record<string, unknown>;
  };
  reviewRequired: boolean;
  reasons: string[];
  analysedAt: string;
  analysisVersion: typeof IMAGINGOS_CLINICAL_ANALYSIS_VERSION;
  donor_assessment?: DonorRecipientAssessmentSummary;
  recipient_assessment?: DonorRecipientAssessmentSummary;
};

export type ImagingClinicalAiMetadataRecord = {
  provider: ClinicalImageAnalysisProviderName;
  status: ClinicalImageAnalysisStatus;
  view_type?: string;
  confidence: number;
  review_required: boolean;
  reasons: string[];
  clinical_findings: ClinicalImageAnalysisResult["clinicalFindings"];
  donor_assessment?: DonorRecipientAssessmentSummary;
  recipient_assessment?: DonorRecipientAssessmentSummary;
  analysis_version: typeof IMAGINGOS_CLINICAL_ANALYSIS_VERSION;
  analysed_at: string;
};

export const DONOR_ASSESSMENT_VIEW_TYPES = [
  "donor",
  "microscopic",
] as const satisfies readonly CanonicalHairImageCategory[];

export const RECIPIENT_ASSESSMENT_VIEW_TYPES = [
  "recipient",
  "hairline",
  "front",
  "top",
  "crown",
  "temporal",
  "vertex",
] as const satisfies readonly CanonicalHairImageCategory[];

const DONOR_SLOT_HINTS = new Set([
  "donor",
  "donor_close",
  "donor_before_extraction",
  "donor_during_extraction",
  "donor_final_extraction",
  "pre_op_donor",
  "pre_op_donor_close",
  "immediate_post_op_donor",
  "postop_donor",
]);

const RECIPIENT_SLOT_HINTS = new Set([
  "recipient",
  "recipient_midscalp",
  "recipient_crown",
  "recipient_sites",
  "recipient_zone",
  "recipient_close",
  "immediate_post_op_recipient",
]);

const DONOR_ANATOMICAL_REGIONS = new Set(["donor", "body_hair"]);

const RECIPIENT_ANATOMICAL_REGIONS = new Set([
  "hairline",
  "frontal_third",
  "midscalp",
  "crown",
  "temple_left",
  "temple_right",
  "global",
  "beard",
  "eyebrow",
]);

const HLI_TO_CANONICAL_VIEW: Record<FiAiImageCategory, CanonicalHairImageCategory> = {
  front: "front",
  left_profile: "left",
  right_profile: "right",
  top: "top",
  crown: "crown",
  donor: "donor",
  graft_tray: "graft_tray",
  immediate_post_op: "immediate_post_op",
  follow_up: "follow_up",
  microscopic: "microscopic",
  unknown: "other",
};

export const CLINICAL_REVIEW_CONFIDENCE_THRESHOLD = 0.65;

export function mapHliCategoryToCanonicalViewType(
  category: FiAiImageCategory
): CanonicalHairImageCategory {
  return HLI_TO_CANONICAL_VIEW[category] ?? "other";
}

export function normalizeViewType(raw: unknown): CanonicalHairImageCategory {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase();
  const mapped = mapExternalCategoryToCanonical(key);
  return mapped.canonical;
}

export function shouldRunDonorAssessment(input: {
  viewType?: string | null;
  protocolSlotSlug?: string | null;
  anatomicalRegion?: string | null;
  hliCategory?: FiAiImageCategory | null;
}): boolean {
  const view = normalizeViewType(input.viewType ?? input.hliCategory ?? "other");
  if ((DONOR_ASSESSMENT_VIEW_TYPES as readonly string[]).includes(view)) {
    if (view === "microscopic") {
      const region = String(input.anatomicalRegion ?? "").trim().toLowerCase();
      return !region || DONOR_ANATOMICAL_REGIONS.has(region);
    }
    return true;
  }
  const slot = String(input.protocolSlotSlug ?? "")
    .trim()
    .toLowerCase();
  if (slot && DONOR_SLOT_HINTS.has(slot)) return true;
  const region = String(input.anatomicalRegion ?? "")
    .trim()
    .toLowerCase();
  return DONOR_ANATOMICAL_REGIONS.has(region);
}

export function shouldRunRecipientAssessment(input: {
  viewType?: string | null;
  protocolSlotSlug?: string | null;
  anatomicalRegion?: string | null;
  hliCategory?: FiAiImageCategory | null;
}): boolean {
  const view = normalizeViewType(input.viewType ?? input.hliCategory ?? "other");
  if (view === "donor" || view === "graft_tray") return false;
  if ((RECIPIENT_ASSESSMENT_VIEW_TYPES as readonly string[]).includes(view)) {
    if (view === "microscopic") return false;
    return true;
  }
  const slot = String(input.protocolSlotSlug ?? "")
    .trim()
    .toLowerCase();
  if (slot && RECIPIENT_SLOT_HINTS.has(slot)) return true;
  const region = String(input.anatomicalRegion ?? "")
    .trim()
    .toLowerCase();
  return RECIPIENT_ANATOMICAL_REGIONS.has(region);
}

export function buildStubClinicalImageAnalysis(input: {
  externalCategory?: string;
  legacyUploadType?: string | null;
  idempotencyKey?: string;
  analysedAt?: string;
}): ClinicalImageAnalysisResult {
  const external = input.externalCategory?.trim() || "other";
  const stub = classifyImageCategoryStub({
    external_category: external,
    legacy_upload_type: input.legacyUploadType,
    idempotency_key: input.idempotencyKey,
  });
  const confidence = stub.confidence;
  const reviewRequired = confidence < CLINICAL_REVIEW_CONFIDENCE_THRESHOLD;

  return {
    provider: "stub",
    status: reviewRequired ? "needs_review" : "complete",
    viewType: stub.canonical_photo_category,
    confidence,
    clinicalFindings: {
      classification: {
        canonical_category: stub.canonical_photo_category,
        model_provider: stub.model_provider,
        notes: stub.notes,
      },
    },
    reviewRequired,
    reasons: reviewRequired ? ["low_classification_confidence_stub"] : [],
    analysedAt: input.analysedAt ?? new Date().toISOString(),
    analysisVersion: IMAGINGOS_CLINICAL_ANALYSIS_VERSION,
  };
}

export function buildUnavailableClinicalImageAnalysis(input: {
  reason: string;
  viewType?: string;
  analysedAt?: string;
}): ClinicalImageAnalysisResult {
  return {
    provider: "unavailable",
    status: "failed",
    viewType: input.viewType,
    confidence: 0,
    clinicalFindings: {},
    reviewRequired: true,
    reasons: [input.reason],
    analysedAt: input.analysedAt ?? new Date().toISOString(),
    analysisVersion: IMAGINGOS_CLINICAL_ANALYSIS_VERSION,
  };
}

export function buildClinicalImageAnalysisFromHli(input: {
  hliCategory: FiAiImageCategory;
  categoryConfidence: number;
  hairState?: string;
  shaveState?: string;
  surgeryStage?: string;
  notes?: string;
  analysedAt?: string;
  extraReasons?: string[];
}): ClinicalImageAnalysisResult {
  const viewType = mapHliCategoryToCanonicalViewType(input.hliCategory);
  const confidence = Math.max(0, Math.min(1, input.categoryConfidence));
  const band = confidenceBandForScore(confidence);
  const lowConfidence = confidence < CLINICAL_REVIEW_CONFIDENCE_THRESHOLD;
  const unknownCategory = input.hliCategory === "unknown";
  const reasons = [...(input.extraReasons ?? [])];
  if (lowConfidence) reasons.push("low_classification_confidence");
  if (unknownCategory) reasons.push("unknown_view_classification");

  const reviewRequired = reasons.length > 0;
  const status: ClinicalImageAnalysisStatus =
    unknownCategory && confidence < 0.4
      ? "failed"
      : reviewRequired
        ? "needs_review"
        : "complete";

  return {
    provider: "hli_openai",
    status,
    viewType,
    confidence,
    clinicalFindings: {
      classification: {
        hli_category: input.hliCategory,
        canonical_view_type: viewType,
        confidence_band: band,
        hair_state: input.hairState ?? "unknown",
        shave_state: input.shaveState ?? "unknown",
        surgery_stage: input.surgeryStage ?? "unknown",
        notes: input.notes?.trim() ?? "",
      },
    },
    reviewRequired,
    reasons,
    analysedAt: input.analysedAt ?? new Date().toISOString(),
    analysisVersion: IMAGINGOS_CLINICAL_ANALYSIS_VERSION,
  };
}

export function buildDonorAssessmentSummary(input: {
  confidence: number;
  observations: string[];
  reviewRequired?: boolean;
  status?: DonorRecipientAssessmentSummary["status"];
}): DonorRecipientAssessmentSummary {
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const review =
    input.reviewRequired ??
    (confidence < CLINICAL_REVIEW_CONFIDENCE_THRESHOLD || input.observations.length === 0);
  return {
    status:
      input.status ??
      (review ? "needs_review" : confidence > 0 ? "complete" : "unavailable"),
    confidence,
    observations: input.observations.filter(Boolean).slice(0, 12),
    review_required: review,
  };
}

export function buildRecipientAssessmentSummary(input: {
  confidence: number;
  observations: string[];
  reviewRequired?: boolean;
  status?: DonorRecipientAssessmentSummary["status"];
}): DonorRecipientAssessmentSummary {
  return buildDonorAssessmentSummary(input);
}

export function donorModelResultToObservations(result: {
  donor_quality_rating?: string;
  donor_region?: string;
  clinical_observations?: string | null;
  ai_notes?: string | null;
  extraction_caution_level?: string | null;
}): string[] {
  const observations: string[] = [];
  if (result.donor_quality_rating && result.donor_quality_rating !== "unknown") {
    observations.push(`Donor quality rating: ${result.donor_quality_rating}`);
  }
  if (result.donor_region && result.donor_region !== "unknown") {
    observations.push(`Donor region: ${result.donor_region}`);
  }
  if (result.extraction_caution_level && result.extraction_caution_level !== "unknown") {
    observations.push(`Extraction caution: ${result.extraction_caution_level}`);
  }
  const clinical = result.clinical_observations?.trim();
  if (clinical) observations.push(clinical.slice(0, 500));
  const notes = result.ai_notes?.trim();
  if (notes && notes !== clinical) observations.push(notes.slice(0, 500));
  return observations;
}

export function recipientModelResultToObservations(result: {
  recipient_quality_rating?: string;
  candidacy_summary?: string | null;
  review_topics?: string[];
  ai_notes?: string | null;
}): string[] {
  const observations: string[] = [];
  if (result.recipient_quality_rating && result.recipient_quality_rating !== "unknown") {
    observations.push(`Recipient quality rating: ${result.recipient_quality_rating}`);
  }
  const summary = result.candidacy_summary?.trim();
  if (summary) observations.push(summary.slice(0, 500));
  for (const topic of result.review_topics ?? []) {
    const t = String(topic).trim();
    if (t) observations.push(t.slice(0, 200));
  }
  const notes = result.ai_notes?.trim();
  if (notes && notes !== summary) observations.push(notes.slice(0, 500));
  return observations;
}

export function mergeClinicalAnalysisWithAssessments(
  base: ClinicalImageAnalysisResult,
  assessments: {
    donor?: DonorRecipientAssessmentSummary;
    recipient?: DonorRecipientAssessmentSummary;
    donorFindings?: Record<string, unknown>;
    recipientFindings?: Record<string, unknown>;
  }
): ClinicalImageAnalysisResult {
  const reasons = [...base.reasons];
  if (assessments.donor?.review_required) reasons.push("donor_assessment_needs_review");
  if (assessments.recipient?.review_required) reasons.push("recipient_assessment_needs_review");

  const reviewRequired =
    base.reviewRequired ||
    assessments.donor?.review_required === true ||
    assessments.recipient?.review_required === true;

  let status = base.status;
  if (status === "complete" && reviewRequired) status = "needs_review";

  return {
    ...base,
    status,
    reviewRequired,
    reasons: [...new Set(reasons)],
    donor_assessment: assessments.donor,
    recipient_assessment: assessments.recipient,
    clinicalFindings: {
      ...base.clinicalFindings,
      ...(assessments.donorFindings ? { donor: assessments.donorFindings } : {}),
      ...(assessments.recipientFindings ? { recipient: assessments.recipientFindings } : {}),
    },
  };
}

export function clinicalAnalysisResultToMetadataRecord(
  result: ClinicalImageAnalysisResult
): ImagingClinicalAiMetadataRecord {
  return {
    provider: result.provider,
    status: result.status,
    view_type: result.viewType,
    confidence: result.confidence,
    review_required: result.reviewRequired,
    reasons: result.reasons,
    clinical_findings: result.clinicalFindings,
    ...(result.donor_assessment ? { donor_assessment: result.donor_assessment } : {}),
    ...(result.recipient_assessment ? { recipient_assessment: result.recipient_assessment } : {}),
    analysis_version: result.analysisVersion,
    analysed_at: result.analysedAt,
  };
}

export function mergeImagingClinicalAiMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  record: ImagingClinicalAiMetadataRecord
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  return {
    ...base,
    imaging_clinical_ai: record,
  };
}

export function readImagingClinicalAiMetadata(
  metadata: Record<string, unknown> | null | undefined
): ImagingClinicalAiMetadataRecord | null {
  const raw = metadata?.imaging_clinical_ai;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  const provider = m.provider;
  if (provider !== "hli_openai" && provider !== "stub" && provider !== "unavailable") return null;
  return {
    provider,
    status:
      m.status === "complete" || m.status === "needs_review" || m.status === "failed"
        ? m.status
        : "needs_review",
    view_type: typeof m.view_type === "string" ? m.view_type : undefined,
    confidence: typeof m.confidence === "number" ? m.confidence : 0,
    review_required: m.review_required === true,
    reasons: Array.isArray(m.reasons) ? m.reasons.map(String) : [],
    clinical_findings:
      m.clinical_findings && typeof m.clinical_findings === "object"
        ? (m.clinical_findings as ClinicalImageAnalysisResult["clinicalFindings"])
        : {},
    analysis_version: IMAGINGOS_CLINICAL_ANALYSIS_VERSION,
    analysed_at: typeof m.analysed_at === "string" ? m.analysed_at : new Date().toISOString(),
    ...(parseDonorRecipientAssessmentSummary(m.donor_assessment)
      ? { donor_assessment: parseDonorRecipientAssessmentSummary(m.donor_assessment)! }
      : {}),
    ...(parseDonorRecipientAssessmentSummary(m.recipient_assessment)
      ? { recipient_assessment: parseDonorRecipientAssessmentSummary(m.recipient_assessment)! }
      : {}),
  };
}

function parseDonorRecipientAssessmentSummary(
  raw: unknown
): DonorRecipientAssessmentSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  const status = m.status;
  if (
    status !== "complete" &&
    status !== "needs_review" &&
    status !== "unavailable"
  ) {
    return null;
  }
  return {
    status,
    confidence: typeof m.confidence === "number" ? m.confidence : 0,
    observations: Array.isArray(m.observations) ? m.observations.map(String) : [],
    review_required: m.review_required === true,
  };
}

export function collectImagingReviewReasons(input: {
  classificationConfidence?: number | null;
  qualityStatus?: string | null;
  duplicateStatus?: string | null;
  clinicalAi?: ImagingClinicalAiMetadataRecord | null;
  scalpRegionReviewRequired?: boolean;
  isPossibleDuplicate?: boolean;
}): string[] {
  const reasons: string[] = [];
  if (
    input.classificationConfidence != null &&
    input.classificationConfidence < CLINICAL_REVIEW_CONFIDENCE_THRESHOLD
  ) {
    reasons.push("low_classification_confidence");
  }
  if (input.qualityStatus === "review" || input.qualityStatus === "fail") {
    reasons.push("poor_quality_metadata");
  }
  if (input.duplicateStatus === "possible_duplicate" || input.isPossibleDuplicate) {
    reasons.push("possible_duplicate");
  }
  if (input.scalpRegionReviewRequired) {
    reasons.push("missing_scalp_region");
  }
  if (input.clinicalAi?.status === "failed") {
    reasons.push("failed_live_analysis");
  }
  if (input.clinicalAi?.review_required) {
    for (const r of input.clinicalAi.reasons) {
      if (!reasons.includes(r)) reasons.push(r);
    }
  }
  if (input.clinicalAi?.donor_assessment?.review_required) {
    reasons.push("donor_assessment_needs_review");
  }
  if (input.clinicalAi?.recipient_assessment?.review_required) {
    reasons.push("recipient_assessment_needs_review");
  }
  return [...new Set(reasons)];
}

/** Deterministic degraded confidence for unavailable provider paths in tests. */
export function degradedConfidenceFromSeed(seed: string): number {
  return stubConfidenceFromSeed(seed);
}