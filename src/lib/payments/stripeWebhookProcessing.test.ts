import assert from "node:assert/strict";
import test from "node:test";

import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { resolveStripeCheckoutCompletedWebhookUpdate } from "@/src/lib/payments/stripeWebhookProcessingCore";

const INVOICE = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  clinic_id: null,
  patient_id: null,
  lead_id: null,
  case_id: null,
  consultation_id: null,
  invoice_kind: "surgery_deposit",
  status: "awaiting_payment",
  amount_cents: 50000,
  tax_cents: 0,
  total_cents: 50000,
  amount_paid_cents: 50000,
  currency: "AUD",
  due_date: null,
  issued_at: null,
  sent_at: null,
  paid_at: null,
  remaining_balance_cents: 0,
  days_overdue: 0,
  last_reminder_sent_at: null,
  invoice_number: null,
  title: null,
  automation_hints: {},
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as FiInvoiceRow;

const CONTEXT = {
  stripeEventId: "evt_123",
  paymentIntentId: "pi_123",
  amountCents: 50000,
  currency: "AUD",
  invoiceId: INVOICE.id,
  paymentRequestId: "pr_123",
  customerEmail: "patient@example.com",
};

test("successful payment marks webhook processed", () => {
  const update = resolveStripeCheckoutCompletedWebhookUpdate({
    outcome: { status: "payment_recorded", invoice: INVOICE, paymentId: "pay_1" },
    mappedKind: "checkout_completed",
    context: CONTEXT,
  });
  assert.equal(update.processing_status, "processed");
  assert.equal(update.error_message, null);
  assert.equal(update.metadata.gateway_outcome, "payment_recorded");
  assert.equal(update.httpStatus, 200);
  assert.equal(update.responseBody.ok, true);
});

test("duplicate Stripe payment intent remains processed/idempotent", () => {
  const update = resolveStripeCheckoutCompletedWebhookUpdate({
    outcome: {
      status: "duplicate_already_recorded",
      invoice: INVOICE,
      paymentId: "pay_existing",
    },
    mappedKind: "checkout_completed",
    context: CONTEXT,
  });
  assert.equal(update.processing_status, "processed");
  assert.equal(update.metadata.gateway_outcome, "duplicate_already_recorded");
});

test("reconciliation mismatch does not mark webhook processed", () => {
  const update = resolveStripeCheckoutCompletedWebhookUpdate({
    outcome: {
      status: "reconciliation_mismatch",
      invoice: INVOICE,
      reconciliationId: "rec_1",
      varianceCents: -1,
      reason: "Amount mismatch: expected 50000¢, received 49999¢",
      expectedAmountCents: 50000,
      receivedAmountCents: 49999,
      paymentRequestId: "pr_123",
    },
    mappedKind: "checkout_completed",
    context: CONTEXT,
  });
  assert.equal(update.processing_status, "error");
  assert.equal(update.metadata.unresolved, true);
  assert.equal(update.metadata.needs_operator_review, true);
  assert.equal(update.metadata.reconciliation_id, "rec_1");
  assert.equal(update.metadata.stripe_event_id, "evt_123");
  assert.equal(update.metadata.payment_intent_id, "pi_123");
  assert.equal(update.httpStatus, 200);
  assert.equal(update.responseBody.unresolved, true);
});

test("unmatched payment request creates actionable error metadata", () => {
  const update = resolveStripeCheckoutCompletedWebhookUpdate({
    outcome: {
      status: "ignored_or_unmatched",
      reason: "payment_request_not_found",
      invoiceId: INVOICE.id,
      paymentRequestId: "pr_missing",
    },
    mappedKind: "checkout_completed",
    context: { ...CONTEXT, paymentRequestId: "pr_missing" },
  });
  assert.equal(update.processing_status, "error");
  assert.equal(update.metadata.match_reason, "payment_request_not_found");
  assert.equal(update.metadata.attempted_payment_request_id, "pr_missing");
  assert.equal(update.metadata.customer_email, "patient@example.com");
});