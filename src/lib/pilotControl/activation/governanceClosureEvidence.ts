/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B Governance Closure —
 * honest evidence snapshot for gate evaluation (pure constants).
 *
 * Human fields remain false until named approvals are recorded.
 * Software must never set approvedForInitialInvites from this file alone.
 */

import type { ControlledPilotActivationGateInput } from "./controlledPilotActivationGate";
import { summariseEventCoverage } from "./eventCoverage";

/**
 * Technical evidence after Governance Closure code fixes.
 * Live finance role-matrix re-run may still be pending operator confirmation —
 * unit + contract proofs land here; register notes the live re-run status.
 */
export const PILOT_1B_GOVERNANCE_CLOSURE_TECHNICAL = {
  controlCentreAccepted: true,
  migrationsApplied: true,
  tenantIsolationProven: true,
  /** API matrix proved; finance mapping corrected in code — live CFO re-probe pending. */
  roleMatrixProven: true,
  financeRoleMappingCorrect: true,
  exportSurfaceProven: true,
  identityPreflightProven: true,
  financePreflightProven: true,
  consentControlsProven: true,
  /** Pathway emitters landed for quote/deposit/notification/blocker set; some remain limited. */
  eventCoverageSufficient: summariseEventCoverage().sufficientForInitialPathway,
} as const;

/** Human fields — all pending named approval. Never auto-true. */
export const PILOT_1B_GOVERNANCE_CLOSURE_HUMAN = {
  operationalSopApproved: false,
  staffTrainingCompleted: false,
  supportCoverageConfirmed: false,
  incidentResponseConfirmed: false,
  manualFallbackConfirmed: false,
  rollbackConfirmed: false,
  patientPilotConsentApproved: false,
  clinicalGovernanceApproved: false,
  privacyApproved: false,
  financeApproved: false,
  initialPathwayApproved: false,
  initialCohortApproved: false,
  directorApproval: false,
  humanApprovedForInitialInvites: false,
} as const;

export const PILOT_1B_GOVERNANCE_CLOSURE_META = {
  recommendation: "defer" as const,
  formalProduction: "NO-GO" as const,
  stripe: "disabled" as const,
  activationState: "planned" as const,
  realPatientInvitesEnabled: false,
  eligibleForGovernanceReviewExpected: true,
  approvedForInitialInvitesExpected: false,
  evidenceVersion: "1B.governance-closure.0",
  sopDocument: "docs/operations/FI-CONTROLLED-PILOT-OPERATING-SOP-1B.md",
  sopVersion: "1B.0-draft",
  sopChecksumPendingNamedApproval: true,
  consentDocumentVersion: "1B.0-draft",
  tabletopStatus: "pending" as const,
  phaseVerdictExpected: "GREEN WITH LIMITATIONS" as const,
  technicalVerdictExpected: "GREEN WITH LIMITATIONS" as const,
  humanVerdictExpected: "AMBER — pending" as const,
};

export function buildGovernanceClosureGateInput(
  overrides: ControlledPilotActivationGateInput = {}
): ControlledPilotActivationGateInput {
  return {
    ...PILOT_1B_GOVERNANCE_CLOSURE_TECHNICAL,
    ...PILOT_1B_GOVERNANCE_CLOSURE_HUMAN,
    warnings: [
      "human_approvals_pending",
      "live_cfo_role_matrix_reprobe_recommended",
      ...summariseEventCoverage().warnings,
    ],
    criticalBlockers: [],
    ...overrides,
  };
}
