import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type GatewayPaymentSuccessStatus =
  | "payment_recorded"
  | "duplicate_already_recorded"
  | "reconciliation_mismatch"
  | "ignored_or_unmatched"
  | "failed";

export type GatewayPaymentSuccessOutcome =
  | {
      status: "payment_recorded";
      invoice: FiInvoiceRow;
      paymentId: string;
    }
  | {
      status: "duplicate_already_recorded";
      invoice: FiInvoiceRow;
      paymentId?: string | null;
    }
  | {
      status: "reconciliation_mismatch";
      invoice: FiInvoiceRow;
      reconciliationId: string;
      varianceCents: number;
      reason: string;
      expectedAmountCents: number;
      receivedAmountCents: number;
      paymentRequestId: string | null;
    }
  | {
      status: "ignored_or_unmatched";
      reason: string;
      invoiceId: string | null;
      paymentRequestId: string | null;
    }
  | {
      status: "failed";
      reason: string;
      invoiceId?: string | null;
      paymentRequestId?: string | null;
    };

/** Webhook may be marked processed only when payment settlement is confirmed or idempotent. */
export function isGatewayPaymentWebhookSettled(outcome: GatewayPaymentSuccessOutcome): boolean {
  return (
    outcome.status === "payment_recorded" || outcome.status === "duplicate_already_recorded"
  );
}

export type StripeWebhookUnresolvedContext = {
  stripeEventId: string | null;
  paymentIntentId: string | null;
  amountCents: number;
  currency: string;
  invoiceId: string | null;
  paymentRequestId: string | null;
  customerEmail?: string | null;
};

export function buildStripeWebhookUnresolvedMetadata(
  outcome: GatewayPaymentSuccessOutcome,
  ctx: StripeWebhookUnresolvedContext
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    gateway_outcome: outcome.status,
    stripe_event_id: ctx.stripeEventId,
    payment_intent_id: ctx.paymentIntentId,
    amount_cents: ctx.amountCents,
    currency: ctx.currency,
    invoice_id: ctx.invoiceId,
    payment_request_id: ctx.paymentRequestId,
    customer_email: ctx.customerEmail?.trim() || null,
    needs_operator_review: true,
    unresolved: true,
  };

  if (outcome.status === "reconciliation_mismatch") {
    return {
      ...base,
      reconciliation_id: outcome.reconciliationId,
      variance_cents: outcome.varianceCents,
      expected_amount_cents: outcome.expectedAmountCents,
      received_amount_cents: outcome.receivedAmountCents,
      match_reason: outcome.reason,
      attempted_payment_request_id: outcome.paymentRequestId,
    };
  }

  if (outcome.status === "ignored_or_unmatched") {
    return {
      ...base,
      match_reason: outcome.reason,
      attempted_invoice_id: outcome.invoiceId,
      attempted_payment_request_id: outcome.paymentRequestId,
    };
  }

  if (outcome.status === "failed") {
    return {
      ...base,
      match_reason: outcome.reason,
      attempted_invoice_id: outcome.invoiceId ?? ctx.invoiceId,
      attempted_payment_request_id: outcome.paymentRequestId ?? ctx.paymentRequestId,
    };
  }

  return base;
}

/** Best-effort side effects must not undo confirmed payment settlement. */
export async function swallowGatewayPaymentBestEffort(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    /* best-effort */
  }
}