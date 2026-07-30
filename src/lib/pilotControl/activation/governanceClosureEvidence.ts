/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B Governance Closure —
 * honest evidence snapshot for gate evaluation (pure constants).
 *
 * Evolved uses the small_team_pilot governance tier. Human fields remain false
 * until named confirmations are recorded. Software must never set
 * approvedForInitialInvites from this file alone.
 */

import type { ControlledPilotActivationGateInput } from "./controlledPilotActivationGate";
import { summariseEventCoverage } from "./eventCoverage";
import { EVOLVED_PILOT_GOVERNANCE_TIER } from "./governanceTier";

/**
 * Technical evidence after Governance Closure + live production proofs.
 */
export const PILOT_1B_GOVERNANCE_CLOSURE_TECHNICAL = {
  controlCentreAccepted: true,
  migrationsApplied: true,
  tenantIsolationProven: true,
  roleMatrixProven: true,
  financeRoleMappingCorrect: true,
  exportSurfaceProven: true,
  identityPreflightProven: true,
  financePreflightProven: true,
  consentControlsProven: true,
  /** Pathway emitters landed for quote/deposit/notification/blocker set; some remain limited. */
  eventCoverageSufficient: summariseEventCoverage().sufficientForInitialPathway,
} as const;

/**
 * Evolved small-team human fields — all pending named confirmation.
 * Formal committee / separate SOP / training / tabletop docs are N/A for this tier.
 */
export const PILOT_1B_GOVERNANCE_CLOSURE_HUMAN = {
  teamBriefingCompleted: false,
  clinicalWorkflowConfirmed: false,
  financeWorkflowConfirmed: false,
  supportContactConfirmed: false,
  fallbackConfirmed: false,
  directorApproval: false,
  humanApprovedForInitialInvites: false,
  // Legacy / enterprise fields remain false and are not mandatory for small_team_pilot.
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
  formalPrivacyCommitteeApproval: false,
  multiClinicGovernanceConfirmed: false,
  enterpriseIncidentExerciseConfirmed: false,
  enterpriseSegregationOfDutiesConfirmed: false,
  enterpriseIntegrationApprovalsConfirmed: false,
  enterpriseStagedRolloutApproved: false,
} as const;

export const PILOT_1B_GOVERNANCE_CLOSURE_META = {
  recommendation: "defer" as const,
  formalProduction: "NO-GO" as const,
  stripe: "disabled" as const,
  activationState: "planned" as const,
  realPatientInvitesEnabled: false,
  governanceTier: EVOLVED_PILOT_GOVERNANCE_TIER,
  eligibleForGovernanceReviewExpected: true,
  approvedForInitialInvitesExpected: false,
  evidenceVersion: "1B.governance-closure.1-tiered",
  smallTeamBriefingDocument:
    "docs/governance/FI-CONTROLLED-PILOT-SMALL-TEAM-BRIEFING-1B.md",
  sopDocument: "docs/operations/FI-CONTROLLED-PILOT-OPERATING-SOP-1B.md",
  sopVersion: "1B.0-draft",
  sopChecksumPendingNamedApproval: true,
  consentDocumentVersion: "1B.0-draft",
  tabletopStatus: "not_applicable_small_team_pilot" as const,
  phaseVerdictExpected: "GREEN WITH LIMITATIONS" as const,
  technicalVerdictExpected: "GREEN" as const,
  humanVerdictExpected: "AMBER — pending small-team confirmations" as const,
};

export function buildGovernanceClosureGateInput(
  overrides: ControlledPilotActivationGateInput = {}
): ControlledPilotActivationGateInput {
  return {
    governanceTier: EVOLVED_PILOT_GOVERNANCE_TIER,
    ...PILOT_1B_GOVERNANCE_CLOSURE_TECHNICAL,
    ...PILOT_1B_GOVERNANCE_CLOSURE_HUMAN,
    warnings: [
      "human_approvals_pending",
      "small_team_pilot_compact_human_gates",
      ...summariseEventCoverage().warnings,
    ],
    criticalBlockers: [],
    ...overrides,
  };
}
