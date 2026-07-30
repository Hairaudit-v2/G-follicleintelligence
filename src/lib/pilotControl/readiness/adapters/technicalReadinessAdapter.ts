/**
 * Technical readiness — delivery failures without inventing success from silence (pure).
 */

import { buildSignal, blockerFromSignal, warningFromSignal } from "../signalHelpers";
import type { NotificationTechnicalSourceBag } from "../readinessSourceBag";
import type { PilotBlocker, PilotReadinessWarning, ReadinessSignalResult } from "../readinessTypes";

export type TechnicalAdapterResult = {
  signals: ReadinessSignalResult[];
  blockers: PilotBlocker[];
  warnings: PilotReadinessWarning[];
  technicalAttention: boolean;
};

export function resolveTechnicalSignals(args: {
  bag: NotificationTechnicalSourceBag;
  escalateAfterFailures: number;
  evaluatedAt: string;
}): TechnicalAdapterResult {
  const { bag, escalateAfterFailures, evaluatedAt } = args;
  const signals: ReadinessSignalResult[] = [];
  const blockers: PilotBlocker[] = [];
  const warnings: PilotReadinessWarning[] = [];

  const failedPush = buildSignal({
    key: "technical.failed_push",
    label: "Push notification delivery",
    sourceSystem: "notifications",
    requirement: "optional",
    status: bag.failedPushCount > 0 ? "failed" : "satisfied",
    reasonCode: bag.failedPushCount > 0 ? "push_delivery_failed" : "push_ok_or_none",
    observedValueClass: bag.failedPushCount > 0 ? "failed" : "present",
    sourceTable: "fi_patient_notification_dispatch_log",
    sourceField: "status",
    blocking: false,
    severity: bag.failedPushCount > 0 ? "attention" : undefined,
    patientSafeSummary:
      bag.failedPushCount > 0
        ? "Failed push delivery — attention required (not patient non-compliance)"
        : "No failed push deliveries observed",
  });
  signals.push(failedPush);
  if (bag.failedPushCount > 0) {
    warnings.push(
      warningFromSignal({
        signal: failedPush,
        code: "push_delivery_failed",
        severity: "attention",
      })
    );
  }

  const escalated = bag.repeatedFailureCount >= escalateAfterFailures;
  const repeated = buildSignal({
    key: "technical.repeated_failure",
    label: "Repeated technical failures",
    sourceSystem: "notifications",
    requirement: "optional",
    status: escalated ? "failed" : bag.repeatedFailureCount > 0 ? "pending" : "satisfied",
    reasonCode: escalated
      ? "technical_failure_escalated"
      : bag.repeatedFailureCount > 0
        ? "technical_failure_repeat"
        : "no_repeated_failure",
    observedValueClass: escalated
      ? "failed"
      : bag.repeatedFailureCount > 0
        ? "pending"
        : "present",
    sourceTable: "fi_patient_notification_dispatch_log",
    blocking: false,
    severity: escalated ? "high" : bag.repeatedFailureCount > 0 ? "attention" : undefined,
    patientSafeSummary: escalated
      ? "Repeated technical failures exceeded threshold — escalated"
      : "Repeated failure count within threshold",
  });
  signals.push(repeated);
  if (escalated) {
    warnings.push(
      warningFromSignal({
        signal: repeated,
        code: "technical_failure_escalated",
        severity: "high",
      })
    );
  }

  // Absence of expected success must remain unknown/pending — never infer success.
  const expected = bag.expectedSuccessEventPresent;
  const expectedSignal = buildSignal({
    key: "technical.expected_success_event",
    label: "Expected success event",
    sourceSystem: "pilot_control",
    requirement: "conditional",
    status:
      expected === true
        ? "satisfied"
        : expected === false
          ? "pending"
          : "unknown",
    reasonCode:
      expected === true
        ? "success_event_present"
        : expected === false
          ? "success_event_pending"
          : "success_event_not_expected_or_unknown",
    observedValueClass:
      expected === true ? "present" : expected === false ? "pending" : "unknown",
    sourceTable: "fi_pilot_control_events",
    blocking: false,
    conditionReason:
      expected == null
        ? "No event expected or source unavailable — not treated as success"
        : "Expected correlation event tracked",
    patientSafeSummary:
      expected === true
        ? "Expected success event observed"
        : expected === false
          ? "Expected success event pending"
          : "Success not inferred from absence of errors",
  });
  signals.push(expectedSignal);

  const cross = buildSignal({
    key: "technical.cross_patient_linkage",
    label: "Cross-patient technical linkage",
    sourceSystem: "notifications",
    requirement: "mandatory",
    status: bag.crossPatientTechnicalLinkage ? "failed" : "satisfied",
    reasonCode: bag.crossPatientTechnicalLinkage
      ? "cross_patient_technical_linkage"
      : "no_cross_patient_linkage",
    observedValueClass: bag.crossPatientTechnicalLinkage ? "failed" : "present",
    sourceTable: "fi_patient_notifications",
    blocking: bag.crossPatientTechnicalLinkage,
    severity: bag.crossPatientTechnicalLinkage ? "critical" : undefined,
    patientSafeSummary: bag.crossPatientTechnicalLinkage
      ? "Cross-patient technical linkage detected — critical"
      : "No cross-patient technical linkage",
  });
  signals.push(cross);

  if (bag.crossPatientTechnicalLinkage) {
    blockers.push(
      blockerFromSignal({
        signal: cross,
        category: "technical_failure",
        severity: "critical",
        owner: "platform",
        recommendedNextAction: "Halt and investigate cross-patient technical linkage",
        criticalIntegrity: true,
        evaluatedAt,
      })
    );
  }

  const technicalAttention =
    bag.failedPushCount > 0 || escalated || bag.crossPatientTechnicalLinkage;

  return { signals, blockers, warnings, technicalAttention };
}
