/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — expansion recommendation (pure).
 * Critical stop conditions override numerical scores. Never auto-invites patients.
 */

import type { PilotExpansionRecommendation } from "./adoptionTypes";
import type { PilotMetricConfidence } from "./adoptionTypes";

export type ExpansionRecommendationInput = {
  programmeStatus: string;
  liveEnrolmentCount: number;
  healthVerdict: "GREEN" | "AMBER" | "RED";
  stopConditionsCritical: boolean;
  blockersRequiringPilotPause: number;
  openHighBlockers: number;
  highBlockerAmberLimit?: number;
  evidenceConfidence: PilotMetricConfidence;
  /** Minimum live cohort days of evidence (default 14). */
  liveEvidenceDurationDays?: number;
  requiredEvidenceDurationDays?: number;
  /** Human invitation gate eligible — never auto-true from software alone. */
  invitationGateEligible?: boolean;
  technicalAcceptanceComplete?: boolean;
  operationalAcceptanceComplete?: boolean;
};

/**
 * Deterministic expansion recommendation.
 * Technical GREEN + no live cohort → insufficient_evidence / not_started.
 */
export function derivePilotExpansionRecommendation(
  input: ExpansionRecommendationInput
): PilotExpansionRecommendation {
  const highLimit = input.highBlockerAmberLimit ?? 5;
  const requiredDays = input.requiredEvidenceDurationDays ?? 14;
  const durationDays = input.liveEvidenceDurationDays ?? 0;

  if (
    input.programmeStatus === "planned" ||
    input.programmeStatus === "cancelled" ||
    input.liveEnrolmentCount === 0
  ) {
    if (input.programmeStatus === "planned" || input.liveEnrolmentCount === 0) {
      return input.programmeStatus === "planned" && input.liveEnrolmentCount === 0
        ? "not_started"
        : "insufficient_evidence";
    }
  }

  if (
    input.stopConditionsCritical ||
    input.healthVerdict === "RED" ||
    input.blockersRequiringPilotPause > 0
  ) {
    return "pause_pilot";
  }

  if (
    input.evidenceConfidence === "insufficient_evidence" ||
    input.evidenceConfidence === "synthetic_only" ||
    input.evidenceConfidence === "source_unavailable" ||
    durationDays < requiredDays
  ) {
    return "insufficient_evidence";
  }

  if (input.openHighBlockers > highLimit || input.healthVerdict === "AMBER") {
    return "hold_expansion";
  }

  if (
    input.invitationGateEligible === true &&
    input.technicalAcceptanceComplete === true &&
    input.operationalAcceptanceComplete === true &&
    input.healthVerdict === "GREEN" &&
    (input.evidenceConfidence === "live_verified" ||
      input.evidenceConfidence === "live_partial")
  ) {
    return "eligible_for_governance_review";
  }

  return "continue_current_scope";
}
