import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReceptionPilotReviewReport,
  receptionPilotReviewVisible,
  RECEPTION_PILOT_REVIEW_DEFAULT_PERIOD_DAYS,
} from "@/src/lib/receptionOs/receptionPilotReviewModel";
import {
  buildPilotFeedbackScore,
  buildReceptionOwnerValueDashboard,
  receptionOwnerValueVisible,
} from "@/src/lib/receptionOs/receptionOwnerValueModel";
import {
  applyReceptionOsDemoMode,
  anonymizeDisplayLabel,
  assertNoSensitiveExportKeys,
  buildReceptionOsDemoSamplePayload,
  maskCurrencyAmount,
  redactContactText,
  resolveReceptionOsDemoModeState,
} from "@/src/lib/receptionOs/receptionOsDemoModeModel";
import {
  buildReceptionPilotExportBundle,
  serializeReceptionPilotExportCsv,
  serializeReceptionPilotExportJson,
} from "@/src/lib/receptionOs/receptionPilotExportModel";
import { buildReceptionPilotManagerScores, aggregateReceptionPilotMetrics } from "@/src/lib/receptionOs/receptionPilotMetricsModel";
import { parseReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROFILE = "22222222-2222-4222-8222-222222222222";

function minimalCommandCentrePayload(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    tenantName: "Demo Clinic",
    loadedAt: "2026-06-19T10:00:00.000Z",
    operationalDay: {
      calendarTimezone: "Australia/Perth",
      todayYmd: "2026-06-19",
      localStartIso: "2026-06-18T16:00:00.000Z",
      localEndIso: "2026-06-19T16:00:00.000Z",
    },
    viewer: { role: "admin", visibleWidgets: ["todays_patients", "action_alerts"] },
    todaysPatients: [],
    communicationTimeline: [],
    consultationPipeline: {
      columns: {
        new_lead: [],
        consultation_booked: [],
        consultation_completed: [],
        quote_sent: [],
        deposit_pending: [],
        surgery_booked: [],
      },
      counts: {
        new_lead: 0,
        consultation_booked: 0,
        consultation_completed: 0,
        quote_sent: 0,
        deposit_pending: 0,
        surgery_booked: 0,
      },
    },
    outstandingDeposits: [],
    upcomingSurgeries: [],
    actionAlerts: [],
    intelligence: {
      policy: {
        canExportCompetencyData: false,
        canExportAuditData: false,
        canBuildProfessionalGraph: false,
        canSendToFiOs: false,
        requiresConsent: true,
        exportMode: "disabled",
      },
      hints: [],
      generatedAt: "2026-06-19T10:00:00.000Z",
    },
    dailyBrief: {
      todayPatientCount: 0,
      outstandingDepositCount: 0,
      overdueDepositCount: 0,
      surgeryNext14Count: 0,
      surgeryRiskCount: 0,
      followUpNeededCount: 0,
      openTaskCount: 0,
      alertsBySeverity: { info: 0, warning: 0, critical: 0, blocked: 0 },
      projectedOperationalRisk: "info",
      summaryLines: [],
    },
    receptionTasks: [],
    suggestedOperatingMode: "live_clinic",
    revenueSummary: {
      totalWeightedRevenue: 42000,
      totalAtRiskRevenue: 8500,
      currency: "AUD",
      scoredSubjectCount: 1,
      averageProbabilityPercent: 55,
      topOpportunities: [],
    },
    conversionScoreboard: {
      consultsCompletedToday: 0,
      quotesSentToday: 0,
      depositsCollectedToday: 0,
      surgeryBookingsCreatedToday: 0,
      projectedWeightedRevenue: 0,
      atRiskRevenue: 8500,
      currency: "AUD",
    },
    revenueRiskAlerts: [],
    endOfDayCloseout: {
      operatingDate: "2026-06-19",
      riskSummary: "Clear",
      itemCounts: {
        info: 0,
        warning: 0,
        critical: 0,
        blocked: 0,
        total: 0,
        failed_communications: 0,
      },
      checklist: [],
      failedCommunications: [],
      canCloseDay: false,
      existingCloseoutId: null,
      existingCloseoutNotes: null,
      closedAt: null,
    },
    systemStatus: {
      dryRunEnabled: true,
      emailSendEnabled: false,
      smsSendEnabled: false,
      providerMode: "dry_run",
      resendConfigured: false,
      twilioConfigured: false,
      pilotModeActive: true,
      pilotBanner: null,
      lastPayloadLoadedAt: "2026-06-19T10:00:00.000Z",
      failedSendsToday: 0,
      closeoutStatus: "open",
      closeoutOperatingDate: "2026-06-19",
      envChecklist: [],
    },
    pilotMetrics: { visible: true, summary: null, managerScores: null },
    pilotReview: { visible: true, periodDays: 14, report: null },
    ownerValue: { visible: true, dashboard: null },
    demoMode: { active: false, maskAmounts: false, usingSampleData: false, canToggle: true },
    moduleHealth: { coreBoardLoaded: true, unavailableModules: [] },
    ...overrides,
  };
}

