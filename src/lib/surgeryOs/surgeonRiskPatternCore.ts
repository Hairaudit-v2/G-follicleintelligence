/**
 * SurgeryOS Sprint 3 — Surgeon Risk Pattern Detection (pure).
 * Detects repeated performance patterns across historical procedures.
 */

import type { SurgeonProcedurePerformanceRecord } from "@/src/lib/surgeryOs/surgeonPerformanceRecord.types";
import { buildSurgeonConsistency } from "@/src/lib/surgeryOs/surgeonConsistencyCore";

export type SurgeonRiskPatternSeverity = "warning" | "critical";

export type SurgeonDetectedRiskPattern = {
  title: string;
  severity: SurgeonRiskPatternSeverity;
  recommendation: string;
};

export type SurgeonRiskPatternSnapshot = {
  surgeonId: string;
  surgeonName: string;
  totalRisks: number;
  detectedPatterns: SurgeonDetectedRiskPattern[];
  summary: string;
};

export const SURGEON_RISK_PATTERN_THRESHOLDS = {
  minProcedures: 4,
  trendWindow: 8,
  transectionIncreasePercent: 15,
  extractionSlowingPercent: 12,
  durationIncreasePercent: 10,
  implantationDeclinePercent: 12,
  inconsistencyScoreBelow: 55,
} as const;

function safeParseMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function sortChronologically(
  records: SurgeonProcedurePerformanceRecord[]
): SurgeonProcedurePerformanceRecord[] {
  return [...records].sort((a, b) => {
    const aMs = safeParseMs(a.completedAt) ?? 0;
    const bMs = safeParseMs(b.completedAt) ?? 0;
    return aMs - bMs;
  });
}

