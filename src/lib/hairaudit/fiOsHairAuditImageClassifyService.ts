/**
 * FI OS receiving-side HairAudit image classification service — Phase 3F.
 *
 * Validates inbound HairAudit requests and returns normalized classification
 * responses compatible with fiOsImageClassifierClient.parseFiOsClassifierResponseBody.
 *
 * See: docs/hairaudit-phase-3f-fi-classifier-endpoint.md
 */

import {
  classifyClinicalHairImageFromModelUrl,
  isClinicalHairImageClassifierAvailable,
} from "./classifyClinicalHairImageFromModelUrl";
import { buildDegradedHairAuditClassification } from "./hairAuditClassifierResponseMap";
import { isValidHairauditImageContentType } from "./hairauditImageClassifyContract";
import { resolveHairauditClassifierMode } from "@/src/lib/security/hairauditClassifierAuth";
import {
  runImagingOsIngestionPipeline,
  stubConfidenceFromSeed,
  type ImagingOsImageIngestionRequest,
} from "@/src/lib/imaging-os";

export const HAIRAUDIT_CLASSIFIER_SOURCE_SYSTEM = "hairaudit" as const;

export const STUB_CLASSIFIER_VERSION = "fi-os-stub-v1" as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type HairAuditImageClassifyRequest = {
  source_system: typeof HAIRAUDIT_CLASSIFIER_SOURCE_SYSTEM;
  idempotency_key: string;
  source_case_id: string;
  source_upload_id: string;
  canonical_photo_category: string;
  legacy_upload_type?: string;
  storage_bucket?: string;
  storage_path?: string;
  image_content_type?: string | null;
  image_size_bytes?: number | null;
};

export type HairAuditImageClassifyResponse = {
  category: string;
  canonical_photo_category: string;
  confidence: number;
  quality_status: string;
  protocol_status: string;
  classifier_version: string;
  notes: string;
};

export type ParseHairAuditImageClassifyResult =
  | { ok: true; data: HairAuditImageClassifyRequest }
  | { ok: false; error: string; field?: string };

export type ClassifyHairAuditImageOutcome =
  | { ok: true; result: HairAuditImageClassifyResponse }
  | { ok: false; code: "provider_not_ready"; status: 503 };

const LIVE_DEGRADED_CLASSIFIER_VERSION = "hli-openai-hairaudit-live-v1" as const;

const RESPONSE_FIELD_KEYS = [
  "category",
  "canonical_photo_category",
  "confidence",
  "quality_status",
  "protocol_status",
  "classifier_version",
  "notes",
] as const;

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Deterministic stub confidence in [0.5, 0.7]. */
export function stubConfidenceForIdempotencyKey(idempotencyKey: string): number {
  return stubConfidenceFromSeed(idempotencyKey);
}

/** Map HairAudit classify request to universal ImagingOS ingestion request. */
export function buildHairAuditIngestionRequest(
  input: HairAuditImageClassifyRequest
): ImagingOsImageIngestionRequest {
  return {
    source_system: "hairaudit",
    upload_surface: "audit_upload",
    case_id: input.source_case_id,
    external_image_id: input.source_upload_id,
    ...(input.storage_bucket ? { storage_bucket: input.storage_bucket } : {}),
    ...(input.storage_path ? { storage_path: input.storage_path } : {}),
    ...(input.image_content_type ? { content_type: input.image_content_type } : {}),
    ...(input.image_size_bytes != null ? { size_bytes: input.image_size_bytes } : {}),
    external_category: input.canonical_photo_category,
    metadata: {
      idempotency_key: input.idempotency_key,
      ...(input.legacy_upload_type ? { legacy_upload_type: input.legacy_upload_type } : {}),
    },
  };
}

export function buildStubClassificationResponse(
  input: HairAuditImageClassifyRequest
): HairAuditImageClassifyResponse {
  const externalCategory = input.canonical_photo_category;
  const pipeline = runImagingOsIngestionPipeline(buildHairAuditIngestionRequest(input));

  return {
    category: externalCategory,
    canonical_photo_category: pipeline.classification.canonical_photo_category,
    confidence: pipeline.classification.confidence,
    quality_status: "not_evaluated",
    protocol_status: pipeline.protocol.protocol_status,
    classifier_version: STUB_CLASSIFIER_VERSION,
    notes: "Stub classification only",
  };
}

