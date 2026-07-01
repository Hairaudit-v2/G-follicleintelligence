/**
 * SurgeryOS Sprint 3 — Surgeon Performance Analytics Engine (pure).
 * Aggregates historical surgery performance by surgeon.
 */

import type { SurgeryOsProcedureEventKind } from "@/src/lib/surgeryOs/surgeryOsBoardModel";
import { buildExtractionVelocity } from "@/src/lib/surgeryOs/extractionVelocityCore";
import { buildImplantationSpeed } from "@/src/lib/surgeryOs/implantationSpeedCore";
import { buildTransectionMonitoring } from "@/src/lib/surgeryOs/transectionMonitoringCore";
import type { TransectionMonitoringTrayEvent } from "@/src/lib/surgeryOs/transectionMonitoringCore";
import {
  buildSurgeonPerformanceScore,
  type SurgeonPerformanceGrade,
} from "@/src/lib/surgeryOs/surgeonPerformanceScoreCore";
import { buildSurgeonConsistency } from "@/src/lib/surgeryOs/surgeonConsistencyCore";
import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";

export type { SurgeonProcedurePerformanceRecord };

export type SurgeonPerformanceTrendDirection = "improving" | "stable" | "declining";

export type SurgeonPerformanceSnapshot = {
  surgeonId: string;
  surgeonName: string;
  proceduresCompleted: number;
  averageProcedureDuration: number | null;
  averageExtractionVelocity: number | null;
  averageImplantationSpeed: number | null;
  averageTransectionRate: number | null;
  averageHairsPerGraft: number | null;
  consistencyScore: number;
  performanceScore: number;
  performanceGrade: SurgeonPerformanceGrade;
  trendDirection: SurgeonPerformanceTrendDirection;
  summary: string;
};

export const SURGEON_PERFORMANCE_MIN_SAMPLE = 3;
export const SURGEON_PERFORMANCE_TREND_STABLE_PERCENT = 5;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function safeAverage(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  const avg = nums.reduce((sum, v) => sum + v, 0) / nums.length;
  return Number.isFinite(avg) ? Math.round(avg * 10) / 10 : null;
}

function safeParseMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function sortRecordsChronologically(
  records: SurgeonProcedurePerformanceRecord[]
): SurgeonProcedurePerformanceRecord[] {
  return [...records].sort((a, b) => {
    const aMs = safeParseMs(a.completedAt) ?? 0;
    const bMs = safeParseMs(b.completedAt) ?? 0;
    return aMs - bMs;
  });
}

