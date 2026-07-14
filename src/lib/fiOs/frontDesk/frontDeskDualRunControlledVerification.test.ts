/**
 * S3.4C — controlled dual-run verification (synthetic tenant/day; no PHI).
 * Proves compareFrontDeskDualRun gates pass on a realistic full-tier fixture
 * that mirrors controlled go/no-go criteria before redirects.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFrontDeskTodayPresentation } from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation";
import { compareFrontDeskDualRun } from "@/src/lib/fiOs/frontDesk/frontDeskDualRunComparison";
import type {
  ReceptionBoardAppointmentCard,
  ReceptionBoardCommandCenterPayload,
} from "@/src/lib/receptionBoard/receptionBoardTypes";
import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const TENANT = "22222222-2222-4222-8222-222222222222";
const BASE = `/fi-admin/${TENANT}`;
const NOW_MS = Date.parse("2026-07-12T10:00:00.000Z");
const IDS = {
  a: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  c: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  d: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  e: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};

function emptyQueue(): ReceptionBoardCommandCenterPayload["queue"] {
  return {
    scheduled: [],
    arrived: [],
    checked_in: [],
    waiting: [],
    in_consultation: [],
    procedure_in_progress: [],
    completed: [],
    follow_up_booked: [],
  };
}

function card(
  partial: Partial<ReceptionBoardCard> & Pick<ReceptionBoardCard, "id">
): ReceptionBoardCard {
  return {
    id: partial.id,
    startAt: partial.startAt ?? "2026-07-12T10:30:00.000Z",
    endAt: partial.endAt ?? "2026-07-12T11:00:00.000Z",
    title: null,
    bookingType: partial.bookingType ?? "consultation",
    bookingStatus: partial.bookingStatus ?? "scheduled",
    timezone: "UTC",
    leadId: null,
    patientId: null,
    displayName: "Redacted",
    statusLabel: "Scheduled",
    typeLabel: "Consultation",
    providerLabel: "Staff",
    clinicLabel: null,
    roomLabel: null,
    receptionColumn: partial.receptionColumn ?? "expected",
    metadata: partial.metadata ?? {},
  };
}

function appt(
  id: string,
  paymentStatus: ReceptionBoardAppointmentCard["paymentStatus"]
): ReceptionBoardAppointmentCard {
  return {
    id,
    patientName: "Redacted",
    appointmentTime: "10:30",
    appointmentType: "Consultation",
    clinician: "Staff",
    status: "scheduled",
    statusLabel: "Scheduled",
    durationMinutes: 30,
    room: null,
    paymentStatus,
    paymentStatusLabel: paymentStatus,
    confirmationStatus: "confirmed",
    journeyState: null,
    journeyStateLabel: null,
    sortKey: id,
    hrefs: {
      patient: null,
      case: null,
      lead: null,
      appointment: `${BASE}/a`,
      calendar: `${BASE}/c`,
      followUp: `${BASE}/f`,
    },
  };
}

test("controlled dual-run: full fixture passes go/no-go gate", () => {
  const lateStart = new Date(NOW_MS - 20 * 60_000).toISOString();
  const p: ReceptionBoardCommandCenterPayload = {
    tenantId: TENANT,
    tenantName: "Controlled",
    loadedAt: new Date(NOW_MS).toISOString(),
    operationalDay: {
      calendarTimezone: "UTC",
      todayYmd: "2026-07-12",
      localStartIso: "2026-07-12T00:00:00.000Z",
      localEndIso: "2026-07-13T00:00:00.000Z",
    },
    appointments: [
      appt(IDS.a, "due"),
      appt(IDS.b, "unknown"),
      appt(IDS.c, "paid"),
      appt(IDS.d, "unknown"),
      appt(IDS.e, "unknown"),
    ],
    queue: emptyQueue(),
    actionAlerts: [
      {
        id: "consent-a",
        kind: "missing_consent",
        title: "Consent",
        detail: "redacted",
        severity: "critical",
        href: null,
        priorityScore: 90,
        bookingId: IDS.a,
        patientId: null,
      },
      {
        id: "panel-only",
        kind: "missing_forms",
        title: "Forms",
        detail: "redacted",
        severity: "warning",
        href: null,
        priorityScore: 50,
        bookingId: null,
        patientId: null,
      },
    ],
    quickActions: [],
    tomorrowSurgeries: [],
    intelligence: {
      todayConsultations: 0,
      todaySurgeries: 0,
      revenueBookedToday: 0,
      outstandingPayments: 0,
      conversionRateToday: null,
      doctorUtilizationPercent: null,
      staffUtilizationPercent: null,
      averageConsultationCloseRate: null,
      upcomingFollowUps: 0,
      unreadPatientTasks: 0,
    },
    liveEvents: [],
    receptionCards: [
      card({ id: IDS.a, startAt: "2026-07-12T10:20:00.000Z" }), // arriving soon
      card({
        id: IDS.b,
        bookingStatus: "scheduled",
        receptionColumn: "expected",
        startAt: lateStart,
      }), // running late
      card({
        id: IDS.c,
        bookingStatus: "arrived",
        receptionColumn: "arrived",
        startAt: "2026-07-12T09:00:00.000Z",
      }), // waiting
      card({
        id: IDS.d,
        bookingStatus: "completed",
        receptionColumn: "complete",
      }),
      card({
        id: IDS.e,
        bookingStatus: "cancelled",
        receptionColumn: "cancelled",
      }),
    ],
    loadTier: "full",
  };

  const presentation = buildFrontDeskTodayPresentation(p, {
    base: BASE,
    nowMs: NOW_MS,
    mutationMode: "full",
  });
  const report = compareFrontDeskDualRun(p, presentation, { nowMs: NOW_MS });

  // Recorded go/no-go fields (IDs/counts only)
  assert.equal(report.tenantId, TENANT);
  assert.equal(report.operationalDay, "2026-07-12");
  assert.deepEqual(report.missingFromNew, []);
  assert.deepEqual(report.extraInNew, []);
  assert.deepEqual(report.duplicateBookingIds, []);
  assert.equal(report.counts.total.old, report.counts.total.new);
  assert.equal(report.counts.completed.old, report.counts.completed.new);
  assert.equal(report.counts.cancelledOrNoShow.old, report.counts.cancelledOrNoShow.new);
  assert.deepEqual(report.paymentMismatches, []);
  assert.deepEqual(report.keyedBlockerMismatches, []);
  assert.ok(report.panelOnlyAlertIds.includes("panel-only"));
  assert.equal(report.pass, true);

  // Intentional state diffs present and classified
  const kinds = new Set(report.stateDifferences.map((d) => d.kind));
  assert.ok(
    kinds.has("expected_to_running_late") ||
      kinds.has("expected_to_arriving_soon") ||
      kinds.has("arrived_to_waiting")
  );

  const serialized = JSON.stringify(report);
  assert.ok(!serialized.includes("Redacted"));
});
