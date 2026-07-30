/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — assemble health response from frozen rules (pure).
 * Does not redefine GREEN/AMBER/RED — consumes derivePilotHealthVerdict.
 */

import {
  PILOT_HEALTH_RULE_VERSION,
  type PilotEnrolmentStatus,
  type PilotHealthVerdict,
} from "../pilotControlContracts";
import { derivePilotHealthVerdict, type PilotHealthDimensions } from "../pilotHealthCore";
import { computeActivationRate, countEnrolmentsByStatus } from "../pilotEnrolmentCore";
import type { PilotBlockerHealthInput, PilotBlockerRecord } from "../blockers/blockerTypes";
import { buildPilotBlockerHealthInput } from "../blockers/blockerHealthInput";
import type { PilotControlHealthResponse } from "./pilotControlApiTypes";

export type AssemblePilotHealthArgs = {
  programmeStatus: string;
  enrolments: readonly { enrolmentStatus: PilotEnrolmentStatus }[];
  blockers: readonly PilotBlockerRecord[];
  /** When true, treat as synthetic fixture — not live operational proof. */
  syntheticEvidenceOnly?: boolean;
  evaluatedAt?: string;
  previousOldestAgeSeconds?: number;
};

function dim(
  ok: boolean,
  evidence: string,
  insufficient?: boolean
): { status: string; evidence: string } {
  if (insufficient) return { status: "insufficient_evidence", evidence };
  return { status: ok ? "ok" : "attention", evidence };
}

/**
 * Build health API payload. Empty / planned programmes never return misleading GREEN.
 */