function safeAverage(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function adverseChangePercent(
  first: number | null,
  second: number | null,
  direction: "increase_worse" | "decrease_worse"
): number | null {
  if (
    first == null ||
    second == null ||
    !Number.isFinite(first) ||
    !Number.isFinite(second) ||
    first === 0
  ) {
    return null;
  }
  const raw = ((second - first) / Math.abs(first)) * 100;
  if (!Number.isFinite(raw)) return null;
  if (direction === "increase_worse") {
    return raw > 0 ? Math.round(raw) : null;
  }
  return raw < 0 ? Math.round(Math.abs(raw)) : null;
}

function buildSummary(input: {
  surgeonName: string;
  totalRisks: number;
}): string {
  if (input.totalRisks === 0) {
    return "No surgeon performance risks detected.";
  }
  return `${input.surgeonName} — ${input.totalRisks} longitudinal risk pattern(s) detected.`;
}

export function buildSurgeonRiskPatterns(input: {
  surgeonId: string;
  surgeonName: string;
  records: SurgeonProcedurePerformanceRecord[];
}): SurgeonRiskPatternSnapshot {
  const sorted = sortChronologically(input.records);
  const detectedPatterns: SurgeonDetectedRiskPattern[] = [];

  if (sorted.length >= SURGEON_RISK_PATTERN_THRESHOLDS.minProcedures) {
    const windowSize = Math.min(SURGEON_RISK_PATTERN_THRESHOLDS.trendWindow, sorted.length);
    const window = sorted.slice(-windowSize);
    const midpoint = Math.ceil(window.length / 2);
    const firstHalf = window.slice(0, midpoint);
    const secondHalf = window.slice(midpoint);

    const transectionFirst = safeAverage(firstHalf.map((r) => r.transectionRate));
    const transectionSecond = safeAverage(secondHalf.map((r) => r.transectionRate));
    const transectionChange = adverseChangePercent(transectionFirst, transectionSecond, "increase_worse");
    if (
      transectionChange != null &&
      transectionChange >= SURGEON_RISK_PATTERN_THRESHOLDS.transectionIncreasePercent
    ) {
      detectedPatterns.push({
        title: `Transection rate increased ${Math.round(transectionChange)}% across last ${window.length} procedures`,
        severity: transectionChange >= SURGEON_RISK_PATTERN_THRESHOLDS.transectionIncreasePercent * 1.5
          ? "critical"
          : "warning",
        recommendation: "Review punch technique, magnification setup, and follicle handling with theatre lead.",
      });
    }

    const extractionFirst = safeAverage(firstHalf.map((r) => r.extractionVelocityPerHour));
    const extractionSecond = safeAverage(secondHalf.map((r) => r.extractionVelocityPerHour));
    const extractionChange = adverseChangePercent(extractionFirst, extractionSecond, "decrease_worse");
    if (
      extractionChange != null &&
      extractionChange >= SURGEON_RISK_PATTERN_THRESHOLDS.extractionSlowingPercent
    ) {
      detectedPatterns.push({
        title: `Extraction velocity slowed ${Math.round(extractionChange)}% across last ${window.length} procedures`,
        severity: "warning",
        recommendation: "Assess operator fatigue, team rotation, and extraction workflow bottlenecks.",
      });
    }

    const durationFirst = safeAverage(firstHalf.map((r) => r.procedureDurationMinutes));
    const durationSecond = safeAverage(secondHalf.map((r) => r.procedureDurationMinutes));
    const durationChange = adverseChangePercent(durationFirst, durationSecond, "increase_worse");
    if (
      durationChange != null &&
      durationChange >= SURGEON_RISK_PATTERN_THRESHOLDS.durationIncreasePercent
    ) {
      detectedPatterns.push({
        title: `Procedure duration increased ${Math.round(durationChange)}% across last ${window.length} procedures`,
        severity: durationChange >= SURGEON_RISK_PATTERN_THRESHOLDS.durationIncreasePercent * 1.5
          ? "critical"
          : "warning",
        recommendation: "Review theatre pacing, case complexity mix, and pre-op planning alignment.",
      });
    }

    const implantationFirst = safeAverage(firstHalf.map((r) => r.implantationSpeedPerHour));
    const implantationSecond = safeAverage(secondHalf.map((r) => r.implantationSpeedPerHour));
    const implantationChange = adverseChangePercent(
      implantationFirst,
      implantationSecond,
      "decrease_worse"
    );
    if (
      implantationChange != null &&
      implantationChange >= SURGEON_RISK_PATTERN_THRESHOLDS.implantationDeclinePercent
    ) {
      detectedPatterns.push({
        title: `Implantation efficiency declined ${Math.round(implantationChange)}% across last ${window.length} procedures`,
        severity: "warning",
        recommendation: "Evaluate recipient site workflow, graft handling time, and implantation team allocation.",
      });
    }
  }

  const consistency = buildSurgeonConsistency({
    surgeonId: input.surgeonId,
    surgeonName: input.surgeonName,
    records: input.records,
  });

  if (
    input.records.length >= 2 &&
    consistency.consistencyScore < SURGEON_RISK_PATTERN_THRESHOLDS.inconsistencyScoreBelow
  ) {
    detectedPatterns.push({
      title: "Abnormal performance inconsistency detected",
      severity: consistency.consistencyScore < 40 ? "critical" : "warning",
      recommendation: "Schedule competency review and standardise technique checkpoints across recent cases.",
    });
  }

  return {
    surgeonId: input.surgeonId,
    surgeonName: input.surgeonName,
    totalRisks: detectedPatterns.length,
    detectedPatterns,
    summary: buildSummary({
      surgeonName: input.surgeonName,
      totalRisks: detectedPatterns.length,
    }),
  };
}

export function buildSurgeonRiskPatternsForSurgeons(
  inputs: Array<{
    surgeonId: string;
    surgeonName: string;
    records: SurgeonProcedurePerformanceRecord[];
  }>
): SurgeonRiskPatternSnapshot[] {
  return inputs.map((input) => buildSurgeonRiskPatterns(input));
}
