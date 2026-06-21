/**
 * AnalyticsOS Phase B — deterministic executive insight generation.
 */

import type { FiAnalyticsEventRow } from "./analyticsEventCore";
import type { AnalyticsModuleName } from "./analyticsEventTypes";
import type {
  AnalyticsExecutiveInsight,
  AnalyticsExecutiveSnapshot,
} from "./analyticsExecutiveTypes";

function insightId(type: string, suffix: string): string {
  return `exec_${type}_${suffix}`;
}

export function generateAnalyticsExecutiveInsights(
  snapshot: AnalyticsExecutiveSnapshot,
  _events: FiAnalyticsEventRow[]
): AnalyticsExecutiveInsight[] {
  const insights: AnalyticsExecutiveInsight[] = [];

  const revenue = snapshot.revenueEfficiencyScore;
  const workforce = snapshot.workforceReadinessScore;
  const conversion = snapshot.conversionPerformanceScore;
  const surgical = snapshot.surgicalEfficiencyScore;
  const patient = snapshot.patientJourneyScore;
  const data = snapshot.dataCompletenessScore;
  const overall = snapshot.overallClinicHealthScore;

  const paymentMetric = snapshot.metrics.find((m) => m.key === "payment_count");
  if (paymentMetric?.changePercent != null && paymentMetric.changePercent >= 10) {
    insights.push({
      id: insightId("revenue", "momentum_up"),
      type: "revenue_momentum",
      severity: "positive",
      title: "Revenue momentum improving",
      description: "Payment activity increased compared with the previous period.",
      recommendedAction: "Review collection velocity and reinforce high-performing revenue channels.",
      sourceModules: ["financial_os"],
    });
  } else if (paymentMetric?.changePercent != null && paymentMetric.changePercent <= -15) {
    insights.push({
      id: insightId("revenue", "momentum_down"),
      type: "revenue_momentum",
      severity: "warning",
      title: "Revenue momentum declining",
      description: "Payment activity decreased compared with the previous period.",
      recommendedAction: "Inspect AR follow-up, invoice cadence, and consultation-to-payment conversion.",
      sourceModules: ["financial_os"],
    });
  } else if (revenue.limitedSignal) {
    insights.push({
      id: insightId("revenue", "limited"),
      type: "revenue_momentum",
      severity: "info",
      title: "Limited revenue signal",
      description: revenue.explanation,
      recommendedAction: "Confirm FinancialOS payment publishers are active for this tenant.",
      sourceModules: ["financial_os"],
    });
  }

  const quoteMetric = snapshot.metrics.find((m) => m.key === "quote_sent");
  const consultMetric = snapshot.metrics.find((m) => m.key === "consultations_booked");
  if (
    consultMetric &&
    quoteMetric &&
    consultMetric.value > 0 &&
    quoteMetric.value < consultMetric.value * 0.5
  ) {
    insights.push({
      id: insightId("conversion", "quote_gap"),
      type: "conversion_gap",
      severity: "warning",
      title: "Conversion gap detected",
      description: "Quote activity is low relative to consultation activity.",
      recommendedAction: "Review consultation close-out workflow and quote send SLAs.",
      sourceModules: ["consultation_os", "leadflow"],
    });
  } else if (conversion.score >= 70 && !conversion.limitedSignal) {
    insights.push({
      id: insightId("conversion", "healthy"),
      type: "conversion_gap",
      severity: "positive",
      title: "Conversion funnel active",
      description: "Quote and consultation progression is within healthy range.",
      recommendedAction: "Maintain quote follow-up cadence and monitor stage velocity.",
      sourceModules: ["consultation_os", "leadflow"],
    });
  }

  if (workforce.score < 55 || workforce.band === "risk" || workforce.band === "critical") {
    insights.push({
      id: insightId("workforce", "risk"),
      type: "workforce_risk",
      severity: workforce.band === "critical" ? "critical" : "risk",
      title: "Workforce readiness below target",
      description: workforce.explanation,
      recommendedAction: "Open WorkforceOS readiness review and resolve blocked or warning staff.",
      sourceModules: ["workforce_os"],
    });
  } else if (workforce.limitedSignal) {
    insights.push({
      id: insightId("workforce", "limited"),
      type: "workforce_risk",
      severity: "info",
      title: "Workforce signal limited",
      description: workforce.explanation,
      recommendedAction: "Enable WorkforceOS readiness overview or increase staffing event coverage.",
      sourceModules: ["workforce_os"],
    });
  }

  const surgeryMetric = snapshot.metrics.find((m) => m.key === "surgeries_completed");
  if (surgeryMetric?.changePercent != null && Math.abs(surgeryMetric.changePercent) <= 5) {
    insights.push({
      id: insightId("surgery", "stable"),
      type: "surgery_throughput",
      severity: "info",
      title: "Surgery throughput stable",
      description: "Surgery completion activity is stable compared with the previous period.",
      recommendedAction: "Monitor theatre capacity and readiness alerts for upcoming cases.",
      sourceModules: ["surgery_os"],
    });
  } else if (surgeryMetric?.changePercent != null && surgeryMetric.changePercent >= 15) {
    insights.push({
      id: insightId("surgery", "up"),
      type: "surgery_throughput",
      severity: "positive",
      title: "Surgery throughput rising",
      description: "Surgery completions increased compared with the previous period.",
      recommendedAction: "Ensure post-op follow-up capacity keeps pace with throughput.",
      sourceModules: ["surgery_os"],
    });
  } else if (surgical.limitedSignal) {
    insights.push({
      id: insightId("surgery", "limited"),
      type: "surgery_throughput",
      severity: "info",
      title: "Limited surgical signal",
      description: surgical.explanation,
      recommendedAction: "Verify SurgeryOS completion publishers are wired for this tenant.",
      sourceModules: ["surgery_os"],
    });
  }

  if (patient.limitedSignal && patient.score < 50) {
    insights.push({
      id: insightId("patient", "limited"),
      type: "patient_journey",
      severity: "info",
      title: "Patient journey coverage limited",
      description: patient.explanation,
      recommendedAction: "Enable PatientOS event publishers for uploads, reports, and follow-ups.",
      sourceModules: ["patient_os"],
    });
  }

  const activeModules = snapshot.moduleCoverage.filter((m) => m.status === "active").length;
  if (data.limitedSignal || activeModules < 3) {
    insights.push({
      id: insightId("data", "gap"),
      type: "data_gap",
      severity: activeModules === 0 ? "critical" : "warning",
      title: "Analytics confidence limited",
      description:
        activeModules === 0
          ? "No modules published analytics events this period."
          : `Analytics confidence is limited because only ${activeModules} module${activeModules === 1 ? "" : "s"} published events this period.`,
      recommendedAction: "Expand AnalyticsOS event publishers across remaining FI OS modules.",
      sourceModules: snapshot.moduleCoverage
        .filter((m) => m.status === "active")
        .map((m) => m.moduleName),
    });
  }

  if (overall.band === "excellent" || overall.band === "strong") {
    insights.push({
      id: insightId("overall", "healthy"),
      type: "overall_health",
      severity: "positive",
      title: "Clinic health is strong",
      description: overall.explanation,
      recommendedAction: "Continue monitoring watch-list dimensions and module coverage growth.",
      sourceModules: deriveActiveModules(snapshot),
    });
  } else if (overall.band === "risk" || overall.band === "critical") {
    insights.push({
      id: insightId("overall", "attention"),
      type: "overall_health",
      severity: overall.band === "critical" ? "critical" : "risk",
      title: "Clinic health needs owner attention",
      description: overall.explanation,
      recommendedAction: "Prioritize lowest-scoring dimensions and resolve data coverage gaps.",
      sourceModules: deriveActiveModules(snapshot),
    });
  }

  const severityOrder: Record<AnalyticsExecutiveInsight["severity"], number> = {
    critical: 0,
    risk: 1,
    warning: 2,
    info: 3,
    positive: 4,
  };

  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function deriveActiveModules(snapshot: AnalyticsExecutiveSnapshot): AnalyticsModuleName[] {
  return snapshot.moduleCoverage.filter((m) => m.status === "active").map((m) => m.moduleName);
}
