/**
 * Workforce readiness band classification — maps 0–100 scores to operational tiers.
 */

import type { FiBadgeIntent } from "@/src/components/fi-design/fiDesignTokens";

export type WorkforceReadinessBandId =
  | "elite_ready"
  | "fully_ready"
  | "operational_warning"
  | "restricted_assignment"
  | "not_eligible";

export type WorkforceReadinessBandSeverity = "success" | "info" | "warning" | "danger";

export type WorkforceReadinessBand = {
  id: WorkforceReadinessBandId;
  label: string;
  minScore: number;
  maxScore: number;
  /** Maps to `fiBadgeIntentClassNames` for consistent FI badge styling. */
  variant: FiBadgeIntent;
  severity: WorkforceReadinessBandSeverity;
};

export const WORKFORCE_READINESS_BANDS: readonly WorkforceReadinessBand[] = [
  {
    id: "elite_ready",
    label: "Elite Ready",
    minScore: 95,
    maxScore: 100,
    variant: "success",
    severity: "success",
  },
  {
    id: "fully_ready",
    label: "Fully Ready",
    minScore: 85,
    maxScore: 94,
    variant: "complete",
    severity: "success",
  },
  {
    id: "operational_warning",
    label: "Operational Warning",
    minScore: 70,
    maxScore: 84,
    variant: "warning",
    severity: "warning",
  },
  {
    id: "restricted_assignment",
    label: "Restricted Assignment",
    minScore: 50,
    maxScore: 69,
    variant: "pending",
    severity: "warning",
  },
  {
    id: "not_eligible",
    label: "Not Eligible",
    minScore: 0,
    maxScore: 49,
    variant: "danger",
    severity: "danger",
  },
] as const;

/** Minimum score for clinical/surgery assignment eligibility (see `canStaffBeAssignedClinically`). */
export const WORKFORCE_CLINICAL_ASSIGNMENT_MIN_SCORE = 70;

export function clampWorkforceReadinessScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function resolveWorkforceReadinessBand(score: number): WorkforceReadinessBand {
  const clamped = clampWorkforceReadinessScore(score);
  for (const band of WORKFORCE_READINESS_BANDS) {
    if (clamped >= band.minScore && clamped <= band.maxScore) {
      return band;
    }
  }
  return WORKFORCE_READINESS_BANDS[WORKFORCE_READINESS_BANDS.length - 1]!;
}