function deriveTrendDirection(
  records: SurgeonProcedurePerformanceRecord[]
): SurgeonPerformanceTrendDirection {
  if (records.length < SURGEON_PERFORMANCE_MIN_SAMPLE) return "stable";

  const sorted = sortRecordsChronologically(records);
  const midpoint = Math.ceil(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const compositeScore = (items: SurgeonProcedurePerformanceRecord[]) => {
    const extraction = safeAverage(items.map((r) => r.extractionVelocityPerHour)) ?? 0;
    const implantation = safeAverage(items.map((r) => r.implantationSpeedPerHour)) ?? 0;
    const transection = safeAverage(items.map((r) => r.transectionRate)) ?? 0;
    const duration = safeAverage(items.map((r) => r.procedureDurationMinutes)) ?? 0;
    return extraction + implantation - transection * 10 - duration * 0.05;
  };

  const firstScore = compositeScore(firstHalf);
  const secondScore = compositeScore(secondHalf);
  if (!Number.isFinite(firstScore) || !Number.isFinite(secondScore) || firstScore <= 0) {
    return "stable";
  }

  const changePercent = ((secondScore - firstScore) / Math.abs(firstScore)) * 100;
  if (!Number.isFinite(changePercent)) return "stable";
  if (changePercent >= SURGEON_PERFORMANCE_TREND_STABLE_PERCENT) return "improving";
  if (changePercent <= -SURGEON_PERFORMANCE_TREND_STABLE_PERCENT) return "declining";
  return "stable";
}

function buildSummary(input: {
  surgeonName: string;
  proceduresCompleted: number;
  performanceScore: number;
  performanceGrade: SurgeonPerformanceGrade;
  trendDirection: SurgeonPerformanceTrendDirection;
  hasData: boolean;
}): string {
  if (!input.hasData) {
    return "No surgeon performance data available.";
  }

  const trendLabel =
    input.trendDirection === "improving"
      ? "improving"
      : input.trendDirection === "declining"
        ? "declining"
        : "stable";

  return `${input.surgeonName} — ${input.proceduresCompleted} procedure(s), score ${input.performanceScore}% (${input.performanceGrade}), trend ${trendLabel}.`;
}

export function buildSurgeonPerformanceAnalytics(input: {
  records: SurgeonProcedurePerformanceRecord[];
  clinicAverageExtractionVelocity?: number | null;
  clinicAverageImplantationSpeed?: number | null;
  clinicAverageTransectionRate?: number | null;
  clinicAverageDurationMinutes?: number | null;
}): SurgeonPerformanceSnapshot[] {
  const bySurgeon = new Map<string, SurgeonProcedurePerformanceRecord[]>();
  for (const record of input.records) {
    if (!record.surgeonId?.trim()) continue;
    const list = bySurgeon.get(record.surgeonId) ?? [];
    list.push(record);
    bySurgeon.set(record.surgeonId, list);
  }

  const preliminary: SurgeonPerformanceSnapshot[] = [];

  for (const [surgeonId, records] of bySurgeon) {
    if (records.length < SURGEON_PERFORMANCE_MIN_SAMPLE) continue;

    const surgeonName = records[0]?.surgeonName?.trim() || "Surgeon";
    const consistency = buildSurgeonConsistency({ surgeonId, surgeonName, records });
    const scoreSnapshot = buildSurgeonPerformanceScore({
      surgeonId,
      surgeonName,
      records,
      consistencyScore: consistency.consistencyScore,
      clinicAverageExtractionVelocity: input.clinicAverageExtractionVelocity,
      clinicAverageImplantationSpeed: input.clinicAverageImplantationSpeed,
      clinicAverageTransectionRate: input.clinicAverageTransectionRate,
      clinicAverageDurationMinutes: input.clinicAverageDurationMinutes,
    });

    preliminary.push({
      surgeonId,
      surgeonName,
      proceduresCompleted: records.length,
      averageProcedureDuration: safeAverage(records.map((r) => r.procedureDurationMinutes)),
      averageExtractionVelocity: safeAverage(records.map((r) => r.extractionVelocityPerHour)),
      averageImplantationSpeed: safeAverage(records.map((r) => r.implantationSpeedPerHour)),
      averageTransectionRate: safeAverage(records.map((r) => r.transectionRate)),
      averageHairsPerGraft: safeAverage(records.map((r) => r.hairsPerGraft)),
      consistencyScore: consistency.consistencyScore,
      performanceScore: scoreSnapshot.score,
      performanceGrade: scoreSnapshot.grade,
      trendDirection: deriveTrendDirection(records),
      summary: "",
    });
  }

  const allScores = preliminary.map((s) => s.performanceScore);
  return preliminary.map((snapshot) => {
    const records = bySurgeon.get(snapshot.surgeonId) ?? [];
    const scoreWithPercentile = buildSurgeonPerformanceScore({
      surgeonId: snapshot.surgeonId,
      surgeonName: snapshot.surgeonName,
      records,
      consistencyScore: snapshot.consistencyScore,
      clinicAverageExtractionVelocity: input.clinicAverageExtractionVelocity,
      clinicAverageImplantationSpeed: input.clinicAverageImplantationSpeed,
      clinicAverageTransectionRate: input.clinicAverageTransectionRate,
      clinicAverageDurationMinutes: input.clinicAverageDurationMinutes,
      allSurgeonScores: allScores,
    });

    return {
      ...snapshot,
      performanceScore: scoreWithPercentile.score,
      performanceGrade: scoreWithPercentile.grade,
      summary: buildSummary({
        surgeonName: snapshot.surgeonName,
        proceduresCompleted: snapshot.proceduresCompleted,
        performanceScore: scoreWithPercentile.score,
        performanceGrade: scoreWithPercentile.grade,
        trendDirection: snapshot.trendDirection,
        hasData: true,
      }),
    };
  });
}

export function buildSurgeonProcedurePerformanceRecord(input: {
  surgeryId: string;
  surgeonId: string;
  surgeonName: string;
  patientLabel: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  extractedGrafts: number;
  implantedGrafts: number;
  averageHairsPerGraft: number | null;
  events: Array<{ eventKind: SurgeryOsProcedureEventKind; occurredAt: string }>;
  graftEvents: Array<{
    occurredAt: string;
    deltaExtracted: number;
    deltaImplanted: number;
  }>;
  trayEvents: TransectionMonitoringTrayEvent[];
  pendingTrayCount?: number;
  now?: Date;
}): SurgeonProcedurePerformanceRecord {
  const extraction = buildExtractionVelocity({
    surgeryId: input.surgeryId,
    patientLabel: input.patientLabel,
    extractedGrafts: input.extractedGrafts,
    events: input.events,
    graftEvents: input.graftEvents
      .filter((e) => e.deltaExtracted > 0)
      .map((e) => ({ occurredAt: e.occurredAt, deltaExtracted: e.deltaExtracted })),
    now: input.now,
  });

  const implantation = buildImplantationSpeed({
    surgeryId: input.surgeryId,
    patientLabel: input.patientLabel,
    implantedGrafts: input.implantedGrafts,
    events: input.events,
    graftEvents: input.graftEvents
      .filter((e) => e.deltaImplanted > 0)
      .map((e) => ({ occurredAt: e.occurredAt, deltaImplanted: e.deltaImplanted })),
    now: input.now,
  });

  const transection = buildTransectionMonitoring({
    surgeryId: input.surgeryId,
    patientLabel: input.patientLabel,
    trayEvents: input.trayEvents,
    pendingTrayCount: input.pendingTrayCount,
  });

  const startMs = safeParseMs(input.actualStartAt);
  const endMs = safeParseMs(input.actualEndAt);
  let procedureDurationMinutes: number | null = null;
  if (startMs != null && endMs != null && endMs > startMs) {
    procedureDurationMinutes = Math.round((endMs - startMs) / 60_000);
  }

  return {
    surgeryId: input.surgeryId,
    surgeonId: input.surgeonId,
    surgeonName: input.surgeonName,
    completedAt: input.actualEndAt,
    procedureDurationMinutes,
    extractionVelocityPerHour: extraction.extractionRatePerHour,
    implantationSpeedPerHour: implantation.implantationRatePerHour,
    transectionRate: transection.transectionRate,
    hairsPerGraft:
      input.averageHairsPerGraft != null && Number.isFinite(input.averageHairsPerGraft)
        ? Math.round(input.averageHairsPerGraft * 10) / 10
        : null,
  };
}

export function computeClinicPerformanceAverages(records: SurgeonProcedurePerformanceRecord[]): {
  clinicAverageExtractionVelocity: number | null;
  clinicAverageImplantationSpeed: number | null;
  clinicAverageTransectionRate: number | null;
  clinicAverageDurationMinutes: number | null;
  clinicAverageHairsPerGraft: number | null;
} {
  return {
    clinicAverageExtractionVelocity: safeAverage(records.map((r) => r.extractionVelocityPerHour)),
    clinicAverageImplantationSpeed: safeAverage(records.map((r) => r.implantationSpeedPerHour)),
    clinicAverageTransectionRate: safeAverage(records.map((r) => r.transectionRate)),
    clinicAverageDurationMinutes: safeAverage(records.map((r) => r.procedureDurationMinutes)),
    clinicAverageHairsPerGraft: safeAverage(records.map((r) => r.hairsPerGraft)),
  };
}
