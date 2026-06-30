import { formatMoneyFromCents } from "@/src/lib/format/money";

import type { GlobalCommandCentrePayload } from "./enterpriseDemoGlobalCommandCentreLoader.server";

const formatCommandCentreMoney = (cents: number, currency: string): string =>
  formatMoneyFromCents(cents, currency, { maximumFractionDigits: 0, minimumFractionDigits: 0 });

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export type OperatorPainCalloutId =
  | "revenue_variance"
  | "protocol_drift"
  | "staff_training_risk"
  | "quality_linked_refunds"
  | "missing_follow_up_evidence";

export type PresentationSeverity = "critical" | "warning" | "info";

export type OperatorPainCallout = {
  id: OperatorPainCalloutId;
  title: string;
  headline: string;
  metric: string;
  severity: PresentationSeverity;
  clinicsAffected: number;
};

export type PresentationStorySectionId =
  | "network_health"
  | "franchise_risk"
  | "surgical_quality"
  | "financial_leakage"
  | "imaging_audit_proof";

export type PresentationStoryHighlight = {
  label: string;
  value: string;
};

export type PresentationStorySection = {
  id: PresentationStorySectionId;
  index: number;
  title: string;
  subtitle: string;
  narrative: string;
  highlights: PresentationStoryHighlight[];
};

export type GlobalCommandCentrePresentationView = {
  painCallouts: OperatorPainCallout[];
  sections: PresentationStorySection[];
};

const REVENUE_VARIANCE_STATUSES = new Set([
  "Graft/invoice variance",
  "Refund exposure",
  "Quote expiry leakage",
  "Overdue balances",
  "Risk flagged",
]);

const STAFF_RISK_LABELS = new Set(["Recert due Q3", "Module 4 pending"]);

const QUALITY_REFUND_STATUSES = new Set(["Refund exposure", "Elevated transection"]);

function countClinicsMatching(
  rows: GlobalCommandCentrePayload["clinicRiskRows"],
  predicate: (row: GlobalCommandCentrePayload["clinicRiskRows"][number]) => boolean
): number {
  return rows.filter(predicate).length;
}

function topRiskClinicNames(rows: GlobalCommandCentrePayload["clinicRiskRows"], limit = 3): string {
  return rows
    .filter((row) => row.riskScore >= 45)
    .slice(0, limit)
    .map((row) => row.clinicName)
    .join(", ");
}

