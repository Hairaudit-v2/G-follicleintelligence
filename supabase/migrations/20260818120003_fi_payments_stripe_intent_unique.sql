-- One succeeded Stripe PaymentIntent per tenant (idempotency for gateway webhook + app retries).
-- Fails on apply if duplicate (tenant_id, provider_payment_intent_id) rows already exist for provider = stripe.

create unique index if not exists uq_fi_payments_tenant_stripe_payment_intent
  on public.fi_payments (tenant_id, provider_payment_intent_id)
  where provider = 'stripe'
    and provider_payment_intent_id is not null;

comment on index public.uq_fi_payments_tenant_stripe_payment_intent is
  'Ensures at most one fi_payments row per Stripe PaymentIntent per tenant when provider is stripe.';
