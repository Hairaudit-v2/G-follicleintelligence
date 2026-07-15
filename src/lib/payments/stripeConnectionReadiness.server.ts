import "server-only";

import {
  readStripeConnectionConfig,
  readStripeExpectedMode,
  readStripeLiveModeAllowed,
} from "@/src/lib/payments/fiPaymentEnv.server";
import {
  evaluateStripeAccountBinding,
  evaluateStripeConnectionConfig,
  evaluateStripeWebhookMode,
  type StripeAccountSnapshot,
} from "@/src/lib/payments/stripeConnectionReadinessCore";

export async function assertStripeConnectionReady(input: {
  retrieveAccount: () => Promise<StripeAccountSnapshot>;
}): Promise<StripeAccountSnapshot> {
  const config = readStripeConnectionConfig();
  const readiness = evaluateStripeConnectionConfig(config);
  if (!readiness.ok) throw new Error(readiness.errors.join(" "));

  const account = await input.retrieveAccount();
  const bindingErrors = evaluateStripeAccountBinding(account, config.expectedAccountId!.trim());
  if (bindingErrors.length) throw new Error(bindingErrors.join(" "));
  return account;
}

export function assertStripeWebhookEventMode(eventLivemode: boolean | undefined): void {
  const errors = evaluateStripeWebhookMode(
    eventLivemode,
    readStripeExpectedMode(),
    readStripeLiveModeAllowed()
  );
  if (errors.length) throw new Error(errors.join(" "));
}
