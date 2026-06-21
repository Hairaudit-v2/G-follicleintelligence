/**
 * Clinical assignment eligibility gate — powers future rostering and surgery assignment.
 */

import {
  WORKFORCE_CLINICAL_ASSIGNMENT_MIN_SCORE,
  type WorkforceReadinessBandId,
} from "@/src/lib/workforce-os/workforceReadinessBands";
import {
  calculateWorkforceReadinessScore,
  type WorkforceReadinessScoreInput,
  type WorkforceReadinessScoreResult,
  type WorkforceReadinessWarning,
} from "@/src/lib/workforce-os/workforceReadinessEngine";

export type StaffClinicalAssignmentResult = {
  eligible: boolean;
  score: number;
  band: WorkforceReadinessBandId;
  bandLabel: string;
  blocking_issues: WorkforceReadinessScoreResult["blocking_issues"];
  warnings: WorkforceReadinessWarning[];
  reason: string | null;
};

/**
 * Determines whether a staff member can be assigned to clinical work (surgery, rostering).
 * Requires score ≥ 70, no hard blocking issues, and not in restricted/not-eligible bands.
 */
export function canStaffBeAssignedClinically(
  input: WorkforceReadinessScoreInput
): StaffClinicalAssignmentResult {
  const readiness = calculateWorkforceReadinessScore(input);

  if (readiness.blocking_issues.length > 0) {
    return {
      eligible: false,
      score: readiness.score,
      band: readiness.band,
      bandLabel: readiness.bandLabel,
      blocking_issues: readiness.blocking_issues,
      warnings: readiness.warnings,
      reason: "Hard blocking issue present",
    };
  }

  if (readiness.score < WORKFORCE_CLINICAL_ASSIGNMENT_MIN_SCORE) {
    return {
      eligible: false,
      score: readiness.score,
      band: readiness.band,
      bandLabel: readiness.bandLabel,
      blocking_issues: readiness.blocking_issues,
      warnings: readiness.warnings,
      reason: `Readiness score below ${WORKFORCE_CLINICAL_ASSIGNMENT_MIN_SCORE}`,
    };
  }

  if (readiness.band === "restricted_assignment" || readiness.band === "not_eligible") {
    return {
      eligible: false,
      score: readiness.score,
      band: readiness.band,
      bandLabel: readiness.bandLabel,
      blocking_issues: readiness.blocking_issues,
      warnings: readiness.warnings,
      reason: `Readiness band: ${readiness.bandLabel}`,
    };
  }

  return {
    eligible: true,
    score: readiness.score,
    band: readiness.band,
    bandLabel: readiness.bandLabel,
    blocking_issues: readiness.blocking_issues,
    warnings: readiness.warnings,
    reason: null,
  };
}
