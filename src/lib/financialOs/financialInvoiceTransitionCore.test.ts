import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertInvoiceTransitionAllowed,
  isInvoiceTransitionAllowed,
  isInvoiceUnpaidStatus,
} from "@/src/lib/financialOs/financialInvoiceTransitionCore";

describe("FinancialOS invoice lifecycle transition guards", () => {
  it("allows specified forward transitions", () => {
    assert.equal(isInvoiceTransitionAllowed("draft", "sent"), true);
    assert.equal(isInvoiceTransitionAllowed("sent", "awaiting_payment"), true);
    assert.equal(isInvoiceTransitionAllowed("awaiting_payment", "partially_paid"), true);
    assert.equal(isInvoiceTransitionAllowed("partially_paid", "paid"), true);
    assert.equal(isInvoiceTransitionAllowed("awaiting_payment", "overdue"), true);
    assert.equal(isInvoiceTransitionAllowed("partially_paid", "overdue"), true);
    assert.equal(isInvoiceTransitionAllowed("awaiting_payment", "cancelled"), true);
    assert.equal(isInvoiceTransitionAllowed("draft", "paid", { paymentSettlement: true }), true);
    assert.equal(isInvoiceTransitionAllowed("draft", "paid"), false);
    assert.equal(isInvoiceTransitionAllowed("paid", "refunded"), true);
  });

  it("blocks illegal backward transitions", () => {
    assert.equal(isInvoiceTransitionAllowed("paid", "awaiting_payment"), false);
    assert.equal(isInvoiceTransitionAllowed("refunded", "paid"), false);
    assert.equal(isInvoiceTransitionAllowed("cancelled", "paid"), false);
  });

  it("allows cancelled → paid only with admin override", () => {
    assert.equal(isInvoiceTransitionAllowed("cancelled", "paid"), false);
    assert.equal(isInvoiceTransitionAllowed("cancelled", "paid", { adminOverride: true }), true);
  });

  it("normalizes legacy issued to awaiting_payment in guards", () => {
    assert.equal(isInvoiceTransitionAllowed("issued", "partially_paid"), true);
    assert.equal(isInvoiceTransitionAllowed("paid", "issued"), false);
  });

  it("assertInvoiceTransitionAllowed throws on blocked transition", () => {
    assert.throws(() => assertInvoiceTransitionAllowed("paid", "awaiting_payment"), /not allowed/);
    assert.doesNotThrow(() => assertInvoiceTransitionAllowed("paid", "paid"));
  });

  it("classifies unpaid states", () => {
    assert.equal(isInvoiceUnpaidStatus("awaiting_payment"), true);
    assert.equal(isInvoiceUnpaidStatus("paid"), false);
    assert.equal(isInvoiceUnpaidStatus("refunded"), false);
  });
});
