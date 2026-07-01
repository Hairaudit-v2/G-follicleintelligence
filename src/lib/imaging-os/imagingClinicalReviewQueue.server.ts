import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createPatientImageSignedUrls } from "@/src/lib/patientImages/patientImagesServer";
import {
  collectImagingReviewReasons,
  readImagingClinicalAiMetadata,
  CLINICAL_REVIEW_CONFIDENCE_THRESHOLD,
} from "./clinicalImageAnalysisCore";
import {
  readImagingStaffReviewRecord,
  staffReviewClearsQueue,
} from "./imagingStaffReviewCore";
import type { ImagingQualityMetadataRecord } from "./imageQualityMetadata";
import { buildImagingDeepLinks, listAvailableImagingDeepLinks, type ImagingDeepLink } from "./imagingDeepLinksCore";

export type ImagingClinicalReviewQueueItem = {
  imageId: string;
  patientId: string;
  patientLabel: string | null;
  caseId: string | null;
  viewType: string | null;
  captureSource: string | null;
  qualityStatus: string | null;
  classificationStatus: string | null;
  classificationConfidence: number | null;
  reviewReasons: string[];
  createdAt: string;
  protocolSessionId: string | null;
  previewSignedUrl: string | null;
  staffReviewedAt: string | null;
  staffReviewStatus: string | null;
  deepLinks: ImagingDeepLink[];
};

