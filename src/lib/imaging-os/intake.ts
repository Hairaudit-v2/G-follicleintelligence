/**
 * ImagingOS — image intake contract (Phase IM-1 + IM-2 universal ingestion).
 * Describes how an image enters the shared engine; no storage download.
 */

import {
  isCanonicalHairImageCategory,
  mapExternalCategoryToCanonical,
  type CanonicalHairImageCategory,
} from "./categories";
import type {
  ImagingOsActorType,
  ImagingOsSourceSystem,
  ImagingOsUploadedByActorType,
  ImagingOsUploadSurface,
} from "./types";

export const IMAGING_INTAKE_METADATA_VERSION = "imaging-intake.v1" as const;
export const IMAGING_INTAKE_METADATA_VERSION_V2 = "imaging-intake.v2" as const;

export type ImagingIntakeRecord = {
  source_system: ImagingOsSourceSystem;
  source_case_id: string;
  source_upload_id: string;
  storage_bucket: string | null;
  storage_path: string | null;
  content_type: string | null;
  file_size_bytes: number | null;
  actor_type: ImagingOsActorType;
  upload_surface: ImagingOsUploadSurface;
  metadata_version: typeof IMAGING_INTAKE_METADATA_VERSION;
  /** Optional cross-system idempotency key (e.g. HairAudit worker). */
  idempotency_key?: string;
  /** Raw external category label before canonical mapping. */
  external_category?: string;
  legacy_upload_type?: string | null;
};

