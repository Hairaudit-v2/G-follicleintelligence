/**
 * Severity calculation (1A.3). Recalculated every evaluation.
 * Critical integrity severity must not be reduced by acknowledgement alone.
 */

import type { PilotBlockerSeverity } from "../pilotControlContracts";
import { getBlockerRuleForSignal } from "./blockerRules";
import type { BlockerProgrammeContext, PilotBlockerCandidate } from "./blockerTypes";

export type SeverityContext = {
  candidate: PilotBlockerCandidate;
  programme: BlockerProgrammeContext;
  ageSeconds: number;
  acknowledged: boolean;
  /** Repeated failure count for notification/technical signals. */
  repeatedFailureCount?: number;
  asOf: string;
};

function daysUntil(iso: string | null | undefined, asOf: string): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.parse(asOf);
  if (Number.isNaN(ms)) return null;
  return ms / (1000 * 60 * 60 * 24);
}

const SEVERITY_RANK: Record<PilotBlockerSeverity, number> = {
  info: 0,
  attention: 1,
  high: 2,
  critical: 3,
};

export function maxSeverity(
  a: PilotBlockerSeverity,
  b: PilotBlockerSeverity
): PilotBlockerSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * Deterministic severity from category base + age + procedure proximity + integrity.
 */
export function calculateBlockerSeverity(ctx: SeverityContext): PilotBlockerSeverity {
  const { candidate, programme, ageSeconds, acknowledged, repeatedFailureCount = 0, asOf } =
    ctx;
  const rule = getBlockerRuleForSignal(candidate.sourceSignalKey);
  let severity = candidate.baseSeverity;

  if (candidate.criticalIntegrity) {
    return "critical";
  }

  // Repeated push failures escalate attention → high
  if (
    candidate.sourceSignalKey === "technical.failed_push" &&
    repeatedFailureCount >= 3
  ) {
    severity = maxSeverity(severity, "high");
  }
  if (candidate.sourceSignalKey === "technical.repeated_failure") {
    severity = maxSeverity(severity, "high");
  }

  const surgeryDays = daysUntil(programme.procedureAt, asOf);
  const proximityDays =
    rule?.procedureProximityHighDays ??
    programme.escalationThresholds.surgery_window_high_days;

  if (
    surgeryDays != null &&
    surgeryDays >= 0 &&
    surgeryDays <= proximityDays &&
    (candidate.category === "consent" ||
      candidate.category === "pathology" ||
      candidate.category === "financial" ||
      candidate.category === "clinical_review" ||
      candidate.category === "payment_reconciliation")
  ) {
    severity = maxSeverity(severity, "high");
  }

  const ageHigh =
    rule?.ageHighSeconds ??
    programme.escalationThresholds.blocked_high_days * 24 * 3600;
  if (ageSeconds >= ageHigh && severity !== "info") {
    severity = maxSeverity(severity, "high");
  }

  const ageAttention =
    rule?.ageAttentionSeconds ??
    programme.escalationThresholds.patient_action_overdue_attention_hours * 3600;
  if (ageSeconds >= ageAttention && severity === "info") {
    severity = "attention";
  }

  // Acknowledgement must never reduce critical integrity (already returned).
  // For other severities, acknowledgement does not reduce calculated severity.
  void acknowledged;

  return severity;
}
