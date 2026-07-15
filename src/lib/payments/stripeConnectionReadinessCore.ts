export type StripeMode = "test" | "live";

export type StripeAccountSnapshot = {
  id: string;
  country?: string | null;
  default_currency?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  type?: string | null;
  capabilities?: { card_payments?: string | null } | null;
};

export type StripeConnectionConfig = {
  secretKey: string | undefined;
  expectedAccountId: string | undefined;
  expectedMode: StripeMode | undefined;
  liveModeAllowed: boolean;
};

export type StripeConnectionReadiness = {
  ok: boolean;
  mode: StripeMode | null;
  errors: string[];
};

export function detectStripeSecretKeyMode(secretKey: string | undefined): StripeMode | null {
  const key = secretKey?.trim();
  if (!key) return null;
  if (key.startsWith("sk_live_") || key.startsWith("rk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) return "test";
  return null;
}

export function evaluateStripeConnectionConfig(
  config: StripeConnectionConfig
): StripeConnectionReadiness {
  const errors: string[] = [];
  const mode = detectStripeSecretKeyMode(config.secretKey);

  if (!config.secretKey?.trim()) errors.push("STRIPE_SECRET_KEY is not configured.");
  else if (!mode) errors.push("STRIPE_SECRET_KEY has an unsupported key type or mode.");

  if (!config.expectedAccountId?.trim()) {
    errors.push("STRIPE_EXPECTED_ACCOUNT_ID is not configured.");
  } else if (!/^acct_[A-Za-z0-9]+$/.test(config.expectedAccountId.trim())) {
    errors.push("STRIPE_EXPECTED_ACCOUNT_ID is invalid.");
  }

  if (!config.expectedMode) errors.push("STRIPE_EXPECTED_MODE must be test or live.");
  if (mode && config.expectedMode && mode !== config.expectedMode) {
    errors.push(`Stripe key mode ${mode} does not match expected mode ${config.expectedMode}.`);
  }
  if (config.expectedMode === "live" && !config.liveModeAllowed) {
    errors.push("Stripe live mode is blocked until FI_STRIPE_LIVE_MODE_ALLOWED=true.");
  }

  return { ok: errors.length === 0, mode, errors };
}

export function evaluateStripeAccountBinding(
  account: StripeAccountSnapshot,
  expectedAccountId: string
): string[] {
  const errors: string[] = [];
  if (account.id !== expectedAccountId) {
    errors.push(`Stripe account mismatch: authenticated account is ${account.id}.`);
  }
  if (account.charges_enabled !== true) {
    errors.push("Stripe charges are not enabled for the authenticated account.");
  }
  const cardPayments = account.capabilities?.card_payments;
  if (cardPayments != null && cardPayments !== "active") {
    errors.push(`Stripe card_payments capability is ${cardPayments}.`);
  }
  return errors;
}

export function evaluateStripeWebhookMode(
  eventLivemode: boolean | undefined,
  expectedMode: StripeMode | undefined,
  liveModeAllowed: boolean
): string[] {
  const errors: string[] = [];
  if (typeof eventLivemode !== "boolean") {
    errors.push("Stripe webhook event is missing livemode.");
    return errors;
  }
  if (!expectedMode) {
    errors.push("STRIPE_EXPECTED_MODE must be test or live.");
    return errors;
  }
  const eventMode: StripeMode = eventLivemode ? "live" : "test";
  if (eventMode !== expectedMode) {
    errors.push(`Stripe webhook mode ${eventMode} does not match expected mode ${expectedMode}.`);
  }
  if (eventLivemode && !liveModeAllowed) {
    errors.push("Stripe live webhook processing is blocked.");
  }
  return errors;
}
