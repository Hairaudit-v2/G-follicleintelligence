import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAttentionPriorities,
  buildClinicSnapshotCards,
  buildTomorrowPreview,
} from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import type { TenantActionCentre } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const emptyActionCentre: TenantActionCentre = {
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
};

test("buildAttentionPriorities: returns at most five items ordered by priority", () => {
  const items = buildAttentionPriorities({
    base: "/fi-admin/t1",
    showCrmNav: true,
    actionCentre: {
      ...emptyActionCentre,
      leadsAwaitingContact: 4,
      followUpsDue: 3,
      consultationsAwaitingCompletion: 2,
      surgeryReadinessAlerts: 1,
      financialClearanceAttention: 1,
    },
  });
  assert.equal(items.length, 5);
  assert.equal(items[0]?.id, "financial_clearance");
  assert.equal(items[1]?.id, "surgery_readiness");
});

test("buildAttentionPriorities: omits zero-count items", () => {
  const items = buildAttentionPriorities({
    base: "/fi-admin/t1",
    showCrmNav: false,
    actionCentre: { ...emptyActionCentre, followUpsDue: 2 },
  });
  assert.equal(items.length, 1);
  assert.match(items[0]?.label ?? "", /follow-up/i);
});

test("buildClinicSnapshotCards: caps at six cards", () => {
  const cards = buildClinicSnapshotCards({
    base: "/fi-admin/t1",
    clinicToday: { consultations: 3, prp: 0, followUps: 1, surgeries: 2 },
    receptionCards: [],
    paymentCommercialKpis: {
      depositsDueCount: 1,
      depositsPaidTodayCount: 0,
      overduePaymentsCount: 2,
    },
    revenueCollections: {
      moduleEnabled: true,
      unpaidIssuedInvoiceCount: 1,
      overdueInvoiceCount: 0,
    },
    quickStats: {
      newLeadsThisWeek: 0,
      newLeadsToday: 0,
      conversionRateLast30d: null,
      conversionWonLast30d: 0,
      conversionClosedLast30d: 0,
      openConsultations: 0,
      todaysNoShows: 0,
      staffOnDutyToday: 4,
    },
    actionCentre: { ...emptyActionCentre, surgeryReadinessAlerts: 1 },
  });
  assert.equal(cards.length, 6);
});

test("buildTomorrowPreview: summarizes tomorrow surgeries and missing prep", () => {
  const lines = buildTomorrowPreview({
    operationalDay: {
      calendarTimezone: "UTC",
      todayYmd: "2026-06-10",
      localStartIso: "2026-06-10T00:00:00.000Z",
      localEndIso: "2026-06-11T00:00:00.000Z",
    },
    agendaByBucket: {
      consult: [],
      surgery: [
        {
          id: "s1",
          start_at: "2026-06-11T09:00:00.000Z",
          end_at: "2026-06-11T12:00:00.000Z",
          title: "Surgery A",
          booking_type: "surgery",
          booking_status: "confirmed",
          timezone: "UTC",
          lead_id: null,
          patient_id: null,
          case_id: null,
        },
      ],
      follow_up: [],
      other: [],
    },
    paymentCommercialKpis: {
      depositsDueCount: 1,
      depositsPaidTodayCount: 0,
      overduePaymentsCount: 0,
    },
    now: new Date("2026-06-10T12:00:00.000Z"),
  });
  assert.ok(lines.some((l) => /surgery scheduled tomorrow/i.test(l.text)));
  assert.ok(lines.some((l) => /preparation item missing/i.test(l.text)));
});
