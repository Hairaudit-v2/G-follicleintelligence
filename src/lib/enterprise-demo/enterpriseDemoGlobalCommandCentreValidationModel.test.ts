import assert from "node:assert/strict";
import test from "node:test";

import type { GlobalCommandCentrePayload } from "./enterpriseDemoGlobalCommandCentreLoader.server";
import {
  buildTenantGlobalCommandCentreRoutes,
  finalizeGlobalCommandCentreValidationReport,
  TITAN_DEMO_CLINIC_COUNT,
  TITAN_GLOBAL_COMMAND_CENTRE_ROUTES,
  validateGlobalCommandCentrePayloadForDemo,
  validateSyntheticImageStoragePath,
} from "./enterpriseDemoGlobalCommandCentreValidationModel";

function seededPayload(): GlobalCommandCentrePayload {
  return {
    tenantId: "tenant-1",
    tenantSlug: "ihrg-global",
    tenantName: "International Hair Restoration Group",
    codename: "TITAN",
    generatedAt: "2026-06-19T12:00:00.000Z",
    todayYmd: "2026-06-19",
    readOnly: true,
    networkKpis: {
      activeClinics: TITAN_DEMO_CLINIC_COUNT,
      surgeriesToday: 2,
      surgeriesThisWeek: 8,
      openFinancialRiskAlerts: 3,
      protocolImagingIssues: 2,
      averageGraftSurvivalPct: 88.5,
      revenueCollectedCents: 1_200_000,
      revenueOutstandingCents: 450_000,
      currency: "USD",
    },
    clinicRiskRows: Array.from({ length: TITAN_DEMO_CLINIC_COUNT }, (_, i) => ({
      clinicId: `c${i}`,
      clinicName: `Clinic ${i}`,
      clinicSlug: `clinic-${i}`,
      city: "City",
      country: "Country",
      riskScore: 40 + i,
      revenueStatus: "Within tolerance",
      imagingCompliance: "Compliant",
      surgicalQualityStatus: "Nominal",
      staffTrainingStatus: "Certified",
    })),
    alerts: [
      {
        id: "a1",
        severity: "critical",
        clinicSlug: "dubai-hair-institute",
        clinicName: "Dubai Hair Institute",
        title: "Alert",
        summary: "Summary",
        domain: "financial",
        occurredAt: "2026-06-19T10:00:00.000Z",
      },
      {
        id: "a2",
        severity: "warning",
        clinicSlug: "bangkok-restoration-centre",
        clinicName: "Bangkok Restoration Centre",
        title: "Alert",
        summary: "Summary",
        domain: "imaging",
        occurredAt: "2026-06-19T08:00:00.000Z",
      },
      {
        id: "a3",
        severity: "info",
        clinicSlug: "sydney-hair-institute",
        clinicName: "Sydney Hair Institute",
        title: "Alert",
        summary: "Summary",
        domain: "network",
        occurredAt: "2026-06-19T06:00:00.000Z",
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

test("buildTenantGlobalCommandCentreRoutes exposes dashboard and presentation paths", () => {
  const routes = buildTenantGlobalCommandCentreRoutes("uuid-tenant");
  assert.equal(routes.dashboard, "/fi-admin/uuid-tenant/global-command-centre");
  assert.equal(routes.presentation, "/fi-admin/uuid-tenant/global-command-centre/presentation");
  assert.equal(routes.presentationQueryRedirect, "/fi-admin/uuid-tenant/global-command-centre?presentation=true");
});

test("TITAN_GLOBAL_COMMAND_CENTRE_ROUTES uses ihrg-global friendly slug", () => {
  assert.equal(TITAN_GLOBAL_COMMAND_CENTRE_ROUTES.friendlyDashboard, "/fi-admin/ihrg-global/global-command-centre");
  assert.equal(
    TITAN_GLOBAL_COMMAND_CENTRE_ROUTES.friendlyPresentation,
    "/fi-admin/ihrg-global/global-command-centre/presentation"
  );
});

test("validateGlobalCommandCentrePayloadForDemo passes for fully seeded payload", () => {
  const checks: ReturnType<typeof finalizeGlobalCommandCentreValidationReport>["checks"] = [];
  validateGlobalCommandCentrePayloadForDemo(seededPayload(), checks);
  const report = finalizeGlobalCommandCentreValidationReport({
    tenantId: "tenant-1",
    tenantSlug: "ihrg-global",
    validatedAt: "2026-06-19T12:00:00.000Z",
    checks,
  });
  assert.equal(report.readyForDemo, true);
  assert.equal(report.summary.fail, 0);
});

test("validateGlobalCommandCentrePayloadForDemo fails when clinics and surgical totals are empty", () => {
  const checks: ReturnType<typeof finalizeGlobalCommandCentreValidationReport>["checks"] = [];
  const empty = seededPayload();
  empty.networkKpis.activeClinics = 0;
  empty.clinicRiskRows = [];
  empty.alerts = [];
  empty.surgicalSnapshot.totalGraftsExtracted = 0;
  empty.surgicalSnapshot.totalGraftsImplanted = 0;
  empty.outcomeSnapshot.auditsApproved = 0;
  empty.outcomeSnapshot.auditsWithWarnings = 0;
  empty.outcomeSnapshot.incompleteFollowUp = 0;

  validateGlobalCommandCentrePayloadForDemo(empty, checks);
  const report = finalizeGlobalCommandCentreValidationReport({
    tenantId: "tenant-1",
    tenantSlug: "ihrg-global",
    validatedAt: "2026-06-19T12:00:00.000Z",
    checks,
  });
  assert.equal(report.readyForDemo, false);
  assert.ok(report.summary.fail >= 3);
});

test("validateSyntheticImageStoragePath accepts titan-demo synthetic prefix", () => {
  assert.equal(validateSyntheticImageStoragePath("titan-demo/synthetic/demo-key.jpg"), true);
  assert.equal(validateSyntheticImageStoragePath("patient-images/real.jpg"), false);
});
