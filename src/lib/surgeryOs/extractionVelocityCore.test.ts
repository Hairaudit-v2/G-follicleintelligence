import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExtractionVelocity } from "@/src/lib/surgeryOs/extractionVelocityCore";

const surgeryId = "00000000-0000-4000-8000-000000000040";

function baseInput(
  overrides: Partial<Parameters<typeof buildExtractionVelocity>[0]> = {}
) {
  return {
    surgeryId,
    patientLabel: "Jordan Patient",
    extractedGrafts: 0,
    events: [] as Parameters<typeof buildExtractionVelocity>[0]["events"],
    graftEvents: [] as Parameters<typeof buildExtractionVelocity>[0]["graftEvents"],
    ...overrides,
  };
}

describe("extractionVelocityCore", () => {
  it("returns empty state when no extraction data exists", () => {
    const snapshot = buildExtractionVelocity(baseInput());

    assert.equal(snapshot.summary, "No extraction velocity data available.");
    assert.equal(snapshot.extractionRatePerHour, null);
    assert.equal(snapshot.hourlyBreakdown.length, 0);
    assert.equal(snapshot.fatigueSignal, false);
  });

  it("calculates hourly extraction rate from graft events", () => {
    const snapshot = buildExtractionVelocity(
      baseInput({
        extractedGrafts: 600,
        events: [{ eventKind: "extraction_started", occurredAt: "2026-07-01T09:00:00.000Z" }],
        graftEvents: [
          { occurredAt: "2026-07-01T09:15:00.000Z", deltaExtracted: 300 },
          { occurredAt: "2026-07-01T10:15:00.000Z", deltaExtracted: 300 },
        ],
        now: new Date("2026-07-01T10:30:00.000Z"),
      })
    );

    assert.equal(snapshot.graftsExtracted, 600);
    assert.ok(snapshot.extractionRatePerHour != null && snapshot.extractionRatePerHour > 0);
    assert.ok(snapshot.hourlyBreakdown.length >= 1);
    assert.ok(Number.isFinite(snapshot.extractionRatePerHour));
  });

  it("detects efficiency decline between first and second half", () => {
    const snapshot = buildExtractionVelocity(
      baseInput({
        extractedGrafts: 800,
        events: [{ eventKind: "extraction_started", occurredAt: "2026-07-01T08:00:00.000Z" }],
        graftEvents: [
          { occurredAt: "2026-07-01T08:20:00.000Z", deltaExtracted: 400 },
          { occurredAt: "2026-07-01T08:40:00.000Z", deltaExtracted: 200 },
          { occurredAt: "2026-07-01T09:40:00.000Z", deltaExtracted: 100 },
          { occurredAt: "2026-07-01T10:00:00.000Z", deltaExtracted: 100 },
        ],
        now: new Date("2026-07-01T10:30:00.000Z"),
      })
    );

    assert.ok(snapshot.efficiencyDeclinePercent != null);
    assert.ok(snapshot.efficiencyDeclinePercent >= 15);
    assert.equal(snapshot.trendDirection, "down");
  });

  it("raises fatigue signal when decline exceeds threshold", () => {
    const snapshot = buildExtractionVelocity(
      baseInput({
        extractedGrafts: 800,
        events: [{ eventKind: "extraction_started", occurredAt: "2026-07-01T08:00:00.000Z" }],
        graftEvents: [
          { occurredAt: "2026-07-01T08:20:00.000Z", deltaExtracted: 400 },
          { occurredAt: "2026-07-01T08:40:00.000Z", deltaExtracted: 200 },
          { occurredAt: "2026-07-01T09:40:00.000Z", deltaExtracted: 100 },
          { occurredAt: "2026-07-01T10:00:00.000Z", deltaExtracted: 100 },
        ],
        now: new Date("2026-07-01T10:30:00.000Z"),
      })
    );

    assert.equal(snapshot.fatigueSignal, true);
    assert.match(snapshot.summary, /fatigue/i);
  });

  it("handles partial procedures safely without NaN outputs", () => {
    const snapshot = buildExtractionVelocity(
      baseInput({
        extractedGrafts: 120,
        events: [{ eventKind: "extraction_started", occurredAt: "2026-07-01T11:45:00.000Z" }],
        now: new Date("2026-07-01T12:00:00.000Z"),
      })
    );

    assert.ok(snapshot.extractionRatePerHour != null);
    assert.ok(!Number.isNaN(snapshot.extractionRatePerHour));
    assert.ok(
      snapshot.efficiencyDeclinePercent == null ||
        !Number.isNaN(snapshot.efficiencyDeclinePercent)
    );
  });
});
