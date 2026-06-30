import type {
  FiAiHairState,
  FiAiImageCategory,
  FiAiShaveState,
  FiAiSurgeryStage,
} from "@/src/lib/imaging/aiImageClassificationTypes";

export const HLI_PHOTO_PROTOCOL_SOURCE_SYSTEMS = ["fi_os", "hairaudit", "hair_longevity"] as const;
export type HliPhotoProtocolSourceSystem = (typeof HLI_PHOTO_PROTOCOL_SOURCE_SYSTEMS)[number];

export const HLI_PHOTO_PROTOCOL_TEMPLATE_SCOPES = [
  "shared",
  "fi_os",
  "hairaudit",
  "hair_longevity",
] as const;
export type HliPhotoProtocolTemplateScope = (typeof HLI_PHOTO_PROTOCOL_TEMPLATE_SCOPES)[number];

export const HLI_PHOTO_PROTOCOL_CLINICAL_CONTEXTS = [
  "consultation",
  "surgery_pre_op",
  "surgery_immediate_post_op",
  "follow_up",
  "hairaudit_case",
  "hli_intake",
  "hli_progress",
  "trichoscopy",
  "microscopic",
] as const;
export type HliPhotoProtocolClinicalContext = (typeof HLI_PHOTO_PROTOCOL_CLINICAL_CONTEXTS)[number];

export const HLI_PHOTO_PROTOCOL_SESSION_STATUSES = [
  "draft",
  "in_progress",
  "complete",
  "incomplete",
  "cancelled",
] as const;
export type HliPhotoProtocolSessionStatus = (typeof HLI_PHOTO_PROTOCOL_SESSION_STATUSES)[number];

export const HLI_PHOTO_PROTOCOL_SLOT_STATUSES = [
  "missing",
  "captured",
  "accepted",
  "needs_retake",
  "optional_skipped",
] as const;
export type HliPhotoProtocolSlotStatus = (typeof HLI_PHOTO_PROTOCOL_SLOT_STATUSES)[number];

export type HliPhotoProtocolTemplate = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  source_system_scope: HliPhotoProtocolTemplateScope;
  clinical_context: HliPhotoProtocolClinicalContext;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HliPhotoProtocolSlot = {
  id: string;
  protocol_template_id: string;
  slot_slug: string;
  label: string;
  required_image_category: FiAiImageCategory | null;
  acceptable_image_categories: FiAiImageCategory[] | null;
  required_surgery_stage: FiAiSurgeryStage | null;
  required_hair_state: FiAiHairState | null;
  required_shave_state: FiAiShaveState | null;
  sort_order: number;
  is_required: boolean;
  capture_guidance: string | null;
  quality_guidance: string | null;
};

export type HliPhotoProtocolSession = {
  id: string;
  source_system: HliPhotoProtocolSourceSystem;
  source_record_id: string;
  tenant_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  protocol_template_id: string;
  status: HliPhotoProtocolSessionStatus;
  started_at: string | null;
  completed_at: string | null;
  created_by_user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type HliPhotoProtocolSessionSlot = {
  id: string;
  session_id: string;
  slot_id: string;
  patient_image_id: string | null;
  status: HliPhotoProtocolSlotStatus;
  ai_match_confidence: number | null;
  staff_note: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProtocolComplianceImage = {
  id: string;
  ai_image_category: string | null;
  ai_image_category_confidence: number | null;
  ai_hair_state: string | null;
  ai_shave_state: string | null;
  ai_surgery_stage: string | null;
  ai_image_review_status: string | null;
};

export type HliPhotoProtocolSuggestedMatch = {
  image_id: string;
  score: number;
  reasons: string[];
};

export type HliPhotoProtocolComplianceSummary = {
  required_count: number;
  captured_count: number;
  missing_count: number;
  needs_review_count: number;
  complete: boolean;
  missing_slots: HliPhotoProtocolSlot[];
  suggested_matches: Record<string, HliPhotoProtocolSuggestedMatch[]>;
  warnings: string[];
};

export const HLI_PHOTO_PROTOCOL_ALERT_EVENT_STATUSES = [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
] as const;
export type HliPhotoProtocolAlertEventStatus =
  (typeof HLI_PHOTO_PROTOCOL_ALERT_EVENT_STATUSES)[number];

export const HLI_PHOTO_PROTOCOL_ALERT_EVENT_SEVERITIES = ["low", "medium", "high"] as const;
export type HliPhotoProtocolAlertEventSeverity =
  (typeof HLI_PHOTO_PROTOCOL_ALERT_EVENT_SEVERITIES)[number];

export const HLI_PHOTO_PROTOCOL_ALERT_EVENT_TYPES = [
  "missing_required_images",
  "protocol_incomplete_over_24h",
  "needs_retake",
  "low_confidence_capture",
  "hairaudit_not_ready",
  "follow_up_missing_images",
] as const;
export type HliPhotoProtocolAlertEventType = (typeof HLI_PHOTO_PROTOCOL_ALERT_EVENT_TYPES)[number];

export type HliPhotoProtocolAlertEvent = {
  id: string;
  source_system: HliPhotoProtocolSourceSystem;
  source_record_id: string | null;
  tenant_id: string | null;
  clinic_id: string | null;
  patient_id: string | null;
  case_id: string | null;
  protocol_session_id: string;
  alert_type: HliPhotoProtocolAlertEventType;
  severity: HliPhotoProtocolAlertEventSeverity;
  status: HliPhotoProtocolAlertEventStatus;
  message: string;
  recommended_action: string | null;
  payload: Record<string, unknown>;
  idempotency_key: string;
  first_detected_at: string;
  last_detected_at: string;
  acknowledged_at: string | null;
  acknowledged_by_user_id: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};
