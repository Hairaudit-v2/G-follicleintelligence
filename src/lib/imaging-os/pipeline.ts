/**
 * ImagingOS — universal image ingestion pipeline (Phase IM-2).
 * Pure orchestration: normalize → quality → protocol → classification.
 */

import { isCanonicalHairImageCategory, type CanonicalHairImageCategory } from "./categories";
import { classifyImageCategoryStub } from "./classification";
import type { ImageClassificationResult } from "./classification";
import type { ImagingOsImageIngestionRequest, ImagingOsNormalizedImageIntake } from "./intake";
import { normalizeImageIngestionRequest } from "./intake";
import { evaluateImageProtocolStub } from "./protocol";
import type { ImageProtocolEvaluation, ImagingOsProtocolEvaluationResult, ImagingOsProtocolType } from "./protocol";
import { evaluateImageProtocolCompleteness } from "./protocol";
import {
  evaluateImageQualityFromMetadata,
  evaluateImageQualityStub,
  hasMetadataForQualityEvaluation,
  isImagingOsMetadataQualityResult,
} from "./quality";
import type { ImagingOsPipelineQualityResult } from "./quality";

export const IMAGING_OS_INGESTION_PIPELINE_VERSION = "imaging-os-ingestion-v1" as const;

export type ImagingOsIngestionPipelineStatus = "dry_run" | "not_processable";

export type ImagingOsIngestionPipelineOptions = {
  /** When set, runs case/single-image protocol completeness evaluation (IM-3). */
  protocol?: ImagingOsProtocolType;
  /** Optional full case categories; defaults to the normalized intake category when omitted. */
  case_categories?: CanonicalHairImageCategory[];
};

export type ImagingOsIngestionPipelineResult = {
  intake: ImagingOsNormalizedImageIntake;
  quality: ImagingOsPipelineQualityResult;
  protocol: ImageProtocolEvaluation;
  /** Present when `options.protocol` is set (IM-3). */
  protocol_completeness?: ImagingOsProtocolEvaluationResult;
  classification: ImageClassificationResult;
  pipeline_version: typeof IMAGING_OS_INGESTION_PIPELINE_VERSION;
  status: ImagingOsIngestionPipelineStatus;
  /** Non-fatal pipeline warnings (e.g. sub-clinical image quality). */
  warnings?: string[];
};

const CLINICAL_QUALITY_WARNING =
  "Image quality is not clinically usable for downstream intelligence." as const;

function evaluateQualityForIntake(intake: ImagingOsNormalizedImageIntake): ImagingOsPipelineQualityResult {
  if (
    !hasMetadataForQualityEvaluation({
      width: intake.width,
      height: intake.height,
      size_bytes: intake.size_bytes,
      content_type: intake.content_type,
      metadata: intake.metadata,
    })
  ) {
    return evaluateImageQualityStub({
      content_type: intake.content_type,
      file_size_bytes: intake.size_bytes,
    });
  }

  return evaluateImageQualityFromMetadata({
    width: intake.width,
    height: intake.height,
    size_bytes: intake.size_bytes,
    content_type: intake.content_type,
    canonical_category: intake.canonical_photo_category,
    source_system: intake.source_system,
    upload_surface: intake.upload_surface,
    metadata: intake.metadata,
  });
}

function buildPipelineWarnings(quality: ImagingOsPipelineQualityResult): string[] | undefined {
  if (isImagingOsMetadataQualityResult(quality) && !quality.is_clinically_usable) {
    return [CLINICAL_QUALITY_WARNING];
  }
  return undefined;
}

function readClassificationSeed(request: ImagingOsImageIngestionRequest): string | undefined {
  const idempotencyKey = request.metadata?.idempotency_key;
  if (typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0) {
    return idempotencyKey.trim();
  }
  return request.external_image_id?.trim() || undefined;
}

function readLegacyUploadType(request: ImagingOsImageIngestionRequest): string | null {
  const legacy = request.metadata?.legacy_upload_type;
  return typeof legacy === "string" ? legacy : null;
}

function classifyFromRequest(
  request: ImagingOsImageIngestionRequest,
  intake: ImagingOsNormalizedImageIntake
): ImageClassificationResult {
  const externalCategory =
    request.canonical_category_hint &&
    isCanonicalHairImageCategory(request.canonical_category_hint)
      ? request.canonical_category_hint
      : intake.external_category?.trim() ||
        request.external_category?.trim() ||
        intake.canonical_photo_category;

  return classifyImageCategoryStub({
    external_category: externalCategory,
    legacy_upload_type: readLegacyUploadType(request),
    idempotency_key: readClassificationSeed(request),
  });
}

/**
 * Run the universal ingestion pipeline (pure stub path — no I/O or AI).
 */
export function runImagingOsIngestionPipeline(
  request: ImagingOsImageIngestionRequest,
  options?: ImagingOsIngestionPipelineOptions
): ImagingOsIngestionPipelineResult {
  const intake = normalizeImageIngestionRequest(request);
  const classification = classifyFromRequest(request, intake);

  const protocolCompleteness = options?.protocol
    ? evaluateImageProtocolCompleteness({
        protocol: options.protocol,
        categories:
          options.case_categories && options.case_categories.length > 0
            ? options.case_categories
            : [intake.canonical_photo_category],
      })
    : undefined;

  if (!intake.is_processable) {
    const quality = evaluateQualityForIntake(intake);
    const warnings = buildPipelineWarnings(quality);
    return {
      intake,
      quality,
      protocol: evaluateImageProtocolStub(),
      ...(protocolCompleteness ? { protocol_completeness: protocolCompleteness } : {}),
      classification,
      pipeline_version: IMAGING_OS_INGESTION_PIPELINE_VERSION,
      status: "not_processable",
      ...(warnings ? { warnings } : {}),
    };
  }

  const quality = evaluateQualityForIntake(intake);
  const warnings = buildPipelineWarnings(quality);

  return {
    intake,
    quality,
    protocol: evaluateImageProtocolStub(),
    ...(protocolCompleteness ? { protocol_completeness: protocolCompleteness } : {}),
    classification,
    pipeline_version: IMAGING_OS_INGESTION_PIPELINE_VERSION,
    status: "dry_run",
    ...(warnings ? { warnings } : {}),
  };
}

/**
 * Case-level longitudinal progression helpers (Phase IM-5).
 * Single-image ingestion does not run progression automatically — use these at case/batch scope.
 */
export {
  buildProgressionImageFromIntake,
  evaluateLongitudinalProgressionReadiness,
  recommendProgressionAssessmentForWorkflow,
  runImagingOsCaseProgressionEvaluation,
} from "./progression";
