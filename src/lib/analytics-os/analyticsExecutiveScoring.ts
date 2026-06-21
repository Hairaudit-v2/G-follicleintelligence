/**
 * AnalyticsOS Phase B — pure, deterministic executive score calculators.
 * Safe for unit tests without DB.
 */

import type { FiAnalyticsEventRow } from "./analyticsEventCore";
import type {
  AnalyticsExecutiveContributingSignal,
  AnalyticsExecutiveScore,
  AnalyticsModuleCoverageRow,
  AnalyticsScoreBand,
} from "./analyticsExecutiveTypes";

export type ExecutiveScoringEventSummary = {
  eventCount: number;
  eventValueSum: number;
  byEventType: Map<string, { count: number; valueSum: number }>;
  byModule: Map<string, { count: number; valueSum: number }>;
  distinctEntityIds: Set<string>;
};

export type ExecutiveScoringPeriodInput = {
  current: ExecutiveScoringEventSummary;
  comparison?: ExecutiveScoringEventSummary | null;
};

export type WorkforceReadinessScoringContext = {
  averageReadinessScore: number;
  activeStaff: number;
  blockedCount: number;
  operationalWarningCount: number;
  restrictedCount: number;
} | null;

export type ExecutiveScoringInput = ExecutiveScoringPeriodInput & {
  workforceReadiness?: WorkforceReadinessScoringContext;
  /** Modules with active coverage (> threshold events) in the current period. */
  activeModuleNames: string[];
  /** Total modules in the analytics pipeline contract. */
  expectedModuleCount: number;
  /** Per-module coverage rows for completeness scoring. */
  moduleCoverage?: AnalyticsModuleCoverageRow[];
};

export const OVERALL_HEALTH_WEIGHTS = {
  revenueEfficiency: 0.25,
  workforceReadiness: 0.2,
  conversionPerformance: 0.2,
  surgicalEfficiency: 0.15,
  patientJourney: 0.1,
  dataCompleteness: 0.1,
} as const;

export function resolveScoreBand(score: number): AnalyticsScoreBand {
  const s = clampScore(score);
  if (s >= 85) return "excellent";
  if (s >= 70) return "strong";
  if (s >= 55) return "watch";
  if (s >= 40) return "risk";
  return "critical";
}

