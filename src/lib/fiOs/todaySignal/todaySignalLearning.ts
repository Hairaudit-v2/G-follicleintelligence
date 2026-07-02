import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import {
  inferTodaySignalKind,
  type TodayPriorityBand,
  type TodaySignalKind,
} from "@/src/lib/fiOs/todaySignal/todaySignalPriority";

/**
 * FI-UX-REBUILD D6B.5 — Today signal learning layer (operational memory).
 *
 * Lightweight observations and resolution metrics only. Clinical / operational
 * source tables remain the source of truth — no duplicate event data.
 */

export type TodaySignalObservationContext = {
  profileKey?: FiWorkspaceProfileKey;
  resolvedByRole?: string;
  resolvedByUserId?: string;
  nowIso?: string;
};

export type TodaySignalObservation = {
  signalKey: string;
  entityKind?: string;
  entityId?: string;
  signalType: TodaySignalKind;
  priorityBand?: TodayPriorityBand;
  priorityScore?: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
  resolvedByRole?: string;
  resolvedByUserId?: string;
  occurrenceCount: number;
  resolutionSeconds?: number;
  metadata: Record<string, unknown>;
};

export type TodaySignalObservationDraft = Omit<
  TodaySignalObservation,
  "occurrenceCount" | "firstSeenAt" | "lastSeenAt"
> & {
  occurrenceCount?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

export type TodaySignalObservationReconcileResult = {
  created: TodaySignalObservation[];
  updated: TodaySignalObservation[];
  resolved: TodaySignalObservation[];
};

export type TodaySignalResolutionMetrics = {
  ageSeconds: number;
  resolutionSeconds: number | null;
  isUnresolved: boolean;
};

export type TodaySignalLearningSummaryRange = {
  fromIso: string;
  toIso: string;
};

export type TodaySignalLearningSummary = {
  computedAt: string;
  range: TodaySignalLearningSummaryRange;
  observationCount: number;
  topRecurringSignalTypes: Array<{
    signalType: TodaySignalKind;
    totalOccurrences: number;
    observationCount: number;
  }>;
  longestUnresolvedSignals: Array<{
    signalKey: string;
    signalType: TodaySignalKind;
    ageSeconds: number;
    priorityBand?: TodayPriorityBand;
  }>;
  averageResolutionTimeBySignalType: Array<{
    signalType: TodaySignalKind;
    avgSeconds: number;
    sampleCount: number;
  }>;
  averageResolutionTimeByRole: Array<{
    role: string;
    avgSeconds: number;
    sampleCount: number;
  }>;
  criticalSignalsUnresolvedOverThreshold: Array<{
    signalKey: string;
    signalType: TodaySignalKind;
    ageSeconds: number;
    priorityBand?: TodayPriorityBand;
  }>;
  signalsRecurringMoreThanExpected: Array<{
    signalKey: string;
    signalType: TodaySignalKind;
    occurrenceCount: number;
  }>;
};

export const DEFAULT_CRITICAL_UNRESOLVED_THRESHOLD_SECONDS = 3600;
export const DEFAULT_RECURRENCE_EXPECTATION_COUNT = 3;

const BLOCKED_METADATA_KEYS = new Set([
  "personLabel",
  "actionLabel",
  "detailLine",
  "href",
  "actionHint",
  "patientName",
  "patientLabel",
  "displayName",
  "name",
  "email",
  "phone",
  "amount",
  "paymentAmount",
  "balance",
  "note",
  "body",
  "message",
  "clinicalInterpretation",
  "interpretation",
  "priorityReasons",
  "groupMembers",
  "toAddress",
  "fromAddress",
]);

function extractEntityFromFeedItem(
  item: TodayFeedItem,
  _signalType: TodaySignalKind
): { entityKind?: string; entityId?: string } {
  const id = item.id;
  const prefixes: Array<[string, string]> = [
    ["reception-", "booking"],
    ["stale-lead-", "lead"],
    ["task-", "task"],
    ["reminder-", "reminder"],
    ["entity-pathology-", "pathology"],
    ["entity-surgery-readiness-", "surgery_readiness"],
    ["entity-surgery-payment-", "surgery_payment"],
    ["entity-payment-overdue-", "payment"],
    ["entity-financial-clearance-", "financial_clearance"],
    ["entity-staff-", "staff"],
    ["entity-consultation-", "consultation"],
    ["aggregate-", "aggregate"],
  ];

  for (const [prefix, kind] of prefixes) {
    if (id.startsWith(prefix)) {
      return { entityKind: kind, entityId: id.slice(prefix.length) || id };
    }
  }

  return { entityKind: "signal", entityId: id };
}

/** Deterministic key for the same entity-bound Today signal. */
export function buildSignalObservationKey(item: TodayFeedItem): string {
  const signalType = inferTodaySignalKind(item);
  const { entityKind, entityId } = extractEntityFromFeedItem(item, signalType);
  return `${signalType}::${entityKind ?? "signal"}::${entityId ?? item.id}`;
}

/** Strip PHI-like and free-text fields — operational dimensions only. */
export function sanitizeSignalLearningMetadata(item: TodayFeedItem): Record<string, unknown> {
  const out: Record<string, unknown> = {
    bucket: item.bucket,
    severity: item.severity,
    autoResolves: item.autoResolves,
  };

  if (item.groupKey) out.groupKey = item.groupKey;
  if (item.priorityDimensions) out.priorityDimensions = item.priorityDimensions;

  for (const [key, value] of Object.entries(out)) {
    if (BLOCKED_METADATA_KEYS.has(key)) {
      delete out[key];
      continue;
    }
    if (typeof value === "string" && looksLikePhiString(value)) {
      delete out[key];
    }
  }

  return out;
}

function looksLikePhiString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\$[\d,]+(\.\d{2})?$/.test(trimmed)) return true;
  if (/^[\w.+-]+@[\w-]+\.\w+$/.test(trimmed)) return true;
  if (/^\+?\d[\d\s()-]{7,}$/.test(trimmed)) return true;
  return false;
}

