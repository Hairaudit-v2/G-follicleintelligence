import assert from "node:assert/strict";
import test from "node:test";

import {
  computeEffectivePaymentStatus,
  CONSULTATION_DEPOSIT_BOARD_COPY,
  consultationDepositBoardLabel,
  isPaymentMutationRole,
  paymentRecordNeedsCollection,
  summarizePaymentRecordsForOperations,
  SURGERY_DEPOSIT_BOARD_COPY,
} from "@/src/lib/payments/paymentRecordModel";

test("computeEffectivePaymentStatus: paid unchanged", () => {
  assert.equal(computeEffectivePaymentStatus({ status: "paid", due_date: "2020-01-01" }, "2026-06-10"), "paid");
});

test("computeEffectivePaymentStatus: overdue derived from due_date", () => {
  assert.equal(computeEffectivePaymentStatus({ status: "pending", due_date: "2026-06-01" }, "2026-06-10"), "overdue_derived");
  assert.equal(computeEffectivePaymentStatus({ status: "partially_paid", due_date: "2026-06-09" }, "2026-06-10"), "overdue_derived");
});

test("computeEffectivePaymentStatus: pending future due is not overdue", () => {
  assert.equal(computeEffectivePaymentStatus({ status: "pending", due_date: "2026-06-20" }, "2026-06-10"), "pending");
});

test("paymentRecordNeedsCollection: waived is false", () => {
  assert.equal(paymentRecordNeedsCollection({ status: "waived", due_date: null, amount_expected: 100, amount_paid: 0 }, "2026-06-10"), false);
});

test("consultationDepositBoardLabel: no record is neutral tracking state, not unpaid", () => {
  assert.equal(consultationDepositBoardLabel(null, "2026-06-10"), "no_tracking");
  assert.equal(CONSULTATION_DEPOSIT_BOARD_COPY.no_tracking, "No manual deposit record yet.");
});

test("SURGERY_DEPOSIT_BOARD_COPY: no_tracking wording", () => {
  assert.equal(SURGERY_DEPOSIT_BOARD_COPY.no_tracking, "No manual surgery payment record yet.");
});

test("summarizePaymentRecordsForOperations: empty input yields zero KPIs (no phantom dues)", () => {
  const summary = summarizePaymentRecordsForOperations([], "2026-06-10", "2026-06-10T00:00:00.000Z", "2026-06-11T00:00:00.000Z");
  assert.equal(summary.depositsDueCount, 0);
  assert.equal(summary.depositsPaidTodayCount, 0);
  assert.equal(summary.overduePaymentsCount, 0);
});
test("summarizePaymentRecordsForOperations: overdue and paid today", () => {
  const summary = summarizePaymentRecordsForOperations(
    [
      { status: "pending", due_date: "2026-06-01", amount_expected: 100, amount_paid: 0, updated_at: "2026-06-09T10:00:00.000Z" },
      { status: "paid", due_date: null, amount_expected: 50, amount_paid: 50, updated_at: "2026-06-10T14:00:00.000Z" },
    ],
    "2026-06-10",
    "2026-06-10T00:00:00.000Z",
    "2026-06-11T00:00:00.000Z"
  );
  assert.equal(summary.overduePaymentsCount, 1);
  assert.equal(summary.depositsDueCount, 1);
  assert.equal(summary.depositsPaidTodayCount, 1);
});

test("isPaymentMutationRole: reception false", () => {
  assert.equal(isPaymentMutationRole("reception"), false);
});

test("isPaymentMutationRole: finance true", () => {
  assert.equal(isPaymentMutationRole("finance"), true);
});
