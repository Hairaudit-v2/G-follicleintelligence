/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — frozen contracts.
 * Pure module (no server imports). Dashboard and engines must consume these enums.
 */

/** Canonical Evolved controlled-pilot programme key (matches migration seed). */
export const EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY = "evolved_controlled_pilot_1a" as const;

export const EVOLVED_CONTROLLED_PILOT_COHORT_KEY = "evolved_hr_1a" as const;

export const EVOLVED_HAIR_TENANT_ID = "c2615b95-b707-4485-aa5f-be8f78ec868a" as const;

export const EVOLVED_HAIR_TENANT_SLUG = "evolved-hair" as const;

// ---------------------------------------------------------------------------
// Programme + enrolment
// ---------------------------------------------------------------------------

export const PILOT_PROGRAMME_STATUSES = [
  "planned",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;

export type PilotProgrammeStatus = (typeof PILOT_PROGRAMME_STATUSES)[number];

export const PILOT_ENROLMENT_STATUSES = [
  "candidate",
  "approved",
  "invited",
  "activated",
  "active",
  "paused",
  "completed",
  "withdrawn",
  "excluded",
] as const;

export type PilotEnrolmentStatus = (typeof PILOT_ENROLMENT_STATUSES)[number];

/** Statuses included in live operational metrics (not historical-only / excluded). */
export const PILOT_OPERATIONAL_ENROLMENT_STATUSES = [
  "approved",
  "invited",
  "activated",
  "active",
  "paused",
] as const satisfies readonly PilotEnrolmentStatus[];

export type PilotOperationalEnrolmentStatus =
  (typeof PILOT_OPERATIONAL_ENROLMENT_STATUSES)[number];

/** Statuses that count toward "approved pilot patients" executive cards. */
export const PILOT_APPROVED_PIPELINE_STATUSES = [
  "approved",
  "invited",
  "activated",
  "active",
  "paused",
  "completed",
] as const satisfies readonly PilotEnrolmentStatus[];

/** Terminal statuses excluded from active operational rollups. */
export const PILOT_TERMINAL_EXCLUDED_FROM_ACTIVE_METRICS = [
  "withdrawn",
  "excluded",
  "candidate",
] as const satisfies readonly PilotEnrolmentStatus[];

export const PILOT_ENROLMENT_STATUS_LABELS: Record<PilotEnrolmentStatus, string> = {
  candidate: "Candidate",
  approved: "Approved",
  invited: "Invited",
  activated: "Activated",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  withdrawn: "Withdrawn",
  excluded: "Excluded",
};

// ---------------------------------------------------------------------------
// Readiness dimensions
// ---------------------------------------------------------------------------

export const CLINICAL_READINESS_STATES = [
  "not_started",
  "in_progress",
  "awaiting_review",
  "blocked",
  "ready",
  "not_applicable",
] as const;

export type ClinicalReadinessState = (typeof CLINICAL_READINESS_STATES)[number];

export const FINANCIAL_READINESS_STATES = [
  "not_started",
  "quote_pending",
  "deposit_pending",
  "payment_plan_active",
  "reconciliation_required",
  "blocked",
  "cleared",
  "not_applicable",
] as const;

export type FinancialReadinessState = (typeof FINANCIAL_READINESS_STATES)[number];

export const OPERATIONAL_READINESS_STATES = [
  "not_started",
  "in_progress",
  "attention_required",
  "blocked",
  "ready",
  "not_applicable",
] as const;

export type OperationalReadinessState = (typeof OPERATIONAL_READINESS_STATES)[number];

export const PATIENT_READINESS_STATES = [
  "not_started",
  "in_progress",
  "attention_required",
  "blocked",
  "ready",
  "not_applicable",
] as const;

export type PatientReadinessState = (typeof PATIENT_READINESS_STATES)[number];

export const CONSENT_DOCUMENT_READINESS_STATES = [
  "not_started",
  "in_progress",
  "blocked",
  "ready",
  "not_applicable",
  "unknown",
] as const;

export type ConsentDocumentReadinessState =
  (typeof CONSENT_DOCUMENT_READINESS_STATES)[number];

export const PATHOLOGY_READINESS_STATES = [
  "not_started",
  "requested",
  "received",
  "awaiting_review",
  "blocked",
  "cleared",
  "not_applicable",
  "unknown",
] as const;

export type PathologyReadinessState = (typeof PATHOLOGY_READINESS_STATES)[number];

export const IMAGE_READINESS_STATES = [
  "not_started",
  "in_progress",
  "awaiting_review",
  "blocked",
  "ready",
  "not_applicable",
  "unknown",
] as const;

export type ImageReadinessState = (typeof IMAGE_READINESS_STATES)[number];

export const APPOINTMENT_READINESS_STATES = [
  "not_started",
  "scheduled",
  "confirmed",
  "blocked",
  "ready",
  "not_applicable",
  "unknown",
] as const;

export type AppointmentReadinessState = (typeof APPOINTMENT_READINESS_STATES)[number];

export const OVERALL_READINESS_STATES = [
  "not_started",
  "in_progress",
  "attention_required",
  "blocked",
  "ready",
  "completed",
] as const;

export type OverallReadinessState = (typeof OVERALL_READINESS_STATES)[number];

// ---------------------------------------------------------------------------
// Blockers
// ---------------------------------------------------------------------------

export const PILOT_BLOCKER_CATEGORIES = [
  "identity",
  "patient_activation",
  "patient_action_overdue",
  "clinic_action_overdue",
  "clinical_review",
  "pathology",
  "medication",
  "consent",
  "documents",
  "images",
  "appointment",
  "financial",
  "payment_reconciliation",
  "communication",
  "notification_delivery",
  "integration",
  "technical_failure",
  "data_quality",
  "governance_approval",
] as const;

export type PilotBlockerCategory = (typeof PILOT_BLOCKER_CATEGORIES)[number];

export const PILOT_BLOCKER_SEVERITIES = ["info", "attention", "high", "critical"] as const;

export type PilotBlockerSeverity = (typeof PILOT_BLOCKER_SEVERITIES)[number];

export const PILOT_BLOCKER_RESOLUTION_STATES = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "superseded",
  "dismissed",
  /** @deprecated Prefer `dismissed` — retained for 1A.1/1A.2 fixtures. */
  "dismissed_optional",
] as const;

