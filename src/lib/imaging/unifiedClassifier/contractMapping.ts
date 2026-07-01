/**
 * Maps HLI / ImagingOS classifier output to intelligence-core V1 contracts.
 */

import type {
  ImageCaptureSourceV1,
  ImageClassificationResultV1,
  ImageClassificationTypeV1,
  ImageOrientationV1,
  NormalizedImageSignalV1,
  PhotoCategoryV1,
} from "@follicle/intelligence-core/contracts";
import {
  IMAGE_CLASSIFICATION_RESULT_V1_VERSION,
  NORMALIZED_IMAGE_SIGNAL_V1_VERSION,
} from "@follicle/intelligence-core/contracts";
import type { FiAiImageCategory, FiAiImageClassificationResult } from "@/src/lib/hair-intelligence/imageClassification/types";
import type { ImageSignalSourceSystemV1 } from "@follicle/intelligence-core/contracts";
import {
  mapExternalLabelToPhotoCategoryV1,
  mapHliCategoryToPhotoCategoryV1,
} from "./categoryMapping";
import type { UnifiedImageClassifyRequest } from "./unifiedImageClassifyRequest";

const HLI_ORIENTATION: Record<FiAiImageCategory, ImageOrientationV1> = {
  front: "frontal",
  left_profile: "left_profile",
  right_profile: "right_profile",
  top: "top_down",
  crown: "top_down",
  donor: "posterior",
  graft_tray: "unknown",
  immediate_post_op: "frontal",
  follow_up: "frontal",
  microscopic: "unknown",
  unknown: "unknown",
};

function resolveCaptureSource(
  request: UnifiedImageClassifyRequest
): ImageCaptureSourceV1 {
  const raw = request.capture_source?.trim().toLowerCase();
  const bySource: Partial<Record<ImageSignalSourceSystemV1, ImageCaptureSourceV1>> = {
    hairaudit: "forensic_audit",
    fi_os: "guided_capture",
    hli: "patient_portal",
    iiohr: "clinic_staff",
  };
  if (raw === "forensic_audit") return "forensic_audit";
  if (raw === "guided_capture") return "guided_capture";
  if (raw === "patient_portal") return "patient_portal";
  if (raw === "clinic_staff") return "clinic_staff";
  if (raw === "doctor_upload") return "doctor_upload";
  if (raw === "surgery_portal") return "surgery_portal";
  return bySource[request.source_system] ?? "unknown";
}

function inferClassificationType(
  category: PhotoCategoryV1 | undefined,
  hli: FiAiImageClassificationResult
): ImageClassificationTypeV1 {
  if (hli.surgeryStage === "intra_op" || category === "graft_tray") {
    return "surgery_stage";
  }
  if (category === "donor") return "donor_assessment";
  if (category === "recipient") return "recipient_assessment";
  if (category === "follow_up") return "progression_signal";
  if (hli.categoryConfidence < 0.4) return "quality_assessment";
  return "anatomical_view";
}

function qualityScoreFromConfidence(confidence: number): number {
  return Math.max(0, Math.min(1, confidence));
}

function blurScoreFromConfidence(confidence: number): number {
  return Math.max(0, Math.min(1, 1 - confidence * 0.85));
}

export function buildImageClassificationResultV1(input: {
  request: UnifiedImageClassifyRequest;
  hliResult: FiAiImageClassificationResult;
  provider: string;
  processingVersion: string;
  fallbackUsed: boolean;
  externalCategoryHint?: string;
  legacyUploadType?: string | null;
}): ImageClassificationResultV1 {
  const categoryMapping =
    input.hliResult.category === "unknown" && input.externalCategoryHint
      ? mapExternalLabelToPhotoCategoryV1(input.externalCategoryHint, input.legacyUploadType)
      : mapHliCategoryToPhotoCategoryV1(input.hliResult.category);

  const confidence = Math.max(0, Math.min(1, input.hliResult.categoryConfidence));
  const metadata: Record<string, string | number | boolean | null> = {
    provider: input.provider,
    processing_version: input.processingVersion,
    fallback_used: input.fallbackUsed,
    hair_state: input.hliResult.hairState,
    shave_state: input.hliResult.shaveState,
    surgery_stage: input.hliResult.surgeryStage,
    upload_source: input.request.upload_source ?? null,
    category_alias_used: categoryMapping.aliasUsed,
    category_mapping_source: categoryMapping.mappingSource,
    generated_at: new Date().toISOString(),
  };

  if (input.request.metadata) {
    for (const [key, value] of Object.entries(input.request.metadata)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        metadata[`request_${key}`] = value;
      }
    }
  }

  if (input.request.patient_id) metadata.patient_id = input.request.patient_id;
  if (input.request.case_id) metadata.case_id = input.request.case_id;
  if (input.request.professional_id) metadata.professional_id = input.request.professional_id;

  const notes = input.hliResult.notes?.trim();
  if (notes) metadata.classifier_notes = notes.slice(0, 500);

  return {
    schemaVersion: IMAGE_CLASSIFICATION_RESULT_V1_VERSION,
    image_id: input.request.source_image_id,
    classification_type: inferClassificationType(categoryMapping.category, input.hliResult),
    ...(categoryMapping.category ? { category: categoryMapping.category } : {}),
    confidence,
    orientation: HLI_ORIENTATION[input.hliResult.category] ?? "unknown",
    quality_score: qualityScoreFromConfidence(confidence),
    blur_score: blurScoreFromConfidence(confidence),
    protocol_compliant: confidence >= 0.65 && !input.fallbackUsed,
    capture_source: resolveCaptureSource(input.request),
    metadata,
  };
}

export function buildNormalizedImageSignalV1(input: {
  request: UnifiedImageClassifyRequest;
  classification: ImageClassificationResultV1;
  processingVersion: string;
}): NormalizedImageSignalV1 {
  const subjectId =
    input.request.patient_id?.trim() ||
    input.request.case_id?.trim() ||
    input.request.source_image_id;

  const storageRef =
    input.request.storage_bucket && input.request.storage_path
      ? `${input.request.storage_bucket}:${input.request.storage_path}`
      : input.request.storage_path?.trim() || undefined;

  return {
    schemaVersion: NORMALIZED_IMAGE_SIGNAL_V1_VERSION,
    source_system: input.request.source_system,
    subject_id: subjectId,
    classification_results: [input.classification],
    image_metadata: {
      ...(input.request.image_content_type ? { content_type: input.request.image_content_type } : {}),
      ...(input.request.image_size_bytes != null
        ? { size_bytes: input.request.image_size_bytes }
        : {}),
      ...(storageRef ? { storage_ref: storageRef } : {}),
      captured_at:
        typeof input.request.metadata?.uploaded_at === "string"
          ? input.request.metadata.uploaded_at
          : undefined,
    },
    processing_version: input.processingVersion,
  };
}
