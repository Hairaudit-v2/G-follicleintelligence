import assert from "node:assert/strict";
import test from "node:test";

import { ENTERPRISE_DEMO_CLINICS } from "./enterpriseDemoConstants";
import {
  aggregateClinicRows,
  aggregateNetworkKpis,
  aggregateOutcomeSnapshot,
  aggregateSurgicalSnapshot,
  buildClinicRiskTable,
  buildEnterpriseDemoGlobalCommandCentreAlerts,
  isDateInWeek,
  type GlobalCommandCentreRawCaseRiskRow,
  type GlobalCommandCentreRawFinancialRow,
  type GlobalCommandCentreRawOutcomeRow,
  type GlobalCommandCentreRawProtocolRow,
  type GlobalCommandCentreRawSurgeryRow,
} from "./enterpriseDemoGlobalCommandCentreModel";

const clinics = ENTERPRISE_DEMO_CLINICS.map((c, i) => ({
  id: `clinic-${i}`,
  slug: c.slug,
  name: c.name,
  city: c.city,
  country: c.country,
}));

test("isDateInWeek includes today and six following days", () => {
  assert.equal(isDateInWeek("2026-06-19", "2026-06-19"), true);
  assert.equal(isDateInWeek("2026-06-25", "2026-06-19"), true);
  assert.equal(isDateInWeek("2026-06-26", "2026-06-19"), false);
});

test("aggregateNetworkKpis counts surgeries and financial risk alerts", () => {
  const surgeryRows: GlobalCommandCentreRawSurgeryRow[] = [
    {
      clinicSlug: "dubai-hair-institute",
      scheduledDate: "2026-06-19",
      transectionRatePercent: null,
      performanceProfile: null,
      reconciliationStatus: null,
      isToday: true,
      isThisWeek: true,
    },
    {
      clinicSlug: "sydney-hair-institute",
      scheduledDate: "2026-06-21",
      transectionRatePercent: null,
      performanceProfile: "benchmark",
      reconciliationStatus: "completed",
      isToday: false,
      isThisWeek: true,
    },
  ];

  const caseRiskRows: GlobalCommandCentreRawCaseRiskRow[] = [
    {
      clinicSlug: "dubai-hair-institute",
      franchiseRiskScore: 72,
      revenueVarianceFlag: true,
      inventoryToGraftVarianceFlag: true,
      paymentReconciliationStatus: "mismatch_flagged",
      riskReasonCodes: ["inventory_to_graft_variance"],
    },
  ];

  const protocolRows: GlobalCommandCentreRawProtocolRow[] = [
    {
      clinicSlug: "bangkok-restoration-centre",
      protocolCompletionStatus: "missing_follow_up",
      missingSlots: ["6_month"],
      qualityFlaggedSlots: [],
    },
  ];

  const outcomeRows: GlobalCommandCentreRawOutcomeRow[] = [
    {
      clinicSlug: "sydney-hair-institute",
      graftSurvivalEstimate: 92,
      donorRecoveryScore: 88,
      satisfactionScore: 90,
      auditStatus: "approved",
      warnings: [],
    },
    {
      clinicSlug: "london-central-institute",
      graftSurvivalEstimate: 86,
      donorRecoveryScore: 84,
      satisfactionScore: 82,
      auditStatus: "graft_variance_warning",
      warnings: ["Elevated transection"],
    },
  ];

  const financialRows: GlobalCommandCentreRawFinancialRow[] = [
    {
      clinicSlug: "dubai-hair-institute",
      totalCents: 100_000,
      amountPaidCents: 40_000,
      status: "partially_paid",
      isOpen: true,
    },
    {
      clinicSlug: "bangkok-restoration-centre",
      totalCents: 50_000,
      amountPaidCents: 50_000,
      status: "paid",
      isOpen: false,
    },
  ];

  const kpis = aggregateNetworkKpis({
    activeClinics: clinics.length,
    surgeryRows,
    caseRiskRows,
    protocolRows,
    outcomeRows,
    financialRows,
    currency: "USD",
  });

  assert.equal(kpis.surgeriesToday, 1);
  assert.equal(kpis.surgeriesThisWeek, 2);
  assert.equal(kpis.openFinancialRiskAlerts, 1);
  assert.equal(kpis.protocolImagingIssues, 1);
  assert.equal(kpis.averageGraftSurvivalPct, 89);
  assert.equal(kpis.revenueCollectedCents, 90_000);
  assert.equal(kpis.revenueOutstandingCents, 60_000);
});