export function buildOperatorPainCallouts(data: GlobalCommandCentrePayload): OperatorPainCallout[] {
  const { clinicRiskRows, networkKpis, outcomeSnapshot, alerts } = data;

  const revenueVarianceClinics = countClinicsMatching(
    clinicRiskRows,
    (row) => REVENUE_VARIANCE_STATUSES.has(row.revenueStatus) || row.riskScore >= 55
  );

  const protocolDriftClinics = countClinicsMatching(
    clinicRiskRows,
    (row) =>
      row.imagingCompliance === "Missing follow-up" ||
      row.imagingCompliance === "Protocol gaps" ||
      row.imagingCompliance === "Graft tray mismatch" ||
      row.imagingCompliance === "Complete with flags"
  );

  const staffRiskClinics = countClinicsMatching(clinicRiskRows, (row) =>
    STAFF_RISK_LABELS.has(row.staffTrainingStatus)
  );

  const refundClinics = countClinicsMatching(
    clinicRiskRows,
    (row) =>
      QUALITY_REFUND_STATUSES.has(row.revenueStatus) ||
      QUALITY_REFUND_STATUSES.has(row.surgicalQualityStatus) ||
      row.surgicalQualityStatus === "Graft vs quote variance"
  );

  const followUpClinics = countClinicsMatching(
    clinicRiskRows,
    (row) => row.imagingCompliance === "Missing follow-up"
  );

  const refundAlerts = alerts.filter(
    (alert) =>
      alert.domain === "financial" ||
      alert.domain === "surgical" ||
      alert.title.toLowerCase().includes("refund")
  ).length;

  return [
    {
      id: "revenue_variance",
      title: "Revenue variance",
      headline: "Graft counts, quotes, and invoices diverge before HQ sees it.",
      metric: `${networkKpis.openFinancialRiskAlerts} open risk signals · ${revenueVarianceClinics} clinics flagged`,
      severity: revenueVarianceClinics > 0 ? "critical" : "info",
      clinicsAffected: revenueVarianceClinics,
    },
    {
      id: "protocol_drift",
      title: "Protocol drift",
      headline: "Imaging protocol completion slips off-brand across the network.",
      metric: `${networkKpis.protocolImagingIssues} protocol gaps · ${protocolDriftClinics} clinics drifting`,
      severity: protocolDriftClinics > 0 ? "warning" : "info",
      clinicsAffected: protocolDriftClinics,
    },
    {
      id: "staff_training_risk",
      title: "Staff / training risk",
      headline: "Certification and academy sync gaps surface as franchise exposure.",
      metric: `${staffRiskClinics} clinics with recert or module gaps`,
      severity: staffRiskClinics > 0 ? "warning" : "info",
      clinicsAffected: staffRiskClinics,
    },
    {
      id: "quality_linked_refunds",
      title: "Quality-linked refunds",
      headline: "Surgical quality anomalies trigger adjustments and refund exposure.",
      metric: `${refundClinics} clinics · ${refundAlerts} active quality/financial alerts`,
      severity: refundClinics > 0 ? "critical" : "info",
      clinicsAffected: refundClinics,
    },
    {
      id: "missing_follow_up_evidence",
      title: "Missing follow-up evidence",
      headline: "Outcome imaging and audit proof loops stall before franchise review.",
      metric: `${outcomeSnapshot.incompleteFollowUp} incomplete audits · ${followUpClinics} clinics missing follow-up`,
      severity: outcomeSnapshot.incompleteFollowUp > 0 || followUpClinics > 0 ? "critical" : "info",
      clinicsAffected: Math.max(followUpClinics, outcomeSnapshot.incompleteFollowUp > 0 ? 1 : 0),
    },
  ];
}

