import { ENTERPRISE_DEMO_CLINICS } from "./enterpriseDemoConstants";
import { ENTERPRISE_DEMO_CLINIC_FINANCIAL_PROFILES } from "./enterpriseDemoFinancialGenerator";
import { ENTERPRISE_DEMO_CLINIC_IMAGING_PROFILES } from "./enterpriseDemoImagingAuditGenerator";
import { ENTERPRISE_DEMO_CLINIC_PERFORMANCE_PROFILES } from "./enterpriseDemoSurgeriesGenerator";

export type GlobalCommandCentreSeverity = "critical" | "warning" | "info";

export type GlobalCommandCentreAlert = {
  id: string;
  severity: GlobalCommandCentreSeverity;
  clinicSlug: string;
  clinicName: string;
  title: string;
  summary: string;
  domain: "financial" | "imaging" | "surgical" | "outcome" | "network";
  occurredAt: string;
};

export type GlobalCommandCentreNetworkKpis = {
  activeClinics: number;
  surgeriesToday: number;
  surgeriesThisWeek: number;
  openFinancialRiskAlerts: number;
  protocolImagingIssues: number;
  averageGraftSurvivalPct: number | null;
  revenueCollectedCents: number;
  revenueOutstandingCents: number;
  currency: string;
};

export type GlobalCommandCentreClinicRiskRow = {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  city: string;
  country: string;
  riskScore: number;
  revenueStatus: string;
  imagingCompliance: string;
  surgicalQualityStatus: string;
  staffTrainingStatus: string;
};

export type GlobalCommandCentreSurgicalSnapshot = {
  totalGraftsExtracted: number;
  totalGraftsImplanted: number;
  totalHairs: number;
  averageTransectionRatePct: number | null;
  reconciliationCompleted: number;
  reconciliationPending: number;
  reconciliationMismatch: number;
};

export type GlobalCommandCentreOutcomeSnapshot = {
  averageSurvivalEstimatePct: number | null;
  averageDonorRecoveryScore: number | null;
  averageSatisfactionScore: number | null;
  auditsApproved: number;
  auditsWithWarnings: number;
  incompleteFollowUp: number;
};

export type GlobalCommandCentreClinicAggregate = {
  clinicId: string;
  clinicSlug: string;
  clinicName: string;
  city: string;
  country: string;
  maxRiskScore: number;
  overdueInvoiceCount: number;
  openRiskAlertCount: number;
  protocolIssueCount: number;
  protocolCompletionStatuses: string[];
  elevatedTransectionCount: number;
  missingReconciliationCount: number;
  survivalEstimates: number[];
  satisfactionScores: number[];
};

export type GlobalCommandCentreRawFinancialRow = {
  clinicSlug: string | null;
  totalCents: number;
  amountPaidCents: number;
  status: string;
  isOpen: boolean;
};

export type GlobalCommandCentreRawCaseRiskRow = {
  clinicSlug: string | null;
  franchiseRiskScore: number;
  revenueVarianceFlag: boolean;
  inventoryToGraftVarianceFlag: boolean;
  paymentReconciliationStatus: string | null;
  riskReasonCodes: string[];
};

export type GlobalCommandCentreRawProtocolRow = {
  clinicSlug: string | null;
  protocolCompletionStatus: string | null;
  missingSlots: string[];
  qualityFlaggedSlots: string[];
};

export type GlobalCommandCentreRawSurgeryRow = {
  clinicSlug: string | null;
  scheduledDate: string;
  transectionRatePercent: number | null;
  performanceProfile: string | null;
  reconciliationStatus: string | null;
  isToday: boolean;
  isThisWeek: boolean;
};

export type GlobalCommandCentreRawOutcomeRow = {
  clinicSlug: string | null;
  graftSurvivalEstimate: number | null;
  donorRecoveryScore: number | null;
  satisfactionScore: number | null;
  auditStatus: string | null;
  warnings: string[];
};

const CLINIC_NAME_BY_SLUG = new Map<string, string>(ENTERPRISE_DEMO_CLINICS.map((c) => [c.slug, c.name]));

function clinicLabel(slug: string): string {
  return CLINIC_NAME_BY_SLUG.get(slug) ?? slug.replace(/-/g, " ");
}

function revenueStatusLabel(aggregate: GlobalCommandCentreClinicAggregate): string {
  const profile = ENTERPRISE_DEMO_CLINIC_FINANCIAL_PROFILES[aggregate.clinicSlug];
  if (aggregate.overdueInvoiceCount > 0) return "Overdue balances";
  if (profile === "graft_invoice_variance") return "Graft/invoice variance";
  if (profile === "refund_adjustment_heavy") return "Refund exposure";
  if (profile === "quote_expiry_leakage") return "Quote expiry leakage";
  if (profile === "clean_reconciliation") return "Reconciled";
  if (aggregate.openRiskAlertCount > 0) return "Risk flagged";
  return "Within tolerance";
}

