import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createEmptyReceptionOsModuleHealth, markReceptionOsModuleUnavailable } from "@/src/lib/receptionOs/receptionOsModuleHealthModel";
import {
  emptyReceptionCloseoutSnapshot,
  emptyRevenueIntelligenceForBoard,
  isMissingDatabaseRelationError,
  missingTableMessage,
  normalizeLoaderErrorMessage,
} from "@/src/lib/receptionOs/receptionOsLoaderResilience";
import { parseReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

describe("receptionOsLoaderResilience", () => {
  it("detects missing relation errors from Supabase/Postgres messages", () => {
    assert.equal(isMissingDatabaseRelationError(new Error('relation "fi_reception_tasks" does not exist')), true);
    assert.equal(isMissingDatabaseRelationError(new Error("Could not find the table public.fi_reception_usage_events")), true);
    assert.equal(isMissingDatabaseRelationError(new Error("PGRST205")), true);
    assert.equal(isMissingDatabaseRelationError(new Error("permission denied")), false);
  });

  it("builds migration-aware module messages", () => {
    assert.match(missingTableMessage("fi_reception_tasks"), /fi_reception_tasks/);
    assert.match(missingTableMessage("fi_reception_tasks"), /migrations/i);
  });

  it("tracks unavailable optional modules without breaking core board flag", () => {
    let health = createEmptyReceptionOsModuleHealth(true);
    health = markReceptionOsModuleUnavailable(health, "tasks", missingTableMessage("fi_reception_tasks"));
    assert.equal(health.coreBoardLoaded, true);
    assert.equal(health.unavailableModules.length, 1);
    assert.equal(health.unavailableModules[0]?.module, "tasks");
  });

  it("returns empty closeout and revenue defaults for partial payloads", () => {
    const board = {
      tenantId: "11111111-1111-4111-8111-111111111111",
      tenantName: "Demo",
      loadedAt: "2026-06-19T10:00:00.000Z",
      operationalDay: {
        calendarTimezone: "UTC",
        todayYmd: "2026-06-19",
        localStartIso: "2026-06-19T00:00:00.000Z",
        localEndIso: "2026-06-20T00:00:00.000Z",
      },
      viewer: { role: "admin" as const, visibleWidgets: [] as const },
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
          exportMode: "disabled" as const,
        },
        hints: [],
        generatedAt: "2026-06-19T10:00:00.000Z",
      },
    };

    const closeout = emptyReceptionCloseoutSnapshot({ board, tasks: [], viewerRole: "admin" });
    assert.equal(closeout.checklist.length >= 0, true);
    assert.equal(closeout.failedCommunications.length, 0);

    const revenue = emptyRevenueIntelligenceForBoard(board);
    assert.equal(revenue.revenueRiskAlerts.length, 0);
    assert.equal(revenue.conversionScoreboard.depositsCollectedToday, 0);
  });

  it("parses moduleHealth on command centre payload schema", () => {
    const parsed = parseReceptionOsCommandCentrePayload({
      tenantId: "11111111-1111-4111-8111-111111111111",
      tenantName: "Demo",
      loadedAt: "2026-06-19T10:00:00.000Z",
      operationalDay: {
        calendarTimezone: "UTC",
        todayYmd: "2026-06-19",
        localStartIso: "2026-06-19T00:00:00.000Z",
        localEndIso: "2026-06-20T00:00:00.000Z",
      },
      viewer: { role: "admin", visibleWidgets: ["todays_patients"] },
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
        totalWeightedRevenue: 0,
        totalAtRiskRevenue: 0,
        currency: "AUD",
        scoredSubjectCount: 0,
        averageProbabilityPercent: 0,
        topOpportunities: [],
      },
      conversionScoreboard: {
        consultsCompletedToday: 0,
        quotesSentToday: 0,
        depositsCollectedToday: 0,
        surgeryBookingsCreatedToday: 0,
        projectedWeightedRevenue: 0,
        atRiskRevenue: 0,
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
      pilotMetrics: { visible: false, summary: null, managerScores: null },
      pilotReview: { visible: false, periodDays: 14, report: null },
      ownerValue: { visible: false, dashboard: null },
      demoMode: { active: false, maskAmounts: false, usingSampleData: false, canToggle: false },
      moduleHealth: {
        coreBoardLoaded: true,
        unavailableModules: [
          {
            module: "pilot_metrics",
            label: "Pilot metrics",
            message: missingTableMessage("fi_reception_usage_events"),
          },
        ],
      },
    });

    assert.equal(parsed.moduleHealth.unavailableModules[0]?.module, "pilot_metrics");
    assert.equal(normalizeLoaderErrorMessage(new Error("boom")), "boom");
  });
});
