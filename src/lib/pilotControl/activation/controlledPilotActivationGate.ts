/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — controlled activation gate (pure).
 * eligibleForGovernanceReview may be computed.
 * approvedForInitialInvites requires an explicit human decision flag — never auto-set.
 */

import {
  PILOT_ACTIVATION_VERSION,
  type ControlledPilotActivationGate,
} from "./activationTypes";

export type ControlledPilotActivationGateInput = {
  controlCentreAccepted?: boolean;
  migrationsApplied?: boolean;
  tenantIsolationProven?: boolean;
  roleMatrixProven?: boolean;
  identityPreflightProven?: boolean;
  financePreflightProven?: boolean;
  consentControlsProven?: boolean;
  eventCoverageSufficient?: boolean;
  /** Human / operational confirmations — never auto-set. */
  operationalSopApproved?: boolean;
  staffTrainingCompleted?: boolean;
  supportCoverageConfirmed?: boolean;
  incidentResponseConfirmed?: boolean;
  manualFallbackConfirmed?: boolean;
  rollbackConfirmed?: boolean;
  patientPilotConsentApproved?: boolean;
  clinicalGovernanceApproved?: boolean;
  privacyApproved?: boolean;
  initialPathwayApproved?: boolean;
  initialCohortApproved?: boolean;
  directorApproval?: boolean;
  /**
   * Explicit human decision that programme may receive initial invites.
   * Must come from an auditable decision record — never inferred from gate completeness.
   */
  humanApprovedForInitialInvites?: boolean;
  criticalBlockers?: string[];
  warnings?: string[];
  evaluatedAt?: string;
};

const SOFTWARE_FIELDS = [
  "controlCentreAccepted",
  "migrationsApplied",
  "tenantIsolationProven",
  "roleMatrixProven",
  "identityPreflightProven",
  "financePreflightProven",
  "consentControlsProven",
  "eventCoverageSufficient",
] as const;

const HUMAN_FIELDS = [
  "operationalSopApproved",
  "staffTrainingCompleted",
  "supportCoverageConfirmed",
  "incidentResponseConfirmed",
  "manualFallbackConfirmed",
  "rollbackConfirmed",
  "patientPilotConsentApproved",
  "clinicalGovernanceApproved",
  "privacyApproved",
  "initialPathwayApproved",
  "initialCohortApproved",
  "directorApproval",
] as const;

/** Technical software fields alone — used to prove tech completion ≠ invite approval. */
export const ACTIVATION_GATE_SOFTWARE_FIELDS = SOFTWARE_FIELDS;
export const ACTIVATION_GATE_HUMAN_FIELDS = HUMAN_FIELDS;

export function evaluateControlledPilotActivationGate(
  input: ControlledPilotActivationGateInput = {}
): ControlledPilotActivationGate {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const gate: ControlledPilotActivationGate = {
    controlCentreAccepted: Boolean(input.controlCentreAccepted),
    migrationsApplied: Boolean(input.migrationsApplied),
    tenantIsolationProven: Boolean(input.tenantIsolationProven),
    roleMatrixProven: Boolean(input.roleMatrixProven),
    identityPreflightProven: Boolean(input.identityPreflightProven),
    financePreflightProven: Boolean(input.financePreflightProven),
    consentControlsProven: Boolean(input.consentControlsProven),
    eventCoverageSufficient: Boolean(input.eventCoverageSufficient),
    operationalSopApproved: Boolean(input.operationalSopApproved),
    staffTrainingCompleted: Boolean(input.staffTrainingCompleted),
    supportCoverageConfirmed: Boolean(input.supportCoverageConfirmed),
    incidentResponseConfirmed: Boolean(input.incidentResponseConfirmed),
    manualFallbackConfirmed: Boolean(input.manualFallbackConfirmed),
    rollbackConfirmed: Boolean(input.rollbackConfirmed),
    patientPilotConsentApproved: Boolean(input.patientPilotConsentApproved),
    clinicalGovernanceApproved: Boolean(input.clinicalGovernanceApproved),
    privacyApproved: Boolean(input.privacyApproved),
    initialPathwayApproved: Boolean(input.initialPathwayApproved),
    initialCohortApproved: Boolean(input.initialCohortApproved),
    directorApproval: Boolean(input.directorApproval),
    eligibleForGovernanceReview: false,
    approvedForInitialInvites: false,
    blockers: [],
    warnings: [...(input.warnings ?? [])],
    evaluatedAt,
    version: PILOT_ACTIVATION_VERSION,
  };

  const blockers: string[] = [];
  for (const key of SOFTWARE_FIELDS) {
    if (!gate[key]) blockers.push(`software_gate:${key}`);
  }
  for (const key of HUMAN_FIELDS) {
    if (!gate[key]) blockers.push(`human_gate:${key}`);
  }

  const critical = input.criticalBlockers ?? [];
  for (const c of critical) {
    blockers.push(`critical:${c}`);
  }

  gate.blockers = blockers;

  const softwareComplete = SOFTWARE_FIELDS.every((k) => gate[k]);
  const humanComplete = HUMAN_FIELDS.every((k) => gate[k]);
  const noCritical = critical.length === 0;

  // Software may compute eligibility for governance review when technical
  // evidence is complete and no critical blockers exist. Human fields may
  // still be pending — governance review is the place to record them.
  gate.eligibleForGovernanceReview =
    softwareComplete && noCritical && blockers.filter((b) => b.startsWith("software_gate:")).length === 0;

  // approvedForInitialInvites NEVER follows from completeness alone.
  gate.approvedForInitialInvites = Boolean(
    input.humanApprovedForInitialInvites &&
      softwareComplete &&
      humanComplete &&
      noCritical
  );

  if (softwareComplete && humanComplete && !input.humanApprovedForInitialInvites) {
    gate.warnings.push("complete_gate_awaits_explicit_human_invite_decision");
  }

  return gate;
}

/** Convenience: all software + human fields true (for tests). */
export function completeActivationGateInput(
  overrides: ControlledPilotActivationGateInput = {}
): ControlledPilotActivationGateInput {
  const base: ControlledPilotActivationGateInput = {
    controlCentreAccepted: true,
    migrationsApplied: true,
    tenantIsolationProven: true,
    roleMatrixProven: true,
    identityPreflightProven: true,
    financePreflightProven: true,
    consentControlsProven: true,
    eventCoverageSufficient: true,
    operationalSopApproved: true,
    staffTrainingCompleted: true,
    supportCoverageConfirmed: true,
    incidentResponseConfirmed: true,
    manualFallbackConfirmed: true,
    rollbackConfirmed: true,
    patientPilotConsentApproved: true,
    clinicalGovernanceApproved: true,
    privacyApproved: true,
    initialPathwayApproved: true,
    initialCohortApproved: true,
    directorApproval: true,
    humanApprovedForInitialInvites: false,
    criticalBlockers: [],
    warnings: [],
  };
  return { ...base, ...overrides };
}
