import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

describe("receptionOs smoke payload validation", () => {
  it("parses command centre payload with Phase 6 systemStatus", () => {
    const parsed = parseReceptionOsCommandCentrePayload({
      tenantId: "11111111-1111-4111-8111-111111111111",
      tenantName: "Evolved",
      loadedAt: "2026-06-19T10:00:00.000Z",
      operationalDay: {
        calendarTimezone: "Australia/Perth",
        todayYmd: "2026-06-19",
        localStartIso: "2026-06-18T16:00:00.000Z",
        localEndIso: "2026-06-19T16:00:00.000Z",
      },
      viewer: { role: "receptionist", visibleWidgets: ["todays_patients"] },
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
        pilotBanner: {
          variant: "warning",
          title: "Pilot",
          message: "Dry-run active.",
        },
        lastPayloadLoadedAt: "2026-06-19T10:00:00.000Z",
        failedSendsToday: 0,
        closeoutStatus: "open",
        closeoutOperatingDate: "2026-06-19",
        envChecklist: [],
      },
      pilotMetrics: {
        visible: false,
        summary: null,
        managerScores: null,
      },
      pilotReview: {
        visible: false,
        periodDays: 14,
        report: null,
      },
      ownerValue: {
        visible: false,
        dashboard: null,
      },
      demoMode: {
        active: false,
        maskAmounts: false,
        usingSampleData: false,
        canToggle: false,
      },
      moduleHealth: {
        coreBoardLoaded: true,
        unavailableModules: [],
      },
    });

    assert.equal(parsed.systemStatus.dryRunEnabled, true);
    assert.equal(parsed.systemStatus.pilotModeActive, true);
    assert.ok(parsed.systemStatus.pilotBanner);
    assert.equal(parsed.endOfDayCloseout.operatingDate, "2026-06-19");
  });
});
