import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolvePersonDisplayNameForToday,
  resolvePersonFirstNameLabel,
  todayFirstNameFromLabel,
} from "@/src/lib/fiOs/todayPersonLabels";
import { buildTodayFeed } from "@/src/lib/fiOs/todayFeedDerive";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

test("resolvePersonFirstNameLabel: first_name beats email", () => {
  assert.equal(
    resolvePersonFirstNameLabel({
      first_name: "Sarah",
      email: "auditor@hairaudit.com",
    }),
    "Sarah"
  );
});

test("resolvePersonFirstNameLabel: display/full name beats email", () => {
  assert.equal(
    resolvePersonFirstNameLabel({
      full_name: "Sarah Jones",
      email: "auditor@hairaudit.com",
    }),
    "Sarah"
  );
});

test("resolvePersonFirstNameLabel: email-looking display name does not beat role fallback", () => {
  assert.equal(
    resolvePersonFirstNameLabel({
      display_name: "auditor@hairaudit.com",
      role: "auditor",
    }),
    "Auditor"
  );
});

test("resolvePersonFirstNameLabel: email local-part is final fallback", () => {
  assert.equal(
    resolvePersonFirstNameLabel({
      email: "auditor@hairaudit.com",
    }),
    "auditor"
  );
});

test("resolvePersonDisplayNameForToday: prefers structured first_name over email", () => {
  assert.equal(
    resolvePersonDisplayNameForToday({
      first_name: "Sarah",
      email: "auditor@hairaudit.com",
    }),
    "Sarah"
  );
});

test("Today feed item uses resolved first name over email local-part", () => {
  const profile = {
    first_name: "Sarah",
    email: "auditor@hairaudit.com",
    role: "auditor",
  };

  const personLabel = resolvePersonDisplayNameForToday(profile);
  const firstName = resolvePersonFirstNameLabel(profile);
  assert.equal(firstName, "Sarah");
  assert.notEqual(firstName, "auditor");
  assert.equal(personLabel, "Sarah");

  const dashboard = {
    tenantId: "00000000-0000-0000-0000-000000000001",
    tenantName: "Test Clinic",
    agendaRange: { startIso: "2026-06-10T12:00:00.000Z", endIso: "2026-06-10T12:00:00.000Z" },
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
    paymentCommercialKpis: {
      depositsDueCount: 0,
      depositsPaidTodayCount: 0,
      overduePaymentsCount: 0,
    },
    revenueCollections: {
      moduleEnabled: true,
      unpaidIssuedInvoiceCount: 0,
      overdueInvoiceCount: 0,
    },
    receptionBoard: { cards: [] },
    entityAttention: [
      {
        id: "entity-staff-audit-1",
        category: "staff",
        aggregateKey: "staff_compliance",
        personLabel,
        actionLabel: `${firstName} — compliance review`,
        detailLine: "Identity readiness check",
        actionHint: "Review",
        href: "/fi-admin/t1/workforce-os/staff/s1",
        severity: "warning",
        bucket: "up_next",
        priorityScore: 58,
        groupKey: "entity:staff_compliance",
      },
    ],
  } satisfies TenantOperationalDashboard;

  const feed = buildTodayFeed({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  const item = feed.upNext.find((i) => i.id === "entity-staff-audit-1");
  assert.ok(item);
  assert.equal(item.personLabel, "Sarah");
  assert.match(item.actionLabel, /^Sarah —/);
  assert.doesNotMatch(item.actionLabel, /\bauditor\b/i);
});

test("todayFirstNameFromLabel: resolves from label string with profile enrichment", () => {
  assert.equal(
    todayFirstNameFromLabel("auditor@hairaudit.com", {
      first_name: "Sarah",
      email: "auditor@hairaudit.com",
    }),
    "Sarah"
  );
  assert.equal(todayFirstNameFromLabel("Sarah Chen"), "Sarah");
});

test("resolvePersonFirstNameLabel: Connor Green beats connorgreen0310 email local-part", () => {
  const email = "connorgreen0310@example.com";
  assert.equal(
    resolvePersonFirstNameLabel({
      full_name: "Connor Green",
      email,
      role: "staff",
    }),
    "Connor"
  );
});

test("resolvePersonFirstNameLabel: skips precomputed email local-part when full_name exists", () => {
  const email = "connorgreen0310@example.com";
  assert.equal(
    resolvePersonFirstNameLabel({
      display_name: "connorgreen0310",
      full_name: "Connor Green",
      email,
    }),
    "Connor"
  );
});

test("resolvePersonDisplayNameForToday: staff compliance row prefers Connor Green over email", () => {
  assert.equal(
    resolvePersonDisplayNameForToday({
      full_name: "Connor Green",
      email: "connorgreen0310@example.com",
      role: "staff",
    }),
    "Connor Green"
  );
});

test("todayFirstNameFromLabel: precomputed local-part label guard with enriched profile", () => {
  const email = "connorgreen0310@example.com";
  assert.equal(
    todayFirstNameFromLabel("connorgreen0310", {
      full_name: "Connor Green",
      email,
    }),
    "Connor"
  );
});

test("Today feed staff compliance row shows Connor not connorgreen0310", () => {
  const profile = {
    full_name: "Connor Green",
    email: "connorgreen0310@example.com",
    role: "staff",
  };
  const personLabel = resolvePersonDisplayNameForToday(profile);
  const firstName = resolvePersonFirstNameLabel(profile);
  assert.equal(firstName, "Connor");
  assert.notEqual(firstName, "connorgreen0310");
  assert.equal(personLabel, "Connor Green");

  const dashboard = {
    tenantId: "00000000-0000-0000-0000-000000000001",
    tenantName: "Test Clinic",
    agendaRange: { startIso: "2026-06-10T12:00:00.000Z", endIso: "2026-06-10T12:00:00.000Z" },
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
    paymentCommercialKpis: {
      depositsDueCount: 0,
      depositsPaidTodayCount: 0,
      overduePaymentsCount: 0,
    },
    revenueCollections: {
      moduleEnabled: true,
      unpaidIssuedInvoiceCount: 0,
      overdueInvoiceCount: 0,
    },
    receptionBoard: { cards: [] },
    entityAttention: [
      {
        id: "entity-staff-connor-1",
        category: "staff",
        aggregateKey: "staff_compliance",
        personLabel,
        actionLabel: `${firstName} — identity readiness`,
        detailLine: "Staff access invite pending",
        actionHint: "Review",
        href: "/fi-admin/t1/workforce-os/staff/s-connor",
        severity: "warning",
        bucket: "up_next",
        priorityScore: 58,
        groupKey: "entity:staff_compliance",
      },
    ],
  } satisfies TenantOperationalDashboard;

  const feed = buildTodayFeed({
    base: "/fi-admin/t1",
    dashboard,
    showCrmNav: true,
    now: new Date("2026-06-10T12:00:00.000Z"),
  });

  const item = feed.upNext.find((i) => i.id === "entity-staff-connor-1");
  assert.ok(item);
  assert.equal(item.personLabel, "Connor Green");
  assert.match(item.actionLabel, /^Connor —/);
  assert.doesNotMatch(item.actionLabel, /connorgreen0310/i);
});
