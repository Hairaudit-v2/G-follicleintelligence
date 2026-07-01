/**
 * SurgeryOS Sprint 3 — Surgeon Consistency Engine (pure).
 * Measures performance consistency across recent procedures.
 */

import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";

export type SurgeonConsistencyStatus = "elite" | "stable" | "inconsistent" | "concerning";

export type SurgeonConsistencySnapshot = {
  surgeonId: string;
  surgeonName: string;
  consistencyScore: number;
  extractionVariance: number | null;
  transectionVariance: number | null;
  durationVariance: number | null;
  graftVariance: number | null;
  status: SurgeonConsistencyStatus;
  summary: string;
};

export const SURGEON_CONSISTENCY_WINDOW = {
  min: 10,
  max: 20,
} as const;

export const SURGEON_CONSISTENCY_STATUS_THRESHOLDS = {
  elite: 85,
  stable: 70,
  inconsistent: 50,
} as const;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function safeParseMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (!Number.isFinite(mean) || mean <= 0) return null;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, values.length - 1);
  const stdDev = Math.sqrt(variance);
  if (!Number.isFinite(stdDev)) return null;
  return (stdDev / mean) * 100;
}

function varianceFromRecords(
  records: SurgeonProcedurePerformanceRecord[],
  selector: (r: SurgeonProcedurePerformanceRecord) => number | null
): number | null {
  const values = records
    .map(selector)
    .filter((v): v is number => v != null && Number.isFinite(v));
  return coefficientOfVariation(values);
}

function mapStatus(score: number): SurgeonConsistencyStatus {
  const clamped = clampScore(score);
  if (clamped >= SURGEON_CONSISTENCY_STATUS_THRESHOLDS.elite) return "elite";
  if (clamped >= SURGEON_CONSISTENCY_STATUS_THRESHOLDS.stable) return "stable";
  if (clamped >= SURGEON_CONSISTENCY_STATUS_THRESHOLDS.inconsistent) return "inconsistent";
  return "concerning";
}

function varianceToScore(variance: number | null, maxCv: number): number {
  if (variance == null || !Number.isFinite(variance)) return 75;
  return clampScore(100 - (Math.min(variance, maxCv) / maxCv) * 100);
}

function buildSummary(input: {
  surgeonName: string;
  status: SurgeonConsistencyStatus;
  consistencyScore: number;
  hasData: boolean;
}): string {
  if (!input.hasData) {
    return "No surgeon consistency data available.";
  }

  const statusLabel =
    input.status === "elite"
      ? "elite consistency"
      : input.status === "stable"
        ? "stable performance"
        : input.status === "inconsistent"
          ? "inconsistent performance"
          : "concerning variability";

  return `${input.surgeonName} — ${input.consistencyScore}% consistency score (${statusLabel}).`;
}

export function buildSurgeonConsistency(input: {
  surgeonId: string;
  surgeonName: string;
  records: SurgeonProcedurePerformanceRecord[];
}): SurgeonConsistencySnapshot {
  const sorted = [...input.records].sort((a, b) => {
    const aMs = safeParseMs(a.completedAt) ?? 0;
    const bMs = safeParseMs(b.completedAt) ?? 0;
    return bMs - aMs;
  });

  const windowRecords = sorted.slice(0, SURGEON_CONSISTENCY_WINDOW.max);
  const hasEnoughData = windowRecords.length >= 2;

  const extractionVariance = varianceFromRecords(windowRecords, (r) => r.extractionVelocityPerHour);
  const transectionVariance = varianceFromRecords(windowRecords, (r) => r.transectionRate);
  const durationVariance = varianceFromRecords(windowRecords, (r) => r.procedureDurationMinutes);
  const graftVariance = varianceFromRecords(windowRecords, (r) => r.hairsPerGraft);

  const extractionScore = varianceToScore(extractionVariance, 25);
  const transectionScore = varianceToScore(transectionVariance, 40);
  const durationScore = varianceToScore(durationVariance, 20);
  const graftScore = varianceToScore(graftVariance, 15);

  const consistencyScore = hasEnoughData
    ? clampScore(extractionScore * 0.3 + transectionScore * 0.35 + durationScore * 0.2 + graftScore * 0.15)
    : 0;

  const status = hasEnoughData ? mapStatus(consistencyScore) : "concerning";

  return {
    surgeonId: input.surgeonId,
    surgeonName: input.surgeonName,
    consistencyScore,
    extractionVariance:
      extractionVariance != null ? Math.round(extractionVariance * 10) / 10 : null,
    transectionVariance:
      transectionVariance != null ? Math.round(transectionVariance * 10) / 10 : null,
    durationVariance: durationVariance != null ? Math.round(durationVariance * 10) / 10 : null,
    graftVariance: graftVariance != null ? Math.round(graftVariance * 10) / 10 : null,
    status,
    summary: buildSummary({
      surgeonName: input.surgeonName,
      status,
      consistencyScore,
      hasData: hasEnoughData,
    }),
  };
}

export function buildSurgeonConsistencyForSurgeons(
  inputs: Array<{
    surgeonId: string;
    surgeonName: string;
    records: SurgeonProcedurePerformanceRecord[];
  }>
): SurgeonConsistencySnapshot[] {
  return inputs.map((input) => buildSurgeonConsistency(input));
}
