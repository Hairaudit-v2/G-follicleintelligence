import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  moneyClearanceBlockedStaffMessage,
  moneyHubHeadline,
  moneyPaymentRowSourceLabel,
  moneyPaymentTruthBanner,
  moneyTakePaymentHref,
  moneyTomorrowSurgeryPaymentsKpiHelper,
} from "@/src/lib/financialOs/moneyTrustCopy";

describe("moneyTrustCopy", () => {
  it("tomorrow board KPI helper avoids internal table names", () => {
    const helper = moneyTomorrowSurgeryPaymentsKpiHelper();
    assert.match(helper, /Manual surgery payment records/);
    assert.doesNotMatch(helper, /fi_payment_records/);
    assert.doesNotMatch(helper, /FinancialOS/);
  });

  it("uses Money not FinancialOS in staff messages", () => {
    assert.equal(moneyHubHeadline(), "Money");
    const msg = moneyClearanceBlockedStaffMessage("Deposit outstanding");
    assert.match(msg, /Money/);
    assert.doesNotMatch(msg, /FinancialOS/);
    assert.match(msg, /Surgery confirmation blocked/);
  });

  it("banner distinguishes manual-only vs dual path", () => {
    const off = moneyPaymentTruthBanner({ paymentsInboxEnabled: false });
    assert.match(off.body, /Online card capture is off/i);
    const on = moneyPaymentTruthBanner({ paymentsInboxEnabled: true });
    assert.match(on.body, /Take payment/i);
  });

  it("payment row source label distinguishes manual tracking vs provider confirmed", () => {
    assert.deepEqual(moneyPaymentRowSourceLabel("stripe"), {
      label: "Provider confirmed (Stripe)",
      providerConfirmed: true,
    });
    assert.deepEqual(moneyPaymentRowSourceLabel("Stripe"), {
      label: "Provider confirmed (Stripe)",
      providerConfirmed: true,
    });
    assert.deepEqual(moneyPaymentRowSourceLabel("manual"), {
      label: "Manual tracking",
      providerConfirmed: false,
    });
    assert.deepEqual(moneyPaymentRowSourceLabel(null), {
      label: "Manual tracking",
      providerConfirmed: false,
    });
    assert.deepEqual(moneyPaymentRowSourceLabel("  "), {
      label: "Manual tracking",
      providerConfirmed: false,
    });
    assert.deepEqual(moneyPaymentRowSourceLabel("square"), {
      label: "Provider confirmed (square)",
      providerConfirmed: true,
    });
  });

  it("take payment href follows inbox flag", () => {
    assert.equal(
      moneyTakePaymentHref("/fi-admin/t1", true),
      "/fi-admin/t1/payments"
    );
    assert.equal(
      moneyTakePaymentHref("/fi-admin/t1", false),
      "/fi-admin/t1/financial/payments"
    );
  });
});