export function assemblePilotControlHealth(
  args: AssemblePilotHealthArgs
): PilotControlHealthResponse {
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const counts = countEnrolmentsByStatus(args.enrolments);
  const realOps =
    counts.approved +
    counts.invited +
    counts.activated +
    counts.active +
    counts.paused +
    counts.completed;
  const blockerInputs = buildPilotBlockerHealthInput(args.blockers, {
    previousOldestAgeSeconds: args.previousOldestAgeSeconds,
  });

  const activationRate = computeActivationRate({
    invited: counts.invited,
    activated: counts.activated,
    active: counts.active,
  });

  const insufficientEvidence =
    realOps === 0 ||
    args.programmeStatus === "planned" ||
    args.syntheticEvidenceOnly === true;

  const stopConditions: PilotControlHealthResponse["stopConditions"] = [];
  if (blockerInputs.unresolvedIdentityIssues > 0) {
    stopConditions.push({
      code: "identity_integrity",
      message: "Unresolved identity integrity blockers are open.",
      severity: "critical",
    });
  }
  if (blockerInputs.blockersRequiringPilotPause > 0) {
    stopConditions.push({
      code: "pilot_pause_recommended",
      message: "One or more blockers recommend pausing the pilot.",
      severity: "critical",
    });
  }
  if (blockerInputs.unresolvedClinicalSafetyIssues > 0 && blockerInputs.openBySeverity.critical > 0) {
    stopConditions.push({
      code: "clinical_safety",
      message: "Critical clinical safety blockers are open.",
      severity: "critical",
    });
  }

  if (insufficientEvidence) {
    return {
      verdict: "AMBER",
      score: undefined,
      dimensions: emptyInsufficientDimensions(activationRate, blockerInputs),
      blockerInputs,
      stopConditions,
      expansionRecommendation: "insufficient_evidence",
      evaluatedAt,
      ruleVersion: PILOT_HEALTH_RULE_VERSION,
    };
  }

  const dimensionsInput: PilotHealthDimensions = {
    patientActivationRate: activationRate,
    journeyProgressing: blockerInputs.overdueClinicActions === 0,
    actionCompletionHealthy:
      blockerInputs.overduePatientActions + blockerInputs.overdueClinicActions === 0,
    clinicalSafetyOk: blockerInputs.unresolvedClinicalSafetyIssues === 0,
    financialReadinessHealthy: blockerInputs.unresolvedFinancialIntegrityIssues === 0,
    communicationResponsive: true,
    technicalCompletionRate: null,
    dataIntegrityOk: blockerInputs.unresolvedIdentityIssues === 0,
    staffAdoptionHealthy: true,
    exceptionBacklogHealthy:
      blockerInputs.openBySeverity.high <= 5 && blockerInputs.openBySeverity.critical === 0,
  };

  const criticalSafetyLatch = stopConditions.some((s) => s.severity === "critical");
  const result = derivePilotHealthVerdict({
    blockers: args.blockers.map((b) => ({
      id: b.fingerprint,
      tenantId: b.tenantId,
      patientId: b.patientId,
      category: b.category,
      severity: b.severity,
      sourceModule: b.sourceModule,
      sourceRecordType: null,
      sourceRecordId: b.sourceRecordId ?? null,
      firstDetectedAt: b.firstDetectedAt,
      lastConfirmedAt: b.lastConfirmedAt,
      owner: b.ownership.ownerType,
      recommendedNextAction: b.recommendedNextAction,
      resolutionState: b.state,
      criticalIntegrity: b.criticalIntegrity,
    })),
    dimensions: dimensionsInput,
    criticalSafetyLatch,
  });

  let expansionRecommendation: PilotControlHealthResponse["expansionRecommendation"] =
    "continue_current_scope";
  if (result.verdict === "RED" || blockerInputs.blockersRequiringPilotPause > 0) {
    expansionRecommendation = "pause_pilot";
  } else if (result.verdict === "AMBER") {
    expansionRecommendation = "hold_expansion";
  }

  return {
    verdict: result.verdict,
    score: result.score,
    dimensions: {
      activation: dim(
        activationRate == null || activationRate >= 0.5,
        activationRate == null ? "no_invites" : `activation_rate=${activationRate.toFixed(2)}`
      ),
      journeyProgression: dim(dimensionsInput.journeyProgressing, "journey_signal"),
      actionCompletion: dim(dimensionsInput.actionCompletionHealthy, "action_backlog"),
      clinicalSafety: dim(dimensionsInput.clinicalSafetyOk, "clinical_blockers"),
      financialReadiness: dim(dimensionsInput.financialReadinessHealthy, "financial_blockers"),
      communication: dim(dimensionsInput.communicationResponsive, "communication"),
      technicalReliability: dim(true, "technical_rate_unavailable"),
      dataIntegrity: dim(dimensionsInput.dataIntegrityOk, "identity_blockers"),
      staffAdoption: dim(dimensionsInput.staffAdoptionHealthy, "staff_adoption"),
      blockerBacklog: dim(
        dimensionsInput.exceptionBacklogHealthy,
        `open_high=${blockerInputs.openBySeverity.high};open_critical=${blockerInputs.openBySeverity.critical}`
      ),
    },
    blockerInputs,
    stopConditions,
    expansionRecommendation,
    evaluatedAt,
    ruleVersion: PILOT_HEALTH_RULE_VERSION,
  };
}

function emptyInsufficientDimensions(
  activationRate: number | null,
  blockerInputs: PilotBlockerHealthInput
): PilotControlHealthResponse["dimensions"] {
  const evidence = "No real pilot enrolments or live patient activity";
  return {
    activation: dim(false, evidence, true),
    journeyProgression: dim(false, evidence, true),
    actionCompletion: dim(false, evidence, true),
    clinicalSafety: dim(true, "no_live_clinical_signal", true),
    financialReadiness: dim(true, "no_live_financial_signal", true),
    communication: dim(false, evidence, true),
    technicalReliability: dim(false, evidence, true),
    dataIntegrity: dim(
      blockerInputs.unresolvedIdentityIssues === 0,
      "no_live_cohort",
      true
    ),
    staffAdoption: dim(false, evidence, true),
    blockerBacklog: dim(true, `activation_rate=${activationRate}`, true),
  };
}

export function mapHealthVerdictForPauseVisibility(
  health: PilotControlHealthResponse,
  canSeePause: boolean
): PilotControlHealthResponse {
  if (canSeePause) return health;
  return {
    ...health,
    expansionRecommendation:
      health.expansionRecommendation === "pause_pilot"
        ? "hold_expansion"
        : health.expansionRecommendation,
    stopConditions: health.stopConditions.filter((s) => s.code !== "pilot_pause_recommended"),
  };
}

export type { PilotHealthVerdict };
