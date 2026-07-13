import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  moneyClearanceBlockedStaffMessage,
  moneyHubHeadline,
  moneyPaymentTruthBanner,
  moneyTakePaymentHref,
} from "@/src/lib/financialOs/moneyTrustCopy";

describe("moneyTrustCopy", () => {
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
