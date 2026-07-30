/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.6 — pure cohort readiness aggregation.
 * Consumes 1A.2 PilotPatientReadiness results. Never derives readiness from blockers alone.
 */

import type { OverallReadinessState } from "../pilotControlContracts";
import type {
  PilotPatientReadiness,
  ReadinessDimension,
  ReadinessDimensionState,
  ReadinessSignalStatus,
} from "./readinessTypes";
import { READINESS_DIMENSIONS, READINESS_EVALUATION_VERSION } from "./readinessTypes";

export const COHORT_READINESS_SUMMARY_VERSION = "1A.6.0" as const;

export const REQUIREMENTS_MAP_VERSION = "1A.2.0" as const;

/** Maximum enrolments evaluated in one batch (initial pilot deliberately small). */
export const MAX_COHORT_EVALUATION_SIZE = 50;

/** Default bounded adapter concurrency for cohort batch. */
export const DEFAULT_COHORT_EVALUATION_CONCURRENCY = 4;

/** Hard ceiling on concurrency. */
export const MAX_COHORT_EVALUATION_CONCURRENCY = 8;

/** Soft evaluation timeout budget (ms) for instrumentation / partial handling. */
export const COHORT_EVALUATION_TIMEOUT_MS = 30_000;

export type ReadinessStateDistribution = {
  notStarted: number;
  inProgress: number;
  awaitingReview: number;
  attentionRequired: number;
  blocked: number;
  ready: number;
  completed: number;
  notApplicable: number;
  unknown: number;
};

export type MandatorySignalCounts = {
  unknown: number;
  missing: number;
  pending: number;
  reviewRequired: number;
  failed: number;
  satisfied: number;
};

export type PilotCohortReadinessSummary = {
  programmeId: string;
  tenantId: string;
  cohort: {
    totalEnrolled: number;
    evaluated: number;
    completeEvaluations: number;
    partialEvaluations: number;
    failedEvaluations: number;
    liveEnrolled: number;
    syntheticEnrolled: number;
  };
  overall: ReadinessStateDistribution;
  dimensions: {
    clinical: ReadinessStateDistribution;
    financial: ReadinessStateDistribution;
    patient: ReadinessStateDistribution;
    operational: ReadinessStateDistribution;
    technical: ReadinessStateDistribution;
  };
  mandatorySignals: MandatorySignalCounts;
  blockers: {
    patientsBlocked: number;
    patientsAttentionRequired: number;
    patientsReady: number;
    patientsCompleted: number;
  };
  freshness: {
    evaluatedAt: string;
    oldestSourceUpdatedAt?: string;
    stalePatientCount: number;
    staleSourceSystems: string[];
  };
  versions: {
    readiness: string;
    requirements: string;
    summary: string;
  };
  /** True when cohort exceeded MAX_COHORT_EVALUATION_SIZE or timeout truncated work. */
  truncated: boolean;
  source: "canonical_batch_readiness";
};

export type CohortPatientEvaluationOutcome =
  | {
      kind: "ok";
      readiness: PilotPatientReadiness;
      partial: boolean;
      evidenceClass: PilotEvidenceSourceClass;
    }
  | {
      kind: "failed";
      patientId: string;
      enrolmentId: string;
      evidenceClass: PilotEvidenceSourceClass;
      reason: string;
    };

export const PILOT_EVIDENCE_SOURCE_CLASSES = [
  "live_patient",
  "synthetic_fixture",
  "staff_test",
  "smoke_test",
  "migration_test",
] as const;

export type PilotEvidenceSourceClass = (typeof PILOT_EVIDENCE_SOURCE_CLASSES)[number];

export function emptyReadinessStateDistribution(): ReadinessStateDistribution {
  return {
    notStarted: 0,
    inProgress: 0,
    awaitingReview: 0,
    attentionRequired: 0,
    blocked: 0,
    ready: 0,
    completed: 0,
    notApplicable: 0,
    unknown: 0,
  };
}

export function emptyMandatorySignalCounts(): MandatorySignalCounts {
  return {
    unknown: 0,
    missing: 0,
    pending: 0,
    reviewRequired: 0,
    failed: 0,
    satisfied: 0,
  };
}

