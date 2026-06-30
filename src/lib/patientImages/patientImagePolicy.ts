import type {
  ImagingAnatomicalRegion,
  ImagingLibraryAxis,
} from "@/src/lib/imagingOs/imagingOsConstants";
import {
  IMAGING_ANATOMICAL_REGIONS,
  IMAGING_LIBRARY_AXES,
} from "@/src/lib/imagingOs/imagingOsConstants";
import type { PatientImageCategory, PatientImageStatus } from "./patientImageTypes";

export const PATIENT_IMAGES_BUCKET_DEFAULT = "patient-images";

export const PATIENT_IMAGE_CATEGORIES: readonly PatientImageCategory[] = [
  "consult",
  "scalp",
  "donor",
  "hairline",
  "trichoscopy",
  "post_op",
  "progress",
  "before",
  "after",
  "other",
] as const;

export const PATIENT_IMAGE_STATUSES: readonly PatientImageStatus[] = [
  "active",
  "archived",
] as const;

export function isImagingLibraryAxis(value: unknown): value is ImagingLibraryAxis {
  return typeof value === "string" && (IMAGING_LIBRARY_AXES as readonly string[]).includes(value);
}

export function normalizeImagingLibraryAxis(raw: unknown): ImagingLibraryAxis {
  if (isImagingLibraryAxis(raw)) return raw;
  return "general_clinical";
}

export function isImagingAnatomicalRegion(value: unknown): value is ImagingAnatomicalRegion {
  return (
    typeof value === "string" && (IMAGING_ANATOMICAL_REGIONS as readonly string[]).includes(value)
  );
}

export function normalizeImagingAnatomicalRegion(raw: unknown): ImagingAnatomicalRegion | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return isImagingAnatomicalRegion(s) ? s : null;
}

const CATEGORY_SET = new Set<string>(PATIENT_IMAGE_CATEGORIES);
const STATUS_SET = new Set<string>(PATIENT_IMAGE_STATUSES);

export const PATIENT_IMAGE_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

const MIME_SET = new Set<string>(PATIENT_IMAGE_ALLOWED_CONTENT_TYPES);

export const PATIENT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

export const PATIENT_IMAGE_CAPTION_MAX = 2000;
export const PATIENT_IMAGE_ARCHIVE_REASON_MAX = 1000;

export function isPatientImageCategory(value: unknown): value is PatientImageCategory {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export function normalizePatientImageCategory(raw: unknown): PatientImageCategory {
  if (isPatientImageCategory(raw)) return raw;
  return "other";
}

export function isPatientImageStatus(value: unknown): value is PatientImageStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

export function assertPatientImageStatus(value: unknown): PatientImageStatus {
  if (!isPatientImageStatus(value)) {
    throw new Error(`Invalid image_status: ${String(value)}`);
  }
  return value;
}

/** True when value is a non-null plain object (not array). */
export function isPatientImageMetadataObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assertPatientImageMetadataObject(
  name: string,
  value: unknown
): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isPatientImageMetadataObject(value)) {
    throw new Error(`${name} must be a JSON object.`);
  }
  return value;
}

export function assertCaptionLength(caption: string | null | undefined): string | null {
  if (caption == null) return null;
  const s = String(caption);
  if (s.length > PATIENT_IMAGE_CAPTION_MAX) {
    throw new Error(`Caption exceeds ${PATIENT_IMAGE_CAPTION_MAX} characters.`);
  }
  return s.trim() ? s : null;
}

export function assertArchiveReasonLength(reason: string | null | undefined): string | null {
  if (reason == null) return null;
  const s = String(reason);
  if (s.length > PATIENT_IMAGE_ARCHIVE_REASON_MAX) {
    throw new Error(`Archive reason exceeds ${PATIENT_IMAGE_ARCHIVE_REASON_MAX} characters.`);
  }
  return s.trim() ? s : null;
}

export function assertFileSizeWithinPolicy(sizeBytes: number): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Invalid file size.");
  }
  if (sizeBytes > PATIENT_IMAGE_MAX_BYTES) {
    throw new Error(`File exceeds maximum size of ${PATIENT_IMAGE_MAX_BYTES} bytes.`);
  }
}

const HEIC_EXT = /\.(heic|heif)$/i;
const JPEG_EXT = /\.(jpe?g)$/i;
const PNG_EXT = /\.png$/i;
const WEBP_EXT = /\.webp$/i;

/**
 * Resolves a canonical allowed MIME type. Accepts HEIC uploads that arrive as
 * `application/octet-stream` when the filename extension matches.
 */
export function resolvePatientImageContentType(file: {
  name: string;
  type: string;
}): string | null {
  const t = (file.type ?? "").trim().toLowerCase();
  if (t && MIME_SET.has(t)) return t;
  const name = file.name ?? "";
  if (JPEG_EXT.test(name)) return "image/jpeg";
  if (PNG_EXT.test(name)) return "image/png";
  if (WEBP_EXT.test(name)) return "image/webp";
  if (HEIC_EXT.test(name)) return "image/heic";
  return null;
}

export function assertAllowedPatientImageContentType(file: {
  name: string;
  type: string;
  size: number;
}): string {
  assertFileSizeWithinPolicy(file.size);
  const ct = resolvePatientImageContentType(file);
  if (!ct) {
    throw new Error(
      "Unsupported file type. Allowed: image/jpeg, image/png, image/webp, image/heic, image/heif."
    );
  }
  return ct;
}

export function assertPatientImageEditableStatus(status: PatientImageStatus): void {
  if (status === "archived") {
    throw new Error("Cannot edit an archived image.");
  }
}
