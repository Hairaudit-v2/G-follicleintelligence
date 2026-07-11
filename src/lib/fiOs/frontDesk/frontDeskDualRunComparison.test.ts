import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFrontDeskTodayPresentation } from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation";
import { compareFrontDeskDualRun } from "@/src/lib/fiOs/frontDesk/frontDeskDualRunComparison";
import { RECEPTION_RUNNING_LATE_GRACE_MINUTES } from "@/src/lib/fiOs/receptionBoardModel";
import type {
  ReceptionBoardActionAlert,
  ReceptionBoardAppointmentCard,
  ReceptionBoardCommandCenterPayload,
} from "@/src/lib/receptionBoard/receptionBoardTypes";
import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

const TENANT = "11111111-1111-1111-1111-111111111111";
const BASE = `/fi-admin/${TENANT}`;
const NOW_MS = Date.parse("2026-07-11T12:00:00.000Z");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
    startAt: partial.startAt ?? "2026-07-11T12:30:00.000Z",
    endAt: partial.endAt ?? "2026-07-11T13:00:00.000Z",
    title: null,
    bookingType: "consultation",
    bookingStatus: partial.bookingStatus ?? "scheduled",
    timezone: "UTC",
    leadId: null,
    patientId: null,
    displayName: "Patient", // must not appear in comparison output
    statusLabel: "Scheduled",
    typeLabel: "Consultation",
    providerLabel: "Dr A",
    clinicLabel: null,
    roomLabel: null,
    receptionColumn: partial.receptionColumn ?? "expected",
    metadata: partial.metadata ?? {},
  };
}

