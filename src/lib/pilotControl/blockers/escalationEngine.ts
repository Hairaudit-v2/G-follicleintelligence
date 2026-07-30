/**
 * Escalation engine (1A.3).
 * Acknowledgement does not stop escalation automatically.
 */

import type { PilotEscalationLevel, PilotEscalationThresholds } from "../pilotControlContracts";
import { effectiveAgeSeconds } from "./ageingEngine";
import { getBlockerRuleForSignal } from "./blockerRules";
import type {
  BlockerProgrammeContext,
  PilotBlockerCandidate,
  PilotBlockerRecord,
  PilotEscalationState,
} from "./blockerTypes";
import { calculateBlockerSeverity } from "./severityEngine";

export type EvaluateBlockerEscalationArgs = {
  blocker: Pick<
    PilotBlockerRecord,
    | "severity"
    | "state"
    | "firstDetectedAt"
    | "criticalIntegrity"
    | "category"
    | "sourceSignalKey"
    | "ownership"
    | "dimension"
  >;
  candidate?: PilotBlockerCandidate;
  programme: BlockerProgrammeContext;
  asOf: string;
  repeatedFailureCount?: number;
  pausedAt?: string | null;
};

function daysUntil(iso: string | null | undefined, asOf: string): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.parse(asOf);
  if (Number.isNaN(ms)) return null;
  return ms / (1000 * 60 * 60 * 24);
}

function levelFromSeverity(sev: string): PilotEscalationLevel {
  if (sev === "critical") return "critical";
  if (sev === "high") return "high";
  if (sev === "attention") return "attention";
  return "none";
}

export function evaluateBlockerEscalation(
  args: EvaluateBlockerEscalationArgs
): PilotEscalationState {
  const { blocker, programme, asOf, candidate, repeatedFailureCount = 0, pausedAt } =
    args;
  const thresholds: PilotEscalationThresholds = programme.escalationThresholds;
  const rule = blocker.sourceSignalKey
    ? getBlockerRuleForSignal(blocker.sourceSignalKey)
    : undefined;

  const age = candidate
    ? effectiveAgeSeconds({
        firstDetectedAt: blocker.firstDetectedAt,
        asOf,
        candidate,
        programme,
        pausedAt,
      })
    : Math.max(
        0,
        Math.floor((Date.parse(asOf) - Date.parse(blocker.firstDetectedAt)) / 1000)
      );

  // Critical integrity / pause conditions always escalate to critical.
  const pause =
    Boolean(rule?.requiresPilotPause) ||
    blocker.criticalIntegrity ||
    candidate?.requiresPilotPauseHint === true ||
    blocker.severity === "critical";

  if (pause && (blocker.criticalIntegrity || candidate?.criticalIntegrity || blocker.severity === "critical")) {
    return {
      level: "critical",
      escalated: true,
      escalatedAt: asOf,
      thresholdKey: "critical_integrity",
      thresholdSeconds: 0,
      escalationOwnerType:
        rule?.escalationOwner ??
        candidate?.escalationOwnerType ??
        blocker.ownership.escalationOwnerType ??
        "director",
      escalationReason: "Critical integrity or pilot-pause condition",
      requiresPilotPause: Boolean(rule?.requiresPilotPause || candidate?.requiresPilotPauseHint || blocker.criticalIntegrity),
      requiresImmediateReview: true,
    };
  }

  const surgeryDays = daysUntil(programme.procedureAt, asOf);
  const reasons: string[] = [];
  let level: PilotEscalationLevel = levelFromSeverity(blocker.severity);

  if (
    surgeryDays != null &&
    surgeryDays >= 0 &&
    surgeryDays <= thresholds.surgery_window_high_days &&
    (blocker.category === "consent" ||
      blocker.category === "financial" ||
      blocker.category === "pathology" ||
      blocker.category === "clinical_review")
  ) {
    level = "high";
    reasons.push("procedure_proximity");
  }

  const ageHigh =
    rule?.ageHighSeconds ?? thresholds.blocked_high_days * 24 * 3600;
  const ageAttention =
    rule?.ageAttentionSeconds ??
    thresholds.patient_action_overdue_attention_hours * 3600;

  if (age >= ageHigh) {
    level = level === "critical" ? "critical" : "high";
    reasons.push("age_high_threshold");
  } else if (age >= ageAttention && level === "none") {
    level = "attention";
    reasons.push("age_attention_threshold");
  }

  if (
    blocker.category === "clinic_action_overdue" &&
    age >= thresholds.clinic_action_overdue_attention_business_days * 8 * 3600
  ) {
    if (level === "none" || level === "attention") {
      level = age >= ageHigh ? "high" : "attention";
    }
    reasons.push("clinic_action_overdue");
  }

  if (
    blocker.category === "patient_action_overdue" &&
    age >= thresholds.patient_action_overdue_attention_hours * 3600
  ) {
    if (level === "none") level = "attention";
    reasons.push("patient_action_overdue");
  }

  if (repeatedFailureCount >= 3) {
    level = level === "critical" ? "critical" : "high";
    reasons.push("repeated_failure");
  }

  // Unowned high blockers escalate
  if (
    (blocker.severity === "high" || level === "high") &&
    (blocker.ownership.ownerType === "unassigned" ||
      blocker.ownership.assignmentSource === "unresolved")
  ) {
    level = "high";
    reasons.push("unowned_high_blocker");
  }

  // Acknowledgement does not clear escalation — continue ageing.
  if (blocker.state === "acknowledged" && level !== "none") {
    reasons.push("acknowledged_still_escalating");
  }

  const escalated = level === "attention" || level === "high" || level === "critical";
  const requiresPilotPause = Boolean(
    rule?.requiresPilotPause || candidate?.requiresPilotPauseHint
  );

  return {
    level,
    escalated,
    escalatedAt: escalated ? asOf : undefined,
    thresholdKey: reasons[0],
    thresholdSeconds: reasons.includes("age_high_threshold")
      ? ageHigh
      : reasons.includes("age_attention_threshold")
        ? ageAttention
        : undefined,
    escalationOwnerType:
      rule?.escalationOwner ??
      candidate?.escalationOwnerType ??
      blocker.ownership.escalationOwnerType,
    escalationReason: reasons.length ? reasons.join(",") : undefined,
    requiresPilotPause,
    requiresImmediateReview: level === "critical" || requiresPilotPause,
  };
}

