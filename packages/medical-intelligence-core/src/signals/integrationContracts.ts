export const LONGEVITY_INTEGRATION_SOURCE_SYSTEM = "hli_longevity" as const;
export const LONGEVITY_EVENT_CONTRACT_VERSION = "1" as const;
export const LONGEVITY_SIGNAL_CONTRACT_VERSION = "1" as const;

export const LONGEVITY_EVENT_TYPE = {
  INTAKE_SUBMITTED: "longevity.intake.submitted",
  REVIEW_COMPLETED: "longevity.review.completed",
  BLOOD_REQUEST_CREATED: "longevity.blood_request.created",
  BLOOD_RESULTS_UPLOADED: "longevity.blood_results.uploaded",
  CARE_PLAN_GENERATED: "longevity.care_plan.generated",
  REMINDER_SENT: "longevity.reminder.sent",
  REMINDER_FAILED: "longevity.reminder.failed",
  FOLLOW_UP_COMPLETED_AFTER_REMINDER: "longevity.follow_up_completed_after_reminder",
  BLOOD_RESULTS_UPLOADED_AFTER_REMINDER: "longevity.blood_results_uploaded_after_reminder",
  SCALP_PHOTO_UPLOADED_AFTER_REMINDER: "longevity.scalp_photo_uploaded_after_reminder",
} as const;

export type LongevityEventType =
  (typeof LONGEVITY_EVENT_TYPE)[keyof typeof LONGEVITY_EVENT_TYPE];

export const LONGEVITY_SIGNAL_KEY = {
  IRON_RISK_ACTIVE: "iron_risk_active",
  THYROID_DRIVER_ACTIVE: "thyroid_driver_active",
  INFLAMMATORY_BURDEN_PERSISTENT: "inflammatory_burden_persistent",
  MARKER_IMPROVING: "marker_improving",
  FOLLOW_UP_RECOMMENDED: "follow_up_recommended",
  BLOOD_RESULTS_PENDING: "blood_results_pending",
  GP_FOLLOW_UP_SUGGESTED: "gp_follow_up_suggested",
  VISUAL_CHANGE_DETECTED: "visual_change_detected",
  VISUAL_CONCERN_PERSISTENT: "visual_concern_persistent",
  VISUAL_COMPARISON_LIMITED: "visual_comparison_limited",
  REENGAGEMENT_DELAY_DAYS: "reengagement_delay_days",
  /** Phase U: treatment continuity summary (FI-ready) */
  TREATMENT_ADHERENCE_SUMMARY: "treatment_adherence_summary",
  /** Phase U: outcome correlation state (FI-ready) */
  OUTCOME_CORRELATION: "outcome_correlation",
} as const;

export type LongevitySignalKey =
  (typeof LONGEVITY_SIGNAL_KEY)[keyof typeof LONGEVITY_SIGNAL_KEY];

export type LongevityActorType =
  | "user"
  | "system"
  | "admin"
  | "trichologist";

export type LongevityEntityRefType =
  | "profile"
  | "intake"
  | "blood_request"
  | "document"
  | "care_plan";

export type LongevityEntityRefs = {
  source_system: typeof LONGEVITY_INTEGRATION_SOURCE_SYSTEM;
  local_entity_type: LongevityEntityRefType;
  local_entity_id: string;
  global_person_id?: string;
  global_case_id?: string;
  global_document_id?: string;
  global_provider_id?: string;
  global_clinic_id?: string;
};

export function buildLongevityEntityRefs(
  local_entity_type: LongevityEntityRefType,
  local_entity_id: string
): LongevityEntityRefs {
  return {
    source_system: LONGEVITY_INTEGRATION_SOURCE_SYSTEM,
    local_entity_type,
    local_entity_id,
  };
}

/** Phase U: FI-ready payload shape for treatment_adherence_summary signal (HLI source of truth). */
export type PhaseUTreatmentAdherenceSummaryPayload = {
  profile_id: string | null;
  intake_id: string;
  items: { key: string; label: string; state: string }[];
};

/** Phase U: FI-ready payload shape for outcome_correlation signal (HLI source of truth). */
export type PhaseUOutcomeCorrelationPayload = {
  profile_id: string | null;
  intake_id: string;
  correlation_state: string;
  outcome_domains_used: string[];
  clinician_summary: string[];
  caveats: string[];
};