export function emptyPilotCohortReadinessSummary(args: {
  programmeId: string;
  tenantId: string;
  evaluatedAt?: string;
}): PilotCohortReadinessSummary {
  return {
    programmeId: args.programmeId,
    tenantId: args.tenantId,
    cohort: {
      totalEnrolled: 0,
      evaluated: 0,
      completeEvaluations: 0,
      partialEvaluations: 0,
      failedEvaluations: 0,
      liveEnrolled: 0,
      syntheticEnrolled: 0,
    },
    overall: emptyReadinessStateDistribution(),
    dimensions: {
      clinical: emptyReadinessStateDistribution(),
      financial: emptyReadinessStateDistribution(),
      patient: emptyReadinessStateDistribution(),
      operational: emptyReadinessStateDistribution(),
      technical: emptyReadinessStateDistribution(),
    },
    mandatorySignals: emptyMandatorySignalCounts(),
    blockers: {
      patientsBlocked: 0,
      patientsAttentionRequired: 0,
      patientsReady: 0,
      patientsCompleted: 0,
    },
    freshness: {
      evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
      stalePatientCount: 0,
      staleSourceSystems: [],
    },
    versions: {
      readiness: READINESS_EVALUATION_VERSION,
      requirements: REQUIREMENTS_MAP_VERSION,
      summary: COHORT_READINESS_SUMMARY_VERSION,
    },
    truncated: false,
    source: "canonical_batch_readiness",
  };
}

/**
 * Classify enrolment evidence from cohort key / metadata.
 * Synthetic and test records must never enter live pilot rates.
 */
export function classifyPilotEvidenceSource(args: {
  pilotCohort?: string | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
}): PilotEvidenceSourceClass {
  const metaClass = args.metadata?.evidenceClass ?? args.metadata?.evidence_class;
  if (typeof metaClass === "string") {
    const normalized = metaClass.trim().toLowerCase();
    if ((PILOT_EVIDENCE_SOURCE_CLASSES as readonly string[]).includes(normalized)) {
      return normalized as PilotEvidenceSourceClass;
    }
  }

  const cohort = String(args.pilotCohort ?? "")
    .trim()
    .toLowerCase();
  if (!cohort) return "live_patient";
  if (cohort.includes("migration_test") || cohort.startsWith("migration_")) {
    return "migration_test";
  }
  if (cohort.includes("smoke") || cohort.startsWith("smoke_")) return "smoke_test";
  if (cohort.includes("staff_test") || cohort.startsWith("staff_test")) return "staff_test";
  if (
    cohort.includes("synthetic") ||
    cohort.startsWith("fixture") ||
    cohort.includes("_fixture") ||
    cohort === "fi_synthetic"
  ) {
    return "synthetic_fixture";
  }
  return "live_patient";
}

export function isLivePilotEvidence(cls: PilotEvidenceSourceClass): boolean {
  return cls === "live_patient";
}

/** Count mandatory signals that prevent a trustworthy ready state. */
export function countUnknownMandatorySignals(readiness: PilotPatientReadiness): number {
  let n = 0;
  for (const dim of READINESS_DIMENSIONS) {
    for (const signal of readiness[dim].mandatorySignals) {
      if (signal.status === "unknown") n += 1;
    }
  }
  return n;
}

/**
 * A evaluation is partial when mandatory sources are unknown/unavailable,
 * or the engine flagged fail-closed unknown provenance.
 * Partial must never be presented as Ready.
 */
export function isPartialPatientReadiness(readiness: PilotPatientReadiness): boolean {
  if (countUnknownMandatorySignals(readiness) > 0) return true;
  if (
    readiness.warnings.some(
      (w) =>
        w.code.includes("source_unavailable") ||
        w.code.includes("partial") ||
        w.severity === "high"
    )
  ) {
    return true;
  }
  const reasons = readiness.overall.reasons.join(" ");
  if (reasons.includes("unknown") && readiness.overall.failClosed) return true;
  return false;
}