describe("receptionPilotReviewModel", () => {
  it("aggregates pilot review metrics over a period", () => {
    const report = buildReceptionPilotReviewReport({
      periodStart: "2026-06-05T00:00:00.000Z",
      periodEnd: "2026-06-19T00:00:00.000Z",
      periodDays: 14,
      currency: "AUD",
      revenueAtRiskIdentified: 12000,
      usageEvents: [
        {
          eventKind: "dashboard_viewed",
          profileId: PROFILE,
          widgetKey: null,
          createdAt: "2026-06-10T09:00:00.000Z",
        },
        {
          eventKind: "widget_viewed",
          profileId: PROFILE,
          widgetKey: "reception_tasks",
          createdAt: "2026-06-10T09:05:00.000Z",
        },
      ],
      feedbackRows: [{ feedbackKind: "workflow_friction", createdAt: "2026-06-11T10:00:00.000Z" }],
      tasksCreatedInPeriod: 5,
      tasksResolvedInPeriod: 4,
      risksClosedInPeriod: 2,
      avgTaskResolutionMinutes: 35,
      communicationsDrafted: 1,
      communicationsSent: 0,
      communicationsDryRun: 3,
      depositsChased: 2,
      closeoutsCompleted: 1,
    });

    assert.equal(report.periodDays, 14);
    assert.equal(report.activeUsers, 1);
    assert.equal(report.risksClosed, 2);
    assert.equal(report.depositsChased, 2);
    assert.equal(report.revenueAtRiskIdentified, 12000);
    assert.equal(report.topWorkflowIssues[0]?.feedbackKind, "workflow_friction");
    assert.equal(report.mostValuableWidgets[0]?.widgetKey, "reception_tasks");
  });

  it("restricts pilot review visibility to admin and clinic_manager", () => {
    assert.equal(receptionPilotReviewVisible("admin"), true);
    assert.equal(receptionPilotReviewVisible("clinic_manager"), true);
    assert.equal(receptionPilotReviewVisible("receptionist"), false);
    assert.equal(receptionOwnerValueVisible("consultant"), false);
  });
});

describe("receptionOwnerValueModel", () => {
  it("builds owner dashboard from pilot review and manager scores", () => {
    const report = buildReceptionPilotReviewReport({
      periodStart: "2026-06-05T00:00:00.000Z",
      periodEnd: "2026-06-19T00:00:00.000Z",
      periodDays: RECEPTION_PILOT_REVIEW_DEFAULT_PERIOD_DAYS,
      currency: "AUD",
      revenueAtRiskIdentified: 10000,
      usageEvents: [],
      feedbackRows: [
        { feedbackKind: "useful", createdAt: "2026-06-10T09:00:00.000Z" },
        { feedbackKind: "useful", createdAt: "2026-06-11T09:00:00.000Z" },
        { feedbackKind: "workflow_friction", createdAt: "2026-06-12T09:00:00.000Z" },
      ],
      tasksCreatedInPeriod: 4,
      tasksResolvedInPeriod: 3,
      risksClosedInPeriod: 2,
      avgTaskResolutionMinutes: 22,
      communicationsDrafted: 0,
      communicationsSent: 0,
      communicationsDryRun: 2,
      depositsChased: 1,
      closeoutsCompleted: 1,
    });

    const summary = aggregateReceptionPilotMetrics({
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      usageEvents: [],
      feedbackRows: [
        { feedbackKind: "useful", createdAt: "2026-06-10T09:00:00.000Z" },
        { feedbackKind: "useful", createdAt: "2026-06-11T09:00:00.000Z" },
        { feedbackKind: "workflow_friction", createdAt: "2026-06-12T09:00:00.000Z" },
      ],
      tasksCreatedInPeriod: 4,
      tasksResolvedInPeriod: 3,
      avgTaskResolutionMinutes: 22,
      unresolvedCriticalRisks: 0,
      communicationsDrafted: 0,
      communicationsSent: 0,
      communicationsDryRun: 2,
      closeoutsCompleted: 1,
    });

    const managerScores = buildReceptionPilotManagerScores(summary, [
      { feedbackKind: "useful" },
      { feedbackKind: "useful" },
      { feedbackKind: "workflow_friction" },
    ]);

    const dashboard = buildReceptionOwnerValueDashboard({
      report,
      managerScores,
      feedbackRows: [
        { feedbackKind: "useful" },
        { feedbackKind: "useful" },
        { feedbackKind: "workflow_friction" },
      ],
    });

    assert.ok(dashboard.estimatedRevenueProtected > 0);
    assert.equal(dashboard.operationalRisksClosed, 2);
    assert.equal(dashboard.averageResponseTimeMinutes, 22);
    assert.ok(dashboard.staffAdoptionScore >= 0);
    assert.equal(buildPilotFeedbackScore([{ feedbackKind: "useful" }]), 100);
  });
});