export function parseHairAuditImageClassifyRequest(
  body: unknown
): ParseHairAuditImageClassifyResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const sourceSystem = readNonEmptyString(body.source_system);
  if (!sourceSystem) {
    return { ok: false, error: "source_system is required", field: "source_system" };
  }
  if (sourceSystem !== HAIRAUDIT_CLASSIFIER_SOURCE_SYSTEM) {
    return { ok: false, error: "Invalid source_system", field: "source_system" };
  }

  const idempotencyKey = readNonEmptyString(body.idempotency_key);
  if (!idempotencyKey) {
    return { ok: false, error: "idempotency_key is required", field: "idempotency_key" };
  }

  const sourceCaseId = readNonEmptyString(body.source_case_id);
  if (!sourceCaseId || !isUuid(sourceCaseId)) {
    return { ok: false, error: "source_case_id must be a valid UUID", field: "source_case_id" };
  }

  const sourceUploadId = readNonEmptyString(body.source_upload_id);
  if (!sourceUploadId || !isUuid(sourceUploadId)) {
    return { ok: false, error: "source_upload_id must be a valid UUID", field: "source_upload_id" };
  }

  const canonicalPhotoCategory = readNonEmptyString(body.canonical_photo_category);
  if (!canonicalPhotoCategory) {
    return {
      ok: false,
      error: "canonical_photo_category is required",
      field: "canonical_photo_category",
    };
  }

  const legacyUploadType = readNonEmptyString(body.legacy_upload_type);

  const storageBucket = readNonEmptyString(body.storage_bucket);
  const storagePath = readNonEmptyString(body.storage_path);

  if (storageBucket && !storagePath) {
    return {
      ok: false,
      error: "storage_path is required when storage_bucket is set",
      field: "storage_path",
    };
  }
  if (storagePath && !storageBucket) {
    return {
      ok: false,
      error: "storage_bucket is required when storage_path is set",
      field: "storage_bucket",
    };
  }

  let imageContentType: string | null | undefined;
  if (body.image_content_type != null) {
    const contentType = readNonEmptyString(body.image_content_type);
    if (!contentType || !isValidHairauditImageContentType(contentType)) {
      return {
        ok: false,
        error: "image_content_type must be a supported image MIME type",
        field: "image_content_type",
      };
    }
    imageContentType = contentType;
  }

  let imageSizeBytes: number | null | undefined;
  if (body.image_size_bytes != null) {
    const size = Number(body.image_size_bytes);
    if (!Number.isFinite(size) || size < 0 || !Number.isInteger(size)) {
      return {
        ok: false,
        error: "image_size_bytes must be a non-negative integer",
        field: "image_size_bytes",
      };
    }
    imageSizeBytes = size;
  }

  const data: HairAuditImageClassifyRequest = {
    source_system: HAIRAUDIT_CLASSIFIER_SOURCE_SYSTEM,
    idempotency_key: idempotencyKey,
    source_case_id: sourceCaseId,
    source_upload_id: sourceUploadId,
    canonical_photo_category: canonicalPhotoCategory,
    ...(legacyUploadType ? { legacy_upload_type: legacyUploadType } : {}),
    ...(storageBucket ? { storage_bucket: storageBucket, storage_path: storagePath } : {}),
    ...(imageContentType ? { image_content_type: imageContentType } : {}),
    ...(imageSizeBytes != null ? { image_size_bytes: imageSizeBytes } : {}),
  };

  return { ok: true, data };
}

export function isSafeClassificationResponseBody(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body);
  if (keys.length !== RESPONSE_FIELD_KEYS.length) return false;
  if (!RESPONSE_FIELD_KEYS.every((key) => keys.includes(key))) return false;

  const serialized = JSON.stringify(body);
  if (/signedUrl|signed_url|token=|service_role|supabase\.co\/storage/i.test(serialized)) {
    return false;
  }

  return true;
}

export async function classifyHairAuditImageRequest(
  input: HairAuditImageClassifyRequest,
  env: NodeJS.ProcessEnv = process.env
): Promise<ClassifyHairAuditImageOutcome> {
  if (resolveHairauditClassifierMode(env) === "stub") {
    return { ok: true, result: buildStubClassificationResponse(input) };
  }

  if (isClinicalHairImageClassifierAvailable(env)) {
    const realResult = await classifyClinicalHairImageFromModelUrl(
      {
        canonical_photo_category: input.canonical_photo_category,
        legacy_upload_type: input.legacy_upload_type,
        storage_bucket: input.storage_bucket,
        storage_path: input.storage_path,
        image_content_type: input.image_content_type,
        image_size_bytes: input.image_size_bytes,
        source_upload_id: input.source_upload_id,
      },
      env
    );

    if (realResult) {
      return { ok: true, result: realResult };
    }
  }

  return {
    ok: true,
    result: buildDegradedHairAuditClassification({
      canonical_photo_category: input.canonical_photo_category,
      legacy_upload_type: input.legacy_upload_type,
      classifier_version: LIVE_DEGRADED_CLASSIFIER_VERSION,
      reason: isClinicalHairImageClassifierAvailable(env)
        ? "live classifier unavailable in this runtime"
        : "live classifier prerequisites not met",
    }),
  };
}
