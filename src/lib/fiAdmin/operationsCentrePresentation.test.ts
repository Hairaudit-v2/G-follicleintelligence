import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCoordinationPriorities,
  buildLiveClinicFlowCards,
  buildMovementBoardItems,
  hasUrgentCoordination,
} from "@/src/lib/fiAdmin/operationsCentrePresentation";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const operationalDay = {
  calendarTimezone: "Australia/Sydney",
  todayYmd: "2026-06-23",
  localStartIso: "2026-06-22T14:00:00.000Z",
  localEndIso: "2026-06-23T14:00:00.000Z",
};

const baseData: Pick<
  TenantOperationalDashboard,
  | "agendaByBucket"
  | "operationalDay"
  | "clinicToday"
  | "paymentCommercialKpis"
  | "receptionBoard"
  | "actionCentre"
  | "quickStats"
> = {
  operationalDay,
  agendaByBucket: {
    consult: [
      {
        id: "a1111111-1111-4111-8111-111111111111",
        start_at: "2026-06-23T00:30:00.000Z",
        end_at: "2026-06-23T01:30:00.000Z",
        title: "Alex Patient",
        booking_type: "consultation",
        booking_status: "scheduled",
        timezone: "Australia/Sydney",
        lead_id: null,
        patient_id: "b2222222-2222-4222-8222-222222222222",
        case_id: null,
      },
      {
        id: "a2222222-2222-4222-8222-222222222222",
        start_at: "2026-06-23T02:00:00.000Z",
        end_at: "2026-06-23T03:00:00.000Z",
        title: "Sam Consult",
        booking_type: "consultation",
        booking_status: "arrived",
        timezone: "Australia/Sydney",
        lead_id: null,
        patient_id: "c3333333-3333-4333-8333-333333333333",
        case_id: null,
      },
    ],
    surgery: [
      {
        id: "a3333333-3333-4333-8333-333333333333",
        start_at: "2026-06-23T04:00:00.000Z",
        end_at: "2026-06-23T08:00:00.000Z",
        title: "Jordan Surgery",
        booking_type: "surgery",
        booking_status: "arrived",
        timezone: "Australia/Sydney",
        lead_id: null,
        patient_id: "d4444444-4444-4444-8444-444444444444",
        case_id: null,
      },
    ],
    follow_up: [],
    other: [
      {
        id: "a4444444-4444-4444-8444-444444444444",
        start_at: "2026-06-23T01:00:00.000Z",
        end_at: "2026-06-23T01:30:00.000Z",
        title: "Waiting Guest",
        booking_type: "other",
        booking_status: "arrived",
        timezone: "Australia/Sydney",
        lead_id: null,
        patient_id: null,
        case_id: null,
      },
    ],
  },
  clinicToday: { consultations: 2, prp: 0, followUps: 0, surgeries: 1 },
  paymentCommercialKpis: { depositsDueCount: 2, depositsPaidTodayCount: 1, overduePaymentsCount: 1 },
  receptionBoard: { cards: [] },
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
  quickStats: {
    newLeadsThisWeek: 0,
    newLeadsToday: 0,
    conversionRateLast30d: null,
    conversionWonLast30d: 0,
    conversionClosedLast30d: 0,
    openConsultations: 0,
    todaysNoShows: 0,
    staffOnDutyToday: 2,
  },
};

test("buildLiveClinicFlowCards returns six clinic-facing cards", () => {
  const cards = buildLiveClinicFlowCards("/fi-admin/t1", baseData);
  assert.equal(cards.length, 6);
  assert.equal(cards[0]?.id, "expected");
  assert.equal(cards[0]?.value, 1);
  assert.equal(cards[1]?.value, 3);
});

test("buildCoordinationPriorities ranks payment and preparation blockers first", () => {
  const items = buildCoordinationPriorities("/fi-admin/t1", baseData, true, 5);
  assert.ok(items.length >= 2);
  assert.equal(items[0]?.id, "payment_before_procedure");
  assert.ok(hasUrgentCoordination(items));
});

test("buildMovementBoardItems groups today visits by operational lane", () => {
  const lanes = buildMovementBoardItems("/fi-admin/t1", baseData, 5);
  assert.equal(lanes.expected.length, 1);
  assert.equal(lanes.arrived.length, 1);
  assert.equal(lanes.in_consultation.length, 1);
  assert.equal(lanes.in_procedure.length, 1);
  assert.equal(lanes.arrived[0]?.patientName, "Waiting Guest");
});

test("hasUrgentCoordination is false when no priorities", () => {
  const calm = {
    ...baseData,
    paymentCommercialKpis: { depositsDueCount: 0, depositsPaidTodayCount: 0, overduePaymentsCount: 0 },
    agendaByBucket: { consult: [], surgery: [], follow_up: [], other: [] },
    actionCentre: { ...baseData.actionCentre, surgeryReadinessAlerts: 0 },
  };
  const items = buildCoordinationPriorities("/fi-admin/t1", calm, true, 5);
  assert.equal(items.length, 0);
  assert.equal(hasUrgentCoordination(items), false);
});
