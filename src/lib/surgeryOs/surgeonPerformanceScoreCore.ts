/**
 * SurgeryOS Sprint 3 — Surgeon Performance Score Engine (pure).
 * Unified weighted performance score across efficiency, quality, and consistency.
 */

import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";

export type SurgeonPerformanceGrade = "elite" | "excellent" | "strong" | "watch" | "poor";

export type SurgeonPerformanceScoreInput = {
  surgeonId: string;
  surgeonName: string;
  records: SurgeonProcedurePerformanceRecord[];
  consistencyScore: number;
  clinicAverageExtractionVelocity?: number | null;
  clinicAverageImplantationSpeed?: number | null;
  clinicAverageTransectionRate?: number | null;
  clinicAverageDurationMinutes?: number | null;
  allSurgeonScores?: number[];
};

export type SurgeonPerformanceScoreSnapshot = {
  surgeonId: string;
  surgeonName: string;
  score: number;
  grade: SurgeonPerformanceGrade;
  percentile: number | null;
  summary: string;
};

export const SURGEON_PERFORMANCE_SCORE_WEIGHTS = {
  extractionEfficiency: 0.25,
  implantationEfficiency: 0.2,
  transectionQuality: 0.25,
  consistency: 0.15,
  procedureDuration: 0.1,
  graftQuality: 0.05,
} as const;

export const SURGEON_PERFORMANCE_GRADE_THRESHOLDS = {
  elite: 90,
  excellent: 80,
  strong: 70,
  watch: 50,
} as const;

const OPTIMAL_EXTRACTION_RATE = 650;
const OPTIMAL_IMPLANTATION_RATE = 600;
const OPTIMAL_TRANSECTION_RATE = 2;
const OPTIMAL_HAIRS_PER_GRAFT = 2.4;
const OPTIMAL_DURATION_MINUTES = 480;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function safeAverage(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function ratioScore(value: number | null, optimal: number, higherIsBetter: boolean): number {
  if (value == null || !Number.isFinite(value) || optimal <= 0) return 50;
  const ratio = value / optimal;
  const normalized = higherIsBetter ? ratio : optimal / Math.max(value, 0.01);
  return clampScore(Math.min(1.2, normalized) * 100);
}

function transectionQualityScore(rate: number | null): number {
  if (rate == null || !Number.isFinite(rate)) return 50;
  if (rate <= OPTIMAL_TRANSECTION_RATE) return 100;
  if (rate >= 15) return 0;
  return clampScore(100 - ((rate - OPTIMAL_TRANSECTION_RATE) / (15 - OPTIMAL_TRANSECTION_RATE)) * 100);
}

function durationScore(minutes: number | null, clinicAverage: number | null): number {
  if (minutes == null || !Number.isFinite(minutes)) return 50;
  const benchmark = clinicAverage ?? OPTIMAL_DURATION_MINUTES;
  if (benchmark <= 0) return 50;
  const ratio = minutes / benchmark;
  if (ratio <= 1) return clampScore(100 - (1 - ratio) * 20);
  return clampScore(Math.max(0, 100 - (ratio - 1) * 80));
}

function graftQualityScore(hairsPerGraft: number | null): number {
  if (hairsPerGraft == null || !Number.isFinite(hairsPerGraft)) return 50;
  const diff = Math.abs(hairsPerGraft - OPTIMAL_HAIRS_PER_GRAFT);
  return clampScore(100 - diff * 40);
}

export function mapSurgeonPerformanceGrade(score: number): SurgeonPerformanceGrade {
  const clamped = clampScore(score);
  if (clamped >= SURGEON_PERFORMANCE_GRADE_THRESHOLDS.elite) return "elite";
  if (clamped >= SURGEON_PERFORMANCE_GRADE_THRESHOLDS.excellent) return "excellent";
  if (clamped >= SURGEON_PERFORMANCE_GRADE_THRESHOLDS.strong) return "strong";
  if (clamped >= SURGEON_PERFORMANCE_GRADE_THRESHOLDS.watch) return "watch";
  return "poor";
}

function gradeLabel(grade: SurgeonPerformanceGrade): string {
  switch (grade) {
    case "elite":
      return "Elite";
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "watch":
      return "Watch";
    case "poor":
      return "Poor";
    default:
      return grade;
  }
}

function computePercentile(score: number, allScores: number[]): number | null {
  if (!allScores.length) return null;
  const sorted = [...allScores].sort((a, b) => a - b);
  const below = sorted.filter((s) => s < score).length;
  return clampScore(Math.round((below / sorted.length) * 100));
}

function buildSummary(input: {
  surgeonName: string;
  score: number;
  grade: SurgeonPerformanceGrade;
}): string {
  return `Surgeon Performance Score — ${input.surgeonName}: ${input.score}% (${gradeLabel(input.grade)}).`;
}

export function buildSurgeonPerformanceScore(
  input: SurgeonPerformanceScoreInput
): SurgeonPerformanceScoreSnapshot {
  const avgExtraction = safeAverage(input.records.map((r) => r.extractionVelocityPerHour));
  const avgImplantation = safeAverage(input.records.map((r) => r.implantationSpeedPerHour));
  const avgTransection = safeAverage(input.records.map((r) => r.transectionRate));
  const avgDuration = safeAverage(input.records.map((r) => r.procedureDurationMinutes));
  const avgHairs = safeAverage(input.records.map((r) => r.hairsPerGraft));

  const extractionComponent = ratioScore(
    avgExtraction,
    input.clinicAverageExtractionVelocity ?? OPTIMAL_EXTRACTION_RATE,
    true
  );
  const implantationComponent = ratioScore(
    avgImplantation,
    input.clinicAverageImplantationSpeed ?? OPTIMAL_IMPLANTATION_RATE,
    true
  );
  const transectionComponent = transectionQualityScore(avgTransection);
  const consistencyComponent = clampScore(input.consistencyScore);
  const durationComponent = durationScore(avgDuration, input.clinicAverageDurationMinutes ?? null);
  const graftComponent = graftQualityScore(avgHairs);

  const weights = SURGEON_PERFORMANCE_SCORE_WEIGHTS;
  const score = clampScore(
    extractionComponent * weights.extractionEfficiency +
      implantationComponent * weights.implantationEfficiency +
      transectionComponent * weights.transectionQuality +
      consistencyComponent * weights.consistency +
      durationComponent * weights.procedureDuration +
      graftComponent * weights.graftQuality
  );

  const grade = mapSurgeonPerformanceGrade(score);
  const percentile =
    input.allSurgeonScores && input.allSurgeonScores.length > 1
      ? computePercentile(score, input.allSurgeonScores)
      : null;

  return {
    surgeonId: input.surgeonId,
    surgeonName: input.surgeonName,
    score,
    grade,
    percentile,
    summary: buildSummary({ surgeonName: input.surgeonName, score, grade }),
  };
}

export function buildSurgeonPerformanceScores(
  inputs: SurgeonPerformanceScoreInput[]
): SurgeonPerformanceScoreSnapshot[] {
  const preliminary = inputs.map((input) =>
    buildSurgeonPerformanceScore({ ...input, allSurgeonScores: undefined })
  );
  const allScores = preliminary.map((s) => s.score);
  return inputs.map((input, index) =>
    buildSurgeonPerformanceScore({ ...input, allSurgeonScores: allScores })
  );
}
