/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.3 — operational blocker contracts.
 * Pure module. Derived from 1A.2 readiness signals; not a competing clinical/financial SoR.
 */

import type {
  PilotBlockerAssignmentSource,
  PilotBlockerCategory,
  PilotBlockerDimension,
  PilotBlockerOwner,
  PilotBlockerResolutionState,
  PilotBlockerSeverity,
  PilotEscalationLevel,
  PilotEscalationThresholds,
  PilotSourceModule,
} from "../pilotControlContracts";
import type {
  PilotJourneyStage,
  PilotPatientReadiness,
  ReadinessProvenance,
} from "../readiness/readinessTypes";
import { BLOCKER_EVALUATION_VERSION } from "../pilotControlContracts";

export { BLOCKER_EVALUATION_VERSION };

/** Alias used in 1A.3 — same frozen module set as readiness. */
export type PilotSourceSystem = PilotSourceModule;

export type PilotBlockerOwnership = {
  ownerType: PilotBlockerOwner;
  ownerUserId?: string;
  ownerRole?: string;
  assignmentSource: PilotBlockerAssignmentSource;
  ownershipReason: string;
  /** Clinic-side monitor when primary owner is the patient. */
  monitoringOwnerType?: PilotBlockerOwner;
  /** Owner that receives escalation when thresholds are breached. */
  escalationOwnerType?: PilotBlockerOwner;
};

export type PilotEscalationState = {
  level: PilotEscalationLevel;
  escalated: boolean;
  escalatedAt?: string;
  thresholdKey?: string;
  thresholdSeconds?: number;
  escalationOwnerType?: PilotBlockerOwner;
  escalationReason?: string;
  requiresPilotPause: boolean;
  requiresImmediateReview: boolean;
};

/**
 * Canonical operational blocker record (1A.3).
 * Answers: what is blocked, why, who owns next action, how long unresolved.
 */
export type PilotBlockerRecord = {
  blockerKey: string;
  fingerprint: string;

  programmeId: string;
  enrolmentId: string;
  tenantId: string;
  patientId: string;

  category: PilotBlockerCategory;
  subcategory?: string;

  title: string;
  summary: string;
  /** Patient-safe wording when permitted; omit for critical identity/privacy. */
  patientSafeSummary?: string;
  recommendedNextAction: string;

  sourceModule: PilotSourceSystem;
  sourceRecordId?: string;
  sourceSignalKey?: string;

  dimension: PilotBlockerDimension;

  severity: PilotBlockerSeverity;
  state: PilotBlockerResolutionState;

  ownership: PilotBlockerOwnership;

  firstDetectedAt: string;
  lastConfirmedAt: string;
  ageSeconds: number;

  escalation: PilotEscalationState;

  provenance: ReadinessProvenance[];
  correlationIds: string[];

  detectedByVersion: string;
  evaluatedAt: string;

  /** Critical integrity / safety latch — never reduced by acknowledgement alone. */
  criticalIntegrity: boolean;

  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolutionReason?: string;
  supersededBy?: string;
  dismissalReason?: string;
  dismissedBy?: string;
};

/**
 * Recurrence policy (1A.3):
 *
 * When a fingerprint was previously resolved/superseded/dismissed and the same
 * source condition returns, create a **new occurrence** (new row / new firstDetectedAt).
 * Do not reopen the terminal row. Active uniqueness is enforced on open/acknowledged/
 * in_progress fingerprints only. This preserves audit history and accurate ageing
 * for the new episode.
 */
export const BLOCKER_RECURRENCE_POLICY = {
  mode: "new_occurrence_on_reopen" as const,
  preservesTerminalHistory: true,
  resetsAgeOnNewOccurrence: true,
  version: BLOCKER_EVALUATION_VERSION,
};

