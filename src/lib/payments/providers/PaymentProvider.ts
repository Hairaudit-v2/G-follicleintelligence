import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type CheckoutSessionResult = {
  sessionId: string;
  checkoutUrl: string;
  expiresAt: string | null;
  rawMetadata?: Record<string, unknown>;
};

export type WebhookVerificationInput = {
  rawBody: string | Buffer;
  signatureHeader: string | null;
};

export type MappedPaymentWebhookEvent =
  | {
      kind: "checkout_completed";
      tenantId: string;
      invoiceId: string;
      paymentRequestId: string | null;
      amountCents: number;
      currency: string;
      provider: "stripe";
      providerRef: string;
      paymentIntentId: string | null;
    }
  | {
      kind: "checkout_failed";
      tenantId: string | null;
      invoiceId: string | null;
      paymentRequestId: string | null;
      message: string;
      provider: "stripe";
    }
  | { kind: "ignored"; reason: string };

export interface FiPaymentProvider {
  readonly id: string;
  createCheckoutSession(input: {
    tenantId: string;
    invoice: FiInvoiceRow;
    paymentRequestId: string;
    amountCents: number;
    currency: string;
  }): Promise<CheckoutSessionResult>;
  verifyWebhook(input: WebhookVerificationInput): Promise<unknown>;
  mapWebhookToPaymentEvent(rawEvent: unknown): MappedPaymentWebhookEvent;
}
