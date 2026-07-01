/**
 * SurgeryOS Sprint 3 — Procedure Benchmark Engine (pure).
 * Compares individual surgeon performance against clinic averages.
 */

import type { SurgeonPerformanceSnapshot } from "@/src/lib/surgeryOs/surgeonPerformanceAnalyticsCore";

export type SurgeryBenchmarkStatus = "above_average" | "average" | "below_average";

export type SurgeryBenchmarkDeviationPercentages = {
  extractionVelocity: number | null;
  implantationSpeed: number | null;
  transectionRate: number | null;
  procedureDuration: number | null;
  graftComposition: number | null;
};

export type SurgeryBenchmarkSnapshot = {
  surgeonId: string;
  surgeonName: string;
  surgeonBenchmarkRank: number | null;
  clinicAverageExtractionVelocity: number | null;
  clinicAverageTransectionRate: number | null;
  clinicAverageImplantationSpeed: number | null;
  clinicAverageDurationMinutes: number | null;
  clinicAverageHairsPerGraft: number | null;
  deviationPercentages: SurgeryBenchmarkDeviationPercentages;
  benchmarkStatus: SurgeryBenchmarkStatus;
  summary: string;
};

export const SURGERY_BENCHMARK_AVERAGE_BAND_PERCENT = 5;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function deviationPercent(value: number | null, clinicAverage: number | null, invert = false): number | null {
  if (value == null || clinicAverage == null || !Number.isFinite(value) || !Number.isFinite(clinicAverage)) {
    return null;
  }
  if (clinicAverage === 0) return null;
  const raw = ((value - clinicAverage) / Math.abs(clinicAverage)) * 100;
  if (!Number.isFinite(raw)) return null;
  return clampPercent(invert ? -raw : raw);
}

function compositeDeviation(deviations: SurgeryBenchmarkDeviationPercentages): number | null {
  const weights = {
    extractionVelocity: 0.3,
    implantationSpeed: 0.25,
    transectionRate: 0.25,
    procedureDuration: 0.15,
    graftComposition: 0.05,
  };

  let weightedSum = 0;
  let weightTotal = 0;

  for (const [key, weight] of Object.entries(weights) as Array<
    [keyof SurgeryBenchmarkDeviationPercentages, number]
  >) {
    const value = deviations[key];
    if (value != null && Number.isFinite(value)) {
      weightedSum += value * weight;
      weightTotal += weight;
    }
  }

  if (weightTotal <= 0) return null;
  return clampPercent(weightedSum / weightTotal);
}

function mapBenchmarkStatus(composite: number | null): SurgeryBenchmarkStatus {
  if (composite == null) return "average";
  if (composite >= SURGERY_BENCHMARK_AVERAGE_BAND_PERCENT) return "above_average";
  if (composite <= -SURGERY_BENCHMARK_AVERAGE_BAND_PERCENT) return "below_average";
  return "average";
}

function buildSummary(input: {
  surgeonName: string;
  benchmarkStatus: SurgeryBenchmarkStatus;
  compositeDeviation: number | null;
}): string {
  if (input.compositeDeviation == null) {
    return `${input.surgeonName} — insufficient benchmark data for clinic comparison.`;
  }

  const magnitude = Math.abs(input.compositeDeviation);
  if (input.benchmarkStatus === "above_average") {
    return `${input.surgeonName} is performing ${magnitude}% above clinic average.`;
  }
  if (input.benchmarkStatus === "below_average") {
    return `${input.surgeonName} is performing ${magnitude}% below clinic average.`;
  }
  return `${input.surgeonName} is performing at clinic average.`;
}

export function buildSurgeryBenchmark(input: {
  performance: SurgeonPerformanceSnapshot;
  clinicAverageExtractionVelocity: number | null;
  clinicAverageImplantationSpeed: number | null;
  clinicAverageTransectionRate: number | null;
  clinicAverageDurationMinutes: number | null;
  clinicAverageHairsPerGraft: number | null;
  surgeonBenchmarkRank?: number | null;
}): SurgeryBenchmarkSnapshot {
  const deviationPercentages: SurgeryBenchmarkDeviationPercentages = {
    extractionVelocity: deviationPercent(
      input.performance.averageExtractionVelocity,
      input.clinicAverageExtractionVelocity
    ),
    implantationSpeed: deviationPercent(
      input.performance.averageImplantationSpeed,
      input.clinicAverageImplantationSpeed
    ),
    transectionRate: deviationPercent(
      input.performance.averageTransectionRate,
      input.clinicAverageTransectionRate,
      true
    ),
    procedureDuration: deviationPercent(
      input.performance.averageProcedureDuration,
      input.clinicAverageDurationMinutes,
      true
    ),
    graftComposition: deviationPercent(
      input.performance.averageHairsPerGraft,
      input.clinicAverageHairsPerGraft
    ),
  };

  const composite = compositeDeviation(deviationPercentages);
  const benchmarkStatus = mapBenchmarkStatus(composite);

  return {
    surgeonId: input.performance.surgeonId,
    surgeonName: input.performance.surgeonName,
    surgeonBenchmarkRank: input.surgeonBenchmarkRank ?? null,
    clinicAverageExtractionVelocity: input.clinicAverageExtractionVelocity,
    clinicAverageTransectionRate: input.clinicAverageTransectionRate,
    clinicAverageImplantationSpeed: input.clinicAverageImplantationSpeed,
    clinicAverageDurationMinutes: input.clinicAverageDurationMinutes,
    clinicAverageHairsPerGraft: input.clinicAverageHairsPerGraft,
    deviationPercentages,
    benchmarkStatus,
    summary: buildSummary({
      surgeonName: input.performance.surgeonName,
      benchmarkStatus,
      compositeDeviation: composite,
    }),
  };
}

export function buildSurgeryBenchmarks(input: {
  performances: SurgeonPerformanceSnapshot[];
  clinicAverageExtractionVelocity: number | null;
  clinicAverageImplantationSpeed: number | null;
  clinicAverageTransectionRate: number | null;
  clinicAverageDurationMinutes: number | null;
  clinicAverageHairsPerGraft: number | null;
}): SurgeryBenchmarkSnapshot[] {
  const ranked = [...input.performances].sort(
    (a, b) => b.performanceScore - a.performanceScore
  );

  return ranked.map((performance, index) =>
    buildSurgeryBenchmark({
      performance,
      clinicAverageExtractionVelocity: input.clinicAverageExtractionVelocity,
      clinicAverageImplantationSpeed: input.clinicAverageImplantationSpeed,
      clinicAverageTransectionRate: input.clinicAverageTransectionRate,
      clinicAverageDurationMinutes: input.clinicAverageDurationMinutes,
      clinicAverageHairsPerGraft: input.clinicAverageHairsPerGraft,
      surgeonBenchmarkRank: index + 1,
    })
  );
}
