/**
 * ImagingOS Phase 6 — server-side review queue filter matching (pure logic).
 */

import { CLINICAL_REVIEW_CONFIDENCE_THRESHOLD } from "./clinicalImageAnalysisCore";
import { readImagingClinicalAiMetadata } from "./clinicalImageAnalysisCore";
import { readImagingReviewAssignmentRecord } from "./imagingReviewAssignmentCore";
import { readImagingStaffReviewRecord } from "./imagingStaffReviewCore";
import type { ImagingQualityMetadataRecord } from "./imageQualityMetadata";

export type ImagingReviewConfidenceBand = "low" | "medium" | "high" | "any";

export type ImagingClinicalReviewQueueFilters = {
  reviewReason?: string | null;
  qualityStatus?: string | null;
  confidenceBand?: ImagingReviewConfidenceBand;
  captureSource?: string | null;
  viewType?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  protocolSessionId?: string | null;
  assignedReviewerId?: string | null;
  retakeRequired?: boolean | null;
  createdAfter?: string | null;
  createdBefore?: string | null;
};

export type ReviewQueueFilterRow = {
  imageId: string;
  patientId: string;
  caseId: string | null;
  metadata: Record<string, unknown>;
  aiImageCategory: string | null;
  aiImageCategoryConfidence: number | null;
  aiImageReviewStatus: string | null;
  createdAt: string;
  reviewReasons: string[];
};

function readQuality(metadata: Record<string, unknown>): ImagingQualityMetadataRecord | null {
  const raw = metadata.imaging_quality;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const q = raw as Record<string, unknown>;
  return {
    quality_score: typeof q.quality_score === "number" ? q.quality_score : 0,
    quality_status:
      q.quality_status === "pass" || q.quality_status === "review" || q.quality_status === "fail"
        ? q.quality_status
        : "review",
    blur_status: (q.blur_status as ImagingQualityMetadataRecord["blur_status"]) ?? "unknown",
    exposure_status:
      (q.exposure_status as ImagingQualityMetadataRecord["exposure_status"]) ?? "unknown",
    duplicate_status:
      (q.duplicate_status as ImagingQualityMetadataRecord["duplicate_status"]) ?? "unknown",
    sharpness_score: typeof q.sharpness_score === "number" ? q.sharpness_score : null,
    evaluated_at: typeof q.evaluated_at === "string" ? q.evaluated_at : new Date().toISOString(),
    evaluator_version: "imagingos_quality_v1",
  };
}

function extractCaptureSource(metadata: Record<string, unknown>): string | null {
  if (typeof metadata.capture_source === "string") return metadata.capture_source;
  const fi = metadata.fi_image_metadata;
  if (fi && typeof fi === "object" && !Array.isArray(fi)) {
    const src = (fi as { capture_source?: string }).capture_source;
    if (src) return src;
  }
  return null;
}

function confidenceBandMatch(
  confidence: number | null,
  band: ImagingReviewConfidenceBand
): boolean {
  if (band === "any") return true;
  const c = confidence ?? 0;
  if (band === "low") return c < CLINICAL_REVIEW_CONFIDENCE_THRESHOLD;
  if (band === "medium")
    return c >= CLINICAL_REVIEW_CONFIDENCE_THRESHOLD && c < 0.85;
  return c >= 0.85;
}

export function matchesImagingReviewQueueFilters(
  row: ReviewQueueFilterRow,
  filters: ImagingClinicalReviewQueueFilters
): boolean {
  const metadata = row.metadata;
  const clinical = readImagingClinicalAiMetadata(metadata);
  const quality = readQuality(metadata);
  const staffReview = readImagingStaffReviewRecord(metadata);
  const assignment = readImagingReviewAssignmentRecord(metadata);

  if (filters.patientId?.trim() && row.patientId !== filters.patientId.trim()) return false;
  if (filters.caseId?.trim() && row.caseId !== filters.caseId.trim()) return false;

  if (filters.reviewReason?.trim()) {
    const reason = filters.reviewReason.trim();
    if (!row.reviewReasons.includes(reason)) return false;
  }

  if (filters.qualityStatus?.trim()) {
    if ((quality?.quality_status ?? "") !== filters.qualityStatus.trim()) return false;
  }

  if (filters.confidenceBand && filters.confidenceBand !== "any") {
    const conf = row.aiImageCategoryConfidence ?? clinical?.confidence ?? null;
    if (!confidenceBandMatch(conf, filters.confidenceBand)) return false;
  }

  if (filters.captureSource?.trim()) {
    const src = extractCaptureSource(metadata);
    if (src !== filters.captureSource.trim()) return false;
  }

  if (filters.viewType?.trim()) {
    const view = clinical?.view_type ?? row.aiImageCategory ?? "";
    if (String(view).toLowerCase() !== filters.viewType.trim().toLowerCase()) return false;
  }

  if (filters.protocolSessionId?.trim()) {
    const sid =
      typeof metadata.protocol_session_id === "string" ? metadata.protocol_session_id : null;
    if (sid !== filters.protocolSessionId.trim()) return false;
  }

  if (filters.assignedReviewerId?.trim()) {
    const reviewer = filters.assignedReviewerId.trim();
    if (assignment?.assigned_to !== reviewer) return false;
  }

  if (filters.retakeRequired === true && staffReview?.status !== "retake_required") return false;
  if (filters.retakeRequired === false && staffReview?.status === "retake_required") return false;

  if (filters.createdAfter?.trim()) {
    const after = Date.parse(filters.createdAfter.trim());
    const created = Date.parse(row.createdAt);
    if (Number.isFinite(after) && Number.isFinite(created) && created < after) return false;
  }

  if (filters.createdBefore?.trim()) {
    const before = Date.parse(filters.createdBefore.trim());
    const created = Date.parse(row.createdAt);
    if (Number.isFinite(before) && Number.isFinite(created) && created > before) return false;
  }

  return true;
}

export function parseImagingReviewQueueFiltersFromSearchParams(
  params: URLSearchParams
): ImagingClinicalReviewQueueFilters {
  const retake = params.get("retake");
  return {
    reviewReason: params.get("reason"),
    qualityStatus: params.get("quality"),
    confidenceBand: (params.get("confidence") as ImagingReviewConfidenceBand) ?? "any",
    captureSource: params.get("capture"),
    viewType: params.get("view"),
    patientId: params.get("patient"),
    caseId: params.get("case"),
    protocolSessionId: params.get("session"),
    assignedReviewerId: params.get("assigned"),
    retakeRequired: retake === "1" ? true : retake === "0" ? false : null,
    createdAfter: params.get("after"),
    createdBefore: params.get("before"),
  };
}