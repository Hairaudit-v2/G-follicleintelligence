/**
 * Request parsing for POST /api/internal/imaging/classify (FIN-IMAGING-2).
 */

import type { ImageSignalSourceSystemV1 } from "@follicle/intelligence-core/contracts";
import { IMAGE_SIGNAL_SOURCE_SYSTEMS_V1 } from "@follicle/intelligence-core/contracts";
import { isValidHairauditImageContentType } from "@/src/lib/hairaudit/hairauditImageClassifyContract";

const ALLOWED_SOURCE_SYSTEMS = new Set<string>(
  IMAGE_SIGNAL_SOURCE_SYSTEMS_V1.filter((s) => s !== "surgery_os")
);

export type UnifiedImageClassifyRequest = {
  source_system: Exclude<ImageSignalSourceSystemV1, "surgery_os">;
  source_image_id: string;
  image_url?: string;
  signed_url?: string;
  storage_bucket?: string;
  storage_path?: string;
  capture_source?: string;
  upload_source?: string;
  requested_categories?: string[];
  patient_id?: string;
  case_id?: string;
  professional_id?: string;
  /** HairAudit / legacy hints for category alias mapping. */
  canonical_photo_category?: string;
  legacy_upload_type?: string;
  image_content_type?: string | null;
  image_size_bytes?: number | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ParseUnifiedImageClassifyResult =
  | { ok: true; data: UnifiedImageClassifyRequest }
  | { ok: false; error: string; field?: string };

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseMetadata(value: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!isPlainObject(value)) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean" ||
      raw === null
    ) {
      out[key] = raw;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function isAllowedUnifiedSourceSystem(value: string): value is UnifiedImageClassifyRequest["source_system"] {
  return ALLOWED_SOURCE_SYSTEMS.has(value);
}

export function parseUnifiedImageClassifyRequest(body: unknown): ParseUnifiedImageClassifyResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const sourceSystem = readNonEmptyString(body.source_system);
  if (!sourceSystem) {
    return { ok: false, error: "source_system is required", field: "source_system" };
  }
  if (!isAllowedUnifiedSourceSystem(sourceSystem)) {
    return { ok: false, error: "Unsupported source_system", field: "source_system" };
  }

  const sourceImageId = readNonEmptyString(body.source_image_id);
  if (!sourceImageId) {
    return { ok: false, error: "source_image_id is required", field: "source_image_id" };
  }

  const imageUrl = readNonEmptyString(body.image_url);
  const signedUrl = readNonEmptyString(body.signed_url);
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

  const hasImageRef = Boolean(imageUrl || signedUrl || (storageBucket && storagePath));
  if (!hasImageRef) {
    return {
      ok: false,
      error: "One of image_url, signed_url, or storage_bucket+storage_path is required",
      field: "image_url",
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

  let requestedCategories: string[] | undefined;
  if (body.requested_categories != null) {
    if (!Array.isArray(body.requested_categories)) {
      return {
        ok: false,
        error: "requested_categories must be an array of strings",
        field: "requested_categories",
      };
    }
    requestedCategories = body.requested_categories
      .map((item) => readNonEmptyString(item))
      .filter((item): item is string => Boolean(item));
  }

  const metadata = parseMetadata(body.metadata);

  if (sourceSystem === "iiohr" && metadata) {
    for (const key of ["academy_case_id", "professional_id", "global_professional_id"] as const) {
      if (body[key] != null && metadata[key] == null) {
        const val = readNonEmptyString(body[key]);
        if (val) metadata[key] = val;
      }
    }
  }

  const data: UnifiedImageClassifyRequest = {
    source_system: sourceSystem,
    source_image_id: sourceImageId,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    ...(signedUrl ? { signed_url: signedUrl } : {}),
    ...(storageBucket ? { storage_bucket: storageBucket, storage_path: storagePath } : {}),
    ...(readNonEmptyString(body.capture_source)
      ? { capture_source: readNonEmptyString(body.capture_source) }
      : {}),
    ...(readNonEmptyString(body.upload_source)
      ? { upload_source: readNonEmptyString(body.upload_source) }
      : {}),
    ...(requestedCategories?.length ? { requested_categories: requestedCategories } : {}),
    ...(readNonEmptyString(body.patient_id) ? { patient_id: readNonEmptyString(body.patient_id) } : {}),
    ...(readNonEmptyString(body.case_id) ? { case_id: readNonEmptyString(body.case_id) } : {}),
    ...(readNonEmptyString(body.professional_id)
      ? { professional_id: readNonEmptyString(body.professional_id) }
      : {}),
    ...(readNonEmptyString(body.canonical_photo_category)
      ? { canonical_photo_category: readNonEmptyString(body.canonical_photo_category) }
      : {}),
    ...(readNonEmptyString(body.legacy_upload_type)
      ? { legacy_upload_type: readNonEmptyString(body.legacy_upload_type) }
      : {}),
    ...(imageContentType ? { image_content_type: imageContentType } : {}),
    ...(imageSizeBytes != null ? { image_size_bytes: imageSizeBytes } : {}),
    ...(metadata ? { metadata } : {}),
  };

  return { ok: true, data };
}

/** Map HairAudit Phase 3F request shape to unified classify request. */
export function hairAuditRequestToUnified(input: {
  source_upload_id: string;
  source_case_id: string;
  canonical_photo_category: string;
  legacy_upload_type?: string;
  storage_bucket?: string;
  storage_path?: string;
  image_content_type?: string | null;
  image_size_bytes?: number | null;
  idempotency_key?: string;
}): UnifiedImageClassifyRequest {
  return {
    source_system: "hairaudit",
    source_image_id: input.source_upload_id,
    case_id: input.source_case_id,
    canonical_photo_category: input.canonical_photo_category,
    ...(input.legacy_upload_type ? { legacy_upload_type: input.legacy_upload_type } : {}),
    ...(input.storage_bucket ? { storage_bucket: input.storage_bucket } : {}),
    ...(input.storage_path ? { storage_path: input.storage_path } : {}),
    ...(input.image_content_type ? { image_content_type: input.image_content_type } : {}),
    ...(input.image_size_bytes != null ? { image_size_bytes: input.image_size_bytes } : {}),
    capture_source: "forensic_audit",
    upload_source: "hairaudit",
    ...(input.idempotency_key ? { metadata: { idempotency_key: input.idempotency_key } } : {}),
  };
}
