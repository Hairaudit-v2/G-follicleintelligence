/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — activation contracts (pure).
 * Software may compute readiness for governance review.
 * Software must never set approved_for_initial_invites or initial_cohort_active.
 */

export const PILOT_ACTIVATION_VERSION = "1B.0.0" as const;

export const PILOT_ACTIVATION_STATES = [
  "planned",
  "technical_validation",
  "governance_review",
  "approved_for_initial_invites",
  "initial_cohort_active",
  "hold",
  "paused",
  "completed",
  "cancelled",
] as const;

export type PilotActivationState = (typeof PILOT_ACTIVATION_STATES)[number];

/** States that may be set by software (never invite/active approvals). */
export const SOFTWARE_SETTABLE_ACTIVATION_STATES = [
  "planned",
  "technical_validation",
  "governance_review",
  "hold",
  "paused",
  "completed",
  "cancelled",
] as const satisfies readonly PilotActivationState[];

/** States that require explicit human decision records. */
export const HUMAN_ONLY_ACTIVATION_STATES = [
  "approved_for_initial_invites",
  "initial_cohort_active",
] as const satisfies readonly PilotActivationState[];

export const PILOT_ACTIVATION_DECISION_TYPES = [
  "governance_review",
  "initial_invite_approval",
  "cohort_activation",
  "hold",
  "pause",
  "restart",
  "cancel",
  "defer",
] as const;

export type PilotActivationDecisionType =
  (typeof PILOT_ACTIVATION_DECISION_TYPES)[number];

export const PILOT_ACTIVATION_DECISIONS = [
  "pending",
  "approved",
  "rejected",
  "deferred",
  "withdrawn",
] as const;

export type PilotActivationDecisionOutcome =
  (typeof PILOT_ACTIVATION_DECISIONS)[number];

export const PILOT_CANDIDATE_REVIEW_STATUSES = [
  "candidate",
  "preflight_in_progress",
  "eligible_for_clinical_review",
  "eligible_for_governance_review",
  "approved",
  "enrolled",
  "deferred",
  "excluded",
  "withdrawn",
] as const;

export type PilotCandidateReviewStatus =
  (typeof PILOT_CANDIDATE_REVIEW_STATUSES)[number];

export const PILOT_INITIAL_PATHWAYS = [
  "consultation_to_quote",
  "quote_to_deposit",
  "pre_procedure_readiness",
  "postoperative_follow_up",
] as const;

export type PilotInitialPathway = (typeof PILOT_INITIAL_PATHWAYS)[number];

/** Locked pathway for Evolved first cohort (1B). */
export const EVOLVED_INITIAL_PATHWAY_LOCK: PilotInitialPathway =
  "quote_to_deposit";

export type GateCheckStatus =
  | "pass"
  | "fail"
  | "unknown"
  | "not_applicable"
  | "human_required";

export type GateCheck = {
  status: GateCheckStatus;
  reasonCode: string;
  blocking: boolean;
  patientSafeSummary: string;
};

export type PilotIdentityPreflightResult = {
  eligible: boolean;
  checks: {
    canonicalPatient: GateCheck;
    tenantOwnership: GateCheck;
    appIdentity: GateCheck;
    crmIdentity: GateCheck;
    financeIdentity: GateCheck;
    consentIdentity: GateCheck;
    documentIdentity: GateCheck;
    imageIdentity: GateCheck;
    journeyIdentity: GateCheck;
    duplicateEnrolment: GateCheck;
  };
  criticalBlockers: string[];
  evaluatedAt: string;
  version: string;
};

export type PilotFinancePreflightResult = {
  eligible: boolean;
  checks: {
    quoteOwnership: GateCheck;
    invoiceOwnership: GateCheck;
    depositRequirement: GateCheck;
    paymentAllocation: GateCheck;
    paymentPlan: GateCheck;
    unallocatedPayment: GateCheck;
    crossPatientPayment: GateCheck;
    reconciliation: GateCheck;
    stripeDisabled: GateCheck;
    financialClearance: GateCheck;
  };
  criticalBlockers: string[];
  evaluatedAt: string;
  version: string;
};