function appt(
  partial: Partial<ReceptionBoardAppointmentCard> & Pick<ReceptionBoardAppointmentCard, "id">
): ReceptionBoardAppointmentCard {
  return {
    id: partial.id,
    patientName: "Secret Name",
    appointmentTime: "12:30",
    appointmentType: "Consultation",
    clinician: "Dr A",
    status: "scheduled",
    statusLabel: "Scheduled",
    durationMinutes: 30,
    room: null,
    paymentStatus: partial.paymentStatus ?? "unknown",
    paymentStatusLabel: partial.paymentStatusLabel ?? "Unknown",
    confirmationStatus: "confirmed",
    journeyState: null,
    journeyStateLabel: null,
    sortKey: partial.id,
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

function alert(
  partial: Partial<ReceptionBoardActionAlert> & Pick<ReceptionBoardActionAlert, "id" | "kind">
): ReceptionBoardActionAlert {
  return {
    id: partial.id,
    kind: partial.kind,
    title: partial.title ?? "Alert",
    detail: partial.detail ?? "detail",
    severity: partial.severity ?? "warning",
    href: null,
    priorityScore: partial.priorityScore ?? 80,
    bookingId: partial.bookingId ?? null,
    patientId: partial.patientId ?? null,
  };
}

function payload(
  overrides: Partial<ReceptionBoardCommandCenterPayload> = {}
): ReceptionBoardCommandCenterPayload {
  return {
    tenantId: TENANT,
    tenantName: "Clinic",
    loadedAt: "2026-07-11T12:00:00.000Z",
    operationalDay: {
      calendarTimezone: "UTC",
      todayYmd: "2026-07-11",
      localStartIso: "2026-07-11T00:00:00.000Z",
      localEndIso: "2026-07-12T00:00:00.000Z",
    },
    appointments: [],
    queue: emptyQueue(),
    actionAlerts: [],
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
    receptionCards: [],
    loadTier: "full",
    ...overrides,
  };
}

function present(p: ReceptionBoardCommandCenterPayload) {
  return buildFrontDeskTodayPresentation(p, {
    base: BASE,
    nowMs: NOW_MS,
    mutationMode: "full",
  });
}

function compare(p: ReceptionBoardCommandCenterPayload) {
  return compareFrontDeskDualRun(p, present(p), { nowMs: NOW_MS });
}

function jsonHasPhi(report: ReturnType<typeof compare>): boolean {
  const s = JSON.stringify(report);
  return /Secret Name|Patient|Dr A|detail|Consent|phone|@/.test(s) && /Secret Name/.test(s);
}

test("1. missing booking detection", () => {
  const p = payload({
    receptionCards: [card({ id: A }), card({ id: B })],
  });
  // Force missing by comparing payload with presentation built without B
  const pOnlyA = payload({ receptionCards: [card({ id: A })] });
  const presOnlyA = present(pOnlyA);
  const report = compareFrontDeskDualRun(p, presOnlyA, { nowMs: NOW_MS });
  assert.ok(report.missingFromNew.includes(B));
  assert.equal(report.pass, false);
});

test("2. extra booking detection", () => {
  const p = payload({ receptionCards: [card({ id: A })] });
  const pExtra = payload({ receptionCards: [card({ id: A }), card({ id: B })] });
  const report = compareFrontDeskDualRun(p, present(pExtra), { nowMs: NOW_MS });
  assert.ok(report.extraInNew.includes(B));
  assert.equal(report.pass, false);
});

test("3. duplicate booking detection", () => {
  const p = payload({ receptionCards: [card({ id: A })] });
  const presentation = present(p);
  // Inject duplicate into a lane
  const lane = presentation.lanes.find((l) => l.cards.length > 0)!;
  const dup = { ...lane.cards[0]! };
  lane.cards.push(dup);
  const report = compareFrontDeskDualRun(p, presentation, { nowMs: NOW_MS });
  assert.ok(report.duplicateBookingIds.includes(A));
  assert.equal(report.pass, false);
});

test("4. exact ID parity pass", () => {
  const p = payload({
    receptionCards: [
      card({ id: A, startAt: "2026-07-11T12:30:00.000Z" }),
      card({
        id: B,
        bookingStatus: "arrived",
        receptionColumn: "arrived",
        startAt: "2026-07-11T10:00:00.000Z",
      }),
    ],
  });
  const report = compare(p);
  assert.deepEqual(report.missingFromNew, []);
  assert.deepEqual(report.extraInNew, []);
  assert.deepEqual(report.duplicateBookingIds, []);
  assert.equal(report.pass, true);
});

test("5. waiting accepted as intentional reclassification", () => {
  const p = payload({
    receptionCards: [
      card({
        id: A,
        bookingStatus: "arrived",
        receptionColumn: "arrived",
        startAt: "2026-07-11T10:00:00.000Z",
      }),
    ],
  });
  const report = compare(p);
  const wait = report.stateDifferences.find((d) => d.bookingId === A);
  assert.ok(wait);
  assert.equal(wait!.kind, "arrived_to_waiting");
  assert.equal(report.pass, true);
});

test("6. running late accepted with exported 10-minute grace", () => {
  assert.equal(RECEPTION_RUNNING_LATE_GRACE_MINUTES, 10);
  const start = new Date(
    NOW_MS - (RECEPTION_RUNNING_LATE_GRACE_MINUTES + 5) * 60_000
  ).toISOString();
  const p = payload({
    receptionCards: [
      card({
        id: A,
        bookingStatus: "scheduled",
        receptionColumn: "expected",
        startAt: start,
      }),
    ],
  });
  const report = compare(p);
  const diff = report.stateDifferences.find((d) => d.bookingId === A);
  assert.ok(diff);
  assert.equal(diff!.kind, "expected_to_running_late");
  assert.equal(report.runningLateGraceMinutes, 10);
  assert.equal(report.pass, true);
});

test("7. completed reconciliation", () => {
  const p = payload({
    receptionCards: [
      card({
        id: A,
        bookingStatus: "completed",
        receptionColumn: "complete",
      }),
    ],
  });
  const report = compare(p);
  assert.equal(report.counts.completed.old, 1);
  assert.equal(report.counts.completed.new, 1);
  assert.equal(report.pass, true);
});

test("8. cancelled/no-show reconciliation", () => {
  const p = payload({
    receptionCards: [
      card({ id: A, bookingStatus: "cancelled", receptionColumn: "cancelled" }),
      card({ id: B, bookingStatus: "no_show", receptionColumn: "no_show" }),
    ],
  });
  const report = compare(p);
  assert.equal(report.counts.cancelledOrNoShow.old, 2);
  assert.equal(report.counts.cancelledOrNoShow.new, 2);
  assert.equal(report.pass, true);
});

test("9. payment mismatch detection", () => {
  const p = payload({
    receptionCards: [card({ id: A })],
    appointments: [appt({ id: A, paymentStatus: "overdue", paymentStatusLabel: "Overdue" })],
    loadTier: "full",
  });
  // Build presentation then force payment unknown to create mismatch
  const presentation = present(p);
  const cardRow = presentation.lanes.flatMap((l) => l.cards).find((c) => c.bookingId === A)!;
  cardRow.payment = { state: "unknown", label: "unknown" };
  const report = compareFrontDeskDualRun(p, presentation, { nowMs: NOW_MS });
  assert.ok(report.paymentMismatches.includes(A));
  assert.equal(report.pass, false);
});

test("10. explicit blocker mismatch detection", () => {
  const p = payload({
    receptionCards: [card({ id: A })],
    actionAlerts: [
      alert({
        id: "blk-1",
        kind: "missing_consent",
        title: "Consent",
        severity: "critical",
        bookingId: A,
      }),
    ],
  });
  const presentation = present(p);
  // Strip blockers
  for (const lane of presentation.lanes) {
    for (const c of lane.cards) {
      c.blocker = { highest: null, summary: null, items: [] };
    }
  }
  presentation.attentionItems = [];
  const report = compareFrontDeskDualRun(p, presentation, { nowMs: NOW_MS });
  assert.ok(report.keyedBlockerMismatches.includes(A));
  assert.equal(report.pass, false);
});

test("11. unkeyed alert classified as panel-only", () => {
  const p = payload({
    receptionCards: [card({ id: A })],
    actionAlerts: [
      alert({
        id: "panel-only-1",
        kind: "missing_forms",
        title: "Forms",
        bookingId: null,
        patientId: null,
      }),
    ],
  });
  const report = compare(p);
  assert.ok(report.panelOnlyAlertIds.includes("panel-only-1"));
  assert.equal(report.pass, true);
});

test("12. no PHI in comparison output", () => {
  const p = payload({
    receptionCards: [card({ id: A, displayName: "Secret Patient" })],
    appointments: [appt({ id: A, paymentStatus: "due" })],
    actionAlerts: [
      alert({
        id: "x",
        kind: "missing_consent",
        title: "Should not dump free text names",
        detail: "Secret clinical note",
        bookingId: A,
      }),
    ],
  });
  const report = compare(p);
  const raw = JSON.stringify(report);
  assert.ok(!raw.includes("Secret Patient"));
  assert.ok(!raw.includes("Secret Name"));
  assert.ok(!raw.includes("Secret clinical"));
  assert.ok(!jsonHasPhi(report));
  // IDs ok
  assert.ok(raw.includes(A));
});
