import type { PhotoCategoryV1 } from "./photoCategoryV1";

export const IMAGE_CLASSIFICATION_RESULT_V1_VERSION = 1 as const;

export const IMAGE_CLASSIFICATION_TYPES_V1 = [
  "anatomical_view",
  "surgery_stage",
  "quality_assessment",
  "protocol_compliance",
  "donor_assessment",
  "recipient_assessment",
  "progression_signal",
] as const;

export type ImageClassificationTypeV1 =
  (typeof IMAGE_CLASSIFICATION_TYPES_V1)[number];

export const IMAGE_ORIENTATIONS_V1 = [
  "frontal",
  "left_profile",
  "right_profile",
  "top_down",
  "posterior",
  "oblique",
  "unknown",
] as const;

export type ImageOrientationV1 = (typeof IMAGE_ORIENTATIONS_V1)[number];

export const IMAGE_CAPTURE_SOURCES_V1 = [
  "patient_portal",
  "clinic_staff",
  "doctor_upload",
  "surgery_portal",
  "forensic_audit",
  "guided_capture",
  "bulk_import",
  "legacy_intake",
  "unknown",
] as const;

export type ImageCaptureSourceV1 = (typeof IMAGE_CAPTURE_SOURCES_V1)[number];

/**
 * Structured output from the central FI OS imaging classifier service.
 * Consumers store a local copy; this contract is the wire format only.
 */
export interface ImageClassificationResultV1 {
  schemaVersion: typeof IMAGE_CLASSIFICATION_RESULT_V1_VERSION;
  /** Opaque image identifier in the source system (upload id, fi_patient_images.id, etc.). */
  image_id: string;
  classification_type: ImageClassificationTypeV1;
  /** Primary anatomical category when classification_type is anatomical_view or related. */
  category?: PhotoCategoryV1;
  /** Model confidence in [0, 1]. */
  confidence: number;
  orientation: ImageOrientationV1;
  /** Overall capture quality in [0, 1]. Higher is better. */
  quality_score: number;
  /** Blur severity in [0, 1]. Higher indicates more blur. */
  blur_score: number;
  /** Whether the image satisfies the active capture protocol for its slot. */
  protocol_compliant: boolean;
  capture_source: ImageCaptureSourceV1;
  /** Opaque extension bag — no PHI; classifier version, model id, review flags, etc. */
  metadata: Record<string, string | number | boolean | null>;
}