function bumpOverall(
  dist: ReadinessStateDistribution,
  state: OverallReadinessState,
  opts?: { forceUnknown?: boolean }
): void {
  if (opts?.forceUnknown) {
    dist.unknown += 1;
    return;
  }
  switch (state) {
    case "not_started":
      dist.notStarted += 1;
      break;
    case "in_progress":
      dist.inProgress += 1;
      break;
    case "attention_required":
      dist.attentionRequired += 1;
      break;
    case "blocked":
      dist.blocked += 1;
      break;
    case "ready":
      dist.ready += 1;
      break;
    case "completed":
      dist.completed += 1;
      break;
    default:
      dist.unknown += 1;
  }
}

function bumpDimension(dist: ReadinessStateDistribution, state: ReadinessDimensionState): void {
  switch (state) {
    case "not_started":
      dist.notStarted += 1;
      break;
    case "in_progress":
      dist.inProgress += 1;
      break;
    case "awaiting_review":
      dist.awaitingReview += 1;
      break;
    case "attention_required":
      dist.attentionRequired += 1;
      break;
    case "blocked":
      dist.blocked += 1;
      break;
    case "ready":
      dist.ready += 1;
      break;
    case "not_applicable":
      dist.notApplicable += 1;
      break;
    default:
      dist.unknown += 1;
  }
}

function bumpMandatory(counts: MandatorySignalCounts, status: ReadinessSignalStatus): void {
  switch (status) {
    case "unknown":
      counts.unknown += 1;
      break;
    case "missing":
      counts.missing += 1;
      break;
    case "pending":
      counts.pending += 1;
      break;
    case "review_required":
      counts.reviewRequired += 1;
      break;
    case "failed":
      counts.failed += 1;
      break;
    case "satisfied":
      counts.satisfied += 1;
      break;
    default:
      break;
  }
}

