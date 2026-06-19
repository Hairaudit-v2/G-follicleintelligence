import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFinancialOsCommandCentreAlerts } from "@/src/lib/financialOs/financialOsCommandCentreAlertsCore";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";

describe("FinancialOS command centre alerts", () => {
  it("surfaces needs review for unmatched reconciliation rows", () => {
    const alerts = buildFinancialOsCommandCentreAlerts({
      unmatchedRows: [
        {
          id: "rec-1",
          provider: "stripe",
          expected_amount_cents: 50000,
          received_amount_cents: 49900,
        },
      ],
      overdueInvoices: [],
      failedPaymentRows: [],
      depositDeadlineInvoices: [],
    });
    assert.equal(alerts.needsReviewCount, 1);
    assert.equal(alerts.unmatchedPayments.count, 1);
    assert.match(alerts.unmatchedPayments.items[0]?.label ?? "", /Needs review/);
  });

  it("includes overdue, failed, and deposit deadline alerts", () => {
    const overdue = mapInvoiceRow({
      id: "inv-1",
      tenant_id: "t",
      invoice_kind: "surgery_deposit",
      status: "overdue",
      total_cents: 10000,
      amount_paid_cents: 0,
      remaining_balance_cents: 10000,
      days_overdue: 3,
      currency: "AUD",
      title: "Deposit",
    });
    const alerts = buildFinancialOsCommandCentreAlerts({
      unmatchedRows: [],
      overdueInvoices: [overdue],
      failedPaymentRows: [{ id: "pay-f", failure_message: "card_declined" }],
      depositDeadlineInvoices: [overdue],
    });
    assert.equal(alerts.overdueInvoices.count, 1);
    assert.equal(alerts.failedGatewayPayments.count, 1);
    assert.equal(alerts.depositDeadlines48h.count, 1);
  });
});