function imagingComplianceLabel(aggregate: GlobalCommandCentreClinicAggregate): string {
  const profile = ENTERPRISE_DEMO_CLINIC_IMAGING_PROFILES[aggregate.clinicSlug];
  const statuses = new Set(aggregate.protocolCompletionStatuses);

  if (statuses.has("missing_follow_up")) return "Missing follow-up";
  if (statuses.has("graft_tray_mismatch")) return "Graft tray mismatch";
  if (statuses.has("complete_with_flags")) return "Complete with flags";
  if (statuses.has("excellent") || profile === "excellent_completion") return "Excellent";
  if (aggregate.protocolIssueCount > 0) return "Protocol gaps";
  return "Compliant";
}

function surgicalQualityLabel(aggregate: GlobalCommandCentreClinicAggregate): string {
  const profile = ENTERPRISE_DEMO_CLINIC_PERFORMANCE_PROFILES[aggregate.clinicSlug];
  if (profile === "benchmark") return "Benchmark";
  if (aggregate.elevatedTransectionCount > 0) return "Elevated transection";
  if (aggregate.missingReconciliationCount > 0) return "Reconciliation pending";
  if (profile === "graft_count_vs_quote") return "Graft vs quote variance";
  return "Nominal";
}

function staffTrainingPlaceholder(clinicSlug: string): string {
  const idx = ENTERPRISE_DEMO_CLINICS.findIndex((c) => c.slug === clinicSlug);
  if (idx < 0) return "Academy sync pending";
  const labels = ["Certified", "Recert due Q3", "Training on track", "Module 4 pending"];
  return labels[idx % labels.length];
}

export function aggregateClinicRows(
  clinics: readonly {
    id: string;
    slug: string;
    name: string;
    city: string;
    country: string;
  }[],
  financialRows: readonly GlobalCommandCentreRawFinancialRow[],
  caseRiskRows: readonly GlobalCommandCentreRawCaseRiskRow[],
  protocolRows: readonly GlobalCommandCentreRawProtocolRow[],
  surgeryRows: readonly GlobalCommandCentreRawSurgeryRow[],
  outcomeRows: readonly GlobalCommandCentreRawOutcomeRow[]
): GlobalCommandCentreClinicAggregate[] {
  const bySlug = new Map<string, GlobalCommandCentreClinicAggregate>();

  for (const clinic of clinics) {
    bySlug.set(clinic.slug, {
      clinicId: clinic.id,
      clinicSlug: clinic.slug,
      clinicName: clinic.name,
      city: clinic.city,
      country: clinic.country,
      maxRiskScore: 0,
      overdueInvoiceCount: 0,
      openRiskAlertCount: 0,
      protocolIssueCount: 0,
      protocolCompletionStatuses: [],
      elevatedTransectionCount: 0,
      missingReconciliationCount: 0,
      survivalEstimates: [],
      satisfactionScores: [],
    });
  }

  for (const row of financialRows) {
    if (!row.clinicSlug) continue;
    const agg = bySlug.get(row.clinicSlug);
    if (!agg) continue;
    if (row.status === "overdue" || (row.isOpen && row.status === "partially_paid")) {
      agg.overdueInvoiceCount += 1;
    }
  }

  for (const row of caseRiskRows) {
    if (!row.clinicSlug) continue;
    const agg = bySlug.get(row.clinicSlug);
    if (!agg) continue;
    agg.maxRiskScore = Math.max(agg.maxRiskScore, row.franchiseRiskScore);
    if (
      row.revenueVarianceFlag ||
      row.inventoryToGraftVarianceFlag ||
      row.paymentReconciliationStatus === "mismatch_flagged" ||
      row.paymentReconciliationStatus === "overdue_follow_up_missing" ||
      row.franchiseRiskScore >= 55
    ) {
      agg.openRiskAlertCount += 1;
    }
  }

  for (const row of protocolRows) {
    if (!row.clinicSlug) continue;
    const agg = bySlug.get(row.clinicSlug);
    if (!agg) continue;
    if (row.protocolCompletionStatus) {
      agg.protocolCompletionStatuses.push(row.protocolCompletionStatus);
    }
    const issue =
      row.protocolCompletionStatus === "missing_follow_up" ||
      row.protocolCompletionStatus === "graft_tray_mismatch" ||
      row.protocolCompletionStatus === "complete_with_flags" ||
      row.protocolCompletionStatus === "partial" ||
      row.missingSlots.length > 0;
    if (issue) agg.protocolIssueCount += 1;
  }

  for (const row of surgeryRows) {
    if (!row.clinicSlug) continue;
    const agg = bySlug.get(row.clinicSlug);
    if (!agg) continue;
    if (row.transectionRatePercent != null && row.transectionRatePercent >= 10) {
      agg.elevatedTransectionCount += 1;
    }
    if (row.reconciliationStatus === "pending" || row.reconciliationStatus === "mismatch") {
      agg.missingReconciliationCount += 1;
    }
  }

  for (const row of outcomeRows) {
    if (!row.clinicSlug) continue;
    const agg = bySlug.get(row.clinicSlug);
    if (!agg) continue;
    if (row.graftSurvivalEstimate != null) agg.survivalEstimates.push(row.graftSurvivalEstimate);
    if (row.satisfactionScore != null) agg.satisfactionScores.push(row.satisfactionScore);
  }

  return [...bySlug.values()].sort((a, b) => b.maxRiskScore - a.maxRiskScore || a.clinicName.localeCompare(b.clinicName));
}

