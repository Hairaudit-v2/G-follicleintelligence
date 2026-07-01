/**
 * SurgeryOS Sprint 3 — Surgeon Performance Intelligence orchestrator (pure).
 * Composes analytics, benchmark, consistency, risk, and score engines.
 */

import {
  buildSurgeonPerformanceAnalytics,
  computeClinicPerformanceAverages,
} from "@/src/lib/surgeryOs/surgeonPerformanceAnalyticsCore";
import { buildSurgeryBenchmarks } from "@/src/lib/surgeryOs/surgeryBenchmarkCore";
import {
  buildSurgeonConsistencyForSurgeons,
  type SurgeonConsistencySnapshot,
} from "@/src/lib/surgeryOs/surgeonConsistencyCore";
import {
  buildSurgeonRiskPatternsForSurgeons,
  type SurgeonRiskPatternSnapshot,
} from "@/src/lib/surgeryOs/surgeonRiskPatternCore";
import {
  buildSurgeonPerformanceScores,
  type SurgeonPerformanceScoreSnapshot,
} from "@/src/lib/surgeryOs/surgeonPerformanceScoreCore";
import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";
import type { SurgeonPerformanceSnapshot } from "@/src/lib/surgeryOs/surgeonPerformanceAnalyticsCore";
import type { SurgeryBenchmarkSnapshot } from "@/src/lib/surgeryOs/surgeryBenchmarkCore";

export type SurgeonPerformanceIntelligenceBundle = {
  surgeonPerformance: SurgeonPerformanceSnapshot[];
  surgeryBenchmarks: SurgeryBenchmarkSnapshot[];
  surgeonConsistency: SurgeonConsistencySnapshot[];
  surgeonRiskPatterns: SurgeonRiskPatternSnapshot[];
  surgeonPerformanceScores: SurgeonPerformanceScoreSnapshot[];
};

export function buildSurgeonPerformanceIntelligence(
  records: SurgeonProcedurePerformanceRecord[]
): SurgeonPerformanceIntelligenceBundle {
  const clinicAverages = computeClinicPerformanceAverages(records);

  const surgeonPerformance = buildSurgeonPerformanceAnalytics({
    records,
    clinicAverageExtractionVelocity: clinicAverages.clinicAverageExtractionVelocity,
    clinicAverageImplantationSpeed: clinicAverages.clinicAverageImplantationSpeed,
    clinicAverageTransectionRate: clinicAverages.clinicAverageTransectionRate,
    clinicAverageDurationMinutes: clinicAverages.clinicAverageDurationMinutes,
  });

  const surgeryBenchmarks = buildSurgeryBenchmarks({
    performances: surgeonPerformance,
    clinicAverageExtractionVelocity: clinicAverages.clinicAverageExtractionVelocity,
    clinicAverageImplantationSpeed: clinicAverages.clinicAverageImplantationSpeed,
    clinicAverageTransectionRate: clinicAverages.clinicAverageTransectionRate,
    clinicAverageDurationMinutes: clinicAverages.clinicAverageDurationMinutes,
    clinicAverageHairsPerGraft: clinicAverages.clinicAverageHairsPerGraft,
  });

  const bySurgeon = new Map<string, SurgeonProcedurePerformanceRecord[]>();
  for (const record of records) {
    if (!record.surgeonId?.trim()) continue;
    const list = bySurgeon.get(record.surgeonId) ?? [];
    list.push(record);
    bySurgeon.set(record.surgeonId, list);
  }

  const surgeonInputs = Array.from(bySurgeon.entries()).map(([surgeonId, surgeonRecords]) => ({
    surgeonId,
    surgeonName: surgeonRecords[0]?.surgeonName?.trim() || "Surgeon",
    records: surgeonRecords,
  }));

  const surgeonConsistency = buildSurgeonConsistencyForSurgeons(surgeonInputs);
  const surgeonRiskPatterns = buildSurgeonRiskPatternsForSurgeons(surgeonInputs);

  const performanceBySurgeon = new Map(surgeonPerformance.map((s) => [s.surgeonId, s]));
  const consistencyBySurgeon = new Map(surgeonConsistency.map((s) => [s.surgeonId, s]));

  const surgeonPerformanceScores = buildSurgeonPerformanceScores(
    surgeonInputs
      .filter(({ surgeonId, records: surgeonRecords }) => {
        const perf = performanceBySurgeon.get(surgeonId);
        return perf != null && surgeonRecords.length >= 3;
      })
      .map(({ surgeonId, surgeonName, records: surgeonRecords }) => ({
        surgeonId,
        surgeonName,
        records: surgeonRecords,
        consistencyScore: consistencyBySurgeon.get(surgeonId)?.consistencyScore ?? 0,
        clinicAverageExtractionVelocity: clinicAverages.clinicAverageExtractionVelocity,
        clinicAverageImplantationSpeed: clinicAverages.clinicAverageImplantationSpeed,
        clinicAverageTransectionRate: clinicAverages.clinicAverageTransectionRate,
        clinicAverageDurationMinutes: clinicAverages.clinicAverageDurationMinutes,
      }))
  );

  return {
    surgeonPerformance,
    surgeryBenchmarks,
    surgeonConsistency,
    surgeonRiskPatterns,
    surgeonPerformanceScores,
  };
}