describe("receptionOsDemoModeModel", () => {
  it("anonymises patient labels and redacts contact details", () => {
    assert.notEqual(anonymizeDisplayLabel("Jane Real Patient", 0), "Jane Real Patient");
    assert.match(redactContactText("Call +61 400 123 456 or email jane@clinic.com") ?? "", /\[phone hidden\]/);
    assert.match(redactContactText("Call +61 400 123 456 or email jane@clinic.com") ?? "", /\[email hidden\]/);
  });

  it("masks currency amounts when enabled", () => {
    assert.equal(maskCurrencyAmount(400, true), 500);
    assert.equal(maskCurrencyAmount(750, false), 750);
  });

  it("applies demo mode with sample data when board is empty", () => {
    const base = parseReceptionOsCommandCentrePayload(minimalCommandCentrePayload());
    const demoState = resolveReceptionOsDemoModeState({
      envActive: false,
      maskAmounts: true,
      demoRequested: true,
      canToggle: true,
    });
    const demo = applyReceptionOsDemoMode(base, demoState);

    assert.equal(demo.demoMode.active, true);
    assert.equal(demo.demoMode.usingSampleData, true);
    assert.ok(demo.todaysPatients.length > 0);
    assert.ok(demo.todaysPatients.every((p) => !p.patientName.includes("Real")));
    assert.ok(demo.outstandingDeposits.every((d) => d.hrefs.patient == null));
    assert.ok(demo.receptionTasks.every((t) => t.internalNotes == null));
  });

  it("injects sample payload without live patient identifiers", () => {
    const base = parseReceptionOsCommandCentrePayload(minimalCommandCentrePayload());
    const sample = buildReceptionOsDemoSamplePayload(base);
    assert.ok(sample.todaysPatients.length >= 2);
    assert.ok(sample.actionAlerts.length >= 1);
    assert.doesNotMatch(JSON.stringify(sample), /@[\w.-]+\.\w+/);
  });
});

describe("receptionPilotExportModel", () => {
  it("exports JSON and CSV without sensitive keys", () => {
    const report = buildReceptionPilotReviewReport({
      periodStart: "2026-06-05T00:00:00.000Z",
      periodEnd: "2026-06-19T00:00:00.000Z",
      periodDays: 14,
      currency: "AUD",
      revenueAtRiskIdentified: 5000,
      usageEvents: [],
      feedbackRows: [],
      tasksCreatedInPeriod: 1,
      tasksResolvedInPeriod: 1,
      risksClosedInPeriod: 1,
      avgTaskResolutionMinutes: 10,
      communicationsDrafted: 0,
      communicationsSent: 0,
      communicationsDryRun: 1,
      depositsChased: 0,
      closeoutsCompleted: 0,
    });

    const bundle = buildReceptionPilotExportBundle({
      tenantId: TENANT,
      tenantName: "Demo Clinic",
      periodDays: 14,
      pilotReview: report,
      ownerValue: {
        estimatedRevenueProtected: 1500,
        currency: "AUD",
        operationalRisksClosed: 1,
        averageResponseTimeMinutes: 10,
        conversionActionsTaken: 2,
        staffAdoptionScore: 80,
        pilotFeedbackScore: 90,
      },
      managerScores: null,
    });

    const json = serializeReceptionPilotExportJson(bundle);
    const csv = serializeReceptionPilotExportCsv(bundle);

    assert.doesNotMatch(json, /patientName|smsBody|emailBody|phone/);
    assert.doesNotMatch(csv, /patientName|smsBody|emailBody|phone/);
    assert.match(csv, /^metric,value/m);
    assert.throws(() => assertNoSensitiveExportKeys({ patientName: "secret" }), /Sensitive export key/);
  });
});

describe("Phase 1–7 regression guard", () => {
  it("keeps command centre loader additive for Phase 8", async () => {
    const { readFileSync } = await import("node:fs");
    const loader = readFileSync("src/lib/receptionOs/receptionOsCommandCentreLoader.server.ts", "utf8");
    assert.match(loader, /loadReceptionOsBoardPayload/);
    assert.match(loader, /loadReceptionPilotMetricsForCommandCentre/);
    assert.match(loader, /loadReceptionPhase8PayloadForCommandCentre/);
    assert.doesNotMatch(readFileSync("src/lib/receptionOs/receptionOsBoardLoader.server.ts", "utf8"), /fi_reception_usage_events/);
  });

  it("parses Phase 8 payload fields in command centre schema", () => {
    const parsed = parseReceptionOsCommandCentrePayload(minimalCommandCentrePayload());
    assert.equal(parsed.pilotReview.periodDays, 14);
    assert.equal(parsed.demoMode.active, false);
    assert.equal(parsed.ownerValue.visible, true);
  });
});
