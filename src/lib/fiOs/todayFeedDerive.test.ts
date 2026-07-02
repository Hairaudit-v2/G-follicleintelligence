import assert from "node:assert/strict";
import { test } from "node:test";

import { buildTodayFeed } from "@/src/lib/fiOs/todayFeedDerive";
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
    ...overrides,
  };
}

test("buildTodayFeed: named reception card 'arrived' goes to right now", () => {
  const dashboard = baseDashboard({
    receptionBoard: {
      cards: [
        {
          id: "11111111-0000-0000-0000-000000000001",
          startAt: "2026-06-10T11:50:00.000Z",
          endAt: "2026-06-10T12:20:00.000Z",
          title: "Consultation",
          bookingType: "consult",
          bookingStatus: "arrived",
          timezone: "UTC",
          leadId: null,
          patientId: "22222222-0000-0000-0000-000000000001",
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

  const feed = buildTodayFeed({ base: "/fi-admin/t1", dashboard, showCrmNav: true, now: NOW });

  assert.equal(feed.rightNow.length, 1);
  assert.equal(feed.rightNow[0]?.personLabel, "Sarah Chen");
  assert.match(feed.rightNow[0]?.actionLabel ?? "", /waiting/i);
  assert.equal(feed.rightNow[0]?.href, "/fi-admin/t1/patients/22222222-0000-0000-0000-000000000001");
});

test("buildTodayFeed: terminal reception columns are excluded", () => {
  const dashboard = baseDashboard({
    receptionBoard: {
      cards: [
        {
          id: "11111111-0000-0000-0000-000000000002",
          startAt: "2026-06-10T09:00:00.000Z",
          endAt: "2026-06-10T09:30:00.000Z",
          title: null,
          bookingType: "consult",
          bookingStatus: "complete",
          timezone: "UTC",
          leadId: null,
          patientId: null,
          displayName: "Completed Patient",
          statusLabel: "Complete",
          typeLabel: "Consultation",
          providerLabel: "",
          clinicLabel: null,
          roomLabel: null,
          receptionColumn: "complete",
          metadata: {},
        },
      ],
    },
  });

  const feed = buildTodayFeed({ base: "/fi-admin/t1", dashboard, showCrmNav: true, now: NOW });
  const allItems = [...feed.rightNow, ...feed.upNext, ...feed.comingUp];
  assert.ok(!allItems.some((i) => i.personLabel === "Completed Patient"));
});

test("buildTodayFeed: severely stale lead escalates to right now", () => {
  const dashboard = baseDashboard({
    staleLeadThresholdDays: 7,
    staleLeads: [
      {
        leadId: "33333333-0000-0000-0000-000000000001",
        title: "James Morrison",
        stageLabel: "New enquiry",
        daysInStage: 20,
        enteredStageAt: "2026-05-21T00:00:00.000Z",
      },
    ],
  });

  const feed = buildTodayFeed({ base: "/fi-admin/t1", dashboard, showCrmNav: true, now: NOW });
  assert.equal(feed.rightNow.length, 1);
  assert.equal(feed.rightNow[0]?.personLabel, "James Morrison");
  assert.equal(feed.rightNow[0]?.severity, "critical");
});

test("buildTodayFeed: mildly stale lead is up next, not right now", () => {
  const dashboard = baseDashboard({
    staleLeadThresholdDays: 7,
    staleLeads: [
      {
        leadId: "33333333-0000-0000-0000-000000000002",
        title: "Emma Walsh",
        stageLabel: "Contacted",
        daysInStage: 9,
        enteredStageAt: "2026-06-01T00:00:00.000Z",
      },
    ],
  });

  const feed = buildTodayFeed({ base: "/fi-admin/t1", dashboard, showCrmNav: true, now: NOW });
  assert.equal(feed.rightNow.length, 0);
  assert.equal(feed.upNext.length, 1);
  assert.equal(feed.upNext[0]?.personLabel, "Emma Walsh");
});

test("buildTodayFeed: overdue CRM task is named and right now", () => {
  const dashboard = baseDashboard({
    tasksDue: [
      {
        id: "44444444-0000-0000-0000-000000000001",
        leadId: "33333333-0000-0000-0000-000000000003",
        title: "Tom Williams",
        status: "open",
        taskType: "call",
        dueAt: "2026-06-10T08:00:00.000Z",
        assigneeUserId: null,
        isUnassigned: true,
      },
    ],
  });

  const feed = buildTodayFeed({ base: "/fi-admin/t1", dashboard, showCrmNav: true, now: NOW });
  assert.equal(feed.rightNow.length, 1);
  assert.equal(feed.rightNow[0]?.personLabel, "Tom Williams");
  assert.match(feed.rightNow[0]?.actionLabel ?? "", /overdue/i);
  assert.equal(feed.rightNow[0]?.severity, "critical");
});

test("buildTodayFeed: aggregate fallback items carry no person label and land in expected buckets", () => {
  const dashboard = baseDashboard({
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
  });

  const feed = buildTodayFeed({ base: "/fi-admin/t1", dashboard, showCrmNav: true, now: NOW });
  assert.equal(feed.rightNow.length, 1);
  assert.equal(feed.rightNow[0]?.personLabel, "");
  assert.match(feed.rightNow[0]?.actionLabel ?? "", /surger/i);
});

test("buildTodayFeed: surgeon role boosts surgery-category priority above default weighting", () => {
  const dashboard = baseDashboard({
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
  });

  const defaultFeed = buildTodayFeed({ base: "/fi-admin/t1", dashboard, showCrmNav: true, now: NOW });
  const surgeonFeed = buildTodayFeed({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    profileKey: "surgeon",
    now: NOW,
  });

  const defaultScore = defaultFeed.rightNow.find((i) => i.id === "aggregate-surgery_readiness")?.priorityScore ?? 0;
  const surgeonScore = surgeonFeed.rightNow.find((i) => i.id === "aggregate-surgery_readiness")?.priorityScore ?? 0;
  assert.ok(surgeonScore > defaultScore);
});

test("buildTodayFeed: caps each bucket at maxPerBucket", () => {
  const cards = Array.from({ length: 12 }, (_, i) => ({
    id: `55555555-0000-0000-0000-${String(i).padStart(12, "0")}`,
    startAt: "2026-06-10T11:55:00.000Z",
    endAt: "2026-06-10T12:15:00.000Z",
    title: null,
    bookingType: "consult",
    bookingStatus: "arrived",
    timezone: "UTC",
    leadId: null,
    patientId: null,
    displayName: `Patient ${i}`,
    statusLabel: "Waiting",
    typeLabel: "Consultation",
    providerLabel: "",
    clinicLabel: null,
    roomLabel: null,
    receptionColumn: "arrived" as const,
    metadata: {},
  }));

  const dashboard = baseDashboard({ receptionBoard: { cards } });
  const feed = buildTodayFeed({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    now: NOW,
    maxPerBucket: 5,
  });

  assert.equal(feed.rightNow.length, 5);
});
