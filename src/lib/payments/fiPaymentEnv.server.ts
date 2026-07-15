import "server-only";

import type {
  StripeConnectionConfig,
  StripeMode,
} from "@/src/lib/payments/stripeConnectionReadinessCore";

function truthyEnv(v: string | undefined): boolean {
  const s = v?.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function readFiPaymentsEnabled(): boolean {
  return truthyEnv(process.env.FI_PAYMENTS_ENABLED);
}

export function readFiPaymentProviderId(): string {
  return (process.env.FI_PAYMENT_PROVIDER ?? "manual").trim().toLowerCase() || "manual";
}

export function readStripeSecretKey(): string | undefined {
  const k = process.env.STRIPE_SECRET_KEY?.trim();
  return k || undefined;
}

export function readStripeWebhookSecret(): string | undefined {
  const k = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return k || undefined;
}

export function readStripeExpectedAccountId(): string | undefined {
  const id = process.env.STRIPE_EXPECTED_ACCOUNT_ID?.trim();
  return id || undefined;
}

export function readStripeExpectedMode(): StripeMode | undefined {
  const mode = process.env.STRIPE_EXPECTED_MODE?.trim().toLowerCase();
  return mode === "test" || mode === "live" ? mode : undefined;
}

export function readStripeLiveModeAllowed(): boolean {
  return truthyEnv(process.env.FI_STRIPE_LIVE_MODE_ALLOWED);
}

export function readStripeConnectionConfig(): StripeConnectionConfig {
  return {
    secretKey: readStripeSecretKey(),
    expectedAccountId: readStripeExpectedAccountId(),
    expectedMode: readStripeExpectedMode(),
    liveModeAllowed: readStripeLiveModeAllowed(),
  };
}

export function readFiPaymentSuccessUrl(): string | undefined {
  const u = process.env.FI_PAYMENT_SUCCESS_URL?.trim();
  return u || undefined;
}

export function readFiPaymentCancelUrl(): string | undefined {
  const u = process.env.FI_PAYMENT_CANCEL_URL?.trim();
  return u || undefined;
}

/** Default suggested expiry window for payment links (informational; Stripe session has its own TTL). */
export function readFiPaymentRequestDefaultExpiryDays(): number {
  const n = Number(process.env.FI_PAYMENT_REQUEST_EXPIRY_DAYS ?? "14");
  if (!Number.isFinite(n) || n < 1 || n > 365) return 14;
  return Math.floor(n);
}
