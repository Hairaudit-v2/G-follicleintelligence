/**
 * FI-CONTROLLED-PILOT-ACTIVATION-1B — controlled activation gate (pure).
 * eligibleForGovernanceReview may be computed.
 * approvedForInitialInvites requires an explicit human decision flag — never auto-set.
 *
 * Human requirements are tiered: small_team_pilot / standard_tenant /
 * enterprise_or_high_risk. Not every formal document is mandatory for every tenant.
 */

import {
  PILOT_ACTIVATION_VERSION,
  type ControlledPilotActivationGate,
} from "./activationTypes";
import {
  DEFAULT_PILOT_GOVERNANCE_TIER,
  ENTERPRISE_EXTRA_HUMAN_FIELDS,
  getGovernanceTierProfile,
  SMALL_TEAM_PILOT_HUMAN_FIELDS,
  STANDARD_TENANT_HUMAN_FIELDS,
  type PilotGovernanceTier,
} from "./governanceTier";

export type ControlledPilotActivationGateInput = {
  /** Determines which human gates apply. Defaults to standard_tenant. */
  governanceTier?: PilotGovernanceTier;

  controlCentreAccepted?: boolean;
  migrationsApplied?: boolean;
  tenantIsolationProven?: boolean;
  roleMatrixProven?: boolean;
  financeRoleMappingCorrect?: boolean;
  exportSurfaceProven?: boolean;
  identityPreflightProven?: boolean;
  financePreflightProven?: boolean;
  consentControlsProven?: boolean;
  eventCoverageSufficient?: boolean;

  /** Small-team pilot human confirmations. */
  teamBriefingCompleted?: boolean;
  clinicalWorkflowConfirmed?: boolean;
  financeWorkflowConfirmed?: boolean;
  supportContactConfirmed?: boolean;
  fallbackConfirmed?: boolean;

  /** Standard / enterprise human confirmations — never auto-set. */
  operationalSopApproved?: boolean;
  staffTrainingCompleted?: boolean;
  supportCoverageConfirmed?: boolean;
  incidentResponseConfirmed?: boolean;
  manualFallbackConfirmed?: boolean;
  rollbackConfirmed?: boolean;
  patientPilotConsentApproved?: boolean;
  clinicalGovernanceApproved?: boolean;
  privacyApproved?: boolean;
  financeApproved?: boolean;
  initialPathwayApproved?: boolean;
  initialCohortApproved?: boolean;
  directorApproval?: boolean;

  /** Enterprise / high-risk extras. */
  formalPrivacyCommitteeApproval?: boolean;
  multiClinicGovernanceConfirmed?: boolean;
  enterpriseIncidentExerciseConfirmed?: boolean;
  enterpriseSegregationOfDutiesConfirmed?: boolean;
  enterpriseIntegrationApprovalsConfirmed?: boolean;
  enterpriseStagedRolloutApproved?: boolean;

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
  "financeRoleMappingCorrect",
  "exportSurfaceProven",
  "identityPreflightProven",
  "financePreflightProven",
  "consentControlsProven",
  "eventCoverageSufficient",
] as const;

/** Union of all human field keys that may appear on the gate. */
const ALL_HUMAN_FIELDS = [
  ...SMALL_TEAM_PILOT_HUMAN_FIELDS,
  ...STANDARD_TENANT_HUMAN_FIELDS.filter((k) => k !== "directorApproval"),
  ...ENTERPRISE_EXTRA_HUMAN_FIELDS,
] as const;

/** Technical software fields alone — used to prove tech completion ≠ invite approval. */
export const ACTIVATION_GATE_SOFTWARE_FIELDS = SOFTWARE_FIELDS;
/** @deprecated Prefer tier-required fields via getGovernanceTierProfile. */
export const ACTIVATION_GATE_HUMAN_FIELDS = STANDARD_TENANT_HUMAN_FIELDS;