function readQualityRecord(metadata: Record<string, unknown>): ImagingQualityMetadataRecord | null {
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

export function imageNeedsClinicalReview(input: {
  metadata: Record<string, unknown>;
  aiImageCategoryConfidence?: number | null;
  aiImageReviewStatus?: string | null;
}): { needsReview: boolean; reasons: string[] } {
  const metadata = input.metadata;
  const clinicalAi = readImagingClinicalAiMetadata(metadata);
  const quality = readQualityRecord(metadata);
  const classificationConfidence =
    input.aiImageCategoryConfidence ??
    (typeof metadata.ai_image_category_confidence === "number"
      ? metadata.ai_image_category_confidence
      : clinicalAi?.confidence ?? null);

  const reasons = collectImagingReviewReasons({
    classificationConfidence,
    qualityStatus: quality?.quality_status ?? null,
    duplicateStatus: quality?.duplicate_status ?? null,
    clinicalAi,
    isPossibleDuplicate: quality?.duplicate_status === "possible_duplicate",
    scalpRegionReviewRequired: clinicalAi?.reasons.includes("missing_scalp_region") ?? false,
  });

  if (input.aiImageReviewStatus === "pending" && (classificationConfidence ?? 0) < CLINICAL_REVIEW_CONFIDENCE_THRESHOLD) {
    if (!reasons.includes("low_classification_confidence")) {
      reasons.push("low_classification_confidence");
    }
  }

  const staffReview = readImagingStaffReviewRecord(metadata);
  if (staffReviewClearsQueue(staffReview)) {
    return { needsReview: false, reasons: [] };
  }
  if (staffReview?.status === "retake_required") {
    if (!reasons.includes("retake_required")) reasons.push("retake_required");
  }

  return { needsReview: reasons.length > 0, reasons };
}

export async function loadImagingClinicalReviewQueue(
  tenantId: string,
  client?: SupabaseClient,
  limit = 100
): Promise<ImagingClinicalReviewQueueItem[]> {
  const supabase = client ?? supabaseAdmin();
  const tid = tenantId.trim();

  const { data: images, error } = await supabase
    .from("fi_patient_images")
    .select(
      "id, patient_id, case_id, storage_bucket, storage_path, created_at, metadata, ai_image_category, ai_image_category_confidence, ai_image_review_status, imaging_protocol_slot_slug"
    )
    .eq("tenant_id", tid)
    .eq("image_status", "active")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit * 3, 300));
  if (error) throw new Error(error.message);

  const pending: Array<{
    row: Record<string, unknown>;
    reasons: string[];
  }> = [];

  for (const row of images ?? []) {
    const mapped = row as Record<string, unknown>;
    const metadata =
      mapped.metadata && typeof mapped.metadata === "object"
        ? (mapped.metadata as Record<string, unknown>)
        : {};
    const review = imageNeedsClinicalReview({
      metadata,
      aiImageCategoryConfidence:
        mapped.ai_image_category_confidence != null
          ? Number(mapped.ai_image_category_confidence)
          : null,
      aiImageReviewStatus:
        mapped.ai_image_review_status != null ? String(mapped.ai_image_review_status) : null,
    });
    if (review.needsReview) {
      pending.push({ row: mapped, reasons: review.reasons });
    }
  }

  const slice = pending.slice(0, limit);
  const patientIds = [...new Set(slice.map((p) => String(p.row.patient_id)))];

  const patientLabelById = new Map<string, string | null>();
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from("fi_patients")
      .select("id, metadata, person_id")
      .eq("tenant_id", tid)
      .in("id", patientIds);
    const personIds = (patients ?? [])
      .map((p) => (p as { person_id?: string }).person_id)
      .filter(Boolean) as string[];
    const personNameById = new Map<string, string>();
    if (personIds.length > 0) {
      const { data: persons } = await supabase
        .from("fi_persons")
        .select("id, metadata")
        .in("id", personIds);
      for (const person of persons ?? []) {
        const meta = (person as { metadata?: Record<string, unknown> }).metadata ?? {};
        const name =
          typeof meta.full_name === "string"
            ? meta.full_name
            : typeof meta.preferred_name === "string"
              ? meta.preferred_name
              : null;
        personNameById.set(String((person as { id: string }).id), name ?? "Patient");
      }
    }
    for (const patient of patients ?? []) {
      const pid = String((patient as { id: string }).id);
      const personId = (patient as { person_id?: string }).person_id;
      patientLabelById.set(pid, personId ? (personNameById.get(personId) ?? null) : null);
    }
  }

  const signed = await createPatientImageSignedUrls(
    slice.map((p) => ({
      id: String(p.row.id),
      storage_bucket: String(p.row.storage_bucket ?? "patient-images"),
      storage_path: String(p.row.storage_path ?? ""),
    })),
    supabase
  );

  return slice.map(({ row, reasons }) => {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const clinicalAi = readImagingClinicalAiMetadata(metadata);
    const quality = readQualityRecord(metadata);
    const imageId = String(row.id);
    const signedEntry = signed.get(imageId);

    const patientId = String(row.patient_id);
    const protocolSessionId =
      typeof metadata.protocol_session_id === "string" ? metadata.protocol_session_id : null;
    const deepLinks = listAvailableImagingDeepLinks(
      buildImagingDeepLinks({
        tenantId: tid,
        patientId,
        imageId,
        caseId: row.case_id != null ? String(row.case_id) : null,
        protocolSessionId,
        protocolTemplateSlug:
          typeof metadata.protocol_template_slug === "string"
            ? metadata.protocol_template_slug
            : null,
        reviewRequired: true,
      })
    );

    return {
      imageId,
      patientId,
      patientLabel: patientLabelById.get(patientId) ?? null,
      caseId: row.case_id != null ? String(row.case_id) : null,
      viewType:
        clinicalAi?.view_type ??
        (row.ai_image_category != null ? String(row.ai_image_category) : null),
      captureSource: extractCaptureSource(metadata),
      qualityStatus: quality?.quality_status ?? null,
      classificationStatus:
        row.ai_image_review_status != null ? String(row.ai_image_review_status) : null,
      classificationConfidence:
        row.ai_image_category_confidence != null
          ? Number(row.ai_image_category_confidence)
          : (clinicalAi?.confidence ?? null),
      reviewReasons: reasons,
      createdAt: String(row.created_at),
      protocolSessionId,
      previewSignedUrl: signedEntry?.url ?? null,
      staffReviewedAt: readImagingStaffReviewRecord(metadata)?.reviewed_at ?? null,
      staffReviewStatus: readImagingStaffReviewRecord(metadata)?.status ?? null,
      deepLinks,
    };
  });
}