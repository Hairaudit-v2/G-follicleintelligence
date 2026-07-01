import type { PhotoCategoryV1 } from "./photoCategoryV1";
import type { ImageCaptureSourceV1 } from "./imageClassificationResultV1";

export const IMAGE_CAPTURE_PROTOCOL_V1_VERSION = 1 as const;

export const SURGERY_STAGES_V1 = [
  "preoperative",
  "day_of_surgery",
  "intraoperative",
  "immediate_postoperative",
  "early_postoperative",
  "follow_up",
  "longitudinal",
] as const;

export type SurgeryStageV1 = (typeof SURGERY_STAGES_V1)[number];

export const PATIENT_POSITIONS_V1 = [
  "standing_front",
  "standing_back",
  "seated",
  "supine",
  "unknown",
] as const;

export type PatientPositionV1 = (typeof PATIENT_POSITIONS_V1)[number];

export const LIGHTING_RULES_V1 = [
  "even_indoor",
  "natural_daylight",
  "clinical_overhead",
  "flash_allowed",
  "no_flash",
  "wet_hair_required",
  "dry_hair_required",
] as const;

export type LightingRuleV1 = (typeof LIGHTING_RULES_V1)[number];

/**
 * Capture protocol definition shared across FI OS, HairAudit, and HLI.
 * Products may embed additional slot metadata locally; this is the
 * intelligence-layer contract for protocol compliance checks.
 */
export interface ImageCaptureProtocolV1 {
  schemaVersion: typeof IMAGE_CAPTURE_PROTOCOL_V1_VERSION;
  protocol_version: string;
  required_views: PhotoCategoryV1[];
  optional_views: PhotoCategoryV1[];
  capture_source: ImageCaptureSourceV1;
  surgery_stage: SurgeryStageV1;
  patient_position: PatientPositionV1;
  lighting_rules: LightingRuleV1[];
}
