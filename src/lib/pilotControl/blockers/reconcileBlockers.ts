/**
 * Pure reconciliation algorithm (1A.3).
 *
 * 1. Produce candidates from readiness
 * 2. Fingerprint
 * 3. Match existing active blockers
 * 4. Update lastConfirmedAt / severity / ownership / escalation
 * 5. Insert new
 * 6. Resolve missing
 * 7. Supersede replaced source records
 *
 * Idempotent: unchanged source data must not duplicate or reset firstDetectedAt.
 */

import { effectiveAgeSeconds, ageSecondsUtc } from "./ageingEngine";
import { BLOCKER_EVALUATION_VERSION } from "./blockerTypes";
import { fingerprintFromCandidate } from "./blockerFingerprint";
import { detectBlockerCandidates } from "./detectBlockerCandidates";
import { evaluateSeverityAndEscalation } from "./escalationEngine";
import { resolveBlockerOwnership } from "./ownershipEngine";
import { decideResolution } from "./resolutionEngine";
import type {
  BlockerProgrammeContext,
  PersistedBlockerSnapshot,
  PilotBlockerCandidate,
  PilotBlockerRecord,
} from "./blockerTypes";
import type { PilotPatientReadiness } from "../readiness/readinessTypes";

export type ReconcileBlockersArgs = {
  readiness: PilotPatientReadiness;
  programme: BlockerProgrammeContext;
  existingActive: PersistedBlockerSnapshot[];
  asOf: string;
  /** Correlation id for this evaluation pass. */
  correlationId?: string;
  repeatedFailureCount?: number;
  pausedAt?: string | null;
  evaluationVersion?: string;
};

export type ReconcileBlockersResult = {
  active: PilotBlockerRecord[];
  recentlyResolved: PilotBlockerRecord[];
  toInsert: PilotBlockerRecord[];
  toUpdate: PilotBlockerRecord[];
  candidates: PilotBlockerCandidate[];
};

function isActiveState(state: string): boolean {
  return state === "open" || state === "acknowledged" || state === "in_progress";
}

function snapshotToRecord(
  snap: PersistedBlockerSnapshot,
  asOf: string
): PilotBlockerRecord {
  return {
    blockerKey: snap.sourceSignalKey ?? snap.fingerprint,
    fingerprint: snap.fingerprint,
    programmeId: snap.programmeId,
    enrolmentId: snap.enrolmentId,
    tenantId: snap.tenantId,
    patientId: snap.patientId,
    category: snap.category,
    subcategory: snap.subcategory ?? undefined,
    title: snap.title,
    summary: snap.summary,
    recommendedNextAction: snap.recommendedNextAction,
    sourceModule: snap.sourceModule,
    sourceRecordId: snap.sourceRecordId ?? undefined,
    sourceSignalKey: snap.sourceSignalKey ?? undefined,
    dimension: snap.dimension,
    severity: snap.severity,
    state: snap.state,
    ownership: {
      ownerType: snap.ownerType,
      ownerUserId: snap.ownerUserId ?? undefined,
      ownerRole: snap.ownerRole ?? undefined,
      assignmentSource: snap.assignmentSource,
      ownershipReason: snap.ownershipReason,
    },
    firstDetectedAt: snap.firstDetectedAt,
    lastConfirmedAt: snap.lastConfirmedAt,
    ageSeconds: ageSecondsUtc(snap.firstDetectedAt, asOf),
    escalation: {
      level: snap.escalationLevel,
      escalated: snap.escalationLevel !== "none",
      escalatedAt: snap.escalatedAt ?? undefined,
      thresholdKey: snap.thresholdKey ?? undefined,
      requiresPilotPause: snap.requiresPilotPause,
      requiresImmediateReview: snap.requiresImmediateReview,
    },
    provenance: snap.provenanceJson ?? [],
    correlationIds: snap.correlationIds ?? [],
    detectedByVersion: snap.detectedByVersion,
    evaluatedAt: asOf,
    criticalIntegrity: snap.criticalIntegrity,
    acknowledgedAt: snap.acknowledgedAt ?? undefined,
    acknowledgedBy: snap.acknowledgedBy ?? undefined,
    resolvedAt: snap.resolvedAt ?? undefined,
    resolutionReason: snap.resolutionReason ?? undefined,
    supersededBy: snap.supersededBy ?? undefined,
  };
}