export type PilotBlockerResolutionState = (typeof PILOT_BLOCKER_RESOLUTION_STATES)[number];

/** Active (non-terminal) blocker lifecycle states. */
export const PILOT_BLOCKER_ACTIVE_STATES = [
  "open",
  "acknowledged",
  "in_progress",
] as const satisfies readonly PilotBlockerResolutionState[];

export type PilotBlockerActiveState = (typeof PILOT_BLOCKER_ACTIVE_STATES)[number];

export const PILOT_BLOCKER_OWNERS = [
  "patient",
  "reception",
  "consultant",
  "clinical",
  "finance",
  "clinic_manager",
  "technical",
  "director",
  "governance",
  "unassigned",
  "system",
  "platform",
] as const;

export type PilotBlockerOwner = (typeof PILOT_BLOCKER_OWNERS)[number];

/** 1A.3 ownership assignment sources (deterministic precedence). */
export const PILOT_BLOCKER_ASSIGNMENT_SOURCES = [
  "canonical_record",
  "programme_rule",
  "module_default",
  "escalation_rule",
  "unresolved",
] as const;

export type PilotBlockerAssignmentSource =
  (typeof PILOT_BLOCKER_ASSIGNMENT_SOURCES)[number];

/** Source dimensions for operational blockers (extends readiness dims + identity/governance). */
export const PILOT_BLOCKER_DIMENSIONS = [
  "identity",
  "clinical",
  "financial",
  "patient",
  "operational",
  "technical",
  "governance",
] as const;

export type PilotBlockerDimension = (typeof PILOT_BLOCKER_DIMENSIONS)[number];

/** Brisbane timezone assumption for Evolved programme business-hour ageing. */
export const EVOLVED_PILOT_CLINIC_TIMEZONE = "Australia/Brisbane" as const;

export const BLOCKER_EVALUATION_VERSION = "1A.3.0" as const;

