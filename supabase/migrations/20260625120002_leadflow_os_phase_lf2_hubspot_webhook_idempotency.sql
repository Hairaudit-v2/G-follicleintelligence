-- LeadFlowOS Phase LF-2 — HubSpot webhook ingest idempotency (additive).
-- Allows repeated fi_external_events rows for the same HubSpot contact/deal object (external_id).
-- Idempotency is keyed by provider_event_id (HubSpot eventId or deterministic payload fingerprint).

drop index if exists public.idx_fi_external_events_idempotency;

alter table public.fi_external_events
  add column if not exists provider_event_id text;

comment on column public.fi_external_events.external_id is
  'Provider object id (e.g. HubSpot contact/deal hs_object_id). Not unique — same object may emit many events.';

comment on column public.fi_external_events.provider_event_id is
  'Unique delivery id per provider webhook (HubSpot eventId or computed fingerprint). Used for ingest idempotency.';

create index if not exists idx_fi_external_events_external_object
  on public.fi_external_events (tenant_id, provider, external_id, created_at desc)
  where external_id is not null and external_id <> '';

create unique index if not exists idx_fi_external_events_provider_event_idempotency
  on public.fi_external_events (tenant_id, provider, provider_event_id)
  where provider_event_id is not null and provider_event_id <> '';