export function buildClinicRiskTable(aggregates: readonly GlobalCommandCentreClinicAggregate[]): GlobalCommandCentreClinicRiskRow[] {
  return aggregates.map((aggregate) => ({
    clinicId: aggregate.clinicId,
    clinicName: aggregate.clinicName,
    clinicSlug: aggregate.clinicSlug,
    city: aggregate.city,
    country: aggregate.country,
    riskScore: aggregate.maxRiskScore,
    revenueStatus: revenueStatusLabel(aggregate),
    imagingCompliance: imagingComplianceLabel(aggregate),
    surgicalQualityStatus: surgicalQualityLabel(aggregate),
    staffTrainingStatus: staffTrainingPlaceholder(aggregate.clinicSlug),
  }));
}

export function aggregateNetworkKpis(input: {
  activeClinics: number;
  surgeryRows: readonly GlobalCommandCentreRawSurgeryRow[];
  caseRiskRows: readonly GlobalCommandCentreRawCaseRiskRow[];
  protocolRows: readonly GlobalCommandCentreRawProtocolRow[];
  outcomeRows: readonly GlobalCommandCentreRawOutcomeRow[];
  financialRows: readonly GlobalCommandCentreRawFinancialRow[];
  currency: string;
}): GlobalCommandCentreNetworkKpis {
  const surgeriesToday = input.surgeryRows.filter((r) => r.isToday).length;
  const surgeriesThisWeek = input.surgeryRows.filter((r) => r.isThisWeek).length;

  const openFinancialRiskAlerts = input.caseRiskRows.filter(
    (r) =>
      r.revenueVarianceFlag ||
      r.inventoryToGraftVarianceFlag ||
      r.paymentReconciliationStatus === "mismatch_flagged" ||
      r.paymentReconciliationStatus === "overdue_follow_up_missing" ||
      r.franchiseRiskScore >= 55
  ).length;

  const protocolImagingIssues = input.protocolRows.filter((r) => {
    const status = r.protocolCompletionStatus;
    return (
      status === "missing_follow_up" ||
      status === "graft_tray_mismatch" ||
      status === "complete_with_flags" ||
      status === "partial" ||
      r.missingSlots.length > 0
    );
  }).length;

  const survivalValues = input.outcomeRows
    .map((r) => r.graftSurvivalEstimate)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const averageGraftSurvivalPct =
    survivalValues.length > 0 ? round1(average(survivalValues)) : null;

  let revenueCollectedCents = 0;
  let revenueOutstandingCents = 0;
  for (const row of input.financialRows) {
    revenueCollectedCents += row.amountPaidCents;
    if (row.isOpen) {
      revenueOutstandingCents += Math.max(0, row.totalCents - row.amountPaidCents);
    }
  }

  return {
    activeClinics: input.activeClinics,
    surgeriesToday,
    surgeriesThisWeek,
    openFinancialRiskAlerts,
    protocolImagingIssues,
    averageGraftSurvivalPct,
    revenueCollectedCents,
    revenueOutstandingCents,
    currency: input.currency,
  };
}

export function aggregateSurgicalSnapshot(graftTotals: {
  extracted: number;
  implanted: number;
  totalHairs: number;
  transectionRates: number[];
  reconciliationCompleted: number;
  reconciliationPending: number;
  reconciliationMismatch: number;
}): GlobalCommandCentreSurgicalSnapshot {
  const transectionRates = graftTotals.transectionRates.filter((v) => Number.isFinite(v));
  return {
    totalGraftsExtracted: graftTotals.extracted,
    totalGraftsImplanted: graftTotals.implanted,
    totalHairs: graftTotals.totalHairs,
    averageTransectionRatePct: transectionRates.length > 0 ? round1(average(transectionRates)) : null,
    reconciliationCompleted: graftTotals.reconciliationCompleted,
    reconciliationPending: graftTotals.reconciliationPending,
    reconciliationMismatch: graftTotals.reconciliationMismatch,
  };
}