/** Frozen health rule version consumed by 1A.4 health API (do not redefine in routes). */
export const PILOT_HEALTH_RULE_VERSION = "1A.1.0" as const;

/** Pilot Control API envelope version. */
export const PILOT_CONTROL_API_VERSION = "1A.6.0" as const;

// ---------------------------------------------------------------------------
// Escalation + health
// ---------------------------------------------------------------------------

export const PILOT_ESCALATION_LEVELS = ["none", "attention", "high", "critical"] as const;

export type PilotEscalationLevel = (typeof PILOT_ESCALATION_LEVELS)[number];

export const PILOT_HEALTH_VERDICTS = ["GREEN", "AMBER", "RED"] as const;

export type PilotHealthVerdict = (typeof PILOT_HEALTH_VERDICTS)[number];

export type PilotEscalationThresholds = {
  patient_action_overdue_attention_hours: number;
  clinic_action_overdue_attention_business_days: number;
  patient_inactive_attention_days: number;
  unread_message_attention_business_hours: number;
  surgery_window_high_days: number;
  blocked_high_days: number;
  high_blocker_amber_limit: number;
  technical_completion_rate_green_min: number;
};

export const DEFAULT_PILOT_ESCALATION_THRESHOLDS: PilotEscalationThresholds = {
  patient_action_overdue_attention_hours: 24,
  clinic_action_overdue_attention_business_days: 1,
  patient_inactive_attention_days: 3,
  unread_message_attention_business_hours: 4,
  surgery_window_high_days: 7,
  blocked_high_days: 3,
  high_blocker_amber_limit: 5,
  technical_completion_rate_green_min: 0.95,
};

// ---------------------------------------------------------------------------
// Adoption telemetry event kinds
// ---------------------------------------------------------------------------

export const PILOT_CONTROL_EVENT_KINDS = [
  "pilot_patient_approved",
  "pilot_patient_invited",
  "pilot_patient_activated",
  "pilot_patient_paused",
  "pilot_patient_completed",
  "pilot_patient_withdrawn",
  "pilot_patient_excluded",
  "patient_action_created",
  "patient_action_completed",
  "clinic_action_created",
  "clinic_action_completed",
  "journey_milestone_started",
  "journey_milestone_completed",
  "quote_delivered",
  "quote_viewed",
  "deposit_requested",
  "payment_verified",
  "financial_clearance_achieved",
  "document_requested",
  "document_completed",
  "consent_completed",
  "pathology_requested",
  "pathology_received",
  "pathology_cleared",
  "images_completed",
  "message_received",
  "message_replied",
  "notification_sent",
  "notification_failed",
  "readiness_blocked",
  "readiness_achieved",
  "staff_override_used",
  "technical_error_detected",
  // 1A.4 read-only API audit events (no sensitive patient content in payloads)
  "pilot_control_overview_viewed",
  "pilot_control_patient_register_viewed",
  "pilot_control_patient_detail_viewed",
  "pilot_control_blockers_viewed",
  "pilot_control_health_viewed",
  "pilot_control_activity_viewed",
  "pilot_control_export_created",
  "pilot_control_access_denied",
  "pilot_control_evaluation_failed",
  // 1A.6 adoption / workflow coverage (emitters may still be contract_only)
  "patient_action_overdue",
  "clinic_action_overdue",
  "journey_milestone_blocked",
  "quote_accepted",
  "payment_reconciliation_required",
  "pathology_reviewed",
  "images_requested",
  "images_reviewed",
  "notification_delivered",
  "readiness_evaluated",
  "blocker_opened",
  "blocker_escalated",
  "blocker_resolved",
  "manual_channel_fallback_recorded",
  "workflow_abandoned",
  "pilot_control_adoption_viewed",
] as const;

export type PilotControlEventKind = (typeof PILOT_CONTROL_EVENT_KINDS)[number];

export const PILOT_CONTROL_ACTOR_TYPES = ["system", "staff", "patient", "integration"] as const;

export type PilotControlActorType = (typeof PILOT_CONTROL_ACTOR_TYPES)[number];

// ---------------------------------------------------------------------------
// Source provenance (readiness / blockers must cite source modules)
// ---------------------------------------------------------------------------