export type IntakeValidationResult =
  | { ok: true; intake: ImagingIntakeRecord }
  | { ok: false; error: string; field?: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SOURCE_SYSTEMS = new Set<ImagingOsSourceSystem>([
  "fi_os",
  "hairaudit",
  "hli",
  "iiohr",
  "external",
]);

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export type BuildImagingIntakeInput = {
  source_system: ImagingOsSourceSystem;
  source_case_id: string;
  source_upload_id: string;
  storage_bucket?: string | null;
  storage_path?: string | null;
  content_type?: string | null;
  file_size_bytes?: number | null;
  actor_type?: ImagingOsActorType;
  upload_surface?: ImagingOsUploadSurface;
  idempotency_key?: string;
  external_category?: string;
  legacy_upload_type?: string | null;
};

/** Build a validated intake record from known fields (pure). */
export function buildImagingIntakeRecord(input: BuildImagingIntakeInput): IntakeValidationResult {
  if (!SOURCE_SYSTEMS.has(input.source_system)) {
    return { ok: false, error: "Invalid source_system", field: "source_system" };
  }

  const sourceCaseId = readNonEmptyString(input.source_case_id);
  if (!sourceCaseId || !isUuid(sourceCaseId)) {
    return { ok: false, error: "source_case_id must be a valid UUID", field: "source_case_id" };
  }

  const sourceUploadId = readNonEmptyString(input.source_upload_id);
  if (!sourceUploadId || !isUuid(sourceUploadId)) {
    return { ok: false, error: "source_upload_id must be a valid UUID", field: "source_upload_id" };
  }

  const storageBucket = input.storage_bucket ? readNonEmptyString(input.storage_bucket) : null;
  const storagePath = input.storage_path ? readNonEmptyString(input.storage_path) : null;

  if (storageBucket && !storagePath) {
    return { ok: false, error: "storage_path is required when storage_bucket is set", field: "storage_path" };
  }
  if (storagePath && !storageBucket) {
    return { ok: false, error: "storage_bucket is required when storage_path is set", field: "storage_bucket" };
  }

  let fileSizeBytes: number | null = null;
  if (input.file_size_bytes != null) {
    const size = Number(input.file_size_bytes);
    if (!Number.isFinite(size) || size < 0 || !Number.isInteger(size)) {
      return { ok: false, error: "file_size_bytes must be a non-negative integer", field: "file_size_bytes" };
    }
    fileSizeBytes = size;
  }

  const intake: ImagingIntakeRecord = {
    source_system: input.source_system,
    source_case_id: sourceCaseId,
    source_upload_id: sourceUploadId,
    storage_bucket: storageBucket ?? null,
    storage_path: storagePath ?? null,
    content_type: input.content_type ?? null,
    file_size_bytes: fileSizeBytes,
    actor_type: input.actor_type ?? "external_client",
    upload_surface: input.upload_surface ?? "unknown",
    metadata_version: IMAGING_INTAKE_METADATA_VERSION,
    ...(input.idempotency_key ? { idempotency_key: input.idempotency_key.trim() } : {}),
    ...(input.external_category ? { external_category: input.external_category.trim() } : {}),
    ...(input.legacy_upload_type ? { legacy_upload_type: input.legacy_upload_type } : {}),
  };

  return { ok: true, intake };
}

/** HairAudit-specific intake defaults. */
export function buildHairAuditImagingIntake(input: {
  source_case_id: string;
  source_upload_id: string;
  storage_bucket?: string;
  storage_path?: string;
  content_type?: string | null;
  file_size_bytes?: number | null;
  idempotency_key?: string;
  external_category?: string;
  legacy_upload_type?: string;
}): IntakeValidationResult {
  return buildImagingIntakeRecord({
    source_system: "hairaudit",
    source_case_id: input.source_case_id,
    source_upload_id: input.source_upload_id,
    storage_bucket: input.storage_bucket ?? null,
    storage_path: input.storage_path ?? null,
    content_type: input.content_type ?? null,
    file_size_bytes: input.file_size_bytes ?? null,
    actor_type: "external_client",
    upload_surface: "hairaudit_case_upload",
    idempotency_key: input.idempotency_key,
    external_category: input.external_category,
    legacy_upload_type: input.legacy_upload_type ?? null,
  });
}

// ---------------------------------------------------------------------------
// Phase IM-2 — universal image ingestion
// ---------------------------------------------------------------------------

/** Universal ingestion request accepted from any FI imaging source system. */
export type ImagingOsImageIngestionRequest = {
  source_system: ImagingOsSourceSystem;
  upload_surface: ImagingOsUploadSurface;
  tenant_id?: string;
  clinic_id?: string;
  patient_id?: string;
  case_id?: string;
  consultation_id?: string;
  surgery_id?: string;
  external_image_id?: string;
  storage_bucket?: string;
  storage_path?: string;
  public_url?: string;
  signed_url?: string;
  content_type?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  uploaded_by_actor_id?: string;
  uploaded_by_actor_type?: ImagingOsUploadedByActorType;
  external_category?: string;
  canonical_category_hint?: CanonicalHairImageCategory;
  captured_at?: string;
  uploaded_at?: string;
  metadata?: Record<string, unknown>;
};

/** Normalized intake record produced by the universal ingestion pipeline (IM-2). */
export type ImagingOsNormalizedImageIntake = {
  intake_id: string;
  metadata_version: typeof IMAGING_INTAKE_METADATA_VERSION_V2;
  source_system: ImagingOsSourceSystem;
  upload_surface: ImagingOsUploadSurface;
  canonical_photo_category: CanonicalHairImageCategory;
  external_category?: string;
  tenant_id?: string;
  clinic_id?: string;
  patient_id?: string;
  case_id?: string;
  consultation_id?: string;
  surgery_id?: string;
  external_image_id?: string;
  storage_bucket?: string;
  storage_path?: string;
  public_url?: string;
  signed_url?: string;
  content_type?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  uploaded_by_actor_id?: string;
  uploaded_by_actor_type?: ImagingOsUploadedByActorType;
  captured_at?: string;
  uploaded_at?: string;
  metadata: Record<string, unknown>;
  warnings: string[];
  is_processable: boolean;
};

function hashIntakeSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function generateIntakeId(request: ImagingOsImageIngestionRequest): string {
  const anchor =
    readNonEmptyString(request.external_image_id) ||
    readNonEmptyString(request.storage_path) ||
    readNonEmptyString(request.public_url) ||
    readNonEmptyString(request.signed_url) ||
    "no-storage-ref";
  const timestamp =
    readNonEmptyString(request.uploaded_at) ||
    readNonEmptyString(request.captured_at) ||
    "no-timestamp";
  const seed = `${request.source_system}|${anchor}|${timestamp}`;
  return `intake-${hashIntakeSeed(seed)}`;
}

function resolveCanonicalCategory(
  request: ImagingOsImageIngestionRequest,
  warnings: string[]
): CanonicalHairImageCategory {
  if (
    request.canonical_category_hint &&
    isCanonicalHairImageCategory(request.canonical_category_hint)
  ) {
    return request.canonical_category_hint;
  }

  const externalCategory = readNonEmptyString(request.external_category);
  if (externalCategory) {
    const legacyUploadType =
      typeof request.metadata?.legacy_upload_type === "string"
        ? request.metadata.legacy_upload_type
        : null;
    const mapping = mapExternalCategoryToCanonical(externalCategory, legacyUploadType);
    if (!mapping.matched) {
      warnings.push(
        `Unknown external category "${externalCategory}" mapped to ${mapping.canonical}`
      );
    }
    return mapping.canonical;
  }

  warnings.push("No category provided; defaulting to other");
  return "other";
}

function hasProcessableStorageReference(request: ImagingOsImageIngestionRequest): boolean {
  return Boolean(
    readNonEmptyString(request.storage_path) ||
      readNonEmptyString(request.public_url) ||
      readNonEmptyString(request.signed_url)
  );
}

/**
 * Normalize a universal ingestion request into a processable intake record (pure).
 * Never throws — returns warnings for missing optional data.
 */
export function normalizeImageIngestionRequest(
  request: ImagingOsImageIngestionRequest
): ImagingOsNormalizedImageIntake {
  const warnings: string[] = [];
  const isProcessable = hasProcessableStorageReference(request);

  if (!isProcessable) {
    warnings.push(
      "No storage_path, public_url, or signed_url provided; image is not processable"
    );
  }

  const canonicalPhotoCategory = resolveCanonicalCategory(request, warnings);
  const metadata = { ...(request.metadata ?? {}) };

  return {
    intake_id: generateIntakeId(request),
    metadata_version: IMAGING_INTAKE_METADATA_VERSION_V2,
    source_system: request.source_system,
    upload_surface: request.upload_surface,
    canonical_photo_category: canonicalPhotoCategory,
    ...(readNonEmptyString(request.external_category)
      ? { external_category: readNonEmptyString(request.external_category) }
      : {}),
    ...(readNonEmptyString(request.tenant_id) ? { tenant_id: request.tenant_id!.trim() } : {}),
    ...(readNonEmptyString(request.clinic_id) ? { clinic_id: request.clinic_id!.trim() } : {}),
    ...(readNonEmptyString(request.patient_id) ? { patient_id: request.patient_id!.trim() } : {}),
    ...(readNonEmptyString(request.case_id) ? { case_id: request.case_id!.trim() } : {}),
    ...(readNonEmptyString(request.consultation_id)
      ? { consultation_id: request.consultation_id!.trim() }
      : {}),
    ...(readNonEmptyString(request.surgery_id) ? { surgery_id: request.surgery_id!.trim() } : {}),
    ...(readNonEmptyString(request.external_image_id)
      ? { external_image_id: request.external_image_id!.trim() }
      : {}),
    ...(readNonEmptyString(request.storage_bucket)
      ? { storage_bucket: request.storage_bucket!.trim() }
      : {}),
    ...(readNonEmptyString(request.storage_path)
      ? { storage_path: request.storage_path!.trim() }
      : {}),
    ...(readNonEmptyString(request.public_url) ? { public_url: request.public_url!.trim() } : {}),
    ...(readNonEmptyString(request.signed_url) ? { signed_url: request.signed_url!.trim() } : {}),
    ...(readNonEmptyString(request.content_type)
      ? { content_type: request.content_type!.trim() }
      : {}),
    ...(request.size_bytes != null && Number.isFinite(request.size_bytes)
      ? { size_bytes: Math.max(0, Math.floor(Number(request.size_bytes))) }
      : {}),
    ...(request.width != null && Number.isFinite(request.width)
      ? { width: Math.max(0, Math.floor(Number(request.width))) }
      : {}),
    ...(request.height != null && Number.isFinite(request.height)
      ? { height: Math.max(0, Math.floor(Number(request.height))) }
      : {}),
    ...(readNonEmptyString(request.uploaded_by_actor_id)
      ? { uploaded_by_actor_id: request.uploaded_by_actor_id!.trim() }
      : {}),
    ...(request.uploaded_by_actor_type
      ? { uploaded_by_actor_type: request.uploaded_by_actor_type }
      : {}),
    ...(readNonEmptyString(request.captured_at)
      ? { captured_at: request.captured_at!.trim() }
      : {}),
    ...(readNonEmptyString(request.uploaded_at)
      ? { uploaded_at: request.uploaded_at!.trim() }
      : {}),
    metadata,
    warnings,
    is_processable: isProcessable,
  };
}
