/** FI OS — Intelligent Photo Attribution & Branding Engine types. */

export const FI_IMAGE_CAPTURE_TYPES = ["camera", "upload"] as const;
export type FiImageCaptureType = (typeof FI_IMAGE_CAPTURE_TYPES)[number];

export const FI_IMAGE_CAPTURE_SOURCES = [
  "patient_profile",
  "patient_slide_over",
  "imaging_os_wizard",
  "vie_capture_wizard",
  "surgery_os",
  "profile_upload_form",
  "appointment_procedure",
  "appointment_procedure_admin_fallback",
  "unknown",
] as const;
export type FiImageCaptureSource = (typeof FI_IMAGE_CAPTURE_SOURCES)[number];

export const FI_IMAGE_PROCEDURE_STAGES = [
  "pre_op",
  "surgery_day",
  "post_op",
  "follow_up",
  "audit",
  "baseline",
  "unknown",
] as const;
export type FiImageProcedureStage = (typeof FI_IMAGE_PROCEDURE_STAGES)[number];

/** AI / auto-tag image view types for attribution and marketing. */
export const FI_IMAGE_ATTRIBUTION_TYPES = [
  "frontal_hairline",
  "left_temple",
  "right_temple",
  "crown",
  "donor_zone",
  "immediate_post_op",
  "recipient_zone",
  "scalp_close_up",
  "beard",
  "eyebrow",
  "trichoscopy",
  "unknown",
] as const;
export type FiImageAttributionType = (typeof FI_IMAGE_ATTRIBUTION_TYPES)[number];

export const FI_IMAGE_WATERMARK_POSITIONS = ["bottom_right", "bottom_center", "top_right"] as const;
export type FiImageWatermarkPosition = (typeof FI_IMAGE_WATERMARK_POSITIONS)[number];

export type FiImageMetadata = {
  patient_id: string;
  patient_full_name: string;
  clinic_id: string | null;
  clinic_name: string | null;
  practitioner_name: string | null;
  practitioner_id: string | null;
  capture_date: string;
  capture_timestamp: string;
  capture_type: FiImageCaptureType;
  capture_source: FiImageCaptureSource;
  anatomical_region: string | null;
  visit_type: string | null;
  procedure_stage: FiImageProcedureStage;
  image_type: FiImageAttributionType;
  image_type_confidence: number | null;
  attribution_engine_version: string;
};

export type FiImageDerivativeRef = {
  storage_bucket: string;
  storage_path: string;
  content_type: string;
  variant: "watermarked_marketing" | "marketing_export" | "internal_attributed";
  created_at: string;
};

export type FiImageQualitySnapshot = {
  quality_status: string;
  quality_score: number;
  is_clinically_usable: boolean;
  warnings: string[];
  blockers: string[];
  alert_message: string | null;
  width: number | null;
  height: number | null;
};

export type FiImageTimelineEntry = {
  image_id: string;
  label: string;
  procedure_stage: FiImageProcedureStage;
  capture_timestamp: string;
  image_type: FiImageAttributionType;
  sort_order: number;
};

export type FiImageAiDatasetFields = {
  hair_loss_stage: string | null;
  ethnicity: string | null;
  age: number | null;
  donor_density: string | null;
  graft_count: number | null;
  medication_status: string | null;
  treatment_type: string | null;
  growth_outcome: string | null;
};

export type FiImageAttributionSettings = {
  enable_watermark: boolean;
  watermark_opacity: number;
  watermark_position: FiImageWatermarkPosition;
  enable_patient_name_overlay: boolean;
  enable_marketing_export: boolean;
  auto_classify_on_capture: boolean;
  block_upload_on_poor_quality: boolean;
};

export type PatientImagePostCaptureResult = {
  metadata_patch: Record<string, unknown>;
  quality: FiImageQualitySnapshot;
  derivatives: FiImageDerivativeRef[];
  classification: { image_type: FiImageAttributionType; confidence: number | null } | null;
  timeline_entry: FiImageTimelineEntry;
  watermark_applied: boolean;
  marketing_version_created: boolean;
  quality_blocked: boolean;
};

export const FI_IMAGE_ATTRIBUTION_ENGINE_VERSION = "fi-image-attribution-v1" as const;