export function deriveSignalObservationSnapshot(
  items: readonly TodayFeedItem[],
  context: TodaySignalObservationContext = {}
): Map<string, TodaySignalObservation> {
  const nowIso = context.nowIso ?? new Date().toISOString();
  const snapshot = new Map<string, TodaySignalObservation>();

  for (const item of items) {
    const signalType = inferTodaySignalKind(item);
    const signalKey = buildSignalObservationKey(item);
    const { entityKind, entityId } = extractEntityFromFeedItem(item, signalType);

    snapshot.set(signalKey, {
      signalKey,
      entityKind,
      entityId,
      signalType,
      priorityBand: item.priorityBand,
      priorityScore: item.priorityScore,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      occurrenceCount: 1,
      metadata: sanitizeSignalLearningMetadata(item),
    });
  }

  return snapshot;
}

export function calculateResolutionSeconds(firstSeenAt: string, resolvedAt: string): number {
  const start = Date.parse(firstSeenAt);
  const end = Date.parse(resolvedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 1000));
}

export function calculateSignalResolutionMetrics(
  observation: TodaySignalObservation,
  context: Pick<TodaySignalObservationContext, "nowIso"> = {}
): TodaySignalResolutionMetrics {
  const nowMs = Date.parse(context.nowIso ?? new Date().toISOString());
  const firstMs = Date.parse(observation.firstSeenAt);

  if (observation.resolvedAt) {
    return {
      ageSeconds: observation.resolutionSeconds ?? calculateResolutionSeconds(
        observation.firstSeenAt,
        observation.resolvedAt
      ),
      resolutionSeconds:
        observation.resolutionSeconds ??
        calculateResolutionSeconds(observation.firstSeenAt, observation.resolvedAt),
      isUnresolved: false,
    };
  }

  const ageSeconds =
    Number.isFinite(firstMs) && Number.isFinite(nowMs)
      ? Math.max(0, Math.round((nowMs - firstMs) / 1000))
      : 0;

  return {
    ageSeconds,
    resolutionSeconds: null,
    isUnresolved: true,
  };
}

export function reconcileSignalObservations(
  previous: readonly TodaySignalObservation[],
  current: ReadonlyMap<string, TodaySignalObservation>,
  context: TodaySignalObservationContext = {}
): TodaySignalObservationReconcileResult {
  const nowIso = context.nowIso ?? new Date().toISOString();
  const openPrevious = previous.filter((row) => !row.resolvedAt);
  const prevByKey = new Map(openPrevious.map((row) => [row.signalKey, row]));

  const created: TodaySignalObservation[] = [];
  const updated: TodaySignalObservation[] = [];
  const resolved: TodaySignalObservation[] = [];

  for (const [signalKey, draft] of current) {
    const prev = prevByKey.get(signalKey);
    if (prev) {
      updated.push({
        ...prev,
        lastSeenAt: nowIso,
        occurrenceCount: prev.occurrenceCount + 1,
        priorityBand: draft.priorityBand ?? prev.priorityBand,
        priorityScore: draft.priorityScore ?? prev.priorityScore,
        metadata: draft.metadata,
      });
    } else {
      created.push({
        ...draft,
        signalKey,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        occurrenceCount: 1,
      });
    }
  }

  for (const prev of openPrevious) {
    if (current.has(prev.signalKey)) continue;
    const resolvedAt = nowIso;
    resolved.push({
      ...prev,
      resolvedAt,
      resolvedByRole: context.resolvedByRole ?? context.profileKey,
      resolvedByUserId: context.resolvedByUserId,
      resolutionSeconds: calculateResolutionSeconds(prev.firstSeenAt, resolvedAt),
    });
  }

  return { created, updated, resolved };
}

