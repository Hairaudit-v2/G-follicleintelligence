/**
 * Trichoscopy permission helpers — wraps platform entitlement capabilities.
 */

export const TRICHOSCOPY_PERMISSIONS = {
  request: "trichoscopy.request",
  viewStatus: "trichoscopy.view_status",
  viewConfirmedEvidence: "trichoscopy.view_evidence",
  openHliReview: "trichoscopy.review_findings",
  acceptFindings: "trichoscopy.accept_findings",
  requestAdditionalEvidence: "trichoscopy.request_additional_evidence",
  escalate: "trichoscopy.escalate",
  withdraw: "trichoscopy.withdraw",
  configureConsultationRules: "trichoscopy.configure_consultation_rules",
  viewAuditHistory: "trichoscopy.view_audit_history",
  retrySync: "trichoscopy.fios_integration",
  cancelRequest: "trichoscopy.request",
  viewIntegrationErrors: "trichoscopy.fios_integration",
} as const;