function collectOldestSourceUpdatedAt(readiness: PilotPatientReadiness): string | undefined {
  let oldest: string | undefined;
  for (const dim of READINESS_DIMENSIONS) {
    for (const p of readiness[dim].provenance) {
      if (!p.sourceUpdatedAt) continue;
      if (!oldest || p.sourceUpdatedAt < oldest) oldest = p.sourceUpdatedAt;
    }
  }
  return oldest;
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function isStalePatient(readiness: PilotPatientReadiness, asOfMs: number): boolean {
  const oldest = collectOldestSourceUpdatedAt(readiness);
  if (!oldest) return false;
  const t = Date.parse(oldest);
  if (!Number.isFinite(t)) return false;
  return asOfMs - t > STALE_MS;
}

function collectStaleSystems(readiness: PilotPatientReadiness, asOfMs: number): string[] {
  const systems = new Set<string>();
  for (const dim of READINESS_DIMENSIONS) {
    for (const p of readiness[dim].provenance) {
      if (!p.sourceUpdatedAt) continue;
      const t = Date.parse(p.sourceUpdatedAt);
      if (Number.isFinite(t) && asOfMs - t > STALE_MS) {
        systems.add(p.sourceSystem);
      }
    }
  }
  return [...systems].sort();
}

/**
 * Aggregate patient-level 1A.2 results into a cohort summary.
 * Failed outcomes contribute to failedEvaluations and overall.unknown (never ready).
 */
export function summarizePilotCohortReadiness(args: {
  programmeId: string;
  tenantId: string;
  totalEnrolled: number;
  liveEnrolled: number;
  syntheticEnrolled: number;
  outcomes: readonly CohortPatientEvaluationOutcome[];
  evaluatedAt?: string;
  truncated?: boolean;
}): PilotCohortReadinessSummary {
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const asOfMs = Date.parse(evaluatedAt) || Date.now();
  const summary = emptyPilotCohortReadinessSummary({
    programmeId: args.programmeId,
    tenantId: args.tenantId,
    evaluatedAt,
  });

  summary.cohort.totalEnrolled = args.totalEnrolled;
  summary.cohort.liveEnrolled = args.liveEnrolled;
  summary.cohort.syntheticEnrolled = args.syntheticEnrolled;
  summary.truncated = Boolean(args.truncated);

  let oldestSourceUpdatedAt: string | undefined;
  const staleSystems = new Set<string>();

  for (const outcome of args.outcomes) {
    summary.cohort.evaluated += 1;

    if (outcome.kind === "failed") {
      summary.cohort.failedEvaluations += 1;
      summary.overall.unknown += 1;
      summary.blockers.patientsAttentionRequired += 1;
      continue;
    }

    const { readiness, partial } = outcome;
    if (partial) {
      summary.cohort.partialEvaluations += 1;
    } else {
      summary.cohort.completeEvaluations += 1;
    }

    // Never count partial mandatory evaluation as ready.
    const overallState = readiness.overall.state;
    const forceUnknown =
      partial && (overallState === "ready" || overallState === "completed");
    if (forceUnknown) {
      bumpOverall(summary.overall, overallState, { forceUnknown: true });
      summary.blockers.patientsAttentionRequired += 1;
    } else {
      bumpOverall(summary.overall, overallState);
      if (overallState === "blocked") summary.blockers.patientsBlocked += 1;
      else if (overallState === "attention_required") {
        summary.blockers.patientsAttentionRequired += 1;
      } else if (overallState === "ready") summary.blockers.patientsReady += 1;
      else if (overallState === "completed") summary.blockers.patientsCompleted += 1;
    }

    for (const dim of READINESS_DIMENSIONS) {
      bumpDimension(summary.dimensions[dim], readiness[dim].state);
      for (const signal of readiness[dim].mandatorySignals) {
        bumpMandatory(summary.mandatorySignals, signal.status);
      }
    }

    const oldest = collectOldestSourceUpdatedAt(readiness);
    if (oldest && (!oldestSourceUpdatedAt || oldest < oldestSourceUpdatedAt)) {
      oldestSourceUpdatedAt = oldest;
    }
    if (isStalePatient(readiness, asOfMs)) {
      summary.freshness.stalePatientCount += 1;
      for (const s of collectStaleSystems(readiness, asOfMs)) staleSystems.add(s);
    }
  }

  summary.freshness.oldestSourceUpdatedAt = oldestSourceUpdatedAt;
  summary.freshness.staleSourceSystems = [...staleSystems].sort();
  return summary;
}

/** Distribution total helper for tests. */
export function readinessDistributionTotal(d: ReadinessStateDistribution): number {
  return (
    d.notStarted +
    d.inProgress +
    d.awaitingReview +
    d.attentionRequired +
    d.blocked +
    d.ready +
    d.completed +
    d.notApplicable +
    d.unknown
  );
}

export type RegisterReadinessProjection = {
  clinical: string;
  financial: string;
  patient: string;
  operational: string;
  technical: string;
  overall: OverallReadinessState | "attention_required";
  partial: boolean;
  unknownMandatorySignalCount: number;
  evaluatedAt: string;
  evaluationFreshnessAt?: string;
};

/**
 * Project patient readiness onto a register row.
 * Partial mandatory evaluation → overall attention_required (never Ready).
 */
export function projectRegisterReadiness(
  readiness: PilotPatientReadiness | null,
  opts?: { failed?: boolean; evaluatedAt?: string }
): RegisterReadinessProjection {
  const evaluatedAt = opts?.evaluatedAt ?? readiness?.evaluatedAt ?? new Date().toISOString();
  if (!readiness || opts?.failed) {
    return {
      clinical: "unknown",
      financial: "unknown",
      patient: "unknown",
      operational: "unknown",
      technical: "unknown",
      overall: "attention_required",
      partial: true,
      unknownMandatorySignalCount: 0,
      evaluatedAt,
    };
  }

  const partial = isPartialPatientReadiness(readiness);
  const unknownMandatorySignalCount = countUnknownMandatorySignals(readiness);
  let overall: OverallReadinessState | "attention_required" = readiness.overall.state;
  if (partial && (overall === "ready" || overall === "completed")) {
    overall = "attention_required";
  }

  return {
    clinical: readiness.clinical.state,
    financial: readiness.financial.state,
    patient: readiness.patient.state,
    operational: readiness.operational.state,
    technical: readiness.technical.state,
    overall,
    partial,
    unknownMandatorySignalCount,
    evaluatedAt: readiness.evaluatedAt,
    evaluationFreshnessAt: collectOldestSourceUpdatedAt(readiness),
  };
}

export function dimensionKeyList(): readonly ReadinessDimension[] {
  return READINESS_DIMENSIONS;
}