export function aggregateOutcomeSnapshot(
  outcomeRows: readonly GlobalCommandCentreRawOutcomeRow[]
): GlobalCommandCentreOutcomeSnapshot {
  const survival = outcomeRows.map((r) => r.graftSurvivalEstimate).filter((v): v is number => v != null);
  const donor = outcomeRows.map((r) => r.donorRecoveryScore).filter((v): v is number => v != null);
  const satisfaction = outcomeRows.map((r) => r.satisfactionScore).filter((v): v is number => v != null);

  let auditsApproved = 0;
  let auditsWithWarnings = 0;
  let incompleteFollowUp = 0;

  for (const row of outcomeRows) {
    if (row.auditStatus === "approved") auditsApproved += 1;
    if (row.warnings.length > 0 || row.auditStatus === "graft_variance_warning") auditsWithWarnings += 1;
    if (row.auditStatus === "incomplete_follow_up") incompleteFollowUp += 1;
  }

  return {
    averageSurvivalEstimatePct: survival.length > 0 ? round1(average(survival)) : null,
    averageDonorRecoveryScore: donor.length > 0 ? round1(average(donor)) : null,
    averageSatisfactionScore: satisfaction.length > 0 ? round1(average(satisfaction)) : null,
    auditsApproved,
    auditsWithWarnings,
    incompleteFollowUp,
  };
}

/** Curated franchise alert feed aligned with TITAN Phase 1F anomaly profiles. */
export function buildEnterpriseDemoGlobalCommandCentreAlerts(
  referenceDate: Date,
  clinicRiskRows: readonly GlobalCommandCentreClinicRiskRow[]
): GlobalCommandCentreAlert[] {
  const iso = (hoursAgo: number) => new Date(referenceDate.getTime() - hoursAgo * 60 * 60 * 1000).toISOString();

  const alerts: GlobalCommandCentreAlert[] = [
    {
      id: "dubai-graft-invoice-variance",
      severity: "critical",
      clinicSlug: "dubai-hair-institute",
      clinicName: clinicLabel("dubai-hair-institute"),
      title: "Graft count vs invoice variance",
      summary:
        "Extracted graft totals exceed quoted invoice bands on multiple Dubai cases. Franchise risk engine flagged inventory-to-graft variance.",
      domain: "financial",
      occurredAt: iso(2),
    },
    {
      id: "bangkok-overdue-imaging",
      severity: "critical",
      clinicSlug: "bangkok-restoration-centre",
      clinicName: clinicLabel("bangkok-restoration-centre"),
      title: "Overdue balances + missing follow-up imaging",
      summary:
        "Surgery balance invoices remain overdue while 3/6/12-month outcome imaging slots are incomplete on active cases.",
      domain: "imaging",
      occurredAt: iso(5),
    },
    {
      id: "london-quality-refund",
      severity: "warning",
      clinicSlug: "london-central-institute",
      clinicName: clinicLabel("london-central-institute"),
      title: "Quality-linked refund warning",
      summary:
        "Elevated transection profile triggered quality adjustment invoices and partial refund activity on completed procedures.",
      domain: "surgical",
      occurredAt: iso(8),
    },
    {
      id: "athens-quote-expiry",
      severity: "warning",
      clinicSlug: "athens-medical-institute",
      clinicName: clinicLabel("athens-medical-institute"),
      title: "Quote expiry leakage",
      summary:
        "Consultation quotes expired without conversion follow-up — revenue leakage detected across open quote invoices.",
      domain: "financial",
      occurredAt: iso(14),
    },
    {
      id: "sydney-benchmark",
      severity: "info",
      clinicSlug: "sydney-hair-institute",
      clinicName: clinicLabel("sydney-hair-institute"),
      title: "Benchmark network status",
      summary:
        "Sydney clinic operating within benchmark transection, imaging completion, and financial reconciliation tolerances.",
      domain: "network",
      occurredAt: iso(20),
    },
  ];

  const knownSlugs = new Set(clinicRiskRows.map((r) => r.clinicSlug));
  return alerts.filter((a) => knownSlugs.has(a.clinicSlug));
}

export function isDateInWeek(dateYmd: string, todayYmd: string): boolean {
  const start = new Date(`${todayYmd}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  return d >= start && d <= end;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
