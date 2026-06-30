/**
 * AnalyticsOS — clinic-facing presentation helpers (UI copy only; no loader changes).
 */

import type {
  AnalyticsExecutiveDashboardPayload,
  AnalyticsExecutiveInsight,
} from "./analyticsExecutiveTypes";
import type {
  AnalyticsExecutiveScore,
  AnalyticsExecutiveSnapshot,
} from "./analyticsExecutiveTypes";
import type {
  AnalyticsOsDashboardPayload,
  AnalyticsOsModuleHealthCard,
  AnalyticsOsModuleHealthStatus,
  AnalyticsOsRiskRow,
} from "@/src/lib/fiAdmin/analyticsOsDashboardTypes";

export type ClinicAttentionItem = {
  id: string;
  headline: string;
  detail?: string;
  href?: string;
  linkDisabled?: boolean;
  severity: "critical" | "risk" | "warning" | "info" | "positive";
};

export type ClinicOperationalMetricGroup = {
  id: string;
  title: string;
  metrics: { label: string; value: string }[];
};

export type ClinicModuleHealthRow = {
  id: string;
  label: string;
  statusLabel: "Ready" | "Limited data" | "Needs attention";
  summary: string;
  href: string;
  linkDisabled?: boolean;
};

const LINK_BTN =
  "inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-[#141C33]/60 px-3 py-2 text-sm font-medium text-[#E2E8F0] transition hover:border-[#22C1FF]/35 hover:text-[#22C1FF] disabled:pointer-events-none disabled:opacity-40";

export { LINK_BTN as analyticsOsLinkButtonClass };

export function clinicModuleStatusLabel(
  status: AnalyticsOsModuleHealthStatus
): ClinicModuleHealthRow["statusLabel"] {
  if (status === "healthy") return "Ready";
  if (status === "attention") return "Needs attention";
  return "Limited data";
}

export function clinicCoverageStatusLabel(
  status: "active" | "limited" | "waiting"
): ClinicModuleHealthRow["statusLabel"] {
  if (status === "active") return "Ready";
  if (status === "limited") return "Limited data";
  return "Limited data";
}

export function formatExecutiveScoreValue(score: AnalyticsExecutiveScore): string {
  if (score.limitedSignal && score.score <= 0) {
    return "Not enough history yet";
  }
  return String(Math.max(0, Math.min(100, score.score)));
}

export function formatPctRatio(ratio: number | null | undefined): string {
  if (ratio == null) return "Not enough history yet";
  return `${Math.round(ratio * 100)}%`;
}

function mapInsightToClinicAttention(insight: AnalyticsExecutiveInsight): ClinicAttentionItem {
  const byType: Partial<
    Record<AnalyticsExecutiveInsight["type"], { headline: string; detail?: string }>
  > = {
    conversion_gap: {
      headline: "Consultation conversion needs attention.",
      detail: insight.description,
    },
    workforce_risk: {
      headline: "Workforce readiness is limiting operational confidence.",
      detail: insight.description,
    },
    revenue_momentum: {
      headline:
        insight.severity === "positive"
          ? "Revenue activity is improving compared with the prior period."
          : "Limited surgery economics data is reducing profitability visibility.",
      detail: insight.description,
    },
    patient_journey: {
      headline: "Patient journey coverage is incomplete.",
      detail: insight.description,
    },
    data_gap: {
      headline: "More activity is needed before predictive trends become reliable.",
      detail: insight.description,
    },
    surgery_throughput: {
      headline:
        insight.severity === "warning" || insight.severity === "risk"
          ? "Surgery throughput needs review."
          : "Surgery activity is stable for this period.",
      detail: insight.description,
    },
    overall_health: {
      headline:
        insight.severity === "positive"
          ? "Clinic performance is in a strong range."
          : "Clinic health needs owner attention.",
      detail: insight.description,
    },
  };

  const mapped = byType[insight.type];
  return {
    id: insight.id,
    headline: mapped?.headline ?? insight.title,
    detail: mapped?.detail ?? insight.description,
    severity: insight.severity,
  };
}

