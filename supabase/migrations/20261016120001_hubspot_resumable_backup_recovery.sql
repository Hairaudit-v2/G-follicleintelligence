-- FI-HUBSPOT-LIVE-CREDENTIAL-AND-SYNC-RECOVERY-1
-- Additive, read-only HubSpot backup state. Rollback is documented at the end.

alter table public.fi_external_hubspot_sync_runs
  add column if not exists contacts_checkpoint jsonb not null default '{"active":null,"archived":null,"phase":"active"}'::jsonb,
  add column if not exists deals_checkpoint jsonb not null default '{"active":null,"archived":null,"phase":"active"}'::jsonb,
  add column if not exists contacts_complete boolean not null default false,
  add column if not exists deals_complete boolean not null default false,
  add column if not exists contacts_archived integer not null default 0,
  add column if not exists deals_archived integer not null default 0,
  add column if not exists contacts_duplicates integer not null default 0,
  add column if not exists deals_duplicates integer not null default 0,
  add column if not exists contacts_failed integer not null default 0,
  add column if not exists deals_failed integer not null default 0,
  add column if not exists association_count integer not null default 0,
  add column if not exists last_checkpoint_at timestamptz;

alter table public.fi_external_hubspot_contact_staging
  add column if not exists hubspot_created_at timestamptz,
  add column if not exists hubspot_updated_at timestamptz,
  add column if not exists archived boolean not null default false,
  add column if not exists payload_checksum text;

alter table public.fi_external_hubspot_deal_staging
  add column if not exists hubspot_created_at timestamptz,
  add column if not exists hubspot_updated_at timestamptz,
  add column if not exists archived boolean not null default false,
  add column if not exists payload_checksum text;

create unique index if not exists uq_hubspot_contact_staging_tenant_integration_record
  on public.fi_external_hubspot_contact_staging (tenant_id, integration_id, hubspot_contact_id);

create unique index if not exists uq_hubspot_deal_staging_tenant_integration_record
  on public.fi_external_hubspot_deal_staging (tenant_id, integration_id, hubspot_deal_id);

create table if not exists public.fi_external_hubspot_association_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  from_object_type text not null check (from_object_type in ('contact','deal')),
  from_hubspot_id text not null check (char_length(trim(from_hubspot_id)) > 0),
  to_object_type text not null check (to_object_type in ('contact','deal','company')),
  to_hubspot_id text not null check (char_length(trim(to_hubspot_id)) > 0),
  association_types jsonb not null default '[]'::jsonb check (jsonb_typeof(association_types) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, from_object_type, from_hubspot_id, to_object_type, to_hubspot_id)
);

alter table public.fi_external_hubspot_association_staging enable row level security;
revoke all on public.fi_external_hubspot_association_staging from anon, authenticated;
grant select, insert, update, delete on public.fi_external_hubspot_association_staging to service_role;

create index if not exists idx_hubspot_association_staging_run
  on public.fi_external_hubspot_association_staging (sync_run_id);

create index if not exists idx_hubspot_association_staging_from
  on public.fi_external_hubspot_association_staging
  (tenant_id, integration_id, from_object_type, from_hubspot_id);

-- Reversal (only after the new application code is rolled back):
-- drop table public.fi_external_hubspot_association_staging;
-- drop index public.uq_hubspot_contact_staging_tenant_integration_record;
-- drop index public.uq_hubspot_deal_staging_tenant_integration_record;
-- alter table ... drop the additive columns above. Preserve evidence before dropping.
