import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTransectionMonitoring } from "@/src/lib/surgeryOs/transectionMonitoringCore";

const surgeryId = "00000000-0000-4000-8000-000000000041";

function baseInput(
  overrides: Partial<Parameters<typeof buildTransectionMonitoring>[0]> = {}
) {
  return {
    surgeryId,
    patientLabel: "Jordan Patient",
    trayEvents: [],
    ...overrides,
  };
}

describe("transectionMonitoringCore", () => {
  it("returns empty state when no tray review data exists", () => {
    const snapshot = buildTransectionMonitoring(baseInput());

    assert.equal(snapshot.summary, "No transection monitoring data available.");
    assert.equal(snapshot.totalGraftsReviewed, 0);
    assert.equal(snapshot.transectionRate, null);
    assert.equal(snapshot.warnings.some((w) => w.kind === "no_data"), true);
  });

  it("calculates transection rate from confirmed tray damage", () => {
    const snapshot = buildTransectionMonitoring(
      baseInput({
        trayEvents: [
          {
            eventType: "tray_count",
            reviewStatus: "confirmed",
            singles: 98,
            doubles: 0,
            triples: 0,
            multiples: 0,
            deltaDiscarded: 2,
            note: "partial transection on 2 units",
          },
        ],
      })
    );

    assert.equal(snapshot.totalGraftsReviewed, 100);
    assert.equal(snapshot.partialTransections, 2);
    assert.equal(snapshot.transectionRate, 2);
  });

  it("computes quality score inversely from transection rate", () => {
    const snapshot = buildTransectionMonitoring(
      baseInput({
        trayEvents: [
          {
            eventType: "tray_count",
            reviewStatus: "confirmed",
            singles: 90,
            doubles: 0,
            triples: 0,
            multiples: 0,
            deltaDiscarded: 10,
            note: "full transection",
          },
        ],
      })
    );

    assert.equal(snapshot.transectionRate, 10);
    assert.equal(snapshot.qualityScore, 20);
  });

  it("maps rate thresholds to status labels", () => {
    const excellent = buildTransectionMonitoring(
      baseInput({
        trayEvents: [
          {
            eventType: "tray_count",
            reviewStatus: "confirmed",
            singles: 99,
            doubles: 0,
            triples: 0,
            multiples: 0,
            deltaDiscarded: 1,
            note: "partial transection",
          },
        ],
      })
    );
    const critical = buildTransectionMonitoring(
      baseInput({
        trayEvents: [
          {
            eventType: "tray_count",
            reviewStatus: "confirmed",
            singles: 90,
            doubles: 0,
            triples: 0,
            multiples: 0,
            deltaDiscarded: 10,
            note: "full transection",
          },
        ],
      })
    );

    assert.equal(excellent.status, "excellent");
    assert.equal(critical.status, "critical");
  });

  it("is division-by-zero safe when no reviewed grafts exist", () => {
    const snapshot = buildTransectionMonitoring(
      baseInput({
        trayEvents: [
          {
            eventType: "tray_count",
            reviewStatus: "pending",
            singles: 50,
            doubles: 0,
            triples: 0,
            multiples: 0,
            deltaDiscarded: 0,
            note: null,
          },
        ],
      })
    );

    assert.equal(snapshot.transectionRate, null);
    assert.equal(snapshot.qualityScore, 100);
    assert.ok(!Number.isNaN(snapshot.qualityScore));
  });
});
