/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1 — deterministic pilot health verdict (pure).
 * Score never overrides a critical fail-closed rule.
 */

import {
  DEFAULT_PILOT_ESCALATION_THRESHOLDS,
  type PilotEscalationThresholds,
  type PilotHealthVerdict,
} from "./pilotControlContracts";
import {
  countOpenHighBlockers,
  hasCriticalIntegrityBlocker,
  type PilotHealthBlockerLike,
} from "./pilotBlockerCore";

export type PilotHealthDimensions = {
  patientActivationRate: number | null;
  journeyProgressing: boolean;
  actionCompletionHealthy: boolean;
  clinicalSafetyOk: boolean;
  financialReadinessHealthy: boolean;
  communicationResponsive: boolean;
  technicalCompletionRate: number | null;
  dataIntegrityOk: boolean;
  staffAdoptionHealthy: boolean;
  exceptionBacklogHealthy: boolean;
};

export type PilotHealthInput = {
  blockers: readonly PilotHealthBlockerLike[];
  dimensions: PilotHealthDimensions;
  thresholds?: Partial<PilotEscalationThresholds> | null;
  /** Explicit critical safety latch from identity / wrong-patient proofs. */
  criticalSafetyLatch?: boolean;
};

export type PilotHealthResult = {
  verdict: PilotHealthVerdict;
  score: number;
  reasons: string[];
  criticalFailClosed: boolean;
};

/**
 * Score is advisory only. Any critical integrity / safety latch forces RED.
 */
export function derivePilotHealthVerdict(input: PilotHealthInput): PilotHealthResult {
  const thresholds = {
    ...DEFAULT_PILOT_ESCALATION_THRESHOLDS,
    ...(input.thresholds ?? {}),
  };
  const reasons: string[] = [];

  const critical =
    Boolean(input.criticalSafetyLatch) ||
    hasCriticalIntegrityBlocker(input.blockers) ||
    !input.dimensions.dataIntegrityOk ||
    !input.dimensions.clinicalSafetyOk;

  if (critical) {
    if (input.criticalSafetyLatch) reasons.push("critical_safety_latch");
    if (hasCriticalIntegrityBlocker(input.blockers)) reasons.push("critical_blocker_open");
    if (!input.dimensions.dataIntegrityOk) reasons.push("data_integrity_failed");
    if (!input.dimensions.clinicalSafetyOk) reasons.push("clinical_safety_failed");
    return {
      verdict: "RED",
      score: 0,
      reasons,
      criticalFailClosed: true,
    };
  }

  const highCount = countOpenHighBlockers(input.blockers);
  const techRate = input.dimensions.technicalCompletionRate;
  const techOk =
    techRate == null || techRate >= thresholds.technical_completion_rate_green_min;

  let score = 100;
  if (highCount > 0) {
    score -= Math.min(40, highCount * 8);
    reasons.push(`high_blockers:${highCount}`);
  }
  if (!input.dimensions.journeyProgressing) {
    score -= 15;
    reasons.push("journey_stalled");
  }
  if (!input.dimensions.actionCompletionHealthy) {
    score -= 10;
    reasons.push("action_backlog");
  }
  if (!input.dimensions.financialReadinessHealthy) {
    score -= 10;
    reasons.push("financial_readiness_weak");
  }
  if (!input.dimensions.communicationResponsive) {
    score -= 8;
    reasons.push("communication_lag");
  }
  if (!techOk) {
    score -= 15;
    reasons.push("technical_reliability_below_threshold");
  }
  if (!input.dimensions.staffAdoptionHealthy) {
    score -= 10;
    reasons.push("staff_adoption_low");
  }
  if (!input.dimensions.exceptionBacklogHealthy) {
    score -= 12;
    reasons.push("exception_backlog");
  }
  if (
    input.dimensions.patientActivationRate != null &&
    input.dimensions.patientActivationRate < 0.5
  ) {
    score -= 10;
    reasons.push("activation_rate_low");
  }

  score = Math.max(0, Math.min(100, score));

  const amber =
    highCount > thresholds.high_blocker_amber_limit ||
    !techOk ||
    !input.dimensions.staffAdoptionHealthy ||
    !input.dimensions.exceptionBacklogHealthy ||
    !input.dimensions.journeyProgressing ||
    highCount > 0;

  if (amber) {
    if (highCount > thresholds.high_blocker_amber_limit) {
      reasons.push("high_blocker_limit_exceeded");
    }
    return {
      verdict: "AMBER",
      score,
      reasons: reasons.length ? reasons : ["operational_concern"],
      criticalFailClosed: false,
    };
  }

  return {
    verdict: "GREEN",
    score,
    reasons: reasons.length ? reasons : ["within_thresholds"],
    criticalFailClosed: false,
  };
}
