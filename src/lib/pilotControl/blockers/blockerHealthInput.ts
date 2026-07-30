/**
 * Pilot-health inputs from operational blockers (1A.3).
 * Does not redefine GREEN/AMBER/RED — supplies counts for frozen health engine.
 */

import { openBlockers } from "../pilotBlockerCore";
import type { PilotBlockerHealthInput, PilotBlockerRecord } from "./blockerTypes";

export function buildPilotBlockerHealthInput(
  blockers: readonly PilotBlockerRecord[],
  options?: { previousOldestAgeSeconds?: number }
): PilotBlockerHealthInput {
  const active = openBlockers(blockers);

  const openBySeverity = {
    info: 0,
    attention: 0,
    high: 0,
    critical: 0,
  };
  for (const b of active) {
    openBySeverity[b.severity] += 1;
  }

  let oldestOpenAgeSeconds = 0;
  for (const b of active) {
    if (b.ageSeconds > oldestOpenAgeSeconds) oldestOpenAgeSeconds = b.ageSeconds;
  }

  const overduePatientActions = active.filter(
    (b) =>
      b.category === "patient_action_overdue" || b.category === "patient_activation"
  ).length;
  const overdueClinicActions = active.filter(
    (b) => b.category === "clinic_action_overdue"
  ).length;
  const unresolvedIdentityIssues = active.filter(
    (b) => b.dimension === "identity" || b.category === "identity"
  ).length;
  const unresolvedFinancialIntegrityIssues = active.filter(
    (b) =>
      b.category === "payment_reconciliation" ||
      (b.dimension === "financial" && (b.criticalIntegrity || b.severity === "critical"))
  ).length;
  const unresolvedClinicalSafetyIssues = active.filter(
    (b) =>
      b.dimension === "clinical" ||
      b.category === "pathology" ||
      b.category === "clinical_review" ||
      b.category === "medication" ||
      b.category === "consent"
  ).length;
  const blockersRequiringPilotPause = active.filter(
    (b) => b.escalation.requiresPilotPause || b.criticalIntegrity
  ).length;

  let blockerBacklogTrend: PilotBlockerHealthInput["blockerBacklogTrend"] = "unknown";
  if (options?.previousOldestAgeSeconds != null) {
    if (oldestOpenAgeSeconds < options.previousOldestAgeSeconds) {
      blockerBacklogTrend = "improving";
    } else if (oldestOpenAgeSeconds > options.previousOldestAgeSeconds) {
      blockerBacklogTrend = "worsening";
    } else {
      blockerBacklogTrend = "stable";
    }
  }

  return {
    openBySeverity,
    oldestOpenAgeSeconds,
    overduePatientActions,
    overdueClinicActions,
    unresolvedIdentityIssues,
    unresolvedFinancialIntegrityIssues,
    unresolvedClinicalSafetyIssues,
    blockersRequiringPilotPause,
    blockerBacklogTrend,
  };
}

export function mergeCohortHealthInputs(
  inputs: readonly PilotBlockerHealthInput[]
): PilotBlockerHealthInput {
  const openBySeverity = { info: 0, attention: 0, high: 0, critical: 0 };
  let oldestOpenAgeSeconds = 0;
  let overduePatientActions = 0;
  let overdueClinicActions = 0;
  let unresolvedIdentityIssues = 0;
  let unresolvedFinancialIntegrityIssues = 0;
  let unresolvedClinicalSafetyIssues = 0;
  let blockersRequiringPilotPause = 0;

  for (const i of inputs) {
    openBySeverity.info += i.openBySeverity.info;
    openBySeverity.attention += i.openBySeverity.attention;
    openBySeverity.high += i.openBySeverity.high;
    openBySeverity.critical += i.openBySeverity.critical;
    oldestOpenAgeSeconds = Math.max(oldestOpenAgeSeconds, i.oldestOpenAgeSeconds);
    overduePatientActions += i.overduePatientActions;
    overdueClinicActions += i.overdueClinicActions;
    unresolvedIdentityIssues += i.unresolvedIdentityIssues;
    unresolvedFinancialIntegrityIssues += i.unresolvedFinancialIntegrityIssues;
    unresolvedClinicalSafetyIssues += i.unresolvedClinicalSafetyIssues;
    blockersRequiringPilotPause += i.blockersRequiringPilotPause;
  }

  return {
    openBySeverity,
    oldestOpenAgeSeconds,
    overduePatientActions,
    overdueClinicActions,
    unresolvedIdentityIssues,
    unresolvedFinancialIntegrityIssues,
    unresolvedClinicalSafetyIssues,
    blockersRequiringPilotPause,
    blockerBacklogTrend: "unknown",
  };
}
