import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInvoiceLifecyclePatch,
  computeInvoiceDaysOverdue,
  depositDueDateFromRule,
} from "@/src/lib/financialOs/financialInvoiceLifecycle.server";

test("computeInvoiceDaysOverdue", () => {
  assert.equal(
    computeInvoiceDaysOverdue({ due_date: "2026-06-01", remaining_balance_cents: 1000, todayYmd: "2026-06-10" }),
    9
  );
  assert.equal(
    computeInvoiceDaysOverdue({ due_date: "2026-06-20", remaining_balance_cents: 1000, todayYmd: "2026-06-10" }),
    0
  );
  assert.equal(
    computeInvoiceDaysOverdue({ due_date: "2026-06-01", remaining_balance_cents: 0, todayYmd: "2026-06-10" }),
    0
  );
});

test("buildInvoiceLifecyclePatch sets paid_at when settled", () => {
  const patch = buildInvoiceLifecyclePatch(
    {
      status: "awaiting_payment",
      total_cents: 5000,
      amount_paid_cents: 5000,
      due_date: "2026-06-01",
      paid_at: null,
      sent_at: "2026-05-01T00:00:00.000Z",
    },
    "paid",
    "2026-06-10"
  );
  assert.equal(patch.status, "paid");
  assert.equal(patch.remaining_balance_cents, 0);
  assert.equal(typeof patch.paid_at, "string");
});

test("depositDueDateFromRule", () => {
  assert.equal(depositDueDateFromRule(14, "2026-06-01"), "2026-06-15");
  assert.equal(depositDueDateFromRule(null, "2026-06-01"), null);
});
