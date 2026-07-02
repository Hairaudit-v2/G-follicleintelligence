import assert from "node:assert/strict";
import { test } from "node:test";

import { computeTodayFeedShadowDiff, runTodayFeedShadowValidation } from "@/src/lib/fiOs/todayFeedShadowDiff";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const NOW = new Date("2026-06-10T12:00:00.000Z");

function baseDashboard(overrides: Partial<TenantOperationalDashboard> = {}): TenantOperationalDashboard {
  return {
    tenantId: "00000000-0000-0000-0000-000000000001",
    tenantName: "Test Clinic",
    agendaRange: { startIso: NOW.toISOString(), endIso: NOW.toISOString() },
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

test("computeTodayFeedShadowDiff: empty dashboard yields zero discrepancies", () => {
  const result = computeTodayFeedShadowDiff({ dashboard: baseDashboard(), showCrmNav: true, now: NOW });
  assert.deepEqual(result.discrepancies, []);
  assert.equal(result.legacySignalCount, 0);
  assert.equal(result.todayFeedSignalCount, 0);
});

test("computeTodayFeedShadowDiff: populated dashboard survives with no lost signals", () => {
  const dashboard = baseDashboard({
    staleLeads: [
      {
        leadId: "33333333-0000-0000-0000-000000000001",
        title: "James Morrison",
        stageLabel: "New enquiry",
        daysInStage: 10,
        enteredStageAt: "2026-05-31T00:00:00.000Z",
      },
    ],
    tasksDue: [
      {
        id: "44444444-0000-0000-0000-000000000001",
        leadId: "33333333-0000-0000-0000-000000000002",
        title: "Tom Williams",
        status: "open",
        taskType: "call",
        dueAt: "2026-06-10T08:00:00.000Z",
        assigneeUserId: null,
        isUnassigned: true,
      },
    ],
    upcomingReminders: [
      {
        jobId: "55555555-0000-0000-0000-000000000001",
        scheduled_at: "2026-06-10T13:00:00.000Z",
        status: "scheduled",
        templateName: "Pre-op reminder",
        templateType: "pre_op",
        bookingId: null,
        bookingTitle: null,
        bookingStartAt: null,
        bookingTimezone: null,
        leadId: null,
        patientId: null,
        recipientLabel: "Emma Walsh",
        clinicalSummaryLine: "Pre-op checklist due",
        bookingAssigneeFiUserId: null,
        leadPrimaryOwnerFiUserId: null,
        detailHref: "/fi-admin/t1/reminders/55555555-0000-0000-0000-000000000001",
      },
    ],
    actionCentre: {
      leadsAwaitingContact: 0,
      consultationsAwaitingCompletion: 0,
      followUpsDue: 0,
      surgeryReadinessAlerts: 1,
      surgeryFinancialPaymentAttention: 0,
      financialPathwayTasksAttention: 0,
      financeApplicationsAttention: 0,
      superReleaseApplicationsAttention: 0,
      internationalTransferApplicationsAttention: 0,
      financialClearanceAttention: 0,
    },
    receptionBoard: {
      cards: [
        {
          id: "66666666-0000-0000-0000-000000000001",
          startAt: "2026-06-10T11:50:00.000Z",
          endAt: "2026-06-10T12:20:00.000Z",
          title: "Consultation",
          bookingType: "consult",
          bookingStatus: "arrived",
          timezone: "UTC",
          leadId: null,
          patientId: "77777777-0000-0000-0000-000000000001",
          displayName: "Sarah Chen",
          statusLabel: "Waiting",
          typeLabel: "Consultation",
          providerLabel: "Dr Lee",
          clinicLabel: null,
          roomLabel: null,
          receptionColumn: "arrived",
          metadata: {},
        },
      ],
    },
  });

  const result = computeTodayFeedShadowDiff({ dashboard, showCrmNav: true, now: NOW });
  assert.deepEqual(result.discrepancies, []);
  // 1 aggregate (surgery readiness) + 1 in-clinic reception card + 1 stale lead + 1 task due + 1 reminder.
  assert.equal(result.legacySignalCount, 5);
  assert.ok(result.todayFeedSignalCount >= result.legacySignalCount);
});

test("runTodayFeedShadowValidation: never throws even when the dashboard shape is malformed", () => {
  const malformed = {
    ...baseDashboard(),
    receptionBoard: undefined,
  } as unknown as TenantOperationalDashboard;

  assert.doesNotThrow(() => {
    runTodayFeedShadowValidation({ dashboard: malformed, showCrmNav: true, now: NOW });
  });
});

test("computeTodayFeedShadowDiff: throws directly on malformed input (wrapper is what makes it safe)", () => {
  const malformed = {
    ...baseDashboard(),
    receptionBoard: undefined,
  } as unknown as TenantOperationalDashboard;

  assert.throws(() => {
    computeTodayFeedShadowDiff({ dashboard: malformed, showCrmNav: true, now: NOW });
  });
});

test("runTodayFeedShadowValidation: respects FI_TODAY_SURFACE_SHADOW_LOG=false kill switch", () => {
  const prev = process.env.FI_TODAY_SURFACE_SHADOW_LOG;
  process.env.FI_TODAY_SURFACE_SHADOW_LOG = "false";
  try {
    const malformed = { ...baseDashboard(), receptionBoard: undefined } as unknown as TenantOperationalDashboard;
    assert.doesNotThrow(() => {
      runTodayFeedShadowValidation({ dashboard: malformed, showCrmNav: true, now: NOW });
    });
  } finally {
    if (prev === undefined) delete process.env.FI_TODAY_SURFACE_SHADOW_LOG;
    else process.env.FI_TODAY_SURFACE_SHADOW_LOG = prev;
  }
});
