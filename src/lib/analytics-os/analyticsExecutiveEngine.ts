/**
 * AnalyticsOS Phase B+C — executive snapshot composition engine.
 */

import type { FiAnalyticsEventRow } from "./analyticsEventCore";
import { ANALYTICS_PIPELINE_MODULES } from "./analyticsExecutiveTypes";
import type {
  AnalyticsConfidenceLevel,
  AnalyticsExecutiveSnapshot,
  AnalyticsModuleCoverageRow,
  AnalyticsModuleCoverageStatus,
} from "./analyticsExecutiveTypes";
import { ANALYTICS_MODULE_DISPLAY_LABELS } from "./analyticsExecutiveTypes";
import type { AnalyticsModuleName } from "./analyticsEventTypes";
import { generateAnalyticsExecutiveInsights } from "./analyticsExecutiveInsights";
import {
  buildExecutiveMetrics,
  buildExecutiveScoringEventSummary,
  calculateConversionPerformanceScore,
  calculateDataCompletenessScore,
  calculateOverallClinicHealthScore,
  calculatePatientJourneyScore,
  calculateRevenueEfficiencyScore,
  calculateSurgicalEfficiencyScore,
  calculateWorkforceReadinessScore,
  type ExecutiveScoringInput,
  type WorkforceReadinessScoringContext,
} from "./analyticsExecutiveScoring";

export type BuildAnalyticsExecutiveSnapshotInput = {
  tenantId: string;
  clinicId?: string | null;
  periodStart: string;
  periodEnd: string;
  comparisonPeriodStart?: string;
  comparisonPeriodEnd?: string;
  currentEvents: FiAnalyticsEventRow[];
  comparisonEvents?: FiAnalyticsEventRow[];
  workforceReadiness?: WorkforceReadinessScoringContext;
  generatedAt?: string;
};

/** Event count above which a module is considered actively publishing. */
export const MODULE_COVERAGE_ACTIVE_THRESHOLD = 20;

/** Minimum event count for limited (non-zero) coverage. */
export const MODULE_COVERAGE_LIMITED_MIN = 1;

export function resolveModuleCoverageStatus(eventCount: number): AnalyticsModuleCoverageStatus {
  if (eventCount > MODULE_COVERAGE_ACTIVE_THRESHOLD) return "active";
  if (eventCount >= MODULE_COVERAGE_LIMITED_MIN) return "limited";
  return "waiting";
}

function countEventsByModule(
  events: FiAnalyticsEventRow[]
): Map<AnalyticsModuleName, { count: number; lastAt: string | null }> {
  const byModule = new Map<AnalyticsModuleName, { count: number; lastAt: string | null }>();

  for (const event of events) {
    const existing = byModule.get(event.module_name) ?? { count: 0, lastAt: null };
    existing.count += 1;
    if (!existing.lastAt || event.occurred_at > existing.lastAt) {
      existing.lastAt = event.occurred_at;
    }
    byModule.set(event.module_name, existing);
  }

  return byModule;
}

export function buildModuleCoverage(events: FiAnalyticsEventRow[]): AnalyticsModuleCoverageRow[] {
  const byModule = countEventsByModule(events);

  return ANALYTICS_PIPELINE_MODULES.map((moduleName) => {
    const stats = byModule.get(moduleName);
    const eventCount = stats?.count ?? 0;

    return {
      moduleName,
      displayLabel: ANALYTICS_MODULE_DISPLAY_LABELS[moduleName],
      status: resolveModuleCoverageStatus(eventCount),
      eventCount,
      lastEventAt: stats?.lastAt ?? null,
    };
  });
}

/** Modules with active coverage (> threshold events) in the period. */
export function deriveActiveModules(events: FiAnalyticsEventRow[]): AnalyticsModuleName[] {
  const byModule = countEventsByModule(events);
  return ANALYTICS_PIPELINE_MODULES.filter(
    (moduleName) => (byModule.get(moduleName)?.count ?? 0) > MODULE_COVERAGE_ACTIVE_THRESHOLD
  );
}

export function deriveAnalyticsConfidence(
  coverage: AnalyticsModuleCoverageRow[]
): AnalyticsConfidenceLevel {
  const activeCount = coverage.filter((row) => row.status === "active").length;
  const publishingCount = coverage.filter((row) => row.status !== "waiting").length;

  if (activeCount >= 6) return "high";
  if (activeCount >= 3 || publishingCount >= 5) return "medium";
  return "low";
}

export function buildAnalyticsExecutiveSnapshot(
  input: BuildAnalyticsExecutiveSnapshotInput
): AnalyticsExecutiveSnapshot {
  const currentSummary = buildExecutiveScoringEventSummary(input.currentEvents);
  const comparisonSummary =
    input.comparisonEvents != null
      ? buildExecutiveScoringEventSummary(input.comparisonEvents)
      : null;

  const moduleCoverage = buildModuleCoverage(input.currentEvents);
  const activeModuleNames = deriveActiveModules(input.currentEvents);
  const analyticsConfidence = deriveAnalyticsConfidence(moduleCoverage);

  const scoringInput: ExecutiveScoringInput = {
    current: currentSummary,
    comparison: comparisonSummary,
    workforceReadiness: input.workforceReadiness ?? null,
    activeModuleNames,
    expectedModuleCount: ANALYTICS_PIPELINE_MODULES.length,
    moduleCoverage,
  };

  const revenueEfficiencyScore = calculateRevenueEfficiencyScore(scoringInput);
  const workforceReadinessScore = calculateWorkforceReadinessScore(scoringInput);
  const conversionPerformanceScore = calculateConversionPerformanceScore(scoringInput);
  const surgicalEfficiencyScore = calculateSurgicalEfficiencyScore(scoringInput);
  const patientJourneyScore = calculatePatientJourneyScore(scoringInput);
  const dataCompletenessScore = calculateDataCompletenessScore(scoringInput);

  const overallClinicHealthScore = calculateOverallClinicHealthScore({
    revenueEfficiencyScore,
    workforceReadinessScore,
    conversionPerformanceScore,
    surgicalEfficiencyScore,
    patientJourneyScore,
    dataCompletenessScore,
  });

  const metrics = buildExecutiveMetrics(scoringInput);

  const snapshot: AnalyticsExecutiveSnapshot = {
    tenantId: input.tenantId.trim(),
    clinicId: input.clinicId?.trim() || null,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    overallClinicHealthScore,
    revenueEfficiencyScore,
    workforceReadinessScore,
    conversionPerformanceScore,
    surgicalEfficiencyScore,
    patientJourneyScore,
    dataCompletenessScore,
    metrics,
    insights: [],
    moduleCoverage,
    analyticsConfidence,
  };

  snapshot.insights = generateAnalyticsExecutiveInsights(snapshot, input.currentEvents);
  return snapshot;
}

export function defaultExecutivePeriod(): {
  periodStart: string;
  periodEnd: string;
  comparisonPeriodStart: string;
  comparisonPeriodEnd: string;
} {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 29);
  start.setUTCHours(0, 0, 0, 0);

  const compEnd = new Date(start);
  compEnd.setUTCDate(compEnd.getUTCDate() - 1);
  compEnd.setUTCHours(23, 59, 59, 999);
  const compStart = new Date(compEnd);
  compStart.setUTCDate(compStart.getUTCDate() - 29);
  compStart.setUTCHours(0, 0, 0, 0);

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    comparisonPeriodStart: compStart.toISOString(),
    comparisonPeriodEnd: compEnd.toISOString(),
  };
}