export type PilotBlockerCandidate = {
  blockerKey: string;
  fingerprintParts: {
    programmeId: string;
    tenantId: string;
    patientId: string;
    category: PilotBlockerCategory;
    sourceModule: PilotSourceSystem;
    sourceSignalKey: string;
    sourceRecordId?: string;
    milestoneContext: string;
  };
  category: PilotBlockerCategory;
  subcategory?: string;
  dimension: PilotBlockerDimension;
  sourceModule: PilotSourceSystem;
  sourceRecordId?: string;
  sourceSignalKey: string;
  title: string;
  summary: string;
  patientSafeSummary?: string;
  recommendedNextAction: string;
  baseSeverity: PilotBlockerSeverity;
  criticalIntegrity: boolean;
  dismissalAllowed: boolean;
  patientSafeSummaryAllowed: boolean;
  requiresPilotPauseHint: boolean;
  defaultOwnerType: PilotBlockerOwner;
  monitoringOwnerType?: PilotBlockerOwner;
  escalationOwnerType?: PilotBlockerOwner;
  provenance: ReadinessProvenance[];
  correlationIds: string[];
  /** Canonical assignee from source record when known. */
  canonicalAssigneeUserId?: string;
  canonicalAssigneeRole?: string;
  /** Signal status that produced this candidate (for resolution checks). */
  sourceStatus: string;
  journeyStage: PilotJourneyStage;
};

export type PilotBlockerHealthInput = {
  openBySeverity: {
    info: number;
    attention: number;
    high: number;
    critical: number;
  };
  oldestOpenAgeSeconds: number;
  overduePatientActions: number;
  overdueClinicActions: number;
  unresolvedIdentityIssues: number;
  unresolvedFinancialIntegrityIssues: number;
  unresolvedClinicalSafetyIssues: number;
  blockersRequiringPilotPause: number;
  blockerBacklogTrend?: "improving" | "stable" | "worsening" | "unknown";
};

export type PilotPatientBlockerEvaluation = {
  programmeId: string;
  enrolmentId: string;
  tenantId: string;
  patientId: string;
  readiness: PilotPatientReadiness;
  activeBlockers: PilotBlockerRecord[];
  recentlyResolved: PilotBlockerRecord[];
  healthInput: PilotBlockerHealthInput;
  evaluatedAt: string;
  evaluationVersion: string;
  enrolled: true;
};

export type PilotPatientBlockerNotEnrolled = {
  tenantId: string;
  programmeId: string;
  patientId: string;
  enrolled: false;
  activeBlockers: [];
  recentlyResolved: [];
  evaluatedAt: string;
  evaluationVersion: string;
};

export type PaginatedPilotBlockerEvaluation = {
  tenantId: string;
  programmeId: string;
  page: number;
  pageSize: number;
  total: number;
  items: PilotPatientBlockerEvaluation[];
  cohortHealthInput: PilotBlockerHealthInput;
  evaluatedAt: string;
  evaluationVersion: string;
};

export type BlockerProgrammeContext = {
  programmeId: string;
  tenantId: string;
  escalationThresholds: PilotEscalationThresholds;
  /** IANA timezone for business-hour ageing. Evolved default: Australia/Brisbane. */
  clinicTimezone: string;
  enrolmentStatus: string;
  enrolmentPaused: boolean;
  /** Optional procedure / surgery start (ISO UTC). */
  procedureAt?: string | null;
  /** Canonical operational owner from enrolment when present. */
  operationalOwnerUserId?: string | null;
  operationalOwnerRole?: string | null;
};

export type PersistedBlockerSnapshot = {
  fingerprint: string;
  programmeId: string;
  enrolmentId: string;
  tenantId: string;
  patientId: string;
  category: PilotBlockerCategory;
  subcategory?: string | null;
  dimension: PilotBlockerDimension;
  sourceModule: PilotSourceSystem;
  sourceRecordId?: string | null;
  sourceSignalKey?: string | null;
  title: string;
  summary: string;
  recommendedNextAction: string;
  severity: PilotBlockerSeverity;
  state: PilotBlockerResolutionState;
  ownerType: PilotBlockerOwner;
  ownerUserId?: string | null;
  ownerRole?: string | null;
  assignmentSource: PilotBlockerAssignmentSource;
  ownershipReason: string;
  firstDetectedAt: string;
  lastConfirmedAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  resolutionReason?: string | null;
  supersededBy?: string | null;
  escalationLevel: PilotEscalationLevel;
  escalatedAt?: string | null;
  thresholdKey?: string | null;
  requiresPilotPause: boolean;
  requiresImmediateReview: boolean;
  provenanceJson: ReadinessProvenance[];
  correlationIds: string[];
  detectedByVersion: string;
  criticalIntegrity: boolean;
  id?: string;
};

export const BLOCKER_BINDING_STATUSES = [
  "wired",
  "wired_with_limitation",
  "contract_only",
  "source_unavailable",
  "not_applicable",
] as const;

export type BlockerBindingStatus = (typeof BLOCKER_BINDING_STATUSES)[number];
