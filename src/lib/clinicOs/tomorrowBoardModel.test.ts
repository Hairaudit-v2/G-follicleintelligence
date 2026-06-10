import assert from "node:assert/strict";
import test from "node:test";

import type { FiBookingRow } from "@/src/lib/bookings/types";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import {
  computeTomorrowOperationalWindow,
  deriveTomorrowActionItems,
  isTomorrowAgendaBooking,
  summarizeTomorrowBoard,
  type TomorrowOperationalWindow,
  type TomorrowSurgeryReadinessDerived,
} from "@/src/lib/clinicOs/tomorrowBoardModel";
import { getClinicOsShellActiveNavId } from "@/src/lib/fiAdmin/clinicOsShellConfig";

const TID = "a0000000-0000-4000-8000-0000000000e1";

function bookingStub(over: Partial<FiBookingRow>): FiBookingRow {
  return {
    id: "b0000000-0000-4000-8000-000000000001",
    tenant_id: TID,
    lead_id: null,
    person_id: null,
    patient_id: null,
    case_id: null,
    clinic_id: null,
    room_id: null,
    room_required: false,
    assigned_staff_id: null,
    assigned_user_id: null,
    booking_type: "consultation",
    booking_status: "confirmed",
    title: "Test",
    description: null,
    start_at: "2026-06-11T10:00:00.000Z",
    end_at: "2026-06-11T11:00:00.000Z",
    timezone: null,
    location: null,
    metadata: {},
    cancelled_at: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    created_by_user_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...over,
  };
}

test("computeTomorrowOperationalWindow: tenant-local tomorrow follows operational today (UTC)", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const w = computeTomorrowOperationalWindow(now, "UTC");
  assert.equal(w.todayYmd, "2026-06-10");
  assert.equal(w.tomorrowYmd, "2026-06-11");
  assert.ok(Date.parse(w.localStartIso) < Date.parse(w.localEndIso));
  const inner = new Date("2026-06-11T10:00:00.000Z").toISOString();
  assert.ok(inner >= w.localStartIso && inner < w.localEndIso);
});

test("isTomorrowAgendaBooking: only rows inside tomorrow window and active statuses", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const w = computeTomorrowOperationalWindow(now, "UTC");
  assert.equal(
    isTomorrowAgendaBooking(bookingStub({ start_at: "2026-06-11T09:00:00.000Z", end_at: "2026-06-11T10:00:00.000Z", booking_status: "confirmed" }), w),
    true
  );
  assert.equal(
    isTomorrowAgendaBooking(bookingStub({ start_at: "2026-06-12T09:00:00.000Z", booking_status: "confirmed" }), w),
    false
  );
  assert.equal(
    isTomorrowAgendaBooking(bookingStub({ start_at: "2026-06-11T09:00:00.000Z", booking_status: "cancelled" }), w),
    false
  );
});

test("deriveTomorrowActionItems: scheduled booking creates call_unconfirmed", () => {
  const window: TomorrowOperationalWindow = {
    calendarTimezone: "UTC",
    todayYmd: "2026-06-10",
    tomorrowYmd: "2026-06-11",
    localStartIso: "2026-06-11T00:00:00.000Z",
    localEndIso: "2026-06-12T00:00:00.000Z",
  };
  const b = bookingStub({ id: "b1", booking_status: "scheduled", booking_type: "consultation" });
  const actions = deriveTomorrowActionItems({
    window,
    agendaBookings: [b],
    surgeryReadiness: [],
    surgeryPayments: { byBookingId: new Map(), byCaseId: new Map() },
    bookingLabel: () => "Pat",
  });
  assert.ok(actions.some((a) => a.kind === "call_unconfirmed" && a.bookingId === "b1"));
});