function mapRiskRowToClinicAttention(row: AnalyticsOsRiskRow): ClinicAttentionItem {
  const labelMap: Record<string, string> = {
    "Stale leads (pipeline hygiene)":
      "Lead follow-up is overdue — review consultation pipeline hygiene.",
    "CRM tasks due (horizon)": "Open follow-up tasks need attention in LeadFlow.",
    "Surgery readiness alerts (cases)":
      "Surgery readiness needs review before upcoming procedures.",
    "Pending HairAudit reviews": "Independent audit reviews are waiting in AuditOS.",
    "Cases missing foundation patient link":
      "Some patient records still need linking for a complete journey view.",
  };

  return {
    id: `risk_${row.rank}_${row.label}`,
    headline: labelMap[row.label] ?? row.label,
    detail: row.count > 0 ? `${row.count} item${row.count === 1 ? "" : "s"} flagged` : undefined,
    href: row.href,
    linkDisabled: row.linkDisabled,
    severity: row.count >= 10 ? "warning" : "info",
  };
}

const severityRank: Record<ClinicAttentionItem["severity"], number> = {
  critical: 0,
  risk: 1,
  warning: 2,
  info: 3,
  positive: 4,
};

export function buildClinicAttentionItems(
  model: AnalyticsOsDashboardPayload,
  executive: AnalyticsExecutiveDashboardPayload,
  maxItems = 5
): ClinicAttentionItem[] {
  const fromInsights = executive.snapshot.insights
    .filter((i) => i.severity !== "positive")
    .map(mapInsightToClinicAttention);

  const fromRisks = model.riskRows.map(mapRiskRowToClinicAttention);

  const merged = [...fromInsights, ...fromRisks]
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .filter((item, index, arr) => arr.findIndex((x) => x.headline === item.headline) === index);

  if (merged.length === 0) {
    return [
      {
        id: "all_clear",
        headline: "No urgent operational issues surfaced for the loaded snapshots.",
        detail: "Continue monitoring conversion, surgery readiness, and patient movement weekly.",
        severity: "positive",
      },
    ];
  }

  return merged.slice(0, maxItems);
}

export function buildOperationalMetricGroups(
  model: AnalyticsOsDashboardPayload,
  executive: AnalyticsExecutiveDashboardPayload
): ClinicOperationalMetricGroup[] {
  const op = model.operational.state === "ok" ? model.operational.data : null;
  const pat = model.patient.state === "ok" ? model.patient.data : null;
  const sur = model.surgery.state === "ok" ? model.surgery.data : null;
  const aud = model.audit.state === "ok" ? model.audit.data : null;
  const snap = executive.snapshot;

  const paymentMetric = snap.metrics.find((m) => m.key === "payment_count");
  const paymentValue = snap.metrics.find((m) => m.key === "payment_value");
  const quoteMetric = snap.metrics.find((m) => m.key === "quote_sent");
  const consultMetric = snap.metrics.find((m) => m.key === "consultations_booked");
  const surgeryMetric = snap.metrics.find((m) => m.key === "surgeries_completed");

  const groups: ClinicOperationalMetricGroup[] = [
    {
      id: "revenue",
      title: "Revenue & finance",
      metrics: [
        {
          label: "Payments received",
          value:
            paymentMetric && paymentMetric.value > 0
              ? String(paymentMetric.value)
              : op?.launchControl.revenueAvailable
                ? "No payments recorded this period"
                : "Financial tracking not active yet",
        },
        {
          label: "Payment volume",
          value:
            paymentValue && paymentValue.value > 0
              ? String(paymentValue.value)
              : "Not enough history yet",
        },
      ],
    },
    {
      id: "conversion",
      title: "Consultations & conversion",
      metrics: [
        {
          label: "30-day conversion",
          value: op
            ? formatPctRatio(op.quickStats.conversionRateLast30d)
            : "Not enough history yet",
        },
        {
          label: "Consultations booked",
          value:
            consultMetric && consultMetric.value > 0
              ? String(consultMetric.value)
              : op
                ? String(op.quickStats.openConsultations)
                : "Not enough history yet",
        },
        {
          label: "Quotes sent",
          value:
            quoteMetric && quoteMetric.value > 0
              ? String(quoteMetric.value)
              : "Not enough history yet",
        },
      ],
    },
    {
      id: "surgery",
      title: "Surgery activity",
      metrics: [
        {
          label: "Today's surgeries",
          value: sur ? String(sur.todaySurgeriesCount) : "Not enough history yet",
        },
        {
          label: "Upcoming (30d)",
          value: sur ? String(sur.metrics.upcomingSurgeries) : "Not enough history yet",
        },
        {
          label: "Completed this period",
          value:
            surgeryMetric && surgeryMetric.value > 0
              ? String(surgeryMetric.value)
              : sur
                ? String(sur.recentCompletedCount)
                : "Not enough history yet",
        },
      ],
    },
    {
      id: "patients",
      title: "Patient movement",
      metrics: [
        {
          label: "Total patients",
          value: pat ? String(pat.kpis.totalPatients) : "Not enough history yet",
        },
        {
          label: "Active journeys",
          value: pat ? String(pat.kpis.patientsWithActiveCases) : "Not enough history yet",
        },
        {
          label: "Follow-up due",
          value: pat ? String(pat.kpis.patientsNeedingFollowUp) : "Not enough history yet",
        },
      ],
    },
    {
      id: "workforce",
      title: "Workforce readiness",
      metrics: [
        {
          label: "Readiness score",
          value: formatExecutiveScoreValue(snap.workforceReadinessScore),
        },
        {
          label: "Pending audit reviews",
          value: aud ? String(aud.kpis.pending_reviews) : "Not enough history yet",
        },
      ],
    },
  ];

  return groups.filter(
    (g) => g.metrics.some((m) => m.value !== "Not enough history yet") || g.id === "conversion"
  );
}