export function evaluateControlledPilotActivationGate(
  input: ControlledPilotActivationGateInput = {}
): ControlledPilotActivationGate {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const governanceTier = input.governanceTier ?? DEFAULT_PILOT_GOVERNANCE_TIER;
  const profile = getGovernanceTierProfile(governanceTier);

  const gate: ControlledPilotActivationGate = {
    governanceTier,
    requiredHumanFields: [...profile.required],
    notApplicableHumanFields: [...profile.deferredOrNotApplicable],

    controlCentreAccepted: Boolean(input.controlCentreAccepted),
    migrationsApplied: Boolean(input.migrationsApplied),
    tenantIsolationProven: Boolean(input.tenantIsolationProven),
    roleMatrixProven: Boolean(input.roleMatrixProven),
    financeRoleMappingCorrect: Boolean(input.financeRoleMappingCorrect),
    exportSurfaceProven: Boolean(input.exportSurfaceProven),
    identityPreflightProven: Boolean(input.identityPreflightProven),
    financePreflightProven: Boolean(input.financePreflightProven),
    consentControlsProven: Boolean(input.consentControlsProven),
    eventCoverageSufficient: Boolean(input.eventCoverageSufficient),

    teamBriefingCompleted: Boolean(input.teamBriefingCompleted),
    clinicalWorkflowConfirmed: Boolean(input.clinicalWorkflowConfirmed),
    financeWorkflowConfirmed: Boolean(input.financeWorkflowConfirmed),
    supportContactConfirmed: Boolean(input.supportContactConfirmed),
    fallbackConfirmed: Boolean(input.fallbackConfirmed),

    operationalSopApproved: Boolean(input.operationalSopApproved),
    staffTrainingCompleted: Boolean(input.staffTrainingCompleted),
    supportCoverageConfirmed: Boolean(input.supportCoverageConfirmed),
    incidentResponseConfirmed: Boolean(input.incidentResponseConfirmed),
    manualFallbackConfirmed: Boolean(input.manualFallbackConfirmed),
    rollbackConfirmed: Boolean(input.rollbackConfirmed),
    patientPilotConsentApproved: Boolean(input.patientPilotConsentApproved),
    clinicalGovernanceApproved: Boolean(input.clinicalGovernanceApproved),
    privacyApproved: Boolean(input.privacyApproved),
    financeApproved: Boolean(input.financeApproved),
    initialPathwayApproved: Boolean(input.initialPathwayApproved),
    initialCohortApproved: Boolean(input.initialCohortApproved),
    directorApproval: Boolean(input.directorApproval),

    formalPrivacyCommitteeApproval: Boolean(input.formalPrivacyCommitteeApproval),
    multiClinicGovernanceConfirmed: Boolean(input.multiClinicGovernanceConfirmed),
    enterpriseIncidentExerciseConfirmed: Boolean(
      input.enterpriseIncidentExerciseConfirmed
    ),
    enterpriseSegregationOfDutiesConfirmed: Boolean(
      input.enterpriseSegregationOfDutiesConfirmed
    ),
    enterpriseIntegrationApprovalsConfirmed: Boolean(
      input.enterpriseIntegrationApprovalsConfirmed
    ),
    enterpriseStagedRolloutApproved: Boolean(input.enterpriseStagedRolloutApproved),

    eligibleForGovernanceReview: false,
    approvedForInitialInvites: false,
    blockers: [],
    warnings: [
      ...(input.warnings ?? []),
      `governance_tier:${governanceTier}`,
    ],
    evaluatedAt,
    version: PILOT_ACTIVATION_VERSION,
  };

  if (governanceTier === "small_team_pilot") {
    gate.warnings.push(
      "small_team_pilot_formal_docs_not_mandatory",
      "larger_tenant_templates_remain_available"
    );
  }

  const blockers: string[] = [];
  for (const key of SOFTWARE_FIELDS) {
    if (!gate[key]) blockers.push(`software_gate:${key}`);
  }

  // Only tier-required human fields block invite readiness.
  for (const key of profile.required) {
    const value = readGateFlag(gate, key);
    if (!value) blockers.push(`human_gate:${key}`);
  }

  const critical = input.criticalBlockers ?? [];
  for (const c of critical) {
    blockers.push(`critical:${c}`);
  }

  gate.blockers = blockers;

  const softwareComplete = SOFTWARE_FIELDS.every((k) => gate[k]);
  const humanComplete = profile.required.every((k) => readGateFlag(gate, k));
  const noCritical = critical.length === 0;

  // Software may compute eligibility for governance review when technical
  // evidence is complete and no critical blockers exist. Human fields may
  // still be pending — governance review is the place to record them.
  gate.eligibleForGovernanceReview =
    softwareComplete &&
    noCritical &&
    blockers.filter((b) => b.startsWith("software_gate:")).length === 0;

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
    governanceTier: DEFAULT_PILOT_GOVERNANCE_TIER,
    controlCentreAccepted: true,
    migrationsApplied: true,
    tenantIsolationProven: true,
    roleMatrixProven: true,
    financeRoleMappingCorrect: true,
    exportSurfaceProven: true,
    identityPreflightProven: true,
    financePreflightProven: true,
    consentControlsProven: true,
    eventCoverageSufficient: true,

    teamBriefingCompleted: true,
    clinicalWorkflowConfirmed: true,
    financeWorkflowConfirmed: true,
    supportContactConfirmed: true,
    fallbackConfirmed: true,

    operationalSopApproved: true,
    staffTrainingCompleted: true,
    supportCoverageConfirmed: true,
    incidentResponseConfirmed: true,
    manualFallbackConfirmed: true,
    rollbackConfirmed: true,
    patientPilotConsentApproved: true,
    clinicalGovernanceApproved: true,
    privacyApproved: true,
    financeApproved: true,
    initialPathwayApproved: true,
    initialCohortApproved: true,
    directorApproval: true,

    formalPrivacyCommitteeApproval: true,
    multiClinicGovernanceConfirmed: true,
    enterpriseIncidentExerciseConfirmed: true,
    enterpriseSegregationOfDutiesConfirmed: true,
    enterpriseIntegrationApprovalsConfirmed: true,
    enterpriseStagedRolloutApproved: true,

    humanApprovedForInitialInvites: false,
    criticalBlockers: [],
    warnings: [],
  };
  return { ...base, ...overrides };
}

export { ALL_HUMAN_FIELDS };

function readGateFlag(
  gate: ControlledPilotActivationGate,
  key: string
): boolean {
  return Boolean((gate as unknown as Record<string, unknown>)[key]);
}
