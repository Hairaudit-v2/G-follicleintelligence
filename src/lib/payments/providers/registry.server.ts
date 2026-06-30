import "server-only";

import type { FiPaymentProvider } from "@/src/lib/payments/providers/PaymentProvider";
import { readFiPaymentProviderId } from "@/src/lib/payments/fiPaymentEnv.server";
import { createStripePaymentProvider } from "@/src/lib/payments/providers/stripe/stripePaymentProvider.server";

class ManualPaymentProvider implements FiPaymentProvider {
  readonly id = "manual";

  async createCheckoutSession(): Promise<
    import("@/src/lib/payments/providers/PaymentProvider").CheckoutSessionResult
  > {
    throw new Error(
      "Online checkout is disabled (FI_PAYMENT_PROVIDER=manual). Create a payment request without send, or enable Stripe."
    );
  }

  verifyWebhook(): Promise<unknown> {
    return Promise.reject(new Error("Webhooks are not used for manual-only provider."));
  }

  mapWebhookToPaymentEvent(): import("@/src/lib/payments/providers/PaymentProvider").MappedPaymentWebhookEvent {
    return { kind: "ignored", reason: "manual_provider" };
  }
}

export function resolvePaymentProvider(): FiPaymentProvider {
  const id = readFiPaymentProviderId();
  if (id === "stripe") return createStripePaymentProvider();
  return new ManualPaymentProvider();
}
