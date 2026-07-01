import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSurgeonConsistency } from "@/src/lib/surgeryOs/surgeonConsistencyCore";
import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";

const surgeonId = "00000000-0000-4000-8000-000000000101";

function record(index: number, overrides: Partial<SurgeonProcedurePerformanceRecord> = {}): SurgeonProcedurePerformanceRecord {
  return {
    surgeryId: `00000000-0000-4000-8000-0000000002${String(index).padStart(2, "0")}`,
    surgeonId,
    surgeonName: "Dr Seetal",
    completedAt: `2026-06-${String(index + 1).padStart(2, "0")}T15:00:00.000Z`,
    procedureDurationMinutes: 480,
    extractionVelocityPerHour: 610,
    implantationSpeedPerHour: 590,
    transectionRate: 2.1,
    hairsPerGraft: 2.3,
    ...overrides,
  };
}

describe("surgeonConsistencyCore", () => {
  it("returns elite consistency for stable metrics", () => {
    const snapshot = buildSurgeonConsistency({
      surgeonId,
      surgeonName: "Dr Seetal",
      records: Array.from({ length: 12 }, (_, i) => record(i)),
    });

    assert.equal(snapshot.status, "elite");
    assert.ok(snapshot.consistencyScore >= 85);
    assert.ok(snapshot.extractionVariance != null);
    assert.match(snapshot.summary, /consistency score/i);
  });

  it("detects inconsistent performance with high variance", () => {
    const snapshot = buildSurgeonConsistency({
      surgeonId,
      surgeonName: "Dr Seetal",
      records: [
        record(0, { extractionVelocityPerHour: 800, transectionRate: 1.5 }),
        record(1, { extractionVelocityPerHour: 450, transectionRate: 6 }),
        record(2, { extractionVelocityPerHour: 720, transectionRate: 2 }),
        record(3, { extractionVelocityPerHour: 400, transectionRate: 8 }),
        record(4, { extractionVelocityPerHour: 650, transectionRate: 3 }),
        record(5, { extractionVelocityPerHour: 380, transectionRate: 9 }),
        record(6, { extractionVelocityPerHour: 700, transectionRate: 2.5 }),
        record(7, { extractionVelocityPerHour: 420, transectionRate: 7 }),
        record(8, { extractionVelocityPerHour: 760, transectionRate: 1.8 }),
        record(9, { extractionVelocityPerHour: 390, transectionRate: 8.5 }),
      ],
    });

    assert.ok(["inconsistent", "concerning"].includes(snapshot.status));
    assert.ok(snapshot.consistencyScore < 70);
  });

  it("supports safe empty state", () => {
    const snapshot = buildSurgeonConsistency({
      surgeonId,
      surgeonName: "Dr Seetal",
      records: [],
    });

    assert.equal(snapshot.consistencyScore, 0);
    assert.match(snapshot.summary, /No surgeon consistency data available/i);
  });
});