function buildRecordFromCandidate(args: {
  candidate: PilotBlockerCandidate;
  fingerprint: string;
  readiness: PilotPatientReadiness;
  programme: BlockerProgrammeContext;
  firstDetectedAt: string;
  asOf: string;
  existingState?: PilotBlockerRecord["state"];
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  correlationId?: string;
  repeatedFailureCount?: number;
  pausedAt?: string | null;
  evaluationVersion: string;
}): PilotBlockerRecord {
  const {
    candidate,
    fingerprint,
    readiness,
    programme,
    firstDetectedAt,
    asOf,
    existingState = "open",
    acknowledgedAt,
    acknowledgedBy,
    correlationId,
    repeatedFailureCount,
    pausedAt,
    evaluationVersion,
  } = args;

  const ownershipDraft = resolveBlockerOwnership({ candidate });
  const { severity, escalation } = evaluateSeverityAndEscalation({
    candidate,
    programme,
    firstDetectedAt,
    asOf,
    state: existingState,
    ownership: ownershipDraft,
    repeatedFailureCount,
    pausedAt,
  });

  const ownership = resolveBlockerOwnership({
    candidate,
    escalation,
    // Escalation owner is recorded on the escalation object; do not replace
    // module/canonical primary ownership unless still unassigned.
    preferEscalationOwner: ownershipDraft.ownerType === "unassigned" && escalation.escalated,
  });

  const age = effectiveAgeSeconds({
    firstDetectedAt,
    asOf,
    candidate,
    programme,
    pausedAt,
  });

  const correlationIds = [
    ...new Set(
      [...candidate.correlationIds, correlationId].filter((x): x is string => Boolean(x))
    ),
  ];

  return {
    blockerKey: candidate.blockerKey,
    fingerprint,
    programmeId: readiness.programmeId,
    enrolmentId: readiness.enrolmentId,
    tenantId: readiness.tenantId,
    patientId: readiness.patientId,
    category: candidate.category,
    subcategory: candidate.subcategory,
    title: candidate.title,
    summary: candidate.summary,
    patientSafeSummary: candidate.patientSafeSummary,
    recommendedNextAction:
      escalation.requiresPilotPause
        ? candidate.recommendedNextAction.includes("Pause")
          ? candidate.recommendedNextAction
          : `${candidate.recommendedNextAction} Pause pilot expansion if directed.`
        : candidate.recommendedNextAction,
    sourceModule: candidate.sourceModule,
    sourceRecordId: candidate.sourceRecordId,
    sourceSignalKey: candidate.sourceSignalKey,
    dimension: candidate.dimension,
    severity,
    state: existingState,
    ownership,
    firstDetectedAt,
    lastConfirmedAt: asOf,
    ageSeconds: age,
    escalation,
    provenance: candidate.provenance,
    correlationIds,
    detectedByVersion: evaluationVersion,
    evaluatedAt: asOf,
    criticalIntegrity: candidate.criticalIntegrity || severity === "critical",
    acknowledgedAt,
    acknowledgedBy,
  };
}

