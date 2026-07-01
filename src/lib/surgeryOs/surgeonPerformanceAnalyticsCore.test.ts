import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSurgeonPerformanceAnalytics,
  computeClinicPerformanceAverages,
  SURGEON_PERFORMANCE_MIN_SAMPLE,
} from "@/src/lib/surgeryOs/surgeonPerformanceAnalyticsCore";
import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";

const surgeonA = "00000000-0000-4000-8000-000000000101";
const surgeonB = "00000000-0000-4000-8000-000000000102";

function record(
  overrides: Partial<SurgeonProcedurePerformanceRecord> & Pick<SurgeonProcedurePerformanceRecord, "surgeryId">
): SurgeonProcedurePerformanceRecord {
  return {
    surgeonId: surgeonA,
    surgeonName: "Dr Seetal",
    completedAt: "2026-06-01T15:00:00.000Z",
    procedureDurationMinutes: 480,
    extractionVelocityPerHour: 600,
    implantationSpeedPerHour: 580,
    transectionRate: 2.5,
    hairsPerGraft: 2.3,
    ...overrides,
  };
}

describe("surgeonPerformanceAnalyticsCore", () => {
  it("returns empty when no surgeon meets minimum sample threshold", () => {
    const snapshots = buildSurgeonPerformanceAnalytics({
      records: [
        record({ surgeryId: "00000000-0000-4000-8000-000000000201" }),
        record({ surgeryId: "00000000-0000-4000-8000-000000000202" }),
      ],
    });
    assert.equal(snapshots.length, 0);
  });

  it("aggregates historical performance by surgeon without NaN", () => {
    const records: SurgeonProcedurePerformanceRecord[] = [
      record({
        surgeryId: "00000000-0000-4000-8000-000000000201",
        extractionVelocityPerHour: 600,
        implantationSpeedPerHour: 580,
        transectionRate: 2,
        procedureDurationMinutes: 480,
        hairsPerGraft: 2.2,
        completedAt: "2026-05-01T15:00:00.000Z",
      }),
      record({
        surgeryId: "00000000-0000-4000-8000-000000000202",
        extractionVelocityPerHour: 620,
        implantationSpeedPerHour: 590,
        transectionRate: 2.5,
        procedureDurationMinutes: 470,
        hairsPerGraft: 2.4,
        completedAt: "2026-05-15T15:00:00.000Z",
      }),
      record({
        surgeryId: "00000000-0000-4000-8000-000000000203",
        extractionVelocityPerHour: 640,
        implantationSpeedPerHour: 600,
        transectionRate: 1.8,
        procedureDurationMinutes: 460,
        hairsPerGraft: 2.5,
        completedAt: "2026-06-01T15:00:00.000Z",
      }),
    ];

    const snapshots = buildSurgeonPerformanceAnalytics({ records });
    assert.equal(snapshots.length, 1);
    const snapshot = snapshots[0]!;
    assert.equal(snapshot.proceduresCompleted, SURGEON_PERFORMANCE_MIN_SAMPLE);
    assert.equal(snapshot.averageExtractionVelocity, 620);
    assert.equal(snapshot.averageImplantationSpeed, 590);
    assert.equal(snapshot.averageTransectionRate, 2.1);
    assert.equal(snapshot.averageProcedureDuration, 470);
    assert.ok(Number.isFinite(snapshot.performanceScore));
    assert.ok(!Number.isNaN(snapshot.consistencyScore));
    assert.ok(snapshot.performanceScore >= 0 && snapshot.performanceScore <= 100);
  });

  it("computes clinic averages safely", () => {
    const averages = computeClinicPerformanceAverages([
      record({ surgeryId: "00000000-0000-4000-8000-000000000201", extractionVelocityPerHour: 600 }),
      record({
        surgeryId: "00000000-0000-4000-8000-000000000202",
        surgeonId: surgeonB,
        extractionVelocityPerHour: 700,
      }),
    ]);
    assert.equal(averages.clinicAverageExtractionVelocity, 650);
  });
});