export function summarizeSignalLearning(
  observations: readonly TodaySignalObservation[],
  opts: {
    range: TodaySignalLearningSummaryRange;
    nowIso?: string;
    criticalUnresolvedThresholdSeconds?: number;
    recurrenceExpectationCount?: number;
  }
): TodaySignalLearningSummary {
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const criticalThreshold =
    opts.criticalUnresolvedThresholdSeconds ?? DEFAULT_CRITICAL_UNRESOLVED_THRESHOLD_SECONDS;
  const recurrenceExpectation =
    opts.recurrenceExpectationCount ?? DEFAULT_RECURRENCE_EXPECTATION_COUNT;

  const fromMs = Date.parse(opts.range.fromIso);
  const toMs = Date.parse(opts.range.toIso);

  const inRange = observations.filter((row) => {
    const seenMs = Date.parse(row.lastSeenAt);
    return Number.isFinite(seenMs) && seenMs >= fromMs && seenMs <= toMs;
  });

  const recurrenceByType = new Map<TodaySignalKind, { totalOccurrences: number; count: number }>();
  for (const row of inRange) {
    const entry = recurrenceByType.get(row.signalType) ?? { totalOccurrences: 0, count: 0 };
    entry.totalOccurrences += row.occurrenceCount;
    entry.count += 1;
    recurrenceByType.set(row.signalType, entry);
  }

  const topRecurringSignalTypes = [...recurrenceByType.entries()]
    .map(([signalType, stats]) => ({
      signalType,
      totalOccurrences: stats.totalOccurrences,
      observationCount: stats.count,
    }))
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences || b.observationCount - a.observationCount);

  const unresolved = inRange
    .filter((row) => !row.resolvedAt)
    .map((row) => {
      const metrics = calculateSignalResolutionMetrics(row, { nowIso });
      return {
        signalKey: row.signalKey,
        signalType: row.signalType,
        ageSeconds: metrics.ageSeconds,
        priorityBand: row.priorityBand,
      };
    })
    .sort((a, b) => b.ageSeconds - a.ageSeconds);

  const longestUnresolvedSignals = unresolved.slice(0, 20);

  const resolutionByType = new Map<TodaySignalKind, { totalSeconds: number; count: number }>();
  const resolutionByRole = new Map<string, { totalSeconds: number; count: number }>();

  for (const row of inRange) {
    if (row.resolvedAt == null || row.resolutionSeconds == null) continue;
    const typeEntry = resolutionByType.get(row.signalType) ?? { totalSeconds: 0, count: 0 };
    typeEntry.totalSeconds += row.resolutionSeconds;
    typeEntry.count += 1;
    resolutionByType.set(row.signalType, typeEntry);

    const role = row.resolvedByRole?.trim();
    if (role) {
      const roleEntry = resolutionByRole.get(role) ?? { totalSeconds: 0, count: 0 };
      roleEntry.totalSeconds += row.resolutionSeconds;
      roleEntry.count += 1;
      resolutionByRole.set(role, roleEntry);
    }
  }

  const averageResolutionTimeBySignalType = [...resolutionByType.entries()]
    .map(([signalType, stats]) => ({
      signalType,
      avgSeconds: Math.round(stats.totalSeconds / stats.count),
      sampleCount: stats.count,
    }))
    .sort((a, b) => b.avgSeconds - a.avgSeconds);

  const averageResolutionTimeByRole = [...resolutionByRole.entries()]
    .map(([role, stats]) => ({
      role,
      avgSeconds: Math.round(stats.totalSeconds / stats.count),
      sampleCount: stats.count,
    }))
    .sort((a, b) => b.avgSeconds - a.avgSeconds);

  const criticalSignalsUnresolvedOverThreshold = unresolved.filter(
    (row) =>
      row.priorityBand === "critical" && row.ageSeconds >= criticalThreshold
  );

  const signalsRecurringMoreThanExpected = inRange
    .filter((row) => row.occurrenceCount > recurrenceExpectation)
    .map((row) => ({
      signalKey: row.signalKey,
      signalType: row.signalType,
      occurrenceCount: row.occurrenceCount,
    }))
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);

  return {
    computedAt: nowIso,
    range: opts.range,
    observationCount: inRange.length,
    topRecurringSignalTypes,
    longestUnresolvedSignals,
    averageResolutionTimeBySignalType,
    averageResolutionTimeByRole,
    criticalSignalsUnresolvedOverThreshold,
    signalsRecurringMoreThanExpected,
  };
}

export function flattenTodayFeedItems(
  feed: Pick<{ rightNow: TodayFeedItem[]; upNext: TodayFeedItem[]; comingUp: TodayFeedItem[] }, "rightNow" | "upNext" | "comingUp">
): TodayFeedItem[] {
  return [...feed.rightNow, ...feed.upNext, ...feed.comingUp];
}
