/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.2 — shared signal / blocker builders (pure).
 */

import type { PilotBlockerCategory, PilotBlockerOwner, PilotBlockerSeverity } from "../pilotControlContracts";
import { makeProvenance } from "./readinessProvenance";
import type {
  PilotBlocker,
  PilotReadinessWarning,
  PilotSourceSystem,
  ReadinessObservedValueClass,
  ReadinessSignalRequirement,
  ReadinessSignalResult,
  ReadinessSignalStatus,
} from "./readinessTypes";
import { READINESS_EVALUATION_VERSION } from "./readinessTypes";

export function buildSignal(args: {
  key: string;
  label: string;
  sourceSystem: PilotSourceSystem;
  requirement: ReadinessSignalRequirement;
  status: ReadinessSignalStatus;
  reasonCode: string;
  blocking?: boolean;
  severity?: "info" | "attention" | "high" | "critical";
  sourceRecordId?: string;
  sourceUpdatedAt?: string;
  patientSafeSummary?: string;
  conditionReason?: string;
  observedValueClass: ReadinessObservedValueClass;
  sourceTable?: string;
  sourceView?: string;
  sourceField?: string;
}): ReadinessSignalResult {
  const mandatoryLike =
    args.requirement === "mandatory" || args.requirement === "conditional";
  const blocking =
    args.blocking ??
    (mandatoryLike &&
      (args.status === "missing" ||
        args.status === "failed" ||
        args.status === "unknown" ||
        args.status === "review_required" ||
        args.status === "pending") &&
      args.requirement === "mandatory");

  // Unknown mandatory must never be treated as satisfied — enforce at build time.
  const status =
    args.requirement === "mandatory" && args.status === "satisfied" && args.observedValueClass === "unknown"
      ? "unknown"
      : args.status;

  return {
    key: args.key,
    label: args.label,
    sourceSystem: args.sourceSystem,
    requirement: args.requirement,
    status,
    blocking:
      status === "satisfied" || status === "not_applicable"
        ? false
        : blocking || (args.requirement === "mandatory" && status === "unknown"),
    severity: args.severity,
    sourceRecordId: args.sourceRecordId,
    sourceUpdatedAt: args.sourceUpdatedAt,
    reasonCode: args.reasonCode,
    patientSafeSummary: args.patientSafeSummary,
    conditionReason: args.conditionReason,
    provenance: [
      makeProvenance({
        sourceSystem: args.sourceSystem,
        observedValueClass: args.observedValueClass,
        sourceTable: args.sourceTable,
        sourceView: args.sourceView,
        sourceRecordId: args.sourceRecordId,
        sourceField: args.sourceField,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }),
    ],
  };
}

export function blockerFromSignal(args: {
  signal: ReadinessSignalResult;
  category: PilotBlockerCategory;
  severity: PilotBlockerSeverity;
  owner: PilotBlockerOwner;
  recommendedNextAction: string;
  criticalIntegrity?: boolean;
  evaluatedAt: string;
  patientId?: string;
}): PilotBlocker {
  return {
    id: `blk:${args.signal.key}:${args.signal.sourceRecordId ?? "none"}`,
    category: args.category,
    severity: args.severity,
    sourceSystem: args.signal.sourceSystem,
    sourceRecordType: args.signal.provenance[0]?.sourceTable ?? null,
    sourceRecordId: args.signal.sourceRecordId ?? null,
    owner: args.owner,
    recommendedNextAction: args.recommendedNextAction,
    resolutionState: "open",
    criticalIntegrity: args.criticalIntegrity ?? args.severity === "critical",
    patientSafeSummary: args.signal.patientSafeSummary ?? args.signal.label,
    signalKey: args.signal.key,
    firstDetectedAt: args.evaluatedAt,
    lastConfirmedAt: args.evaluatedAt,
  };
}

export function warningFromSignal(args: {
  signal: ReadinessSignalResult;
  code: string;
  severity?: "info" | "attention" | "high";
}): PilotReadinessWarning {
  return {
    code: args.code,
    severity: args.severity ?? "attention",
    patientSafeSummary: args.signal.patientSafeSummary ?? args.signal.label,
    sourceSystem: args.signal.sourceSystem,
    signalKey: args.signal.key,
  };
}

/** Mandatory unknown / failed / missing signals are blocking. Optional never blocks. */
export function signalIsBlocking(signal: ReadinessSignalResult): boolean {
  if (signal.requirement === "optional" || signal.requirement === "not_applicable") {
    return false;
  }
  if (signal.status === "satisfied" || signal.status === "not_applicable") return false;
  if (signal.requirement === "mandatory") {
    return (
      signal.status === "unknown" ||
      signal.status === "missing" ||
      signal.status === "failed" ||
      signal.status === "review_required" ||
      signal.status === "pending" ||
      signal.blocking
    );
  }
  // conditional: only block when marked blocking and not satisfied
  return signal.blocking === true;
}

export function evaluationVersion(): string {
  return READINESS_EVALUATION_VERSION;
}