export type PilotClinicalConsentPreflightResult = {
  eligible: boolean;
  /** Software shows clinical states; never independently declares clinical suitability. */
  clinicalSuitabilityHumanRequired: true;
  checks: {
    pathwayAppropriatenessObserved: GateCheck;
    consultationState: GateCheck;
    clinicalReviewState: GateCheck;
    pathologyKnown: GateCheck;
    consentWorkflowAvailable: GateCheck;
    consentOwnership: GateCheck;
    consentCurrent: GateCheck;
    clinicalEscalationPath: GateCheck;
    highComplexityException: GateCheck;
  };
  criticalBlockers: string[];
  warnings: string[];
  evaluatedAt: string;
  version: string;
};

export type ControlledPilotActivationGate = {
  controlCentreAccepted: boolean;
  migrationsApplied: boolean;
  tenantIsolationProven: boolean;
  roleMatrixProven: boolean;
  identityPreflightProven: boolean;
  financePreflightProven: boolean;
  consentControlsProven: boolean;
  eventCoverageSufficient: boolean;
  operationalSopApproved: boolean;
  staffTrainingCompleted: boolean;
  supportCoverageConfirmed: boolean;
  incidentResponseConfirmed: boolean;
  manualFallbackConfirmed: boolean;
  rollbackConfirmed: boolean;
  patientPilotConsentApproved: boolean;
  clinicalGovernanceApproved: boolean;
  privacyApproved: boolean;
  initialPathwayApproved: boolean;
  initialCohortApproved: boolean;
  directorApproval: boolean;

  eligibleForGovernanceReview: boolean;
  /** Requires human decision record — never auto-set by software. */
  approvedForInitialInvites: boolean;

  blockers: string[];
  warnings: string[];

  evaluatedAt: string;
  version: string;
};

export const PILOT_EVENT_IMPLEMENTATION_STATUSES = [
  "wired",
  "wired_with_limitation",
  "contract_only",
  "not_required_for_initial_pathway",
  "source_unavailable",
] as const;

export type PilotEventImplementationStatus =
  (typeof PILOT_EVENT_IMPLEMENTATION_STATUSES)[number];

export type PilotActivationDecisionRecord = {
  id: string;
  programmeId: string;
  tenantId: string;
  decisionType: PilotActivationDecisionType;
  decisionState: PilotActivationState;
  decisionVersion: number;
  requestedAt: string;
  requestedBy: string | null;
  clinicalApproved: boolean;
  clinicalApprovedBy: string | null;
  clinicalApprovedAt: string | null;
  privacyApproved: boolean;
  privacyApprovedBy: string | null;
  privacyApprovedAt: string | null;
  operationsApproved: boolean;
  operationsApprovedBy: string | null;
  operationsApprovedAt: string | null;
  technicalApproved: boolean;
  technicalApprovedBy: string | null;
  technicalApprovedAt: string | null;
  directorApproved: boolean;
  directorApprovedBy: string | null;
  directorApprovedAt: string | null;
  cohortApproved: boolean;
  cohortApprovedBy: string | null;
  cohortApprovedAt: string | null;
  supportConfirmed: boolean;
  rollbackConfirmed: boolean;
  incidentResponseConfirmed: boolean;
  staffTrainingConfirmed: boolean;
  decision: PilotActivationDecisionOutcome;
  decisionReason: string | null;
  blockersJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export type PilotCohortCandidateReview = {
  id: string;
  tenantId: string;
  programmeId: string;
  patientId: string;
  pathway: PilotInitialPathway;
  status: PilotCandidateReviewStatus;
  identityPreflightEligible: boolean | null;
  financePreflightEligible: boolean | null;
  consentPreflightEligible: boolean | null;
  clinicalReviewPassed: boolean | null;
  operationalReviewPassed: boolean | null;
  supportOwnerUserId: string | null;
  clinicalOwnerUserId: string | null;
  operationalOwnerUserId: string | null;
  decision: PilotActivationDecisionOutcome | null;
  decisionReason: string | null;
  approvedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Records that must never be deleted or rolled back. */
export const ROLLBACK_PRESERVED_RECORD_CLASSES = [
  "audit_history",
  "patient_consent_history",
  "financial_records",
  "clinical_records",
  "blocker_history",
  "activation_decisions",
] as const;

export type RollbackPreservedRecordClass =
  (typeof ROLLBACK_PRESERVED_RECORD_CLASSES)[number];
