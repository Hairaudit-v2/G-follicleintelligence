/** WorkforceOS Phase 1C Sprint 2 audit event types (fi_staff_member_audit_events). */
export const WORKFORCE_PHASE_1C_AUDIT_EVENTS = {
  MANUAL_IDENTITY_LINKED: "workforce_manual_identity_linked",
  DUPLICATE_DISMISSED: "workforce_duplicate_dismissed",
  DUPLICATE_APPROVED_FOR_MERGE: "workforce_duplicate_approved_for_merge",
  STAFF_MERGED: "workforce_staff_merged",
  STAFF_OFFBOARDED: "workforce_staff_offboarded",
  CREDENTIAL_UPSERTED: "workforce_credential_upserted",
  CERTIFICATION_UPSERTED: "workforce_certification_upserted",
  COMPLIANCE_AUTOMATION_RUN: "workforce_compliance_automation_run",
  CANONICAL_STAFF_SELECTED: "workforce_canonical_staff_selected",
  MERGE_RECOMMENDATION_GENERATED: "workforce_merge_recommendation_generated",
  MANUAL_REVIEW_REQUESTED: "workforce_manual_review_requested",
  RECONCILIATION_RECOMMENDATION_APPROVED: "workforce_reconciliation_recommendation_approved",
  DUPLICATE_MERGE_RECOMMENDED: "workforce_duplicate_merge_recommended",
  FUTURE_BOOKINGS_UNASSIGNED_ON_OFFBOARD: "workforce_future_bookings_unassigned_on_offboard",
  IIOHR_DEPARTURE_ALIGNED: "workforce_iiohr_departure_aligned",
  IIOHR_DEPARTURE_QUEUED: "workforce_iiohr_departure_queued",
} as const;

export type WorkforcePhase1cAuditEventType =
  (typeof WORKFORCE_PHASE_1C_AUDIT_EVENTS)[keyof typeof WORKFORCE_PHASE_1C_AUDIT_EVENTS];

export const WORKFORCE_PHASE_1C_AUDIT_SOURCE = "workforceos_phase_1c_sprint_3_5" as const;