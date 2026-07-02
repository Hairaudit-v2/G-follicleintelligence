import assert from "node:assert/strict";
import { test } from "node:test";

import { summarizeSignalLearning, type TodaySignalObservation } from "@/src/lib/fiOs/todaySignal/todaySignalLearning";
import {
  assertTodaySignalLearningViewPrivacy,
  buildTodaySignalLearningSummaryView,
  formatSignalLearningDuration,
  safeSignalTypeLabel,
} from "@/src/lib/fiOs/todaySignal/todaySignalLearningSummary";

const RANGE = {
  fromIso: "2026-07-01T00:00:00.000Z",
  toIso: "2026-07-08T00:00:00.000Z",
};

function observation(
  overrides: Partial<TodaySignalObservation> & Pick<TodaySignalObservation, "signalKey" | "signalType">
): TodaySignalObservation {
  return {
    firstSeenAt: "2026-07-03T06:00:00.000Z",
    lastSeenAt: "2026-07-03T08:00:00.000Z",
    occurrenceCount: 1,
    metadata: { bucket: "right_now", patientName: "Should never surface" },
    ...overrides,
  };
}

test("summary view does not expose entity_id or signal_key", () => {
  const summary = summarizeSignalLearning(
    [
      observation({
        signalKey: "payment_blocker::payment::secret-entity-99",
        signalType: "payment_blocker",
        entityId: "secret-entity-99",
        entityKind: "payment",
        priorityBand: "critical",
      }),
    ],
    {
      range: RANGE,
      nowIso: "2026-07-03T09:00:00.000Z",
      criticalUnresolvedThresholdSeconds: 60,
    }
  );

  const view = buildTodaySignalLearningSummaryView(summary, { rangeDays: 7 });
  const serialized = JSON.stringify(view);

  assert.equal(serialized.includes("secret-entity-99"), false);
  assert.equal(serialized.includes("signal_key"), false);
  assert.equal(serialized.includes("signalKey"), false);
  assert.equal(serialized.includes("entity_id"), false);
  assert.equal(serialized.includes("entityId"), false);
  assert.equal(serialized.includes("patientName"), false);
  assert.doesNotThrow(() => assertTodaySignalLearningViewPrivacy(view));
});

test("critical unresolved signals are ranked by longest open", () => {
  const summary = summarizeSignalLearning(
    [
      observation({
        signalKey: "a::booking::1",
        signalType: "arrival_intent",
        firstSeenAt: "2026-07-03T07:00:00.000Z",
        priorityBand: "critical",
      }),
      observation({
        signalKey: "b::payment::2",
        signalType: "payment_blocker",
        firstSeenAt: "2026-07-03T05:00:00.000Z",
        priorityBand: "critical",
      }),
    ],
    {
      range: RANGE,
      nowIso: "2026-07-03T09:00:00.000Z",
      criticalUnresolvedThresholdSeconds: 60,
    }
  );

  const view = buildTodaySignalLearningSummaryView(summary, { rangeDays: 7 });
  assert.equal(view.unresolvedCriticalSignals.length, 2);
  assert.equal(view.unresolvedCriticalSignals[0]?.signalType, "Payment blocker");
  assert.equal(view.unresolvedCriticalSignals[1]?.signalType, "Patient arrival intent");
});

test("recurring signals are ranked by occurrence count", () => {
  const summary = summarizeSignalLearning(
    [
      observation({
        signalKey: "a::lead::1",
        signalType: "stale_lead",
        occurrenceCount: 4,
      }),
      observation({
        signalKey: "b::booking::2",
        signalType: "arrival_intent",
        occurrenceCount: 8,
      }),
      observation({
        signalKey: "c::payment::3",
        signalType: "payment_blocker",
        occurrenceCount: 6,
      }),
    ],
    { range: RANGE, nowIso: "2026-07-03T09:00:00.000Z" }
  );

  const view = buildTodaySignalLearningSummaryView(summary, { rangeDays: 7 });
  assert.deepEqual(
    view.recurringSignals.map((row) => row.count),
    [8, 6, 4]
  );
});

test("duration formatting handles minutes, hours, and days", () => {
  assert.equal(formatSignalLearningDuration(45), "Less than a minute");
  assert.equal(formatSignalLearningDuration(120), "2 minutes");
  assert.equal(formatSignalLearningDuration(3600), "1 hour");
  assert.equal(formatSignalLearningDuration(7200), "2 hours");
  assert.equal(formatSignalLearningDuration(86_400), "1 day");
  assert.equal(formatSignalLearningDuration(172_800), "2 days");
});

test("disabled learning returns disabled state", async () => {
  const prev = process.env.FI_TODAY_SIGNAL_LEARNING_ENABLED;
  process.env.FI_TODAY_SIGNAL_LEARNING_ENABLED = "false";
  try {
    const { loadTodaySignalLearningSummaryForTenant } = await import(
      "@/src/lib/fiOs/todaySignal/todaySignalLearningSummary.server"
    );
    const model = await loadTodaySignalLearningSummaryForTenant(
      "11111111-1111-4111-8111-111111111111"
    );
    assert.equal(model.status, "disabled");
  } finally {
    if (prev === undefined) delete process.env.FI_TODAY_SIGNAL_LEARNING_ENABLED;
    else process.env.FI_TODAY_SIGNAL_LEARNING_ENABLED = prev;
  }
});

test("empty learning returns empty state when no observations exist", () => {
  const summary = summarizeSignalLearning([], {
    range: RANGE,
    nowIso: RANGE.toIso,
  });
  assert.equal(summary.observationCount, 0);

  const view = buildTodaySignalLearningSummaryView(summary, { rangeDays: 7 });
  assert.equal(view.recurringSignals.length, 0);
  assert.equal(view.unresolvedCriticalSignals.length, 0);
  assert.equal(view.health, "quiet");
});

test("safeSignalTypeLabel maps known signal types", () => {
  assert.equal(safeSignalTypeLabel("arrival_intent"), "Patient arrival intent");
  assert.equal(safeSignalTypeLabel("payment_blocker"), "Payment blocker");
  assert.equal(safeSignalTypeLabel("pathology_review_pending"), "Pathology review pending");
  assert.equal(safeSignalTypeLabel("surgery_readiness_blocker"), "Surgery readiness blocker");
  assert.equal(safeSignalTypeLabel("stale_lead"), "Stale lead");
  assert.equal(safeSignalTypeLabel("staff_compliance_alert"), "Staff compliance alert");
  assert.equal(safeSignalTypeLabel("consultation_next_action"), "Consultation next action");
});

test("unknown signal type is safely humanized", () => {
  assert.equal(safeSignalTypeLabel("custom_workflow_hold"), "Custom Workflow Hold");
});