export function countVisibleOperationalMetrics(groups: ClinicOperationalMetricGroup[]): number {
  return groups.reduce((sum, g) => sum + g.metrics.length, 0);
}

export function shouldShowLimitedTrendMessage(snapshot: AnalyticsExecutiveSnapshot): boolean {
  return (
    snapshot.analyticsConfidence === "low" ||
    snapshot.dataCompletenessScore.limitedSignal ||
    snapshot.metrics.find((m) => m.key === "total_events")?.value === 0
  );
}

function mapLoaderModuleHealth(
  card: AnalyticsOsModuleHealthCard,
  statusLabel: ClinicModuleHealthRow["statusLabel"]
): ClinicModuleHealthRow {
  return {
    id: card.moduleId,
    label: card.label,
    statusLabel,
    summary: card.primaryMetric,
    href: card.href,
    linkDisabled: card.linkDisabled,
  };
}

export function buildClinicModuleHealthRows(
  model: AnalyticsOsDashboardPayload,
  executive: AnalyticsExecutiveDashboardPayload,
  base: string
): ClinicModuleHealthRow[] {
  const allowed = new Set(["clinicos", "leadflow", "patientos", "surgeryos", "auditos"]);
  const fromLoader = model.moduleHealth
    .filter((m) => allowed.has(m.moduleId))
    .map((m) => mapLoaderModuleHealth(m, clinicModuleStatusLabel(m.status)));

  const coverageByModule = new Map(
    executive.snapshot.moduleCoverage.map((row) => [row.moduleName, row] as const)
  );

  const workforce = coverageByModule.get("workforce_os");
  const financial = coverageByModule.get("financial_os");

  const workforceRow: ClinicModuleHealthRow = {
    id: "workforceos",
    label: "WorkforceOS",
    statusLabel: workforce ? clinicCoverageStatusLabel(workforce.status) : "Limited data",
    summary: workforce
      ? workforce.status === "active"
        ? "Staff readiness signals available"
        : "Building workforce activity history"
      : "Not enough history yet",
    href: `${base}/hr-os`,
  };

  const financialRow: ClinicModuleHealthRow = {
    id: "financialos",
    label: "FinancialOS",
    statusLabel: financial ? clinicCoverageStatusLabel(financial.status) : "Limited data",
    summary: financial
      ? financial.status === "active"
        ? "Revenue activity captured"
        : "Building financial activity history"
      : "Not enough history yet",
    href: `${base}/financial`,
  };

  return [...fromLoader, workforceRow, financialRow];
}

export const EXECUTIVE_HEALTH_CARDS: {
  key: keyof Pick<
    AnalyticsExecutiveSnapshot,
    | "overallClinicHealthScore"
    | "revenueEfficiencyScore"
    | "conversionPerformanceScore"
    | "surgicalEfficiencyScore"
    | "patientJourneyScore"
    | "dataCompletenessScore"
  >;
  title: string;
}[] = [
  { key: "overallClinicHealthScore", title: "Clinic health score" },
  { key: "revenueEfficiencyScore", title: "Revenue signal" },
  { key: "conversionPerformanceScore", title: "Consultation conversion" },
  { key: "surgicalEfficiencyScore", title: "Surgery readiness" },
  { key: "patientJourneyScore", title: "Patient journey health" },
  { key: "dataCompletenessScore", title: "Data completeness" },
];
