import assert from "node:assert/strict";
import { test } from "node:test";

import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";
import {
  buildSignalObservationKey,
  calculateResolutionSeconds,
  calculateSignalResolutionMetrics,
  deriveSignalObservationSnapshot,
  reconcileSignalObservations,
  sanitizeSignalLearningMetadata,
  summarizeSignalLearning,
  type TodaySignalObservation,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearning";

const T0 = "2026-07-03T08:00:00.000Z";
const T1 = "2026-07-03T08:05:00.000Z";
const T2 = "2026-07-03T09:00:00.000Z";

function feedItem(overrides: Partial<TodayFeedItem> & Pick<TodayFeedItem, "id">): TodayFeedItem {
  return {
    personLabel: "James Morrison",
    actionLabel: "James says they're here",
    detailLine: "Awaiting reception confirmation",
    href: "/fi-admin/x/reception/abc",
    severity: "critical",
    bucket: "right_now",
    priorityScore: 88,
    priorityBand: "critical",
    autoResolves: true,
    groupKey: "reception:arrival_intent",
    ...overrides,
  };
}

test("buildSignalObservationKey is deterministic for the same entity signal", () => {
  const itemA = feedItem({ id: "reception-booking-42" });
  const itemB = feedItem({
    id: "reception-booking-42",
    actionLabel: "James says they're here",
    personLabel: "James Morrison",
  });

  assert.equal(buildSignalObservationKey(itemA), buildSignalObservationKey(itemB));
  assert.equal(buildSignalObservationKey(itemA), "arrival_intent::booking::booking-42");
});

test("new signal creates first_seen_at", () => {
  const items = [feedItem({ id: "reception-booking-1" })];
  const snapshot = deriveSignalObservationSnapshot(items, { nowIso: T0 });
  const observation = snapshot.get(buildSignalObservationKey(items[0]!));

  assert.ok(observation);
  assert.equal(observation.firstSeenAt, T0);
  assert.equal(observation.lastSeenAt, T0);
  assert.equal(observation.occurrenceCount, 1);
  assert.equal(observation.resolvedAt, undefined);
});

test("repeated signal updates last_seen_at and increments occurrence_count", () => {
  const key = buildSignalObservationKey(feedItem({ id: "reception-booking-1" }));
  const previous: TodaySignalObservation[] = [
    {
      signalKey: key,
      entityKind: "booking",
      entityId: "1",
      signalType: "arrival_intent",
      priorityBand: "critical",
      priorityScore: 88,
      firstSeenAt: T0,
      lastSeenAt: T0,
      occurrenceCount: 1,
      metadata: { bucket: "right_now" },
    },
  ];

  const current = deriveSignalObservationSnapshot(
    [feedItem({ id: "reception-booking-1" })],
    { nowIso: T1 }
  );
  const result = reconcileSignalObservations(previous, current, { nowIso: T1 });

  assert.equal(result.created.length, 0);
  assert.equal(result.updated.length, 1);
  assert.equal(result.updated[0]?.lastSeenAt, T1);
  assert.equal(result.updated[0]?.occurrenceCount, 2);
  assert.equal(result.updated[0]?.firstSeenAt, T0);
});

test("missing previous signal marks resolved", () => {
  const key = buildSignalObservationKey(feedItem({ id: "reception-booking-1" }));
  const previous: TodaySignalObservation[] = [
    {
      signalKey: key,
      entityKind: "booking",
      entityId: "1",
      signalType: "arrival_intent",
      firstSeenAt: T0,
      lastSeenAt: T0,
      occurrenceCount: 2,
      metadata: {},
    },
  ];

  const current = deriveSignalObservationSnapshot([], { nowIso: T1 });
  const result = reconcileSignalObservations(previous, current, {
    nowIso: T1,
    profileKey: "reception",
  });

  assert.equal(result.resolved.length, 1);
  assert.equal(result.resolved[0]?.resolvedAt, T1);
  assert.equal(result.resolved[0]?.resolvedByRole, "reception");
});

test("resolution_seconds calculated correctly", () => {
  const seconds = calculateResolutionSeconds(T0, T2);
  assert.equal(seconds, 3600);

  const metrics = calculateSignalResolutionMetrics(
    {
      signalKey: "k",
      signalType: "task_due",
      firstSeenAt: T0,
      lastSeenAt: T0,
      occurrenceCount: 1,
      resolvedAt: T2,
      resolutionSeconds: seconds,
      metadata: {},
    },
    { nowIso: T2 }
  );

  assert.equal(metrics.resolutionSeconds, 3600);
  assert.equal(metrics.isUnresolved, false);
});

test("PHI-like fields are stripped from metadata", () => {
  const item = feedItem({
    id: "stale-lead-9",
    personLabel: "Emma Walsh",
    actionLabel: "Call Emma",
    detailLine: "No follow-up for 20 days",
    groupKey: undefined,
  });

  const metadata = sanitizeSignalLearningMetadata(item);

  assert.equal(metadata.personLabel, undefined);
  assert.equal(metadata.actionLabel, undefined);
  assert.equal(metadata.detailLine, undefined);
  assert.equal(metadata.patientName, undefined);
  assert.equal(metadata.bucket, "right_now");
  assert.equal(metadata.autoResolves, true);
});

test("summary ranks longest unresolved signal first", () => {
  const observations: TodaySignalObservation[] = [
    {
      signalKey: "a::booking::1",
      signalType: "arrival_intent",
      firstSeenAt: "2026-07-03T06:00:00.000Z",
      lastSeenAt: T1,
      occurrenceCount: 1,
      priorityBand: "critical",
      metadata: {},
    },
    {
      signalKey: "b::task::2",
      signalType: "task_due",
      firstSeenAt: "2026-07-03T07:30:00.000Z",
      lastSeenAt: T1,
      occurrenceCount: 1,
      priorityBand: "high",
      metadata: {},
    },
  ];

  const summary = summarizeSignalLearning(observations, {
    range: { fromIso: "2026-07-03T00:00:00.000Z", toIso: T2 },
    nowIso: T2,
  });

  assert.equal(summary.longestUnresolvedSignals[0]?.signalKey, "a::booking::1");
  assert.ok(
    (summary.longestUnresolvedSignals[0]?.ageSeconds ?? 0) >
      (summary.longestUnresolvedSignals[1]?.ageSeconds ?? 0)
  );
});

test("recurring signal increments occurrence_count across reconciles", () => {
  const item = feedItem({ id: "reception-booking-7" });
  const key = buildSignalObservationKey(item);

  let open: TodaySignalObservation[] = [];
  for (let i = 0; i < 3; i += 1) {
    const at = new Date(Date.parse(T0) + i * 60_000).toISOString();
    const current = deriveSignalObservationSnapshot([item], { nowIso: at });
    const result = reconcileSignalObservations(open, current, { nowIso: at });
    open = result.updated.length > 0 ? result.updated : result.created;
    assert.equal(open[0]?.signalKey, key);
  }

  assert.equal(open[0]?.occurrenceCount, 3);
});

test("summarizeSignalLearning surfaces recurring and critical unresolved signals", () => {
  const observations: TodaySignalObservation[] = [
    {
      signalKey: "payment_blocker::surgery_payment::1",
      signalType: "payment_blocker",
      firstSeenAt: "2026-07-03T05:00:00.000Z",
      lastSeenAt: T1,
      occurrenceCount: 5,
      priorityBand: "critical",
      metadata: {},
    },
    {
      signalKey: "task_due::task::9",
      signalType: "task_due",
      firstSeenAt: T0,
      lastSeenAt: T1,
      occurrenceCount: 2,
      resolvedAt: T2,
      resolutionSeconds: 3600,
      resolvedByRole: "reception",
      metadata: {},
    },
  ];

  const summary = summarizeSignalLearning(observations, {
    range: { fromIso: "2026-07-03T00:00:00.000Z", toIso: T2 },
    nowIso: T2,
    criticalUnresolvedThresholdSeconds: 1800,
    recurrenceExpectationCount: 3,
  });

  assert.ok(summary.signalsRecurringMoreThanExpected.some((row) => row.occurrenceCount === 5));
  assert.ok(
    summary.criticalSignalsUnresolvedOverThreshold.some(
      (row) => row.signalType === "payment_blocker"
    )
  );
  assert.ok(
    summary.averageResolutionTimeByRole.some(
      (row) => row.role === "reception" && row.avgSeconds === 3600
    )
  );
});
