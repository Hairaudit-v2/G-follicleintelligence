/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.2 — readiness engine contracts.
 * Pure module. Extends frozen 1A.1 enums without altering lifecycle semantics.
 */

import type {
  OverallReadinessState,
  PilotBlockerCategory,
  PilotBlockerOwner,
  PilotBlockerResolutionState,
  PilotBlockerSeverity,
  PilotControlRoleKey,
  PilotSourceModule,
} from "../pilotControlContracts";

/** Alias used in 1A.2 signal contracts — same frozen module set. */
export type PilotSourceSystem = PilotSourceModule;

export const READINESS_EVALUATION_VERSION = "1A.2.0" as const;

export const READINESS_DIMENSIONS = [
  "clinical",
  "financial",
  "patient",
  "operational",
  "technical",
] as const;

export type ReadinessDimension = (typeof READINESS_DIMENSIONS)[number];

export const READINESS_DIMENSION_STATES = [
  "not_started",
  "in_progress",
  "awaiting_review",
  "attention_required",
  "blocked",
  "ready",
  "not_applicable",
] as const;

export type ReadinessDimensionState = (typeof READINESS_DIMENSION_STATES)[number];

export const READINESS_SIGNAL_REQUIREMENTS = [
  "mandatory",
  "conditional",
  "optional",
  "not_applicable",
] as const;

export type ReadinessSignalRequirement = (typeof READINESS_SIGNAL_REQUIREMENTS)[number];

export const READINESS_SIGNAL_STATUSES = [
  "unknown",
  "missing",
  "pending",
  "review_required",
  "failed",
  "satisfied",
  "not_applicable",
] as const;

export type ReadinessSignalStatus = (typeof READINESS_SIGNAL_STATUSES)[number];

export const READINESS_OBSERVED_VALUE_CLASSES = [
  "present",
  "absent",
  "pending",
  "approved",
  "declined",
  "failed",
  "unknown",
  "not_applicable",
] as const;

export type ReadinessObservedValueClass = (typeof READINESS_OBSERVED_VALUE_CLASSES)[number];

export type ReadinessProvenance = {
  sourceSystem: PilotSourceSystem;
  sourceTable?: string;
  sourceView?: string;
  sourceRecordId?: string;
  sourceField?: string;
  observedValueClass: ReadinessObservedValueClass;
  sourceUpdatedAt?: string;
  resolverVersion: string;
  correlationId?: string;
};

export type PilotReadinessWarning = {
  code: string;
  severity: "info" | "attention" | "high";
  patientSafeSummary: string;
  sourceSystem: PilotSourceSystem;
  signalKey?: string;
};

export type PilotBlocker = {
  id: string;
  category: PilotBlockerCategory;
  severity: PilotBlockerSeverity;
  sourceSystem: PilotSourceSystem;
  sourceRecordType: string | null;
  sourceRecordId: string | null;
  owner: PilotBlockerOwner;
  recommendedNextAction: string;
  resolutionState: PilotBlockerResolutionState;
  criticalIntegrity: boolean;
  patientSafeSummary: string;
  signalKey?: string;
  firstDetectedAt: string;
  lastConfirmedAt: string;
};

export type ReadinessSignalResult = {
  key: string;
  label: string;
  sourceSystem: PilotSourceSystem;
  requirement: ReadinessSignalRequirement;
  status: ReadinessSignalStatus;
  blocking: boolean;
  severity?: "info" | "attention" | "high" | "critical";
  sourceRecordId?: string;
  sourceUpdatedAt?: string;
  reasonCode: string;
  patientSafeSummary?: string;
  provenance: ReadinessProvenance[];
  /** Why a conditional requirement applies (or does not). */
  conditionReason?: string;
};

export type ReadinessDimensionResult = {
  dimension: ReadinessDimension;
  state: ReadinessDimensionState;
  mandatorySignals: ReadinessSignalResult[];
  optionalSignals: ReadinessSignalResult[];
  blockers: PilotBlocker[];
  warnings: PilotReadinessWarning[];
  provenance: ReadinessProvenance[];
  evaluatedAt: string;
};

export type OverallReadinessResult = {
  state: OverallReadinessState;
  reasons: string[];
  failClosed: boolean;
  evaluatedAt: string;
  evaluationVersion: string;
};

export type PilotPatientReadiness = {
  programmeId: string;
  enrolmentId: string;
  tenantId: string;
  patientId: string;
  clinical: ReadinessDimensionResult;
  financial: ReadinessDimensionResult;
  patient: ReadinessDimensionResult;
  operational: ReadinessDimensionResult;
  technical: ReadinessDimensionResult;
  overall: OverallReadinessResult;
  blockers: PilotBlocker[];
  warnings: PilotReadinessWarning[];
  evaluatedAt: string;
  evaluationVersion: string;
  /** Current journey stage used for requirement gating. */
  journeyStage: PilotJourneyStage;
  identityIntegrityBlocked: boolean;
};

export type PilotJourneyStage =
  | "pre_invitation"
  | "consultation_preparation"
  | "procedure_preparation"
  | "postoperative_follow_up"
  | "completed"
  | "unknown";

export type PaginatedPilotReadinessResult = {
  tenantId: string;
  programmeId: string;
  page: number;
  pageSize: number;
  total: number;
  items: PilotPatientReadiness[];
  evaluatedAt: string;
  evaluationVersion: string;
};

export type PilotReadinessRoleProjection = {
  role: PilotControlRoleKey;
  includeClinicalProvenanceDetail: boolean;
  includeFinancialProvenanceDetail: boolean;
  patientSafeSummariesOnly: boolean;
};

/** Implementation status for machine-readable bindings register. */
export const READINESS_BINDING_STATUSES = [
  "wired",
  "wired_with_limitation",
  "contract_only",
  "source_unavailable",
  "not_applicable",
] as const;

export type ReadinessBindingStatus = (typeof READINESS_BINDING_STATUSES)[number];
