/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — real-patient invitation gate (pure).
 * Software may calculate completeness. It must never set human approvals,
 * invite patients, flip real_patient_invites_enabled, or activate the programme.
 */

import type { RealPatientPilotGate } from "./adoptionTypes";

export type RealPatientPilotGateInput = {
  technicalAcceptance?: boolean;
  migrationsApplied?: boolean;
  tenantIsolationProven?: boolean;
  roleMatrixProven?: boolean;
  identityIntegrityProven?: boolean;
  financeIntegrityProven?: boolean;
  consentControlsProven?: boolean;
  /** Human approvals — never auto-set by software. */
  clinicalGovernanceApproved?: boolean;
  privacyApproved?: boolean;
  operationalSopApproved?: boolean;
  staffTrainingCompleted?: boolean;
  supportCoverageConfirmed?: boolean;
  incidentResponseConfirmed?: boolean;
  rollbackConfirmed?: boolean;
  pilotCohortApproved?: boolean;
  directorApproval?: boolean;
};

const SOFTWARE_GATES = [
  "technicalAcceptance",
  "migrationsApplied",
  "tenantIsolationProven",
  "roleMatrixProven",
  "identityIntegrityProven",
  "financeIntegrityProven",
  "consentControlsProven",
] as const;

const HUMAN_GATES = [
  "clinicalGovernanceApproved",
  "privacyApproved",
  "operationalSopApproved",
  "staffTrainingCompleted",
  "supportCoverageConfirmed",
  "incidentResponseConfirmed",
  "rollbackConfirmed",
  "pilotCohortApproved",
  "directorApproval",
] as const;

/**
 * Compute gate completeness. Human approval flags default to false —
 * the engine never invents them.
 */
export function evaluateRealPatientPilotGate(
  input: RealPatientPilotGateInput = {}
): RealPatientPilotGate {
  const gate: RealPatientPilotGate = {
    technicalAcceptance: Boolean(input.technicalAcceptance),
    migrationsApplied: Boolean(input.migrationsApplied),
    tenantIsolationProven: Boolean(input.tenantIsolationProven),
    roleMatrixProven: Boolean(input.roleMatrixProven),
    identityIntegrityProven: Boolean(input.identityIntegrityProven),
    financeIntegrityProven: Boolean(input.financeIntegrityProven),
    consentControlsProven: Boolean(input.consentControlsProven),
    clinicalGovernanceApproved: Boolean(input.clinicalGovernanceApproved),
    privacyApproved: Boolean(input.privacyApproved),
    operationalSopApproved: Boolean(input.operationalSopApproved),
    staffTrainingCompleted: Boolean(input.staffTrainingCompleted),
    supportCoverageConfirmed: Boolean(input.supportCoverageConfirmed),
    incidentResponseConfirmed: Boolean(input.incidentResponseConfirmed),
    rollbackConfirmed: Boolean(input.rollbackConfirmed),
    pilotCohortApproved: Boolean(input.pilotCohortApproved),
    directorApproval: Boolean(input.directorApproval),
    eligible: false,
    blockers: [],
  };

  const blockers: string[] = [];
  for (const key of SOFTWARE_GATES) {
    if (!gate[key]) blockers.push(`software_gate:${key}`);
  }
  for (const key of HUMAN_GATES) {
    if (!gate[key]) blockers.push(`human_gate:${key}`);
  }

  gate.blockers = blockers;
  gate.eligible = blockers.length === 0;
  return gate;
}

/** Recommended initial live cohort model — documentation helper, not enrolment. */
export const RECOMMENDED_INITIAL_PILOT_COHORT = {
  maxPatients: 5,
  minPatients: 3,
  clinics: 1,
  pathways: 1,
  requireTrainedStaff: true,
  excludeComplexIdentity: true,
  excludeUnresolvedFinancialDisputes: true,
  excludeHighRiskClinicalComplexity: true,
  excludeCrossClinicTreatment: true,
  requireExplicitPilotConsent: true,
  requireNamedOperationalOwner: true,
  requireNamedTechnicalSupport: true,
} as const;