export function reconcilePilotBlockers(
  args: ReconcileBlockersArgs
): ReconcileBlockersResult {
  const evaluationVersion = args.evaluationVersion ?? BLOCKER_EVALUATION_VERSION;
  const candidates = detectBlockerCandidates({
    readiness: args.readiness,
    programme: args.programme,
  });

  const candidateByFp = new Map<string, PilotBlockerCandidate>();
  for (const c of candidates) {
    const fp = fingerprintFromCandidate(c);
    // Deterministic: first wins (candidates already sorted)
    if (!candidateByFp.has(fp)) candidateByFp.set(fp, c);
  }

  const existingActive = args.existingActive.filter(
    (e) =>
      e.tenantId === args.readiness.tenantId &&
      e.programmeId === args.readiness.programmeId &&
      e.enrolmentId === args.readiness.enrolmentId &&
      e.patientId === args.readiness.patientId &&
      isActiveState(e.state)
  );

  const existingByFp = new Map(existingActive.map((e) => [e.fingerprint, e]));

  const toUpdate: PilotBlockerRecord[] = [];
  const toInsert: PilotBlockerRecord[] = [];
  const recentlyResolved: PilotBlockerRecord[] = [];
  const matchedExisting = new Set<string>();

  // Match candidates → existing
  for (const [fp, candidate] of candidateByFp) {
    const existing = existingByFp.get(fp);
    if (existing) {
      matchedExisting.add(fp);
      const updated = buildRecordFromCandidate({
        candidate,
        fingerprint: fp,
        readiness: args.readiness,
        programme: args.programme,
        firstDetectedAt: existing.firstDetectedAt, // preserve
        asOf: args.asOf,
        existingState: existing.state,
        acknowledgedAt: existing.acknowledgedAt ?? undefined,
        acknowledgedBy: existing.acknowledgedBy ?? undefined,
        correlationId: args.correlationId,
        repeatedFailureCount: args.repeatedFailureCount,
        pausedAt: args.pausedAt,
        evaluationVersion,
      });
      toUpdate.push(updated);
    } else {
      const created = buildRecordFromCandidate({
        candidate,
        fingerprint: fp,
        readiness: args.readiness,
        programme: args.programme,
        firstDetectedAt: args.asOf,
        asOf: args.asOf,
        existingState: "open",
        correlationId: args.correlationId,
        repeatedFailureCount: args.repeatedFailureCount,
        pausedAt: args.pausedAt,
        evaluationVersion,
      });
      toInsert.push(created);
    }
  }

  // Resolve / supersede unmatched existing
  for (const existing of existingActive) {
    if (matchedExisting.has(existing.fingerprint)) continue;

    // Supersede when same signal key exists with different sourceRecordId
    const replacement = [...candidateByFp.entries()].find(([, c]) => {
      return (
        c.sourceSignalKey === existing.sourceSignalKey &&
        (existing.sourceRecordId ?? null) != null &&
        c.sourceRecordId != null &&
        c.sourceRecordId !== existing.sourceRecordId
      );
    });

    const decision = decideResolution({
      existing,
      matchingCandidate: undefined,
      replacementFingerprint: replacement?.[0],
    });

    const base = snapshotToRecord(existing, args.asOf);
    if (decision.action === "supersede") {
      recentlyResolved.push({
        ...base,
        state: "superseded",
        supersededBy: decision.supersededByFingerprint,
        resolvedAt: args.asOf,
        resolutionReason: decision.reason,
        lastConfirmedAt: args.asOf,
        ageSeconds: ageSecondsUtc(existing.firstDetectedAt, args.asOf),
      });
    } else if (decision.action === "resolve") {
      recentlyResolved.push({
        ...base,
        state: "resolved",
        resolvedAt: args.asOf,
        resolutionReason: decision.reason,
        lastConfirmedAt: args.asOf,
        ageSeconds: ageSecondsUtc(existing.firstDetectedAt, args.asOf),
      });
    }
  }

  const active = [...toUpdate, ...toInsert].sort((a, b) =>
    a.fingerprint.localeCompare(b.fingerprint)
  );

  return {
    active,
    recentlyResolved: recentlyResolved.sort((a, b) =>
      a.fingerprint.localeCompare(b.fingerprint)
    ),
    toInsert,
    toUpdate,
    candidates,
  };
}
