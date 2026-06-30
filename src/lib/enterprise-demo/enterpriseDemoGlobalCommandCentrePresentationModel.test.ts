import assert from "node:assert/strict";
import test from "node:test";

import type { GlobalCommandCentrePayload } from "./enterpriseDemoGlobalCommandCentreLoader.server";
import {
  buildGlobalCommandCentrePresentationView,
  buildOperatorPainCallouts,
  buildPresentationStorySections,
  isGlobalCommandCentrePresentationPath,
  PRESENTATION_STORY_SECTION_ORDER,
} from "./enterpriseDemoGlobalCommandCentrePresentationModel";

function samplePayload(): GlobalCommandCentrePayload {
  return {
    tenantId: "tenant-1",
    tenantSlug: "ihrg-global",
    tenantName: "International Hair Restoration Group",
    codename: "TITAN",
    generatedAt: "2026-06-19T12:00:00.000Z",
    todayYmd: "2026-06-19",
    readOnly: true,
    networkKpis: {
      activeClinics: 6,
      surgeriesToday: 2,
      surgeriesThisWeek: 8,
      openFinancialRiskAlerts: 3,
      protocolImagingIssues: 2,
      averageGraftSurvivalPct: 88.5,
      revenueCollectedCents: 1_200_000,
      revenueOutstandingCents: 450_000,
      currency: "USD",
    },
    clinicRiskRows: [
      {
        clinicId: "c1",
        clinicName: "Dubai Hair Institute",
        clinicSlug: "dubai-hair-institute",
        city: "Dubai",
        country: "UAE",
        riskScore: 72,
        revenueStatus: "Graft/invoice variance",
        imagingCompliance: "Protocol gaps",
        surgicalQualityStatus: "Elevated transection",
        staffTrainingStatus: "Recert due Q3",
      },
      {
        clinicId: "c2",
        clinicName: "Bangkok Restoration Centre",
        clinicSlug: "bangkok-restoration-centre",
        city: "Bangkok",
        country: "Thailand",
        riskScore: 61,
        revenueStatus: "Overdue balances",
        imagingCompliance: "Missing follow-up",
        surgicalQualityStatus: "Nominal",
        staffTrainingStatus: "Certified",
      },
      {
        clinicId: "c3",
        clinicName: "London Central Institute",
        clinicSlug: "london-central-institute",
        city: "London",
        country: "UK",
        riskScore: 48,
        revenueStatus: "Refund exposure",
        imagingCompliance: "Complete with flags",
        surgicalQualityStatus: "Graft vs quote variance",
        staffTrainingStatus: "Module 4 pending",
      },
    ],
    alerts: [
      {
        id: "a1",
        severity: "critical",
        clinicSlug: "dubai-hair-institute",
        clinicName: "Dubai Hair Institute",
        title: "Graft count vs invoice variance",
        summary: "Variance flagged",
        domain: "financial",
        occurredAt: "2026-06-19T10:00:00.000Z",
      },
      {
        id: "a2",
        severity: "warning",
        clinicSlug: "london-central-institute",
        clinicName: "London Central Institute",
        title: "Quality-linked refund warning",
        summary: "Refund exposure",
        domain: "surgical",
        occurredAt: "2026-06-19T08:00:00.000Z",
      },
    ],
    surgicalSnapshot: {
      totalGraftsExtracted: 12000,
      totalGraftsImplanted: 11500,
      totalHairs: 25000,
      averageTransectionRatePct: 8.7,
      reconciliationCompleted: 80,
      reconciliationPending: 10,
      reconciliationMismatch: 6,
    },
    outcomeSnapshot: {
      averageSurvivalEstimatePct: 86,
      averageDonorRecoveryScore: 84,
      averageSatisfactionScore: 82,
      auditsApproved: 12,
      auditsWithWarnings: 4,
      incompleteFollowUp: 2,
    },
  };
}

test("buildPresentationStorySections returns five executive story sections in order", () => {
  const sections = buildPresentationStorySections(samplePayload());
  assert.equal(sections.length, 5);
  assert.deepEqual(
    sections.map((section) => section.id),
    PRESENTATION_STORY_SECTION_ORDER
  );
  assert.equal(sections[0].title, "Global network health");
  assert.equal(sections[4].title, "Imaging / audit proof loop");
});

test("buildOperatorPainCallouts returns five operator pain cards", () => {
  const callouts = buildOperatorPainCallouts(samplePayload());
  assert.equal(callouts.length, 5);
  assert.deepEqual(
    callouts.map((callout) => callout.id),
    [
      "revenue_variance",
      "protocol_drift",
      "staff_training_risk",
      "quality_linked_refunds",
      "missing_follow_up_evidence",
    ]
  );
  assert.equal(callouts[0].severity, "critical");
  assert.ok(callouts[0].metric.includes("3 open risk signals"));
});

test("buildGlobalCommandCentrePresentationView bundles pain callouts and sections", () => {
  const view = buildGlobalCommandCentrePresentationView(samplePayload());
  assert.equal(view.painCallouts.length, 5);
  assert.equal(view.sections.length, 5);
});

test("isGlobalCommandCentrePresentationPath detects presentation route", () => {
  assert.equal(
    isGlobalCommandCentrePresentationPath("/fi-admin/uuid/global-command-centre/presentation"),
    true
  );
  assert.equal(
    isGlobalCommandCentrePresentationPath("/fi-admin/uuid/global-command-centre"),
    false
  );
});
