import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSurgeonRiskPatterns } from "@/src/lib/surgeryOs/surgeonRiskPatternCore";
import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";

const surgeonId = "00000000-0000-4000-8000-000000000101";

function record(index: number, overrides: Partial<SurgeonProcedurePerformanceRecord> = {}): SurgeonProcedurePerformanceRecord {
  return {
    surgeryId: `00000000-0000-4000-8000-0000000003${String(index).padStart(2, "0")}`,
    surgeonId,
    surgeonName: "Dr Seetal",
    completedAt: `2026-05-${String(index + 1).padStart(2, "0")}T15:00:00.000Z`,
    procedureDurationMinutes: 480,
    extractionVelocityPerHour: 620,
    implantationSpeedPerHour: 590,
    transectionRate: 2,
    hairsPerGraft: 2.3,
    ...overrides,
  };
}

describe("surgeonRiskPatternCore", () => {
  it("returns safe empty state when no risks detected", () => {
    const snapshot = buildSurgeonRiskPatterns({
      surgeonId,
      surgeonName: "Dr Seetal",
      records: [record(0), record(1), record(2)],
    });

    assert.equal(snapshot.totalRisks, 0);
    assert.equal(snapshot.summary, "No surgeon performance risks detected.");
  });

  it("detects rising transection trend", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(i, {
        transectionRate: i < 4 ? 2 : 2 + (i - 3) * 1.5,
        completedAt: `2026-05-${String(i + 1).padStart(2, "0")}T15:00:00.000Z`,
      })
    );

    const snapshot = buildSurgeonRiskPatterns({
      surgeonId,
      surgeonName: "Dr Seetal",
      records,
    });

    assert.ok(snapshot.detectedPatterns.some((p) => /Transection rate increased/i.test(p.title)));
  });

  it("detects slowing extraction trend", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(i, {
        extractionVelocityPerHour: i < 4 ? 650 : 650 - (i - 3) * 40,
        completedAt: `2026-05-${String(i + 1).padStart(2, "0")}T15:00:00.000Z`,
      })
    );

    const snapshot = buildSurgeonRiskPatterns({
      surgeonId,
      surgeonName: "Dr Seetal",
      records,
    });

    assert.ok(snapshot.detectedPatterns.some((p) => /Extraction velocity slowed/i.test(p.title)));
  });

  it("detects increasing procedure duration", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      record(i, {
        procedureDurationMinutes: i < 4 ? 470 : 470 + (i - 3) * 35,
        completedAt: `2026-05-${String(i + 1).padStart(2, "0")}T15:00:00.000Z`,
      })
    );

    const snapshot = buildSurgeonRiskPatterns({
      surgeonId,
      surgeonName: "Dr Seetal",
      records,
    });

    assert.ok(snapshot.detectedPatterns.some((p) => /Procedure duration increased/i.test(p.title)));
  });
});