test("deriveTomorrowActionItems: missing case link creates link_case for surgery", () => {
  const window: TomorrowOperationalWindow = {
    calendarTimezone: "UTC",
    todayYmd: "2026-06-10",
    tomorrowYmd: "2026-06-11",
    localStartIso: "2026-06-11T00:00:00.000Z",
    localEndIso: "2026-06-12T00:00:00.000Z",
  };
  const sr: TomorrowSurgeryReadinessDerived[] = [
    {
      bookingId: "s1",
      patientLabel: "Alex",
      surgeryLocalYmd: "2026-06-11",
      bookingTimeKey: "2026-06-11T08:00:00.000Z",
      bookingStatus: "confirmed",
      caseId: null,
      issues: [{ kind: "missing_case_link", severity: "warning" }],
      isHighRisk: false,
    },
  ];
  const actions = deriveTomorrowActionItems({
    window,
    agendaBookings: [],
    surgeryReadiness: sr,
    surgeryPayments: { byBookingId: new Map(), byCaseId: new Map() },
    bookingLabel: () => "x",
  });
  assert.ok(actions.some((a) => a.kind === "link_case" && a.bookingId === "s1"));
});

test("deriveTomorrowActionItems: chase_deposit only when payment record exists", () => {
  const window: TomorrowOperationalWindow = {
    calendarTimezone: "UTC",
    todayYmd: "2026-06-10",
    tomorrowYmd: "2026-06-11",
    localStartIso: "2026-06-11T00:00:00.000Z",
    localEndIso: "2026-06-12T00:00:00.000Z",
  };
  const pay: PaymentRecordRow = {
    id: "pay1",
    tenant_id: TID,
    payment_context: "surgery",
    patient_id: "p1",
    lead_id: null,
    consultation_id: null,
    case_id: "c1",
    booking_id: "s1",
    amount_expected: 100,
    amount_paid: 0,
    currency: "GBP",
    status: "pending",
    due_date: "2026-06-09",
    notes: null,
    recorded_by: null,
    recorded_at: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
  };
  const byBookingId = new Map<string, PaymentRecordRow>([["s1", pay]]);
  const sr: TomorrowSurgeryReadinessDerived[] = [
    {
      bookingId: "s1",
      patientLabel: "Sam",
      surgeryLocalYmd: "2026-06-11",
      bookingTimeKey: "2026-06-11T08:00:00.000Z",
      bookingStatus: "confirmed",
      caseId: "c1",
      issues: [
        { kind: "missing_pathology", severity: "warning" },
        { kind: "surgery_deposit_pending", severity: "warning" },
      ],
      isHighRisk: false,
    },
  ];
  const withPay = deriveTomorrowActionItems({
    window,
    agendaBookings: [],
    surgeryReadiness: sr,
    surgeryPayments: { byBookingId, byCaseId: new Map() },
    bookingLabel: () => "x",
  });
  assert.ok(withPay.some((a) => a.kind === "chase_deposit"));

  const noPay = deriveTomorrowActionItems({
    window,
    agendaBookings: [],
    surgeryReadiness: sr.map((r) => ({ ...r, issues: [{ kind: "missing_pathology", severity: "warning" }] })),
    surgeryPayments: { byBookingId: new Map(), byCaseId: new Map() },
    bookingLabel: () => "x",
  });
  assert.equal(noPay.some((a) => a.kind === "chase_deposit"), false);
});

test("summarizeTomorrowBoard: abnormal pathology counts as high-risk surgery item", () => {
  const agenda: FiBookingRow[] = [bookingStub({ booking_type: "surgery" })];
  const sr: TomorrowSurgeryReadinessDerived[] = [
    {
      bookingId: "s1",
      patientLabel: "Riley",
      surgeryLocalYmd: "2026-06-11",
      bookingTimeKey: "2026-06-11T08:00:00.000Z",
      bookingStatus: "confirmed",
      caseId: "c1",
      issues: [{ kind: "abnormal_pathology", severity: "high_risk" }],
      isHighRisk: true,
    },
  ];
  const summary = summarizeTomorrowBoard(agenda, sr, "2026-06-10", { byBookingId: new Map(), byCaseId: new Map() });
  assert.equal(summary.highRiskSurgeryItems, 1);
});

test("getClinicOsShellActiveNavId: tomorrow route", () => {
  const base = `/fi-admin/${TID}`;
  assert.equal(getClinicOsShellActiveNavId(`${base}/tomorrow`, base), "tomorrow-board");
  assert.equal(getClinicOsShellActiveNavId(`${base}/tomorrow/extra`, base), "tomorrow-board");
});