export function scoreBandLabel(band: AnalyticsScoreBand): string {
  switch (band) {
    case "excellent":
      return "Excellent";
    case "strong":
      return "Strong";
    case "watch":
      return "Watch";
    case "risk":
      return "At risk";
    case "critical":
      return "Critical";
  }
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildExecutiveScoringEventSummary(events: FiAnalyticsEventRow[]): ExecutiveScoringEventSummary {
  const byEventType = new Map<string, { count: number; valueSum: number }>();
  const byModule = new Map<string, { count: number; valueSum: number }>();
  const distinctEntityIds = new Set<string>();
  let eventValueSum = 0;

  for (const event of events) {
    if (event.entity_id) distinctEntityIds.add(event.entity_id);

    const typeBucket = byEventType.get(event.event_type) ?? { count: 0, valueSum: 0 };
    typeBucket.count += 1;
    if (event.event_value != null && Number.isFinite(event.event_value)) {
      typeBucket.valueSum += event.event_value;
      eventValueSum += event.event_value;
    }
    byEventType.set(event.event_type, typeBucket);

    const modBucket = byModule.get(event.module_name) ?? { count: 0, valueSum: 0 };
    modBucket.count += 1;
    if (event.event_value != null && Number.isFinite(event.event_value)) {
      modBucket.valueSum += event.event_value;
    }
    byModule.set(event.module_name, modBucket);
  }

  return {
    eventCount: events.length,
    eventValueSum,
    byEventType,
    byModule,
    distinctEntityIds,
  };
}

function getTypeCount(summary: ExecutiveScoringEventSummary, eventType: string): number {
  return summary.byEventType.get(eventType)?.count ?? 0;
}

function getTypeCounts(summary: ExecutiveScoringEventSummary, eventTypes: string[]): number {
  return eventTypes.reduce((sum, eventType) => sum + getTypeCount(summary, eventType), 0);
}

function getTypeValue(summary: ExecutiveScoringEventSummary, eventType: string): number {
  return summary.byEventType.get(eventType)?.valueSum ?? 0;
}

function getModuleCount(summary: ExecutiveScoringEventSummary, moduleName: string): number {
  return summary.byModule.get(moduleName)?.count ?? 0;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function momentumBonus(current: number, previous: number | undefined, cap = 15): number {
  if (previous == null || previous === 0) return 0;
  const change = ((current - previous) / previous) * 100;
  if (change >= 20) return cap;
  if (change >= 10) return Math.round(cap * 0.66);
  if (change >= 5) return Math.round(cap * 0.33);
  if (change <= -20) return -cap;
  if (change <= -10) return -Math.round(cap * 0.66);
  if (change <= -5) return -Math.round(cap * 0.33);
  return 0;
}

function buildScore(
  score: number,
  label: string,
  explanation: string,
  contributingSignals: AnalyticsExecutiveContributingSignal[],
  limitedSignal: boolean
): AnalyticsExecutiveScore {
  const clamped = clampScore(score);
  const band = resolveScoreBand(clamped);
  return {
    score: clamped,
    band,
    label,
    explanation,
    contributingSignals,
    limitedSignal,
  };
}

function activityBaseScore(count: number, thresholds: [number, number, number]): number {
  const [low, mid, high] = thresholds;
  if (count >= high) return 85;
  if (count >= mid) return 72;
  if (count >= low) return 58;
  if (count > 0) return 45;
  return 30;
}

export function calculateRevenueEfficiencyScore(input: ExecutiveScoringInput): AnalyticsExecutiveScore {
  const paymentCount = getTypeCount(input.current, "payment_received");
  const paymentValue = getTypeValue(input.current, "payment_received");
  const invoiceCount = getTypeCount(input.current, "invoice_created");
  const prevPaymentCount =
    input.comparison != null ? getTypeCount(input.comparison, "payment_received") : undefined;
  const prevPaymentValue =
    input.comparison != null ? getTypeValue(input.comparison, "payment_received") : undefined;

  const hasFinancialModule = input.current.byModule.has("financial_os");
  const limitedSignal = !hasFinancialModule && paymentCount === 0;

  let score = activityBaseScore(paymentCount, [1, 3, 8]);
  if (paymentValue > 0) {
    score += paymentValue >= 50000 ? 10 : paymentValue >= 10000 ? 6 : 3;
  }
  if (invoiceCount > 0) score += Math.min(5, invoiceCount);

  score += momentumBonus(paymentCount, prevPaymentCount, 12);
  if (prevPaymentValue != null && prevPaymentValue > 0 && paymentValue > 0) {
    score += momentumBonus(paymentValue, prevPaymentValue, 8);
  }

  const signals: AnalyticsExecutiveContributingSignal[] = [
    { key: "payment_received_count", label: "Payments received", value: paymentCount },
    { key: "payment_received_value", label: "Payment volume", value: paymentValue },
    { key: "invoice_created_count", label: "Invoices created", value: invoiceCount },
  ];
  if (prevPaymentCount != null) {
    signals.push({
      key: "payment_count_change",
      label: "Payment count vs prior period",
      value: pctChange(paymentCount, prevPaymentCount),
    });
  }

  const explanation =
    limitedSignal
      ? "Limited revenue signal — no FinancialOS events in this period. Score uses fallback activity thresholds."
      : paymentCount === 0
        ? "No payment activity recorded this period."
        : prevPaymentCount != null && paymentCount > prevPaymentCount
          ? "Payment activity increased compared with the previous period."
          : "Revenue efficiency reflects payment volume and invoice activity in the period.";

  return buildScore(score, "Revenue efficiency", explanation, signals, limitedSignal);
}

export function calculateWorkforceReadinessScore(input: ExecutiveScoringInput): AnalyticsExecutiveScore {
  const ctx = input.workforceReadiness;
  const staffAssigned = getTypeCount(input.current, "staff_assigned");
  const shiftCreated = getTypeCount(input.current, "shift_created");
  const readinessChanged = getTypeCount(input.current, "readiness_changed");
  const workforceEvents = getModuleCount(input.current, "workforce_os");

  const signals: AnalyticsExecutiveContributingSignal[] = [];

  if (ctx && ctx.activeStaff > 0) {
    let score = ctx.averageReadinessScore;
    const riskPenalty =
      ctx.blockedCount * 8 + ctx.operationalWarningCount * 4 + ctx.restrictedCount * 2;
    score = clampScore(score - Math.min(25, riskPenalty));

    signals.push(
      { key: "average_readiness", label: "Average readiness score", value: ctx.averageReadinessScore },
      { key: "blocked_staff", label: "Blocked staff", value: ctx.blockedCount },
      { key: "operational_warnings", label: "Operational warnings", value: ctx.operationalWarningCount }
    );

    const explanation =
      ctx.blockedCount > 0 || ctx.operationalWarningCount > 0
        ? "Staff readiness is below target — blocked or warning staff detected."
        : "Workforce readiness reflects tenant-wide readiness scoring from WorkforceOS.";

    return buildScore(score, "Workforce readiness", explanation, signals, false);
  }

  const limitedSignal = workforceEvents === 0;
  let score = activityBaseScore(staffAssigned, [1, 4, 10]);
  score += Math.min(8, shiftCreated * 2);
  score += Math.min(5, readinessChanged * 2);

  signals.push(
    { key: "staff_assigned", label: "Staff assignments", value: staffAssigned },
    { key: "shift_created", label: "Shifts created", value: shiftCreated },
    { key: "readiness_changed", label: "Readiness changes", value: readinessChanged }
  );

  const explanation = limitedSignal
    ? "Limited workforce signal — using event fallback because WorkforceOS readiness overview is unavailable."
    : "Workforce readiness estimated from staffing assignment and shift events.";

  return buildScore(score, "Workforce readiness", explanation, signals, limitedSignal);
}

export function calculateConversionPerformanceScore(input: ExecutiveScoringInput): AnalyticsExecutiveScore {
  const leadCreated = getTypeCount(input.current, "lead_created");
  const leadScored = getTypeCount(input.current, "lead_scored");
  const leadQualified = getTypeCount(input.current, "lead_qualified");
  const leadStageChanged = getTypeCount(input.current, "lead_stage_changed");
  const consultationBooked = getTypeCount(input.current, "consultation_booked");
  const quoteSent = getTypeCount(input.current, "quote_sent");
  const leadConverted = getTypeCount(input.current, "lead_converted");

  const quoteToConsultRatio = consultationBooked > 0 ? quoteSent / consultationBooked : quoteSent > 0 ? 0.5 : 0;
  const conversionRate = leadCreated > 0 ? leadConverted / leadCreated : leadConverted > 0 ? 1 : 0;

  let score = 40;
  score += Math.min(25, quoteSent * 4);
  score += Math.min(15, consultationBooked * 3);
  score += Math.min(15, leadConverted * 5);
  score += Math.min(10, leadScored * 2);
  score += Math.min(8, leadQualified * 3);
  score += Math.min(6, leadStageChanged);
  score += Math.min(10, Math.round(conversionRate * 100) * 0.1);

  if (consultationBooked > 0 && quoteSent < consultationBooked * 0.5) {
    score -= 12;
  } else if (quoteToConsultRatio >= 0.8) {
    score += 8;
  }

  const hasLeadFlow = input.current.byModule.has("leadflow");
  const hasConversionModule =
    input.current.byModule.has("consultation_os") || hasLeadFlow;
  const limitedSignal = !hasConversionModule && quoteSent === 0 && consultationBooked === 0 && leadCreated === 0;

  const signals: AnalyticsExecutiveContributingSignal[] = [
    { key: "lead_created", label: "Leads created", value: leadCreated },
    { key: "lead_scored", label: "Leads scored", value: leadScored },
    { key: "lead_qualified", label: "Leads qualified", value: leadQualified },
    { key: "lead_stage_changed", label: "Lead stage changes", value: leadStageChanged },
    { key: "consultation_booked", label: "Consultations booked", value: consultationBooked },
    { key: "quote_sent", label: "Quotes sent", value: quoteSent },
    { key: "lead_converted", label: "Leads converted", value: leadConverted },
    { key: "quote_to_consult_ratio", label: "Quote-to-consult ratio", value: Math.round(quoteToConsultRatio * 100) },
  ];

  const explanation =
    limitedSignal
      ? "Limited conversion signal — no ConsultationOS or LeadFlow events in this period."
      : consultationBooked > 0 && quoteSent < consultationBooked * 0.5
        ? "Quote activity is low relative to consultation activity."
        : hasLeadFlow && leadScored > 0
          ? "Conversion performance reflects LeadFlow scoring, stage progression, and funnel events."
          : quoteSent > 0
            ? "Conversion performance reflects quote, consultation, and lead progression events."
            : "Conversion funnel activity is minimal this period.";

  return buildScore(score, "Conversion performance", explanation, signals, limitedSignal);
}

export function calculateSurgicalEfficiencyScore(input: ExecutiveScoringInput): AnalyticsExecutiveScore {
  const surgeryCompleted = getTypeCount(input.current, "surgery_completed");
  const surgeryStarted = getTypeCount(input.current, "surgery_started");
  const graftRecorded = getTypeCount(input.current, "graft_count_recorded");
  const imagingProtocolCompleted = getTypeCount(input.current, "imaging_protocol_completed");
  const auditReportGenerated = getTypeCount(input.current, "audit_report_generated");
  const graftIntegrityScored = getTypeCount(input.current, "graft_integrity_scored");
  const prevCompleted =
    input.comparison != null ? getTypeCount(input.comparison, "surgery_completed") : undefined;

  let score = activityBaseScore(surgeryCompleted, [1, 3, 6]);
  if (surgeryStarted > 0 && surgeryCompleted > 0) {
    const completionRatio = surgeryCompleted / surgeryStarted;
    score += completionRatio >= 0.9 ? 10 : completionRatio >= 0.7 ? 5 : -5;
  }
  score += Math.min(8, graftRecorded * 2);
  score += Math.min(6, imagingProtocolCompleted * 2);
  score += Math.min(6, auditReportGenerated * 2);
  score += Math.min(8, graftIntegrityScored * 3);
  score += momentumBonus(surgeryCompleted, prevCompleted, 10);

  const hasSurgeryModule = input.current.byModule.has("surgery_os");
  const hasSupportSignals =
    input.current.byModule.has("imaging_os") || input.current.byModule.has("audit_os");
  const limitedSignal = !hasSurgeryModule && surgeryCompleted === 0 && !hasSupportSignals;

  const signals: AnalyticsExecutiveContributingSignal[] = [
    { key: "surgery_completed", label: "Surgeries completed", value: surgeryCompleted },
    { key: "surgery_started", label: "Surgeries started", value: surgeryStarted },
    { key: "graft_count_recorded", label: "Graft counts recorded", value: graftRecorded },
    { key: "imaging_protocol_completed", label: "Imaging protocols completed", value: imagingProtocolCompleted },
    { key: "audit_report_generated", label: "Audit reports generated", value: auditReportGenerated },
    { key: "graft_integrity_scored", label: "Graft integrity scores", value: graftIntegrityScored },
  ];
  if (prevCompleted != null) {
    signals.push({
      key: "surgery_completed_change",
      label: "Completion count vs prior period",
      value: pctChange(surgeryCompleted, prevCompleted),
    });
  }

  const explanation =
    limitedSignal
      ? "Limited surgical signal — no SurgeryOS, ImagingOS, or AuditOS support events in this period."
      : prevCompleted != null && surgeryCompleted === prevCompleted
        ? "Surgery completion activity is stable compared with the previous period."
        : prevCompleted != null && surgeryCompleted > prevCompleted
          ? "Surgery throughput increased compared with the previous period."
          : "Surgical efficiency reflects completion volume and procedure consistency.";

  return buildScore(score, "Surgical efficiency", explanation, signals, limitedSignal);
}

export function calculatePatientJourneyScore(input: ExecutiveScoringInput): AnalyticsExecutiveScore {
  const onboardingStarted = getTypeCount(input.current, "patient_onboarding_started");
  const documentUploaded = getTypeCount(input.current, "patient_document_uploaded");
  const imagesUploaded = getTypeCounts(input.current, ["patient_images_uploaded", "patient_uploaded_images"]);
  const reportGenerated = getTypeCount(input.current, "patient_report_generated");
  const followupCompleted = getTypeCounts(input.current, ["patient_followup_completed", "followup_completed"]);
  const journeyCompleted = getTypeCount(input.current, "patient_journey_completed");

  const journeyEvents =
    onboardingStarted + documentUploaded + imagesUploaded + reportGenerated + followupCompleted + journeyCompleted;
  let score = activityBaseScore(journeyEvents, [1, 3, 8]);
  score += Math.min(6, onboardingStarted * 3);
  score += Math.min(6, documentUploaded * 2);
  score += Math.min(8, imagesUploaded * 2);
  score += Math.min(8, reportGenerated * 3);
  score += Math.min(10, followupCompleted * 4);
  score += Math.min(10, journeyCompleted * 5);

  const hasPatientModule = input.current.byModule.has("patient_os");
  const limitedSignal = !hasPatientModule && journeyEvents === 0;

  const signals: AnalyticsExecutiveContributingSignal[] = [
    { key: "patient_onboarding_started", label: "Onboarding started", value: onboardingStarted },
    { key: "patient_document_uploaded", label: "Documents uploaded", value: documentUploaded },
    { key: "patient_images_uploaded", label: "Patient image uploads", value: imagesUploaded },
    { key: "patient_report_generated", label: "Reports generated", value: reportGenerated },
    { key: "patient_followup_completed", label: "Follow-ups completed", value: followupCompleted },
    { key: "patient_journey_completed", label: "Journeys completed", value: journeyCompleted },
  ];

  const explanation = limitedSignal
    ? "Limited patient journey signal — no PatientOS events in this period."
    : journeyEvents === 0
      ? "No patient journey milestones recorded this period."
      : "Patient journey score reflects uploads, reports, and follow-up completion.";

  return buildScore(score, "Patient journey", explanation, signals, limitedSignal);
}

export function calculateDataCompletenessScore(input: ExecutiveScoringInput): AnalyticsExecutiveScore {
  const coverage = input.moduleCoverage ?? [];
  const activeCount = coverage.filter((row) => row.status === "active").length;
  const limitedCount = coverage.filter((row) => row.status === "limited").length;
  const publishingCount = activeCount + limitedCount;
  const expected = Math.max(1, input.expectedModuleCount);
  const entityCoverage = input.current.distinctEntityIds.size;

  let score = Math.round((activeCount / expected) * 65);
  score += Math.round((limitedCount / expected) * 20);
  score += Math.min(
    10,
    input.current.eventCount >= 50 ? 10 : input.current.eventCount >= 20 ? 7 : input.current.eventCount >= 10 ? 4 : input.current.eventCount > 0 ? 2 : 0
  );
  score += Math.min(
    10,
    entityCoverage >= 20 ? 10 : entityCoverage >= 10 ? 6 : entityCoverage >= 5 ? 3 : entityCoverage > 0 ? 1 : 0
  );
  if (activeCount >= 6) score += 8;
  if (activeCount >= 8) score += 5;

  const limitedSignal = activeCount < Math.ceil(expected * 0.45);

  const signals: AnalyticsExecutiveContributingSignal[] = [
    { key: "active_modules", label: "Active publishing modules", value: activeCount },
    { key: "limited_modules", label: "Limited-signal modules", value: limitedCount },
    { key: "publishing_modules", label: "Modules with any events", value: publishingCount },
    { key: "expected_modules", label: "Expected pipeline modules", value: expected },
    { key: "total_events", label: "Total events", value: input.current.eventCount },
    { key: "distinct_entities", label: "Distinct entities", value: entityCoverage },
  ];

  const explanation =
    publishingCount === 0
      ? "No modules published analytics events this period — executive confidence is very limited."
      : activeCount < 4
        ? `Analytics confidence is limited — ${activeCount} module${activeCount === 1 ? "" : "s"} actively publishing (>20 events), ${limitedCount} on limited signal.`
        : activeCount >= 6
          ? "Strong module coverage — executive scores use rich cross-module intelligence signals."
          : "Data completeness reflects module coverage tiers, event volume, and entity breadth.";

  return buildScore(score, "Data completeness", explanation, signals, limitedSignal);
}

export type OverallHealthScoreInput = {
  revenueEfficiencyScore: AnalyticsExecutiveScore;
  workforceReadinessScore: AnalyticsExecutiveScore;
  conversionPerformanceScore: AnalyticsExecutiveScore;
  surgicalEfficiencyScore: AnalyticsExecutiveScore;
  patientJourneyScore: AnalyticsExecutiveScore;
  dataCompletenessScore: AnalyticsExecutiveScore;
};

export function calculateOverallClinicHealthScore(input: OverallHealthScoreInput): AnalyticsExecutiveScore {
  const weighted =
    input.revenueEfficiencyScore.score * OVERALL_HEALTH_WEIGHTS.revenueEfficiency +
    input.workforceReadinessScore.score * OVERALL_HEALTH_WEIGHTS.workforceReadiness +
    input.conversionPerformanceScore.score * OVERALL_HEALTH_WEIGHTS.conversionPerformance +
    input.surgicalEfficiencyScore.score * OVERALL_HEALTH_WEIGHTS.surgicalEfficiency +
    input.patientJourneyScore.score * OVERALL_HEALTH_WEIGHTS.patientJourney +
    input.dataCompletenessScore.score * OVERALL_HEALTH_WEIGHTS.dataCompleteness;

  const limitedCount = [
    input.revenueEfficiencyScore,
    input.workforceReadinessScore,
    input.conversionPerformanceScore,
    input.surgicalEfficiencyScore,
    input.patientJourneyScore,
    input.dataCompletenessScore,
  ].filter((s) => s.limitedSignal).length;

  let score = weighted;
  if (limitedCount >= 4) score -= 8;
  else if (limitedCount >= 2) score -= 4;
  else if (limitedCount === 1) score -= 2;

  const explanation =
    limitedCount > 0
      ? `Overall clinic health is a weighted blend of six operational scores (${limitedCount} dimension${limitedCount === 1 ? "" : "s"} on limited signal).`
      : "Overall clinic health combines revenue, workforce, conversion, surgical, patient journey, and data completeness signals.";

  return buildScore(
    score,
    "Overall clinic health",
    explanation,
    [
      {
        key: "revenue_weight",
        label: "Revenue efficiency weight",
        value: `${OVERALL_HEALTH_WEIGHTS.revenueEfficiency * 100}%`,
      },
      {
        key: "workforce_weight",
        label: "Workforce readiness weight",
        value: `${OVERALL_HEALTH_WEIGHTS.workforceReadiness * 100}%`,
      },
      {
        key: "conversion_weight",
        label: "Conversion performance weight",
        value: `${OVERALL_HEALTH_WEIGHTS.conversionPerformance * 100}%`,
      },
      {
        key: "surgical_weight",
        label: "Surgical efficiency weight",
        value: `${OVERALL_HEALTH_WEIGHTS.surgicalEfficiency * 100}%`,
      },
      {
        key: "patient_weight",
        label: "Patient journey weight",
        value: `${OVERALL_HEALTH_WEIGHTS.patientJourney * 100}%`,
      },
      {
        key: "data_weight",
        label: "Data completeness weight",
        value: `${OVERALL_HEALTH_WEIGHTS.dataCompleteness * 100}%`,
      },
    ],
    limitedCount >= 3
  );
}

export function buildExecutiveMetrics(input: ExecutiveScoringInput): import("./analyticsExecutiveTypes").AnalyticsExecutiveMetric[] {
  const paymentCount = getTypeCount(input.current, "payment_received");
  const paymentValue = getTypeValue(input.current, "payment_received");
  const prevPaymentCount =
    input.comparison != null ? getTypeCount(input.comparison, "payment_received") : undefined;
  const prevPaymentValue =
    input.comparison != null ? getTypeValue(input.comparison, "payment_received") : undefined;

  const quoteSent = getTypeCount(input.current, "quote_sent");
  const consultationBooked = getTypeCount(input.current, "consultation_booked");
  const surgeryCompleted = getTypeCount(input.current, "surgery_completed");
  const prevSurgeryCompleted =
    input.comparison != null ? getTypeCount(input.comparison, "surgery_completed") : undefined;

  return [
    buildMetric("payment_count", "Payments received", paymentCount, "count", prevPaymentCount),
    buildMetric("payment_value", "Payment volume", paymentValue, "currency", prevPaymentValue),
    buildMetric("quote_sent", "Quotes sent", quoteSent, "count"),
    buildMetric("consultations_booked", "Consultations booked", consultationBooked, "count"),
    buildMetric("surgeries_completed", "Surgeries completed", surgeryCompleted, "count", prevSurgeryCompleted),
    buildMetric("active_modules", "Active modules", input.activeModuleNames.length, "modules"),
    buildMetric("total_events", "Analytics events", input.current.eventCount, "events"),
  ];
}

function buildMetric(
  key: string,
  label: string,
  value: number,
  unit: string,
  previousValue?: number
): import("./analyticsExecutiveTypes").AnalyticsExecutiveMetric {
  const changePercent =
    previousValue != null ? pctChange(value, previousValue) ?? undefined : undefined;
  let direction: import("./analyticsExecutiveTypes").AnalyticsExecutiveMetricDirection = "unknown";
  if (changePercent != null) {
    if (changePercent > 2) direction = "up";
    else if (changePercent < -2) direction = "down";
    else direction = "flat";
  } else if (value > 0) {
    direction = "flat";
  }

  let status: import("./analyticsExecutiveTypes").AnalyticsExecutiveMetricStatus = "neutral";
  if (changePercent != null) {
    status = changePercent >= 10 ? "positive" : changePercent <= -10 ? "warning" : "neutral";
  } else if (value === 0) {
    status = "warning";
  }

  return {
    key,
    label,
    value,
    unit,
    previousValue,
    changePercent,
    direction,
    status,
  };
}
