/**
 * Pure patient blocker evaluation from readiness (1A.3).
 * Persistence is injected; default is in-memory for tests.
 */

import {
  DEFAULT_PILOT_ESCALATION_THRESHOLDS,
  EVOLVED_PILOT_CLINIC_TIMEZONE,
  type PilotEscalationThresholds,
} from "../pilotControlContracts";
import type { PilotPatientReadiness } from "../readiness/readinessTypes";
import { buildPilotBlockerHealthInput } from "./blockerHealthInput";
import {
  BLOCKER_EVALUATION_VERSION,
  type BlockerProgrammeContext,
  type PersistedBlockerSnapshot,
  type PilotBlockerRecord,
  type PilotPatientBlockerEvaluation,
} from "./blockerTypes";
import { reconcilePilotBlockers } from "./reconcileBlockers";

function mergeThresholds(
  overrides?: Partial<PilotEscalationThresholds> | Record<string, unknown> | null
): PilotEscalationThresholds {
  return {
    ...DEFAULT_PILOT_ESCALATION_THRESHOLDS,
    ...(overrides as Partial<PilotEscalationThresholds> | null | undefined),
  };
}

export type BlockerStore = {
  loadActive(args: {
    tenantId: string;
    programmeId: string;
    enrolmentId: string;
    patientId: string;
  }): PersistedBlockerSnapshot[];
  saveReconciliation(args: {
    tenantId: string;
    programmeId: string;
    enrolmentId: string;
    patientId: string;
    upserts: PilotBlockerRecord[];
    resolved: PilotBlockerRecord[];
  }): void;
};

/** In-memory store keyed by tenant|programme|enrolment|fingerprint — for tests. */
export function createMemoryBlockerStore(): BlockerStore & {
  all(): PersistedBlockerSnapshot[];
} {
  const rows = new Map<string, PersistedBlockerSnapshot>();

  const keyOf = (r: {
    tenantId: string;
    programmeId: string;
    enrolmentId: string;
    fingerprint: string;
  }) => `${r.tenantId}|${r.programmeId}|${r.enrolmentId}|${r.fingerprint}`;

  function toSnap(b: PilotBlockerRecord): PersistedBlockerSnapshot {
    return {
      fingerprint: b.fingerprint,
      programmeId: b.programmeId,
      enrolmentId: b.enrolmentId,
      tenantId: b.tenantId,
      patientId: b.patientId,
      category: b.category,
      subcategory: b.subcategory,
      dimension: b.dimension,
      sourceModule: b.sourceModule,
      sourceRecordId: b.sourceRecordId,
      sourceSignalKey: b.sourceSignalKey,
      title: b.title,
      summary: b.summary,
      recommendedNextAction: b.recommendedNextAction,
      severity: b.severity,
      state: b.state,
      ownerType: b.ownership.ownerType,
      ownerUserId: b.ownership.ownerUserId,
      ownerRole: b.ownership.ownerRole,
      assignmentSource: b.ownership.assignmentSource,
      ownershipReason: b.ownership.ownershipReason,
      firstDetectedAt: b.firstDetectedAt,
      lastConfirmedAt: b.lastConfirmedAt,
      acknowledgedAt: b.acknowledgedAt,
      acknowledgedBy: b.acknowledgedBy,
      resolvedAt: b.resolvedAt,
      resolutionReason: b.resolutionReason,
      supersededBy: b.supersededBy,
      escalationLevel: b.escalation.level,
      escalatedAt: b.escalation.escalatedAt,
      thresholdKey: b.escalation.thresholdKey,
      requiresPilotPause: b.escalation.requiresPilotPause,
      requiresImmediateReview: b.escalation.requiresImmediateReview,
      provenanceJson: b.provenance,
      correlationIds: b.correlationIds,
      detectedByVersion: b.detectedByVersion,
      criticalIntegrity: b.criticalIntegrity,
    };
  }

  return {
    loadActive({ tenantId, programmeId, enrolmentId, patientId }) {
      return [...rows.values()].filter(
        (r) =>
          r.tenantId === tenantId &&
          r.programmeId === programmeId &&
          r.enrolmentId === enrolmentId &&
          r.patientId === patientId &&
          (r.state === "open" || r.state === "acknowledged" || r.state === "in_progress")
      );
    },
    saveReconciliation({ upserts, resolved }) {
      for (const b of upserts) {
        rows.set(keyOf(b), toSnap(b));
      }
      for (const b of resolved) {
        rows.set(keyOf(b), toSnap(b));
      }
    },
    all() {
      return [...rows.values()];
    },
  };
}

export type EvaluateFromReadinessArgs = {
  readiness: PilotPatientReadiness;
  programme: BlockerProgrammeContext;
  asOf?: string;
  store?: BlockerStore;
  persistDerivedState?: boolean;
  correlationId?: string;
  repeatedFailureCount?: number;
  pausedAt?: string | null;
};

export function buildProgrammeContext(args: {
  programmeId: string;
  tenantId: string;
  escalationThresholds?: Partial<PilotEscalationThresholds> | Record<string, unknown> | null;
  clinicTimezone?: string;
  enrolmentStatus: string;
  procedureAt?: string | null;
  operationalOwnerUserId?: string | null;
  operationalOwnerRole?: string | null;
}): BlockerProgrammeContext {
  return {
    programmeId: args.programmeId,
    tenantId: args.tenantId,
    escalationThresholds: mergeThresholds(args.escalationThresholds),
    clinicTimezone: args.clinicTimezone ?? EVOLVED_PILOT_CLINIC_TIMEZONE,
    enrolmentStatus: args.enrolmentStatus,
    enrolmentPaused: args.enrolmentStatus === "paused",
    procedureAt: args.procedureAt,
    operationalOwnerUserId: args.operationalOwnerUserId,
    operationalOwnerRole: args.operationalOwnerRole,
  };
}

/**
 * Evaluate blockers for an enrolled patient from canonical readiness output.
 */
export function evaluatePilotPatientBlockersFromReadiness(
  args: EvaluateFromReadinessArgs
): PilotPatientBlockerEvaluation {
  const asOf = args.asOf ?? args.readiness.evaluatedAt;
  const store = args.store ?? createMemoryBlockerStore();
  const existing = store.loadActive({
    tenantId: args.readiness.tenantId,
    programmeId: args.readiness.programmeId,
    enrolmentId: args.readiness.enrolmentId,
    patientId: args.readiness.patientId,
  });

  const reconciled = reconcilePilotBlockers({
    readiness: args.readiness,
    programme: args.programme,
    existingActive: existing,
    asOf,
    correlationId: args.correlationId,
    repeatedFailureCount: args.repeatedFailureCount,
    pausedAt: args.pausedAt,
  });

  if (args.persistDerivedState !== false) {
    store.saveReconciliation({
      tenantId: args.readiness.tenantId,
      programmeId: args.readiness.programmeId,
      enrolmentId: args.readiness.enrolmentId,
      patientId: args.readiness.patientId,
      upserts: reconciled.active,
      resolved: reconciled.recentlyResolved,
    });
  }

  return {
    programmeId: args.readiness.programmeId,
    enrolmentId: args.readiness.enrolmentId,
    tenantId: args.readiness.tenantId,
    patientId: args.readiness.patientId,
    readiness: args.readiness,
    activeBlockers: reconciled.active,
    recentlyResolved: reconciled.recentlyResolved,
    healthInput: buildPilotBlockerHealthInput(reconciled.active),
    evaluatedAt: asOf,
    evaluationVersion: BLOCKER_EVALUATION_VERSION,
    enrolled: true,
  };
}
