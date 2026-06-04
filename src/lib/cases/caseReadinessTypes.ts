/**
 * Stage 5F: read-only SurgeryOS case readiness (computed from existing case page data only).
 */

export type CaseReadinessSectionKey =
  | "case_profile"
  | "surgery_planning"
  | "procedure_day"
  | "post_op"
  | "follow_ups"
  | "images"
  | "bookings"
  | "timeline";

/** Coarse health for a section row / badge. */
export type CaseReadinessHealth = "complete" | "in_progress" | "needs_attention" | "not_started";

export type CaseReadinessCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  /** When false, omit from required denominator or style as future/optional. */
  optional?: boolean;
};

export type CaseReadinessSection = {
  key: CaseReadinessSectionKey;
  title: string;
  health: CaseReadinessHealth;
  /** Short line for the summary card. */
  summary: string;
  checks: CaseReadinessCheckItem[];
  /** Human-readable gaps (required checks only). */
  missing: string[];
  /** Required checks (non-optional) satisfied / total for this section. */
  requiredProgress: { ok: number; total: number };
};

export type CaseReadinessReport = {
  sections: CaseReadinessSection[];
  /** Required checks only: satisfied / total. */
  requiredSatisfied: number;
  requiredTotal: number;
  /** 0–100 from required checks. */
  overallPercent: number;
  /** Ordered user-facing gaps. */
  warnings: string[];
  /** Single actionable line for operators. */
  nextRecommendedStep: string;
};
