import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildImplantationSpeed } from "@/src/lib/surgeryOs/implantationSpeedCore";

const surgeryId = "00000000-0000-4000-8000-000000000042";

function baseInput(
  overrides: Partial<Parameters<typeof buildImplantationSpeed>[0]> = {}
) {
  return {
    surgeryId,
    patientLabel: "Jordan Patient",
    implantedGrafts: 0,
    events: [] as Parameters<typeof buildImplantationSpeed>[0]["events"],
    ...overrides,
  };
}

describe("implantationSpeedCore", () => {
  it("returns empty state when no implantation data exists", () => {
    const snapshot = buildImplantationSpeed(baseInput());

    assert.equal(snapshot.summary, "No implantation speed data available.");
    assert.equal(snapshot.implantationRatePerHour, null);
    assert.equal(snapshot.implantationDurationMinutes, null);
  });

  it("calculates implantation rate per hour", () => {
    const snapshot = buildImplantationSpeed(
      baseInput({
        implantedGrafts: 642,
        events: [{ eventKind: "implantation_started", occurredAt: "2026-07-01T12:00:00.000Z" }],
        now: new Date("2026-07-01T13:00:00.000Z"),
      })
    );

    assert.equal(snapshot.implantedGrafts, 642);
    assert.equal(snapshot.implantationRatePerHour, 642);
    assert.equal(snapshot.implantationDurationMinutes, 60);
  });

  it("calculates implantation duration in minutes", () => {
    const snapshot = buildImplantationSpeed(
      baseInput({
        implantedGrafts: 300,
        events: [
          { eventKind: "implantation_started", occurredAt: "2026-07-01T14:00:00.000Z" },
          { eventKind: "procedure_completed", occurredAt: "2026-07-01T14:30:00.000Z" },
        ],
      })
    );

    assert.equal(snapshot.implantationDurationMinutes, 30);
    assert.equal(snapshot.implantationRatePerHour, 600);
  });

  it("handles partial procedures safely without NaN outputs", () => {
    const snapshot = buildImplantationSpeed(
      baseInput({
        implantedGrafts: 45,
        events: [{ eventKind: "implantation_started", occurredAt: "2026-07-01T16:50:00.000Z" }],
        now: new Date("2026-07-01T17:00:00.000Z"),
      })
    );

    assert.ok(snapshot.implantationRatePerHour != null);
    assert.ok(!Number.isNaN(snapshot.implantationRatePerHour));
    assert.ok(!Number.isNaN(snapshot.efficiencyScore));
  });
});
