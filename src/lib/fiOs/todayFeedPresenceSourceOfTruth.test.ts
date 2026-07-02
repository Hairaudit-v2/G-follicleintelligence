import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildTodayFeedFromRawItems,
  buildTodayFeedWithPresence,
  loadTodayFeedRawItems,
} from "@/src/lib/fiOs/todayFeedDerive";
import { derivePresenceFromDashboardInput } from "@/src/lib/fiOs/presence/presenceEngine";
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

function arrivalIntentDashboard(displayName: string) {
  return baseDashboard({
    receptionBoard: {
      cards: [
        {
          id: "55555555-0000-0000-0000-000000000001",
          startAt: "2026-06-10T12:05:00.000Z",
          endAt: "2026-06-10T12:35:00.000Z",
          title: null,
          bookingType: "consult",
          bookingStatus: "confirmed",
          timezone: "UTC",
          leadId: null,
          patientId: "22222222-0000-0000-0000-000000000001",
          displayName,
          statusLabel: "Confirmed",
          typeLabel: "Consultation",
          providerLabel: "",
          clinicLabel: null,
          roomLabel: null,
          receptionColumn: "expected",
          metadata: {
            fi_arrival_intent_at: "2026-06-10T12:00:00.000Z",
            fi_arrival_intent_source: "qr",
          },
        },
      ],
    },
  });
}

test("buildTodayFeedWithPresence: raw item loader runs exactly once per request", () => {
  let rawLoadPass = 0;

  const sarahLead = {
    leadId: "33333333-0000-0000-0000-000000000001",
    title: "Sarah Chen",
    stageLabel: "New enquiry",
    daysInStage: 20,
    enteredStageAt: "2026-05-21T00:00:00.000Z",
  };
  const jamesLead = {
    leadId: "33333333-0000-0000-0000-000000000002",
    title: "James Morrison",
    stageLabel: "New enquiry",
    daysInStage: 20,
    enteredStageAt: "2026-05-21T00:00:00.000Z",
  };

  const dashboard = baseDashboard({
    staleLeadThresholdDays: 7,
    get staleLeads() {
      rawLoadPass += 1;
      return rawLoadPass === 1 ? [sarahLead] : [jamesLead];
    },
  });

  const { feed, presence } = buildTodayFeedWithPresence({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    now: NOW,
  });

  assert.equal(rawLoadPass, 1, "raw items must be derived once — a second pass would swap Sarah for James");
  assert.ok(
    feed.rightNow.some((i) => i.personLabel === "Sarah Chen"),
    "feed must reflect the first (and only) raw derivation"
  );
  assert.ok(
    !feed.rightNow.some((i) => i.personLabel === "James Morrison"),
    "feed must not reflect a phantom second raw derivation"
  );
  assert.ok(
    presence.snapshots.some((s) => s.signalKind === "patient_arrival_intent") ||
      feed.rightNow.some((i) => /Call Sarah/i.test(i.actionLabel)),
    "presence and feed must describe the same underlying work items"
  );
});

test("buildTodayFeedWithPresence: presence summary matches feed from the same raw items", () => {
  const dashboard = arrivalIntentDashboard("James Morrison");

  const { feed, presence } = buildTodayFeedWithPresence({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    now: NOW,
  });

  const rawItems = loadTodayFeedRawItems({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    now: NOW,
  });
  const expectedPresence = derivePresenceFromDashboardInput({
    dashboard,
    todayItems: rawItems,
    now: NOW,
  });
  const expectedFeed = buildTodayFeedFromRawItems({
    rawItems,
    now: NOW,
    presenceSummary: expectedPresence,
  });

  assert.deepEqual(presence.escalationHints, expectedPresence.escalationHints);
  assert.deepEqual(feed, expectedFeed);

  assert.ok(
    presence.snapshots.some((s) => s.signalKind === "patient_arrival_intent"),
    "presence should reflect arrival intent from raw items"
  );
  assert.equal(feed.rightNow.length, 1);
  assert.match(feed.rightNow[0]?.actionLabel ?? "", /James says they're here/i);
});

test("buildTodayFeedWithPresence: header chip counts align with feed-derived arrival state", () => {
  const dashboard = arrivalIntentDashboard("James Morrison");

  const { feed, presence } = buildTodayFeedWithPresence({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    now: NOW,
  });

  const hasArrivalIntent = presence.snapshots.some((s) => s.signalKind === "patient_arrival_intent");
  const arrivalChip = presence.operationalStatus.chips.find((c) => c.id === "arrival_active");
  const feedArrivalItems = [...feed.rightNow, ...feed.upNext, ...feed.comingUp].filter((i) =>
    /says they're here|waiting/i.test(i.actionLabel)
  );

  assert.equal(hasArrivalIntent, true);
  assert.ok(arrivalChip, "arrival chip should appear when feed raw items include arrival intent");
  assert.equal(feedArrivalItems.length, 1);
  assert.match(feedArrivalItems[0]?.actionLabel ?? "", /James/i);

  if (presence.escalationHints.includes("reception_unknown_escalates_arrival")) {
    assert.match(arrivalChip?.label ?? "", /reception/i);
    assert.match(feedArrivalItems[0]?.actionHint ?? "", /reception is available/i);
  }
});

test("buildTodayFeedWithPresence: presence escalation corresponds to a visible feed item", () => {
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
    entityAttention: [
      {
        id: "entity-surgery-readiness-booking-1",
        category: "surgery",
        aggregateKey: "surgery_readiness",
        personLabel: "Marcus Reid",
        actionLabel: "Marcus surgery preparation incomplete",
        detailLine: "Procedure tomorrow — case not linked yet",
        actionHint: "Review case",
        href: "/fi-admin/t1/cases/88888888-0000-0000-0000-000000000001",
        severity: "critical",
        bucket: "right_now",
        priorityScore: 96,
        groupKey: "entity:surgery_readiness",
      },
    ],
  });

  const { feed, presence } = buildTodayFeedWithPresence({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    profileKey: "surgeon",
    now: NOW,
  });

  if (presence.escalationHints.includes("surgery_team_incomplete_escalates_readiness")) {
    const visibleReadiness = [...feed.rightNow, ...feed.upNext, ...feed.comingUp].find(
      (i) => i.id.includes("surgery") || i.groupKey?.includes("surgery")
    );
    assert.ok(
      visibleReadiness,
      "surgery readiness escalation must map to a visible feed row or named entity item"
    );
    assert.equal(visibleReadiness?.personLabel, "Marcus Reid");
    assert.ok(
      presence.operationalStatus.chips.some((c) => c.id === "team_readiness"),
      "team readiness chip should accompany surgery escalation"
    );
  }
});