export function buildPresentationStorySections(
  data: GlobalCommandCentrePayload
): PresentationStorySection[] {
  const { networkKpis, clinicRiskRows, surgicalSnapshot, outcomeSnapshot, alerts } = data;
  const highRiskCount = clinicRiskRows.filter((row) => row.riskScore >= 55).length;
  const elevatedSurgicalCount = clinicRiskRows.filter(
    (row) =>
      row.surgicalQualityStatus === "Elevated transection" ||
      row.surgicalQualityStatus === "Reconciliation pending"
  ).length;
  const financialAlerts = alerts.filter((alert) => alert.domain === "financial").length;
  const imagingAlerts = alerts.filter(
    (alert) => alert.domain === "imaging" || alert.domain === "outcome"
  ).length;
  const topRiskNames = topRiskClinicNames(clinicRiskRows);

  return [
    {
      id: "network_health",
      index: 1,
      title: "Global network health",
      subtitle: "One operating picture across every franchise clinic",
      narrative:
        "TITAN aggregates live surgical load, financial posture, and outcome signals into a single network pulse — so HQ and franchise operators share the same truth in a sales or board conversation.",
      highlights: [
        { label: "Active clinics", value: String(networkKpis.activeClinics) },
        { label: "Surgeries today", value: String(networkKpis.surgeriesToday) },
        { label: "This week", value: String(networkKpis.surgeriesThisWeek) },
        { label: "Graft survival", value: formatPct(networkKpis.averageGraftSurvivalPct) },
        {
          label: "Collected",
          value: formatCommandCentreMoney(networkKpis.revenueCollectedCents, networkKpis.currency),
        },
      ],
    },
    {
      id: "franchise_risk",
      index: 2,
      title: "Franchise risk detection",
      subtitle: "Rank clinics before variance becomes brand damage",
      narrative:
        "The risk matrix surfaces revenue, imaging, surgical quality, and training posture per clinic — prioritising intervention where franchise exposure is highest.",
      highlights: [
        { label: "High-risk clinics", value: String(highRiskCount) },
        { label: "Open financial alerts", value: String(networkKpis.openFinancialRiskAlerts) },
        { label: "Top exposure", value: topRiskNames || "Within tolerance" },
        {
          label: "Highest score",
          value: clinicRiskRows[0] ? String(clinicRiskRows[0].riskScore) : "—",
        },
      ],
    },
    {
      id: "surgical_quality",
      index: 3,
      title: "Surgical quality intelligence",
      subtitle: "SurgeryOS graft intelligence rolled up for HQ",
      narrative:
        "Extracted vs implanted graft totals, transection profiles, and reconciliation status show where theatre performance drifts from benchmark — before outcomes and refunds follow.",
      highlights: [
        {
          label: "Grafts extracted",
          value: formatNumber(surgicalSnapshot.totalGraftsExtracted),
        },
        {
          label: "Grafts implanted",
          value: formatNumber(surgicalSnapshot.totalGraftsImplanted),
        },
        {
          label: "Transection profile",
          value: formatPct(surgicalSnapshot.averageTransectionRatePct),
        },
        {
          label: "Clinics elevated",
          value: String(elevatedSurgicalCount),
        },
        {
          label: "Reconciliation",
          value: `${surgicalSnapshot.reconciliationCompleted} ok · ${surgicalSnapshot.reconciliationMismatch} mismatch`,
        },
      ],
    },
    {
      id: "financial_leakage",
      index: 4,
      title: "Financial leakage detection",
      subtitle: "Catch quote expiry, variance, and overdue balances early",
      narrative:
        "RevenueOS signals highlight graft-to-invoice variance, quote conversion leakage, and overdue balances — the franchise operator pains that erode margin without a central command view.",
      highlights: [
        {
          label: "Outstanding",
          value: formatCommandCentreMoney(
            networkKpis.revenueOutstandingCents,
            networkKpis.currency
          ),
        },
        {
          label: "Collected",
          value: formatCommandCentreMoney(networkKpis.revenueCollectedCents, networkKpis.currency),
        },
        { label: "Financial alerts", value: String(financialAlerts) },
        { label: "Open risk signals", value: String(networkKpis.openFinancialRiskAlerts) },
      ],
    },
    {
      id: "imaging_audit_proof",
      index: 5,
      title: "Imaging / audit proof loop",
      subtitle: "Close the loop from protocol capture to franchise audit",
      narrative:
        "Imaging protocol completion, outcome audits, and follow-up evidence roll into an audit-ready proof loop — demonstrating compliance and quality to franchise partners and medical directors.",
      highlights: [
        { label: "Protocol issues", value: String(networkKpis.protocolImagingIssues) },
        { label: "Approved audits", value: String(outcomeSnapshot.auditsApproved) },
        { label: "With warnings", value: String(outcomeSnapshot.auditsWithWarnings) },
        { label: "Incomplete follow-up", value: String(outcomeSnapshot.incompleteFollowUp) },
        { label: "Imaging alerts", value: String(imagingAlerts) },
      ],
    },
  ];
}

export function buildGlobalCommandCentrePresentationView(
  data: GlobalCommandCentrePayload
): GlobalCommandCentrePresentationView {
  return {
    painCallouts: buildOperatorPainCallouts(data),
    sections: buildPresentationStorySections(data),
  };
}

export const PRESENTATION_STORY_SECTION_ORDER: PresentationStorySectionId[] = [
  "network_health",
  "franchise_risk",
  "surgical_quality",
  "financial_leakage",
  "imaging_audit_proof",
];

export function isGlobalCommandCentrePresentationPath(pathname: string): boolean {
  return pathname.includes("/global-command-centre/presentation");
}