/** Helper for building severity+escalation together after age is known. */
export function evaluateSeverityAndEscalation(args: {
  candidate: PilotBlockerCandidate;
  programme: BlockerProgrammeContext;
  firstDetectedAt: string;
  asOf: string;
  state: PilotBlockerRecord["state"];
  ownership: PilotBlockerRecord["ownership"];
  repeatedFailureCount?: number;
  pausedAt?: string | null;
}): { severity: ReturnType<typeof calculateBlockerSeverity>; escalation: PilotEscalationState } {
  const age = effectiveAgeSeconds({
    firstDetectedAt: args.firstDetectedAt,
    asOf: args.asOf,
    candidate: args.candidate,
    programme: args.programme,
    pausedAt: args.pausedAt,
  });
  const severity = calculateBlockerSeverity({
    candidate: args.candidate,
    programme: args.programme,
    ageSeconds: age,
    acknowledged: args.state === "acknowledged",
    repeatedFailureCount: args.repeatedFailureCount,
    asOf: args.asOf,
  });
  const escalation = evaluateBlockerEscalation({
    blocker: {
      severity,
      state: args.state,
      firstDetectedAt: args.firstDetectedAt,
      criticalIntegrity: args.candidate.criticalIntegrity,
      category: args.candidate.category,
      sourceSignalKey: args.candidate.sourceSignalKey,
      ownership: args.ownership,
      dimension: args.candidate.dimension,
    },
    candidate: args.candidate,
    programme: args.programme,
    asOf: args.asOf,
    repeatedFailureCount: args.repeatedFailureCount,
    pausedAt: args.pausedAt,
  });
  return { severity, escalation };
}