test("buildClinicRiskTable surfaces Dubai and Bangkok anomaly labels", () => {
  const financialRows: GlobalCommandCentreRawFinancialRow[] = [
    {
      clinicSlug: "bangkok-restoration-centre",
      totalCents: 10_000,
      amountPaidCents: 0,
      status: "overdue",
      isOpen: true,
    },
  ];

  const caseRiskRows: GlobalCommandCentreRawCaseRiskRow[] = [
    {
      clinicSlug: "dubai-hair-institute",
      franchiseRiskScore: 68,
      revenueVarianceFlag: true,
      inventoryToGraftVarianceFlag: true,
      paymentReconciliationStatus: "mismatch_flagged",
      riskReasonCodes: [],
    },
    {
      clinicSlug: "bangkok-restoration-centre",
      franchiseRiskScore: 61,
      revenueVarianceFlag: false,
      inventoryToGraftVarianceFlag: false,
      paymentReconciliationStatus: "overdue_follow_up_missing",
      riskReasonCodes: [],
    },
  ];

  const protocolRows: GlobalCommandCentreRawProtocolRow[] = [
    {
      clinicSlug: "bangkok-restoration-centre",
      protocolCompletionStatus: "missing_follow_up",
      missingSlots: ["3_month"],
      qualityFlaggedSlots: [],
    },
  ];

  const aggregates = aggregateClinicRows(
    clinics,
    financialRows,
    caseRiskRows,
    protocolRows,
    [],
    []
  );
  const rows = buildClinicRiskTable(aggregates);

  const dubai = rows.find((r) => r.clinicSlug === "dubai-hair-institute");
  const bangkok = rows.find((r) => r.clinicSlug === "bangkok-restoration-centre");

  assert.ok(dubai);
  assert.equal(dubai.revenueStatus, "Graft/invoice variance");
  assert.ok(bangkok);
  assert.equal(bangkok.revenueStatus, "Overdue balances");
  assert.equal(bangkok.imagingCompliance, "Missing follow-up");
});

test("buildEnterpriseDemoGlobalCommandCentreAlerts returns curated franchise alerts", () => {
  const clinicRiskRows = buildClinicRiskTable(aggregateClinicRows(clinics, [], [], [], [], []));
  const alerts = buildEnterpriseDemoGlobalCommandCentreAlerts(
    new Date("2026-06-19T12:00:00.000Z"),
    clinicRiskRows
  );

  assert.equal(alerts.length, 5);
  assert.ok(alerts.some((a) => a.id === "dubai-graft-invoice-variance"));
  assert.ok(alerts.some((a) => a.id === "bangkok-overdue-imaging"));
  assert.ok(alerts.some((a) => a.id === "sydney-benchmark"));
});

test("aggregateSurgicalSnapshot and aggregateOutcomeSnapshot roll up totals", () => {
  const surgical = aggregateSurgicalSnapshot({
    extracted: 12000,
    implanted: 11500,
    totalHairs: 25000,
    transectionRates: [12, 8, 6],
    reconciliationCompleted: 80,
    reconciliationPending: 10,
    reconciliationMismatch: 6,
  });

  assert.equal(surgical.totalGraftsExtracted, 12000);
  assert.equal(surgical.averageTransectionRatePct, 8.7);
  assert.equal(surgical.reconciliationPending, 10);

  const outcome = aggregateOutcomeSnapshot([
    {
      clinicSlug: "sydney-hair-institute",
      graftSurvivalEstimate: 90,
      donorRecoveryScore: 85,
      satisfactionScore: 88,
      auditStatus: "approved",
      warnings: [],
    },
    {
      clinicSlug: "london-central-institute",
      graftSurvivalEstimate: 80,
      donorRecoveryScore: 75,
      satisfactionScore: 78,
      auditStatus: "incomplete_follow_up",
      warnings: ["Follow-up imaging incomplete"],
    },
  ]);

  assert.equal(outcome.averageSurvivalEstimatePct, 85);
  assert.equal(outcome.auditsApproved, 1);
  assert.equal(outcome.incompleteFollowUp, 1);
  assert.equal(outcome.auditsWithWarnings, 1);
});
