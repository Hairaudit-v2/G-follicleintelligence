import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSurgeryBenchmark, buildSurgeryBenchmarks } from "@/src/lib/surgeryOs/surgeryBenchmarkCore";
import type { SurgeonPerformanceSnapshot } from "@/src/lib/surgeryOs/surgeonPerformanceAnalyticsCore";

const surgeonId = "00000000-0000-4000-8000-000000000101";

function performance(overrides: Partial<SurgeonPerformanceSnapshot> = {}): SurgeonPerformanceSnapshot {
  return {
    surgeonId,
    surgeonName: "Dr Seetal",
    proceduresCompleted: 5,
    averageProcedureDuration: 470,
    averageExtractionVelocity: 700,
    averageImplantationSpeed: 650,
    averageTransectionRate: 2,
    averageHairsPerGraft: 2.4,
    consistencyScore: 88,
    performanceScore: 92,
    performanceGrade: "elite",
    trendDirection: "improving",
    summary: "Dr Seetal — 5 procedure(s), score 92% (elite), trend improving.",
    ...overrides,
  };
}

describe("surgeryBenchmarkCore", () => {
  it("compares surgeon against clinic averages", () => {
    const benchmark = buildSurgeryBenchmark({
      performance: performance(),
      clinicAverageExtractionVelocity: 612,
      clinicAverageImplantationSpeed: 587,
      clinicAverageTransectionRate: 2.1,
      clinicAverageDurationMinutes: 480,
      clinicAverageHairsPerGraft: 2.3,
      surgeonBenchmarkRank: 1,
    });

    assert.equal(benchmark.clinicAverageExtractionVelocity, 612);
    assert.equal(benchmark.clinicAverageTransectionRate, 2.1);
    assert.equal(benchmark.benchmarkStatus, "above_average");
    assert.ok(benchmark.deviationPercentages.extractionVelocity != null);
    assert.match(benchmark.summary, /above clinic average/i);
  });

  it("marks below average when composite deviation is negative", () => {
    const benchmark = buildSurgeryBenchmark({
      performance: performance({
        averageExtractionVelocity: 500,
        averageImplantationSpeed: 450,
        averageTransectionRate: 8,
        averageProcedureDuration: 560,
      }),
      clinicAverageExtractionVelocity: 612,
      clinicAverageImplantationSpeed: 587,
      clinicAverageTransectionRate: 2.1,
      clinicAverageDurationMinutes: 480,
      clinicAverageHairsPerGraft: 2.3,
    });

    assert.equal(benchmark.benchmarkStatus, "below_average");
    assert.match(benchmark.summary, /below clinic average/i);
  });

  it("ranks surgeons by performance score", () => {
    const benchmarks = buildSurgeryBenchmarks({
      performances: [
        performance({ surgeonId, performanceScore: 94 }),
        performance({
          surgeonId: "00000000-0000-4000-8000-000000000102",
          surgeonName: "Dr Patel",
          performanceScore: 78,
        }),
      ],
      clinicAverageExtractionVelocity: 612,
      clinicAverageImplantationSpeed: 587,
      clinicAverageTransectionRate: 2.1,
      clinicAverageDurationMinutes: 480,
      clinicAverageHairsPerGraft: 2.3,
    });

    assert.equal(benchmarks[0]?.surgeonBenchmarkRank, 1);
    assert.equal(benchmarks[1]?.surgeonBenchmarkRank, 2);
  });
});
