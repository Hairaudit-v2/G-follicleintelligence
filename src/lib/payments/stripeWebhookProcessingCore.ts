import {
  buildStripeWebhookUnresolvedMetadata,
  isGatewayPaymentWebhookSettled,
  type GatewayPaymentSuccessOutcome,
  type StripeWebhookUnresolvedContext,
} from "@/src/lib/payments/gatewayPaymentSuccessCore";

export type StripeWebhookRowUpdate = {
  processing_status: "processed" | "error";
  error_message: string | null;
  metadata: Record<string, unknown>;
  /** HTTP status returned to Stripe after persisting webhook row state. */
  httpStatus: number;
  responseBody: Record<string, unknown>;
};

export function resolveStripeCheckoutCompletedWebhookUpdate(input: {
  outcome: GatewayPaymentSuccessOutcome;
  context: StripeWebhookUnresolvedContext;
  mappedKind: string;
}): StripeWebhookRowUpdate {
  if (isGatewayPaymentWebhookSettled(input.outcome)) {
    return {
      processing_status: "processed",
      error_message: null,
      metadata: {
        mapped_kind: input.mappedKind,
        gateway_outcome: input.outcome.status,
        payment_id:
          input.outcome.status === "payment_recorded"
            ? input.outcome.paymentId
            : input.outcome.status === "duplicate_already_recorded"
              ? (input.outcome.paymentId ?? null)
              : null,
      },
      httpStatus: 200,
      responseBody: { ok: true, gateway_outcome: input.outcome.status },
    };
  }

  const errorMessage =
    input.outcome.status === "failed"
      ? input.outcome.reason
      : input.outcome.status === "reconciliation_mismatch"
        ? input.outcome.reason
        : input.outcome.status === "ignored_or_unmatched"
          ? input.outcome.reason
          : "gateway_payment_unresolved";

  return {
    processing_status: "error",
    error_message: errorMessage,
    metadata: {
      mapped_kind: input.mappedKind,
      ...buildStripeWebhookUnresolvedMetadata(input.outcome, input.context),
    },
    // 200: persist actionable error on fi_payment_webhook_events — avoid Stripe retry storms
    // while keeping the row visibly unresolved for operator replay/reconciliation.
    httpStatus: 200,
    responseBody: {
      ok: false,
      unresolved: true,
      gateway_outcome: input.outcome.status,
      error: errorMessage,
    },
  };
}
