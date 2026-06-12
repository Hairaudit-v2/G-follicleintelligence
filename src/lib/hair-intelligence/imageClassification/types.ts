/**
 * Hair Image Intelligence — shared classification enums and result shapes
 * (FI OS, HairAudit, Hair Longevity).
 */

export const HLI_SOURCE_SYSTEMS = ["fi_os", "hairaudit", "hair_longevity"] as const;
export type HliSourceSystem = (typeof HLI_SOURCE_SYSTEMS)[number];

export const HLI_CLINICAL_USE_CONTEXTS = [
  "consultation",
  "surgery",
  "audit",
  "follow_up",
  "hli_intake",
  "hli_progress",
  "trichoscopy",
  "microscopic",
  "unknown",
] as const;
export type HliClinicalUseContext = (typeof HLI_CLINICAL_USE_CONTEXTS)[number];

/** View / capture class for hair-restoration photography. */
export const FI_AI_IMAGE_CATEGORIES = [
  "front",
  "left_profile",
  "right_profile",
  "top",
  "crown",
  "donor",
  "graft_tray",
  "immediate_post_op",
  "follow_up",
  "microscopic",
  "unknown",
] as const;
export type FiAiImageCategory = (typeof FI_AI_IMAGE_CATEGORIES)[number];

export const FI_AI_HAIR_STATES = ["wet", "dry", "unknown"] as const;
export type FiAiHairState = (typeof FI_AI_HAIR_STATES)[number];

export const FI_AI_SHAVE_STATES = ["shaved", "non_shaved", "partially_shaved", "unknown"] as const;
export type FiAiShaveState = (typeof FI_AI_SHAVE_STATES)[number];

export const FI_AI_SURGERY_STAGES = ["pre_op", "intra_op", "immediate_post_op", "follow_up", "unknown"] as const;
export type FiAiSurgeryStage = (typeof FI_AI_SURGERY_STAGES)[number];

export const FI_AI_IMAGE_REVIEW_STATUSES = ["pending", "accepted", "corrected", "rejected"] as const;
export type FiAiImageReviewStatus = (typeof FI_AI_IMAGE_REVIEW_STATUSES)[number];

/** Normalised classification returned by the shared classifier (camelCase). */
export type FiAiImageClassificationResult = {
  category: FiAiImageCategory;
  categoryConfidence: number;
  hairState: FiAiHairState;
  shaveState: FiAiShaveState;
  surgeryStage: FiAiSurgeryStage;
  notes: string;
};

/** Row written to `hli_image_classifications` (snake_case DB field names). */
export type HliImageClassificationInsert = {
  source_system: HliSourceSystem;
  source_record_id: string;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  image_url_or_storage_path: string;
  image_category: FiAiImageCategory;
  hair_state: FiAiHairState;
  shave_state: FiAiShaveState;
  surgery_stage: FiAiSurgeryStage;
  clinical_use_context: HliClinicalUseContext;
  confidence: number;
  classifier_version: string | null;
  review_status: FiAiImageReviewStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  notes: string | null;
};
