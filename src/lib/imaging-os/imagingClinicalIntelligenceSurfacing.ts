/**
 * ImagingOS Phase 4 — staff-facing clinical intelligence view models for workspace UI.
 */

import { collectImagingReviewReasons, readImagingClinicalAiMetadata } from "./clinicalImageAnalysisCore";
import type { DonorRecipientAssessmentSummary } from "./clinicalImageAnalysisCore";
import type { ImagingQualityMetadataRecord } from "./imageQualityMetadata";
import { buildImagingDeepLinks, listAvailableImagingDeepLinks, type ImagingDeepLink } from "./imagingDeepLinksCore";
import { readImagingJobSummaries, type ReadOnlyJobSummary } from "./imagingJobReadOnlySummaries";
import {
  readImagingStaffReviewRecord,
  staffReviewClearsQueue,
} from "./imagingStaffReviewCore";

export type ImagingClinicalIntelligenceView = {
  imageId: string;
  viewType: string | null;
  qualityStatus: string | null;
  qualityScore: number | null;
  classificationConfidence: number | null;
  reviewRequired: boolean;
  reviewReasons: string[];
  donorAssessment: DonorRecipientAssessmentSummary | null;
  recipientAssessment: DonorRecipientAssessmentSummary | null;
  staffReviewStatus: string | null;
  retakeRequired: boolean;
  missingScalpRegion: boolean;
  jobSummaries: {
    density_estimate?: ReadOnlyJobSummary;
    norwood_grade?: ReadOnlyJobSummary;
    outcome_score?: ReadOnlyJobSummary;
  };
  reviewQueueHref: string;
  deepLinks: ImagingDeepLink[];
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

export function buildImagingClinicalIntelligenceView(input: {
  tenantId: string;
  patientId: string;
  imageId: string;
  metadata: Record<string, unknown>;
  aiImageCategory?: string | null;
  aiImageCategoryConfidence?: number | null;
  caseId?: string | null;
  consultationId?: string | null;
}): ImagingClinicalIntelligenceView {
  const clinical = readImagingClinicalAiMetadata(input.metadata);
  const quality = readQuality(input.metadata);
  const staffReview = readImagingStaffReviewRecord(input.metadata);
  const jobSummaries = readImagingJobSummaries(input.metadata);

  const classificationConfidence =
    input.aiImageCategoryConfidence ?? clinical?.confidence ?? null;

  const reviewReasons = collectImagingReviewReasons({
    classificationConfidence,
    qualityStatus: quality?.quality_status ?? null,
    duplicateStatus: quality?.duplicate_status ?? null,
    clinicalAi: clinical,
    scalpRegionReviewRequired: clinical?.reasons.includes("missing_scalp_region") ?? false,
  });

  const cleared = staffReviewClearsQueue(staffReview);
  const reviewRequired = !cleared && (reviewReasons.length > 0 || clinical?.review_required === true);

  return {
    imageId: input.imageId,
    viewType: clinical?.view_type ?? input.aiImageCategory ?? null,
    qualityStatus: quality?.quality_status ?? null,
    qualityScore: quality?.quality_score ?? null,
    classificationConfidence,
    reviewRequired,
    reviewReasons,
    donorAssessment: clinical?.donor_assessment ?? null,
    recipientAssessment: clinical?.recipient_assessment ?? null,
    staffReviewStatus: staffReview?.status ?? null,
    retakeRequired: staffReview?.status === "retake_required",
    missingScalpRegion: clinical?.reasons.includes("missing_scalp_region") ?? false,
    jobSummaries: {
      ...(jobSummaries.density_estimate ? { density_estimate: jobSummaries.density_estimate } : {}),
      ...(jobSummaries.norwood_grade ? { norwood_grade: jobSummaries.norwood_grade } : {}),
      ...(jobSummaries.outcome_score ? { outcome_score: jobSummaries.outcome_score } : {}),
    },
    reviewQueueHref: `/fi-admin/${input.tenantId.trim()}/imaging/review`,
    deepLinks: listAvailableImagingDeepLinks(
      buildImagingDeepLinks({
        tenantId: input.tenantId,
        patientId: input.patientId,
        imageId: input.imageId,
        caseId: input.caseId ?? null,
        consultationId: input.consultationId ?? null,
        protocolSessionId:
          typeof input.metadata.protocol_session_id === "string"
            ? input.metadata.protocol_session_id
            : null,
        protocolTemplateSlug:
          typeof input.metadata.protocol_template_slug === "string"
            ? input.metadata.protocol_template_slug
            : null,
        reviewRequired,
      })
    ),
  };
}