import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLiveProcedureTimeline,
  DEFAULT_LIVE_PROCEDURE_TIMELINE_THRESHOLDS,
  LIVE_PROCEDURE_TIMELINE_STAGE_LABELS,
} from "@/src/lib/surgeryOs/liveProcedureTimelineCore";

const surgeryId = "00000000-0000-4000-8000-000000000020";

function baseSurgery(
  overrides: Partial<Parameters<typeof buildLiveProcedureTimeline>[0]["surgery"]> = {}
) {
  return {
    surgeryId,
    patientLabel: "Alex Patient",
    status: "in_progress",
    procedurePhase: "extraction" as const,
    scheduledStartAt: "2026-07-01T08:00:00.000Z",
    scheduledEndAt: "2026-07-01T16:00:00.000Z",
    actualStartAt: "2026-07-01T08:15:00.000Z",
    actualEndAt: null,
    ...overrides,
  };
}

describe("liveProcedureTimelineCore", () => {
  it("returns empty state when no events are recorded", () => {
    const snapshot = buildLiveProcedureTimeline({
      surgery: baseSurgery(),
      events: [],
      now: new Date("2026-07-01T10:00:00.000Z"),
    });

    assert.equal(snapshot.timelineItems.length, 0);
    assert.equal(snapshot.currentStage, null);
    assert.equal(snapshot.summary, "No live theatre events recorded yet.");
    assert.equal(snapshot.delaySignals.length, 0);
  });

  it("orders timeline items chronologically", () => {
    const snapshot = buildLiveProcedureTimeline({
      surgery: baseSurgery(),
      events: [
        { eventKind: "extraction_started", occurredAt: "2026-07-01T09:30:00.000Z" },
        { eventKind: "patient_arrived", occurredAt: "2026-07-01T08:20:00.000Z" },
        { eventKind: "anaesthetic_complete", occurredAt: "2026-07-01T09:00:00.000Z" },
      ],
      now: new Date("2026-07-01T10:00:00.000Z"),
    });

    assert.deepEqual(
      snapshot.timelineItems.map((item) => item.stage),
      ["patient_checked_in", "anaesthetic_completed", "extraction_started"]
    );
    assert.ok(
      snapshot.timelineItems.every((item, index, arr) => {
        if (index === 0) return true;
        return Date.parse(item.occurredAt) >= Date.parse(arr[index - 1]!.occurredAt);
      })
    );
  });

  it("detects current stage from latest meaningful event", () => {
    const snapshot = buildLiveProcedureTimeline({
      surgery: baseSurgery({ procedurePhase: "implantation" }),
      events: [
        { eventKind: "patient_arrived", occurredAt: "2026-07-01T08:20:00.000Z" },
        { eventKind: "extraction_started", occurredAt: "2026-07-01T09:00:00.000Z" },
        { eventKind: "implantation_started", occurredAt: "2026-07-01T12:00:00.000Z" },
      ],
      now: new Date("2026-07-01T13:00:00.000Z"),
    });

    assert.equal(snapshot.currentStage, "implantation_started");
    assert.equal(
      snapshot.currentStageLabel,
      LIVE_PROCEDURE_TIMELINE_STAGE_LABELS.implantation_started
    );
  });

  it("computes elapsed duration from actual start", () => {
    const snapshot = buildLiveProcedureTimeline({
      surgery: baseSurgery(),
      events: [{ eventKind: "patient_arrived", occurredAt: "2026-07-01T08:20:00.000Z" }],
      now: new Date("2026-07-01T10:15:00.000Z"),
    });

    assert.equal(snapshot.elapsedMinutes, 120);
    assert.ok(!Number.isNaN(snapshot.elapsedMinutes));
  });

  it("generates delay signals for stage overrun and behind schedule", () => {
    const snapshot = buildLiveProcedureTimeline({
      surgery: baseSurgery({
        scheduledEndAt: "2026-07-01T12:00:00.000Z",
        procedurePhase: "extraction",
      }),
      events: [
        { eventKind: "patient_arrived", occurredAt: "2026-07-01T08:00:00.000Z" },
        { eventKind: "extraction_started", occurredAt: "2026-07-01T08:05:00.000Z" },
      ],
      now: new Date("2026-07-01T14:00:00.000Z"),
      thresholds: {
        ...DEFAULT_LIVE_PROCEDURE_TIMELINE_THRESHOLDS,
        stageWarningMinutes: { extraction_started: 120 },
        overallDelayMinutes: 15,
      },
    });

    assert.ok(snapshot.delaySignals.some((signal) => signal.kind === "stage_overrun"));
    assert.ok(snapshot.delaySignals.some((signal) => signal.kind === "behind_schedule"));
  });

  it("handles partial events safely without NaN outputs", () => {
    const snapshot = buildLiveProcedureTimeline({
      surgery: baseSurgery({
        actualStartAt: null,
        scheduledStartAt: null,
        scheduledEndAt: "not-a-date",
      }),
      events: [{ eventKind: "patient_arrived", occurredAt: "2026-07-01T08:00:00.000Z" }],
      now: new Date("2026-07-01T09:00:00.000Z"),
    });

    assert.equal(snapshot.timelineItems.length, 1);
    assert.equal(snapshot.elapsedMinutes, 60);
    assert.ok(snapshot.stageDurations.every((d) => Number.isFinite(d.durationMinutes)));
    assert.ok(
      snapshot.delaySignals.every(
        (d) => Number.isFinite(d.elapsedMinutes) && Number.isFinite(d.thresholdMinutes)
      )
    );
    assert.equal(snapshot.expectedCompletionTime, null);
  });

  it("does not expose raw event ids in timeline items", () => {
    const snapshot = buildLiveProcedureTimeline({
      surgery: baseSurgery(),
      events: [{ eventKind: "procedure_completed", occurredAt: "2026-07-01T15:00:00.000Z" }],
      now: new Date("2026-07-01T15:30:00.000Z"),
    });

    for (const item of snapshot.timelineItems) {
      assert.ok(!("id" in item));
      assert.ok(typeof item.stage === "string");
      assert.ok(typeof item.eventLabel === "string");
    }
  });
});
