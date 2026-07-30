/**
 * Derive blocker candidates from 1A.2 readiness output (pure).
 * Does not re-implement domain readiness — consumes signals only.
 */

import type { PilotPatientReadiness, ReadinessSignalResult } from "../readiness/readinessTypes";
import { getBlockerRuleForSignal, ruleAppliesToStage } from "./blockerRules";
import type { BlockerProgrammeContext, PilotBlockerCandidate } from "./blockerTypes";

const DETECTABLE_STATUSES = new Set([
  "unknown",
  "missing",
  "pending",
  "review_required",
  "failed",
]);

/**
 * Whether a readiness signal may create a blocker candidate.
 * Optional / not_applicable / satisfied never create blockers.
 */
export function signalMayCreateBlocker(signal: ReadinessSignalResult): boolean {
  // Approved operational exceptions: overdue actions and technical delivery failures
  // may create blockers even when the readiness signal is classified optional.
  if (
    (signal.key === "patient.inactivity" ||
      signal.key === "operational.clinic_action_overdue") &&
    signal.status === "pending"
  ) {
    return true;
  }
  if (
    (signal.key === "technical.failed_push" ||
      signal.key === "technical.repeated_failure" ||
      signal.key === "technical.cross_patient_linkage") &&
    (signal.status === "failed" || signal.status === "missing" || signal.blocking)
  ) {
    return true;
  }
  if (signal.requirement === "optional" || signal.requirement === "not_applicable") {
    return false;
  }
  if (signal.status === "satisfied" || signal.status === "not_applicable") {
    return false;
  }
  if (signal.requirement === "mandatory") {
    return (
      DETECTABLE_STATUSES.has(signal.status) ||
      signal.blocking === true
    );
  }
  // conditional: only when marked blocking and in a detectable state
  return signal.blocking === true && DETECTABLE_STATUSES.has(signal.status);
}

function collectSignals(readiness: PilotPatientReadiness): ReadinessSignalResult[] {
  return [
    ...readiness.clinical.mandatorySignals,
    ...readiness.clinical.optionalSignals,
    ...readiness.financial.mandatorySignals,
    ...readiness.financial.optionalSignals,
    ...readiness.patient.mandatorySignals,
    ...readiness.patient.optionalSignals,
    ...readiness.operational.mandatorySignals,
    ...readiness.operational.optionalSignals,
    ...readiness.technical.mandatorySignals,
    ...readiness.technical.optionalSignals,
  ];
}

/**
 * Produce deterministic blocker candidates from readiness.
 * One primary category per underlying problem (rule registry enforces uniqueness by signal).
 */
export function detectBlockerCandidates(args: {
  readiness: PilotPatientReadiness;
  programme: BlockerProgrammeContext;
}): PilotBlockerCandidate[] {
  const { readiness, programme } = args;
  const stage = readiness.journeyStage;
  const candidates: PilotBlockerCandidate[] = [];
  const seenKeys = new Set<string>();

  for (const signal of collectSignals(readiness)) {
    if (!signalMayCreateBlocker(signal)) continue;

    const rule = getBlockerRuleForSignal(signal.key);
    if (!rule) continue;
    if (!ruleAppliesToStage(rule, stage)) continue;

    // Avoid duplicate candidates for the same signal key within one evaluation.
    const dedupeKey = `${signal.key}|${signal.sourceRecordId ?? ""}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    // One primary category per underlying problem: prefer patient consent over
    // operational consent gate when both fire for the same enrolment.
    if (
      signal.key === "operational.consent_gate_for_procedure" &&
      [...seenKeys].some((k) => k.startsWith("patient.mandatory_consent|"))
    ) {
      continue;
    }

    candidates.push({
      blockerKey: rule.ruleKey,
      fingerprintParts: {
        programmeId: readiness.programmeId,
        tenantId: readiness.tenantId,
        patientId: readiness.patientId,
        category: rule.category,
        sourceModule: signal.sourceSystem,
        sourceSignalKey: signal.key,
        sourceRecordId: signal.sourceRecordId,
        milestoneContext: stage,
      },
      category: rule.category,
      subcategory: signal.reasonCode,
      dimension: rule.dimension,
      sourceModule: signal.sourceSystem,
      sourceRecordId: signal.sourceRecordId,
      sourceSignalKey: signal.key,
      title: rule.title,
      summary: rule.internalSummary,
      patientSafeSummary: rule.patientSafeSummaryAllowed
        ? rule.patientSafeSummary ?? signal.patientSafeSummary
        : undefined,
      recommendedNextAction: rule.recommendedNextAction,
      baseSeverity: signal.severity === "critical" ? "critical" : rule.baseSeverity,
      criticalIntegrity:
        rule.criticalIntegrity ||
        signal.severity === "critical" ||
        readiness.identityIntegrityBlocked && rule.dimension === "identity",
      dismissalAllowed: rule.dismissalAllowed,
      patientSafeSummaryAllowed: rule.patientSafeSummaryAllowed,
      requiresPilotPauseHint: rule.requiresPilotPause,
      defaultOwnerType: rule.defaultOwner,
      monitoringOwnerType: rule.monitoringOwner,
      escalationOwnerType: rule.escalationOwner,
      provenance: signal.provenance,
      correlationIds: signal.provenance
        .map((p) => p.correlationId)
        .filter((c): c is string => Boolean(c)),
      canonicalAssigneeUserId: programme.operationalOwnerUserId ?? undefined,
      canonicalAssigneeRole: programme.operationalOwnerRole ?? undefined,
      sourceStatus: signal.status,
      journeyStage: stage,
    });
  }

  return candidates.sort((a, b) =>
    `${a.sourceSignalKey}:${a.sourceRecordId ?? ""}`.localeCompare(
      `${b.sourceSignalKey}:${b.sourceRecordId ?? ""}`
    )
  );
}