export const PILOT_SOURCE_MODULES = [
  "pilot_enrolment",
  "foundation_identity",
  "patient_journey_control",
  "patient_app_gateway",
  "reception_inbox",
  "financial_os",
  "crm_quotes",
  "documents",
  "consent",
  "pathology",
  "imaging_os",
  "bookings",
  "notifications",
  "pilot_control",
] as const;

export type PilotSourceModule = (typeof PILOT_SOURCE_MODULES)[number];

export type PilotSourceProvenance = {
  sourceModule: PilotSourceModule;
  sourceRecordType: string | null;
  sourceRecordId: string | null;
  observedAt: string;
  /** When true, the mandatory signal could not be resolved — must not map to ready. */
  unknown: boolean;
};

// ---------------------------------------------------------------------------
// Permission scopes (1A.4 will enforce; contract frozen here)
// ---------------------------------------------------------------------------

export const PILOT_CONTROL_PERMISSION_SCOPES = [
  "overview_full",
  "overview_clinic",
  "register_read",
  "detail_identity",
  "detail_journey",
  "detail_patient_actions",
  "detail_clinic_actions",
  "detail_clinical_summary",
  "detail_clinical_full",
  "detail_financial_summary",
  "detail_financial_full",
  "detail_documents",
  "detail_imaging",
  "detail_communication",
  "detail_app_activity",
  "detail_technical",
  "export",
] as const;

export type PilotControlPermissionScope = (typeof PILOT_CONTROL_PERMISSION_SCOPES)[number];

export const PILOT_CONTROL_ROLE_KEYS = [
  "director",
  "administrator",
  "clinic_manager",
  "reception",
  "consultant",
  "clinical",
  "finance",
  "technical",
] as const;

export type PilotControlRoleKey = (typeof PILOT_CONTROL_ROLE_KEYS)[number];

/** Minimum scopes per role — fail-closed: missing role gets empty set. */
export const PILOT_CONTROL_ROLE_SCOPES: Record<PilotControlRoleKey, readonly PilotControlPermissionScope[]> =
  {
    director: [...PILOT_CONTROL_PERMISSION_SCOPES],
    administrator: [...PILOT_CONTROL_PERMISSION_SCOPES],
    clinic_manager: [
      "overview_clinic",
      "register_read",
      "detail_identity",
      "detail_journey",
      "detail_patient_actions",
      "detail_clinic_actions",
      "detail_clinical_summary",
      "detail_financial_summary",
      "detail_documents",
      "detail_imaging",
      "detail_communication",
      "detail_app_activity",
      "detail_technical",
    ],
    reception: [
      "overview_clinic",
      "register_read",
      "detail_identity",
      "detail_journey",
      "detail_patient_actions",
      "detail_clinic_actions",
      "detail_financial_summary",
      "detail_documents",
      "detail_communication",
      "detail_app_activity",
    ],
    consultant: [
      "overview_clinic",
      "register_read",
      "detail_identity",
      "detail_journey",
      "detail_patient_actions",
      "detail_clinic_actions",
      "detail_clinical_summary",
      "detail_financial_summary",
      "detail_documents",
      "detail_imaging",
      "detail_communication",
      "detail_app_activity",
    ],
    clinical: [
      "overview_clinic",
      "register_read",
      "detail_identity",
      "detail_journey",
      "detail_patient_actions",
      "detail_clinic_actions",
      "detail_clinical_full",
      "detail_documents",
      "detail_imaging",
      "detail_communication",
      "detail_app_activity",
    ],
    finance: [
      "overview_clinic",
      "register_read",
      "detail_identity",
      "detail_journey",
      "detail_patient_actions",
      "detail_clinic_actions",
      "detail_financial_full",
      "detail_communication",
      "detail_app_activity",
    ],
    technical: [
      "overview_clinic",
      "register_read",
      "detail_identity",
      "detail_technical",
      "detail_app_activity",
      "detail_communication",
    ],
  };

export function pilotControlRoleHasScope(
  role: PilotControlRoleKey | null | undefined,
  scope: PilotControlPermissionScope
): boolean {
  if (!role) return false;
  const scopes = PILOT_CONTROL_ROLE_SCOPES[role];
  return scopes.includes(scope);
}
