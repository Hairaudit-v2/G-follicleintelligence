import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSurgeonPerformanceScore,
  buildSurgeonPerformanceScores,
  mapSurgeonPerformanceGrade,
} from "@/src/lib/surgeryOs/surgeonPerformanceScoreCore";
import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";

const surgeonId = "00000000-0000-4000-8000-000000000101";

function record(overrides: Partial<SurgeonProcedurePerformanceRecord> = {}): SurgeonProcedurePerformanceRecord {
  return {
    surgeryId: "00000000-0000-4000-8000-000000000401",
    surgeonId,
    surgeonName: "Dr Seetal",
    completedAt: "2026-06-01T15:00:00.000Z",
    procedureDurationMinutes: 470,
    extractionVelocityPerHour: 640,
    implantationSpeedPerHour: 610,
    transectionRate: 2,
    hairsPerGraft: 2.4,
    ...overrides,
  };
}

describe("surgeonPerformanceScoreCore", () => {
  it("clamps score between 0 and 100", () => {
    const high = buildSurgeonPerformanceScore({
      surgeonId,
      surgeonName: "Dr Seetal",
      records: [record({ extractionVelocityPerHour: 900, implantationSpeedPerHour: 850, transectionRate: 0.5 })],
      consistencyScore: 95,
    });
    assert.ok(high.score >= 0 && high.score <= 100);

    const low = buildSurgeonPerformanceScore({
      surgeonId,
      surgeonName: "Dr Seetal",
      records: [record({ extractionVelocityPerHour: 200, implantationSpeedPerHour: 180, transectionRate: 14 })],
      consistencyScore: 30,
    });
    assert.ok(low.score >= 0 && low.score <= 100);
  });

  it("maps grades correctly", () => {
    assert.equal(mapSurgeonPerformanceGrade(94), "elite");
    assert.equal(mapSurgeonPerformanceGrade(85), "excellent");
    assert.equal(mapSurgeonPerformanceGrade(75), "strong");
    assert.equal(mapSurgeonPerformanceGrade(60), "watch");
    assert.equal(mapSurgeonPerformanceGrade(40), "poor");
  });

  it("computes percentile among peer surgeons", () => {
    const scores = buildSurgeonPerformanceScores([
      {
        surgeonId,
        surgeonName: "Dr Seetal",
        records: [record()],
        consistencyScore: 90,
      },
      {
        surgeonId: "00000000-0000-4000-8000-000000000102",
        surgeonName: "Dr Patel",
        records: [record({ extractionVelocityPerHour: 500, implantationSpeedPerHour: 480, transectionRate: 6 })],
        consistencyScore: 60,
      },
    ]);

    assert.equal(scores.length, 2);
    assert.ok(scores[0]?.percentile != null || scores[1]?.percentile != null);
    assert.match(scores[0]?.summary ?? "", /Surgeon Performance Score/i);
  });
});
