import assert from "node:assert/strict";
import test from "node:test";

import { parseMoneyStringToCentsAud } from "@/src/lib/revenueOs/quoteAmountParse";
import {
  computeNextInvoiceStatus,
  deriveCaseDepositReadinessBlock,
  invoiceAmountPaidAfterAllocation,
  invoiceLineTotalCents,
} from "@/src/lib/revenueOs/revenueInvoiceMath";
import { derivePublicPaymentPageState, isPaymentPublicTokenFormat } from "@/src/lib/revenueOs/publicPaymentRequestModel";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import type { FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  isFiStripeGatewayPaymentIntentDuplicateInsert,
  isStripeWebhookDuplicateInsert,
} from "@/src/lib/payments/stripeWebhookIdempotency";

test("parseMoneyStringToCentsAud: AUD-ish strings", () => {
  assert.equal(parseMoneyStringToCentsAud("$1,250.50 AUD"), 125050);
  assert.equal(parseMoneyStringToCentsAud("12500"), 1250000);
  assert.equal(parseMoneyStringToCentsAud("  "), null);
});

test("invoiceLineTotalCents", () => {
  assert.equal(invoiceLineTotalCents(10000, 1000), 11000);
});

test("invoiceAmountPaidAfterAllocation", () => {
  assert.equal(invoiceAmountPaidAfterAllocation(5000, 2500), 7500);
});

test("computeNextInvoiceStatus: partial and overdue transitions", () => {
  const awaiting = computeNextInvoiceStatus(
    { status: "awaiting_payment", total_cents: 10000, amount_paid_cents: 3000, due_date: "2099-01-01" },
    "2026-06-12"
  );
  assert.equal(awaiting, "partially_paid");
  const overdue = computeNextInvoiceStatus(
    { status: "awaiting_payment", total_cents: 10000, amount_paid_cents: 0, due_date: "2020-01-01" },
    "2026-06-12"
  );
  assert.equal(overdue, "overdue");
  const paid = computeNextInvoiceStatus(
    { status: "awaiting_payment", total_cents: 10000, amount_paid_cents: 10000, due_date: "2020-01-01" },
    "2026-06-12"
  );
  assert.equal(paid, "paid");
});

test("deriveCaseDepositReadinessBlock", () => {
  assert.equal(deriveCaseDepositReadinessBlock(true, true), true);
  assert.equal(deriveCaseDepositReadinessBlock(false, true), false);
  assert.equal(deriveCaseDepositReadinessBlock(true, false), false);
});

test("isPaymentPublicTokenFormat", () => {
  assert.equal(isPaymentPublicTokenFormat("ab".repeat(18)), true);
  assert.equal(isPaymentPublicTokenFormat("not-hex"), false);
});

test("derivePublicPaymentPageState: manual vs payable", () => {
  const inv: Pick<FiInvoiceRow, "total_cents" | "amount_paid_cents" | "status"> = {
    total_cents: 10000,
    amount_paid_cents: 0,
    status: "awaiting_payment",
  };
  const pr = {
    id: "x",
    tenant_id: "t",
    invoice_id: "i",
    status: "sent",
    amount_cents: 10000,
    tax_cents: 0,
    total_cents: 10000,
    currency: "AUD",
    public_token: "tok",
    sent_at: null,
    viewed_at: null,
    checkout_url: "https://stripe.test/checkout",
    provider: "stripe",
    provider_checkout_session_id: null,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    metadata: {},
    created_at: "",
    updated_at: "",
  } satisfies FiPaymentRequestRow;
  assert.equal(
    derivePublicPaymentPageState({
      paymentRequest: pr,
      invoice: inv,
      nowMs: Date.now(),
      stripeCheckoutEnabled: true,
    }),
    "payable"
  );
  assert.equal(
    derivePublicPaymentPageState({
      paymentRequest: { ...pr, checkout_url: null },
      invoice: inv,
      nowMs: Date.now(),
      stripeCheckoutEnabled: true,
    }),
    "manual_contact"
  );
});

test("isStripeWebhookDuplicateInsert", () => {
  assert.equal(isStripeWebhookDuplicateInsert({ code: "23505", message: "duplicate" }), true);
  assert.equal(isStripeWebhookDuplicateInsert({ code: "23505" }), true);
  assert.equal(isStripeWebhookDuplicateInsert({ message: "duplicate key value violates unique constraint" }), true);
  assert.equal(isStripeWebhookDuplicateInsert({ code: "22P02" }), false);
});

test("isFiStripeGatewayPaymentIntentDuplicateInsert", () => {
  assert.equal(
    isFiStripeGatewayPaymentIntentDuplicateInsert({ code: "23505" }, { provider: "stripe", paymentIntentId: "pi_1" }),
    true,
  );
  assert.equal(
    isFiStripeGatewayPaymentIntentDuplicateInsert({ message: "duplicate key" }, { provider: "Stripe", paymentIntentId: "pi_1" }),
    true,
  );
  assert.equal(
    isFiStripeGatewayPaymentIntentDuplicateInsert({ code: "23505" }, { provider: "stripe", paymentIntentId: "  " }),
    false,
  );
  assert.equal(
    isFiStripeGatewayPaymentIntentDuplicateInsert({ code: "23505" }, { provider: "manual", paymentIntentId: "pi_1" }),
    false,
  );
});
