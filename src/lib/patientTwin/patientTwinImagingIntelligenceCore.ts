/**
 * ImagingOS Phase 5 — Patient Twin longitudinal imaging intelligence mapping (pure).
 * Staff-facing conservative summaries only.
 */

import { readImagingClinicalAiMetadata } from "@/src/lib/imaging-os/clinicalImageAnalysisCore";
import {
  buildImagingDeepLinks,
  listAvailableImagingDeepLinks,
  type ImagingDeepLink,
} from "@/src/lib/imaging-os/imagingDeepLinksCore";
import type { ImagingQualityMetadataRecord } from "@/src/lib/imaging-os/imageQualityMetadata";
import {
  readImagingJobSummaries,
  type ImagingJobSummariesMetadata,
} from "@/src/lib/imaging-os/imagingJobReadOnlySummaries";
import {
  readImagingStaffReviewRecord,
  staffReviewClearsQueue,
} from "@/src/lib/imaging-os/imagingStaffReviewCore";
import type { TwinImagingUiSectionKey } from "./patientJourneyGallery";

export type PatientTwinImagingIntelligenceSummary = {
  view_type: string | null;
  capture_source: string | null;
  quality_status: string | null;
  quality_score: number | null;
  classification_confidence: number | null;
  review_required: boolean;
  retake_required: boolean;
  staff_review_status: string | null;
  clinical_status: string | null;
  observations: string[];
  limitations: string[];
  job_summaries: ImagingJobSummariesMetadata;
};

export type PatientTwinImagingDeepLinks = {
  links: ImagingDeepLink[];
  review_queue_href: string | null;
  imaging_workspace_href: string;
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

const JOURNEY_PHASE_LABELS: Record<TwinImagingUiSectionKey, string> = {
  pre_op: "Pre-surgery",
  immediate_post_op: "Immediate post-op",
  follow_up: "Follow-up (3–12 month)",
  donor: "Donor recovery",
  crown: "Crown / recipient growth",
  hairline_front: "Baseline / hairline",
  microscope: "Microscopic",
  unknown_needs_review: "Needs review",
};

export function journeyPhaseLabelForSection(sectionKey: TwinImagingUiSectionKey): string {
  return JOURNEY_PHASE_LABELS[sectionKey] ?? sectionKey.replace(/_/g, " ");
}

export function mapPatientTwinImagingIntelligence(input: {
  metadata: Record<string, unknown>;
  aiImageCategory?: string | null;
  aiImageCategoryConfidence?: number | null;
  aiImageReviewStatus?: string | null;
}): PatientTwinImagingIntelligenceSummary {
  const clinical = readImagingClinicalAiMetadata(input.metadata);
  const quality = readQuality(input.metadata);
  const staffReview = readImagingStaffReviewRecord(input.metadata);
  const jobSummaries = readImagingJobSummaries(input.metadata);

  const classificationConfidence =
    input.aiImageCategoryConfidence ?? clinical?.confidence ?? null;

  const cleared = staffReviewClearsQueue(staffReview);
  const retakeRequired = staffReview?.status === "retake_required";
  const reviewRequired =
    !cleared &&
    (retakeRequired ||
      clinical?.review_required === true ||
      quality?.quality_status === "fail" ||
      quality?.quality_status === "review" ||
      input.aiImageReviewStatus === "pending");

  const observations: string[] = [];
  if (clinical?.donor_assessment?.observations?.length) {
    observations.push(...clinical.donor_assessment.observations.slice(0, 2));
  }
  if (clinical?.recipient_assessment?.observations?.length) {
    observations.push(...clinical.recipient_assessment.observations.slice(0, 2));
  }
  if (jobSummaries.density_estimate?.observations?.length) {
    observations.push(...jobSummaries.density_estimate.observations.slice(0, 1));
  }
  if (jobSummaries.norwood_grade?.observations?.length) {
    observations.push(...jobSummaries.norwood_grade.observations.slice(0, 1));
  }

  const limitations = [
    "Staff review summary — not a patient diagnosis.",
    "Not a predictive surgery simulation.",
  ];
  if (jobSummaries.outcome_score?.limitations?.length) {
    for (const l of jobSummaries.outcome_score.limitations) {
      if (!limitations.includes(l)) limitations.push(l);
    }
  }

  return {
    view_type: clinical?.view_type ?? input.aiImageCategory ?? null,
    capture_source: extractCaptureSource(input.metadata),
    quality_status: quality?.quality_status ?? null,
    quality_score: quality?.quality_score ?? null,
    classification_confidence: classificationConfidence,
    review_required: reviewRequired,
    retake_required: retakeRequired,
    staff_review_status: staffReview?.status ?? null,
    clinical_status: clinical?.status ?? null,
    observations: observations.slice(0, 6),
    limitations,
    job_summaries: {
      ...(jobSummaries.density_estimate ? { density_estimate: jobSummaries.density_estimate } : {}),
      ...(jobSummaries.norwood_grade ? { norwood_grade: jobSummaries.norwood_grade } : {}),
      ...(jobSummaries.outcome_score ? { outcome_score: jobSummaries.outcome_score } : {}),
    },
  };
}

export function buildPatientTwinImagingDeepLinks(input: {
  tenantId: string;
  patientId: string;
  metadata: Record<string, unknown>;
  caseId?: string | null;
  consultationId?: string | null;
  imageId: string;
  reviewRequired: boolean;
}): PatientTwinImagingDeepLinks {
  const protocolSessionId =
    typeof input.metadata.protocol_session_id === "string"
      ? input.metadata.protocol_session_id
      : null;
  const protocolTemplateSlug =
    typeof input.metadata.protocol_template_slug === "string"
      ? input.metadata.protocol_template_slug
      : null;
  const hairAuditSourceCaseId =
    typeof input.metadata.hairaudit_source_case_id === "string"
      ? input.metadata.hairaudit_source_case_id
      : typeof input.metadata.hair_audit_case_id === "string"
        ? input.metadata.hair_audit_case_id
        : null;
  const procedureDayId =
    typeof input.metadata.procedure_day_id === "string" ? input.metadata.procedure_day_id : null;

  const linkSet = buildImagingDeepLinks({
    tenantId: input.tenantId,
    patientId: input.patientId,
    protocolSessionId,
    protocolTemplateSlug,
    caseId: input.caseId ?? null,
    consultationId: input.consultationId ?? null,
    procedureDayId,
    hairAuditSourceCaseId,
    imageId: input.imageId,
    reviewRequired: input.reviewRequired,
  });

  return {
    links: listAvailableImagingDeepLinks(linkSet),
    review_queue_href: linkSet.reviewQueue?.href ?? null,
    imaging_workspace_href: linkSet.imagingWorkspace!.href,
  };
}