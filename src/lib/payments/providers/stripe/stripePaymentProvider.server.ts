import "server-only";

import type {
  FiPaymentProvider,
  MappedPaymentWebhookEvent,
  WebhookVerificationInput,
} from "@/src/lib/payments/providers/PaymentProvider";
import {
  readFiPaymentCancelUrl,
  readFiPaymentSuccessUrl,
  readStripeSecretKey,
  readStripeWebhookSecret,
} from "@/src/lib/payments/fiPaymentEnv.server";

async function loadStripe() {
  const mod = await import("stripe");
  return mod.default;
}

export function createStripePaymentProvider(): FiPaymentProvider {
  return {
    id: "stripe",

    async createCheckoutSession({ tenantId, invoice, paymentRequestId, amountCents, currency }) {
      const StripeSdk = await loadStripe();
      const secret = readStripeSecretKey();
      if (!secret) throw new Error("STRIPE_SECRET_KEY is not configured.");
      const success = readFiPaymentSuccessUrl();
      const cancel = readFiPaymentCancelUrl();
      if (!success?.trim() || !cancel?.trim()) {
        throw new Error(
          "FI_PAYMENT_SUCCESS_URL and FI_PAYMENT_CANCEL_URL are required for Stripe checkout."
        );
      }
      const stripe = new StripeSdk(secret);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: success,
        cancel_url: cancel,
        client_reference_id: paymentRequestId,
        metadata: {
          fi_tenant_id: tenantId,
          fi_invoice_id: invoice.id,
          fi_payment_request_id: paymentRequestId,
        },
        payment_intent_data: {
          metadata: {
            fi_tenant_id: tenantId,
            fi_invoice_id: invoice.id,
            fi_payment_request_id: paymentRequestId,
          },
        },
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: amountCents,
              product_data: {
                name: invoice.title?.trim() || `Invoice ${invoice.id.slice(0, 8)}`,
              },
            },
            quantity: 1,
          },
        ],
      });
      const url = session.url;
      if (!url) throw new Error("Stripe Checkout session did not return a URL.");
      return {
        sessionId: session.id,
        checkoutUrl: url,
        expiresAt:
          session.expires_at != null ? new Date(session.expires_at * 1000).toISOString() : null,
        rawMetadata: { session_id: session.id },
      };
    },

    async verifyWebhook(input: WebhookVerificationInput): Promise<unknown> {
      const whSecret = readStripeWebhookSecret();
      if (!whSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
      const sig = input.signatureHeader?.trim();
      if (!sig) throw new Error("Missing Stripe-Signature header.");
      const raw =
        typeof input.rawBody === "string" ? input.rawBody : input.rawBody.toString("utf8");
      const StripeSdk = await loadStripe();
      return StripeSdk.webhooks.constructEvent(raw, sig, whSecret);
    },

    mapWebhookToPaymentEvent(rawEvent: unknown): MappedPaymentWebhookEvent {
      const ev = rawEvent as { type?: string; data?: { object?: Record<string, unknown> } };
      if (!ev || typeof ev !== "object" || !ev.type)
        return { kind: "ignored", reason: "not_a_stripe_event" };
      if (ev.type === "checkout.session.completed") {
        const obj = ev.data?.object ?? {};
        const md = (obj.metadata as Record<string, string> | undefined) ?? {};
        const tenantId = String(md.fi_tenant_id ?? "").trim();
        const invoiceId = String(md.fi_invoice_id ?? "").trim();
        const paymentRequestId = String(md.fi_payment_request_id ?? "").trim() || null;
        if (!tenantId || !invoiceId) return { kind: "ignored", reason: "missing_metadata" };
        const amountTotal = obj.amount_total != null ? Number(obj.amount_total) : 0;
        const cur = String(obj.currency ?? "aud").toUpperCase();
        return {
          kind: "checkout_completed",
          tenantId,
          invoiceId,
          paymentRequestId,
          amountCents: amountTotal,
          currency: cur,
          provider: "stripe",
          providerRef: String(obj.id ?? ""),
          paymentIntentId: typeof obj.payment_intent === "string" ? obj.payment_intent : null,
        };
      }
      if (
        ev.type === "checkout.session.async_payment_failed" ||
        ev.type === "payment_intent.payment_failed"
      ) {
        const obj = (ev.data?.object ?? {}) as {
          metadata?: Record<string, string>;
          last_payment_error?: { message?: string };
        };
        const md = obj.metadata ?? {};
        return {
          kind: "checkout_failed",
          tenantId: md.fi_tenant_id?.trim() || null,
          invoiceId: md.fi_invoice_id?.trim() || null,
          paymentRequestId: md.fi_payment_request_id?.trim() || null,
          message: obj.last_payment_error?.message ?? ev.type,
          provider: "stripe",
        };
      }
      return { kind: "ignored", reason: ev.type };
    },
  };
}
