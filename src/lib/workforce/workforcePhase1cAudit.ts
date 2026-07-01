/** WorkforceOS Phase 1C Sprint 2 audit event types (fi_staff_member_audit_events). */
export const WORKFORCE_PHASE_1C_AUDIT_EVENTS = {
  MANUAL_IDENTITY_LINKED: "workforce_manual_identity_linked",
  DUPLICATE_DISMISSED: "workforce_duplicate_dismissed",
  DUPLICATE_APPROVED_FOR_MERGE: "workforce_duplicate_approved_for_merge",
  STAFF_MERGED: "workforce_staff_merged",
  STAFF_OFFBOARDED: "workforce_staff_offboarded",
} as const;

export type WorkforcePhase1cAuditEventType =
  (typeof WORKFORCE_PHASE_1C_AUDIT_EVENTS)[keyof typeof WORKFORCE_PHASE_1C_AUDIT_EVENTS];

export const WORKFORCE_PHASE_1C_AUDIT_SOURCE = "workforceos_phase_1c_sprint_2" as const;