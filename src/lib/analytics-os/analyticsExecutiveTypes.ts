/**
 * AnalyticsOS Phase B — executive intelligence snapshot model.
 */

import type { AnalyticsModuleName } from "./analyticsEventTypes";

export const ANALYTICS_SCORE_BANDS = ["excellent", "strong", "watch", "risk", "critical"] as const;

export type AnalyticsScoreBand = (typeof ANALYTICS_SCORE_BANDS)[number];

export type AnalyticsExecutiveContributingSignal = {
  key: string;
  label: string;
  value: number | string | null;
  weight?: number;
};

export type AnalyticsExecutiveScore = {
  score: number;
  band: AnalyticsScoreBand;
  label: string;
  explanation: string;
  contributingSignals: AnalyticsExecutiveContributingSignal[];
  /** True when score is derived from partial or fallback signals. */
  limitedSignal: boolean;
};

export type AnalyticsExecutiveMetricDirection = "up" | "down" | "flat" | "unknown";

export type AnalyticsExecutiveMetricStatus = "positive" | "neutral" | "warning" | "risk";

export type AnalyticsExecutiveMetric = {
  key: string;
  label: string;
  value: number;
  unit: string;
  previousValue?: number;
  changePercent?: number;
  direction: AnalyticsExecutiveMetricDirection;
  status: AnalyticsExecutiveMetricStatus;
};

export type AnalyticsExecutiveInsightSeverity =
  | "info"
  | "positive"
  | "warning"
  | "risk"
  | "critical";

export type AnalyticsExecutiveInsightType =
  | "revenue_momentum"
  | "conversion_gap"
  | "workforce_risk"
  | "surgery_throughput"
  | "patient_journey"
  | "data_gap"
  | "overall_health";

export type AnalyticsExecutiveInsight = {
  id: string;
  type: AnalyticsExecutiveInsightType;
  severity: AnalyticsExecutiveInsightSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  sourceModules: AnalyticsModuleName[];
  relatedEntityIds?: string[];
};

export type AnalyticsModuleCoverageStatus = "active" | "waiting" | "limited";

export type AnalyticsConfidenceLevel = "low" | "medium" | "high";

export type AnalyticsModuleCoverageRow = {
  moduleName: AnalyticsModuleName;
  displayLabel: string;
  status: AnalyticsModuleCoverageStatus;
  eventCount: number;
  lastEventAt: string | null;
};

export type AnalyticsExecutiveSnapshot = {
  tenantId: string;
  clinicId: string | null;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;

  overallClinicHealthScore: AnalyticsExecutiveScore;
  revenueEfficiencyScore: AnalyticsExecutiveScore;
  workforceReadinessScore: AnalyticsExecutiveScore;
  conversionPerformanceScore: AnalyticsExecutiveScore;
  surgicalEfficiencyScore: AnalyticsExecutiveScore;
  patientJourneyScore: AnalyticsExecutiveScore;
  dataCompletenessScore: AnalyticsExecutiveScore;

  metrics: AnalyticsExecutiveMetric[];
  insights: AnalyticsExecutiveInsight[];
  moduleCoverage: AnalyticsModuleCoverageRow[];
  /** Derived from module coverage thresholds — Low / Medium / High. */
  analyticsConfidence: AnalyticsConfidenceLevel;
};

export type AnalyticsExecutiveDashboardPayload = {
  snapshot: AnalyticsExecutiveSnapshot;
  /** Human-readable load notes — no stack traces or raw metadata. */
  loadNotes: string[];
};

/** Display labels for module coverage UI. */
export const ANALYTICS_MODULE_DISPLAY_LABELS: Record<AnalyticsModuleName, string> = {
  workforce_os: "WorkforceOS",
  financial_os: "FinancialOS",
  surgery_os: "SurgeryOS",
  consultation_os: "ConsultationOS",
  patient_os: "PatientOS",
  clinic_os: "ClinicOS",
  leadflow: "LeadFlow",
  imaging_os: "ImagingOS",
  audit_os: "AuditOS",
};

/** Modules expected to feed AnalyticsOS event pipeline (Phase A+B+C). */
export const ANALYTICS_PIPELINE_MODULES: AnalyticsModuleName[] = [
  "workforce_os",
  "surgery_os",
  "financial_os",
  "consultation_os",
  "patient_os",
  "clinic_os",
  "leadflow",
  "imaging_os",
  "audit_os",
];
