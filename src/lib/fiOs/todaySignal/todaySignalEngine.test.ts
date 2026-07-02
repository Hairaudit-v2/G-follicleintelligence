import assert from "node:assert/strict";
import { test } from "node:test";

import { computeTodaySignalRevision } from "@/src/lib/fiOs/todaySignal/todaySignalEngine";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { withArrivalIntentMetadata } from "@/src/lib/fiOs/todaySignal/bookingArrivalIntentCore";

function minimalDashboard(
  overrides: Partial<TenantOperationalDashboard> = {}
): TenantOperationalDashboard {
  return {
    tenantId: "11111111-1111-1111-1111-111111111111",
    tenantName: "Test",
    agendaRange: { startIso: "", endIso: "" },
    agendaByBucket: { consult: [], surgery: [], follow_up: [], other: [] },
    upcomingReminders: [],
    staleLeads: [],
    staleLeadThresholdDays: 7,
    tasksDue: [],
    quickStats: {
      newLeadsThisWeek: 0,
      newLeadsToday: 0,
      conversionRateLast30d: null,
      conversionWonLast30d: 0,
      conversionClosedLast30d: 0,
      openConsultations: 0,
      todaysNoShows: 0,
      staffOnDutyToday: 0,
    },
    viewerFiUserId: null,
    viewerStaffId: null,
    canQuickCallIn: false,
    launchControl: {
      consultationsToday: 0,
      surgeriesThisWeek: 0,
      leadsNeedingFollowUp: 0,
      openTasks: 0,
      revenueAvailable: false,
    },
    clinicToday: { consultations: 0, prp: 0, followUps: 0, surgeries: 0 },
    actionCentre: {
      leadsAwaitingContact: 0,
      consultationsAwaitingCompletion: 0,
      followUpsDue: 0,
      surgeryReadinessAlerts: 0,
      surgeryFinancialPaymentAttention: 0,
      financialPathwayTasksAttention: 0,
      financeApplicationsAttention: 0,
      superReleaseApplicationsAttention: 0,
      internationalTransferApplicationsAttention: 0,
      financialClearanceAttention: 0,
    },
    medicationReorderReviewsPending: 0,
    operationalDay: {
      calendarTimezone: "UTC",
      todayYmd: "2026-06-10",
      localStartIso: "2026-06-10T00:00:00.000Z",
      localEndIso: "2026-06-11T00:00:00.000Z",
    },
    crmPipelineStages: [],
    crmPipelineLeadVolume: {
      activeByStageId: {},
      activeUnassignedStage: 0,
      activeOtherPipelineStage: 0,
    },
    paymentCommercialKpis: { depositsDueCount: 0, depositsPaidTodayCount: 0, overduePaymentsCount: 0 },
    revenueCollections: { moduleEnabled: true, unpaidIssuedInvoiceCount: 0, overdueInvoiceCount: 0 },
    receptionBoard: { cards: [] },
    entityAttention: [],
    ...overrides,
  };
}

test("computeTodaySignalRevision changes when arrival intent is recorded", () => {
  const base = minimalDashboard();
  const withIntent = minimalDashboard({
    receptionBoard: {
      cards: [
        {
          id: "33333333-3333-3333-3333-333333333333",
          startAt: "2026-06-10T10:00:00.000Z",
          endAt: "2026-06-10T10:30:00.000Z",
          title: null,
          bookingType: "consult",
          bookingStatus: "confirmed",
          timezone: "UTC",
          leadId: null,
          patientId: "44444444-4444-4444-4444-444444444444",
          displayName: "James Morrison",
          statusLabel: "Confirmed",
          typeLabel: "Consultation",
          providerLabel: "",
          clinicLabel: null,
          roomLabel: null,
          receptionColumn: "expected",
          metadata: withArrivalIntentMetadata({}, "2026-06-10T09:55:00.000Z", "qr"),
        },
      ],
    },
  });

  assert.notEqual(
    computeTodaySignalRevision(base),
    computeTodaySignalRevision(withIntent)
  );
});
