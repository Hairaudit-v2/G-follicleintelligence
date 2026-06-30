/**
 * AnalyticsOS Phase A+C — typed event contracts per FI OS module.
 */

export const ANALYTICS_MODULE_NAMES = [
  "workforce_os",
  "surgery_os",
  "financial_os",
  "consultation_os",
  "patient_os",
  "clinic_os",
  "leadflow",
  "imaging_os",
  "audit_os",
  "academy_os",
] as const;

export type AnalyticsModuleName = (typeof ANALYTICS_MODULE_NAMES)[number];

export const WORKFORCE_EVENTS = ["staff_assigned", "shift_created", "readiness_changed"] as const;
export type WorkforceAnalyticsEventType = (typeof WORKFORCE_EVENTS)[number];

export const SURGERY_EVENTS = [
  "surgery_started",
  "surgery_completed",
  "graft_count_recorded",
] as const;
export type SurgeryAnalyticsEventType = (typeof SURGERY_EVENTS)[number];

export const FINANCIAL_EVENTS = [
  "invoice_created",
  "payment_received",
  "forecast_updated",
] as const;
export type FinancialAnalyticsEventType = (typeof FINANCIAL_EVENTS)[number];

export const CONSULTATION_EVENTS = [
  "consultation_booked",
  "quote_sent",
  "consultation_closed",
] as const;
export type ConsultationAnalyticsEventType = (typeof CONSULTATION_EVENTS)[number];

export const LEADFLOW_EVENTS = [
  "lead_created",
  "lead_scored",
  "lead_qualified",
  "consultation_booked",
  "lead_stage_changed",
  "lead_converted",
] as const;
export type LeadFlowAnalyticsEventType = (typeof LEADFLOW_EVENTS)[number];

export const PATIENT_EVENTS = [
  "patient_onboarding_started",
  "patient_document_uploaded",
  "patient_images_uploaded",
  "patient_photo_quick_action_completed",
  "patient_report_generated",
  "patient_followup_completed",
  "patient_journey_completed",
  /** @deprecated Phase A alias — kept for backward compatibility */
  "patient_uploaded_images",
  /** @deprecated Phase A alias — kept for backward compatibility */
  "followup_completed",
] as const;
export type PatientAnalyticsEventType = (typeof PATIENT_EVENTS)[number];

export const IMAGING_EVENTS = [
  "imaging_session_created",
  "imaging_protocol_completed",
  "scalp_map_completed",
  "ai_imaging_completed",
  "annotation_completed",
  "image_classification_completed",
  "photo_capture_completed",
] as const;
export type ImagingAnalyticsEventType = (typeof IMAGING_EVENTS)[number];

export const AUDIT_EVENTS = [
  "audit_started",
  "audit_images_uploaded",
  "audit_report_generated",
  "audit_intelligence_completed",
  "graft_integrity_scored",
  "concern_classification_completed",
] as const;
export type AuditAnalyticsEventType = (typeof AUDIT_EVENTS)[number];

export const ACADEMY_EVENTS = [
  "competency_verified",
  "competency_expired",
  "competency_restricted",
  "certification_verified",
  "procedure_privilege_granted",
  "procedure_privilege_suspended",
  "procedure_privilege_revoked",
  "procedure_privilege_expired",
  "privilege_requirement_missing",
] as const;
export type AcademyAnalyticsEventType = (typeof ACADEMY_EVENTS)[number];

export const ANALYTICS_ENTITY_TYPES = [
  "booking",
  "surgery",
  "patient",
  "invoice",
  "staff",
  "consultation",
  "lead",
  "quote",
  "case",
  "image",
  "session",
  "report",
] as const;
export type AnalyticsEntityType = (typeof ANALYTICS_ENTITY_TYPES)[number];

/** Maps each module to its allowed event type strings. */
export const MODULE_EVENT_TYPES: Record<AnalyticsModuleName, readonly string[]> = {
  workforce_os: WORKFORCE_EVENTS,
  surgery_os: SURGERY_EVENTS,
  financial_os: FINANCIAL_EVENTS,
  consultation_os: CONSULTATION_EVENTS,
  patient_os: PATIENT_EVENTS,
  clinic_os: [],
  leadflow: LEADFLOW_EVENTS,
  imaging_os: IMAGING_EVENTS,
  audit_os: AUDIT_EVENTS,
  academy_os: ACADEMY_EVENTS,
};

export function isAnalyticsModuleName(value: string): value is AnalyticsModuleName {
  return (ANALYTICS_MODULE_NAMES as readonly string[]).includes(value);
}

export function isEventTypeAllowedForModule(
  moduleName: AnalyticsModuleName,
  eventType: string
): boolean {
  const allowed = MODULE_EVENT_TYPES[moduleName];
  if (!allowed.length) return eventType.trim().length > 0;
  return allowed.includes(eventType);
}
