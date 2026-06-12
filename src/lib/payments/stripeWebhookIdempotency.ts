/**
 * Stripe webhook inserts into `fi_payment_webhook_events` use a unique index on (provider, provider_event_id).
 * Treat duplicate inserts as successful idempotent replays.
 */
export function isStripeWebhookDuplicateInsert(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  const m = error.message ?? "";
  return /duplicate key|unique constraint/i.test(m);
}

export const isPostgresUniqueViolation = isStripeWebhookDuplicateInsert;
