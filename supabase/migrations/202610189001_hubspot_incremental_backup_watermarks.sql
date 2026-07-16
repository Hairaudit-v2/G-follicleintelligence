-- FI-HUBSPOT-INCREMENTAL-BACKUP-1
-- Additive watermark + incremental run columns. Does not alter Phase O staging rows.

-- Per-dataset watermarks (notes first; future datasets use the same table).
create table if not exists public.fi_external_hubspot_backup_watermarks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  source_system text not null default 'hubspot' check (char_length(trim(source_system)) > 0),
  dataset text not null check (char_length(trim(dataset)) > 0),
  watermark_timestamp timestamptz not null,
  watermark_tiebreaker text,
  last_successful_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  last_verified_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, source_system, dataset)
);

comment on table public.fi_external_hubspot_backup_watermarks is
  'FI-HUBSPOT-INCREMENTAL-BACKUP-1: per-dataset HubSpot backup watermarks. Advance only after verified incremental success.';

create index if not exists idx_fi_external_hubspot_backup_watermarks_integration
  on public.fi_external_hubspot_backup_watermarks (integration_id, dataset);

alter table public.fi_external_hubspot_backup_watermarks enable row level security;

revoke all on table public.fi_external_hubspot_backup_watermarks from anon, authenticated;
grant all on table public.fi_external_hubspot_backup_watermarks to service_role;

-- Immutable incremental contract columns on sync runs (status/checkpoint remain mutable).
alter table public.fi_external_hubspot_sync_runs
  add column if not exists backup_run_type text
    check (backup_run_type is null or backup_run_type in ('full', 'incremental')),
  add column if not exists incremental_dataset text
    check (incremental_dataset is null or char_length(trim(incremental_dataset)) > 0),
  add column if not exists incremental_cutoff_from timestamptz,
  add column if not exists incremental_cutoff_to timestamptz,
  add column if not exists incremental_verification_state text
    check (
      incremental_verification_state is null
      or incremental_verification_state in (
        'pending',
        'passed',
        'failed',
        'skipped'
      )
    ),
  add column if not exists incremental_checkpoint jsonb not null default '{}'::jsonb;

comment on column public.fi_external_hubspot_sync_runs.backup_run_type is
  'full = historical pagination; incremental = fixed UTC cutoff range. Null = legacy full run.';
comment on column public.fi_external_hubspot_sync_runs.incremental_cutoff_from is
  'Immutable inclusive lower UTC bound for incremental runs.';
comment on column public.fi_external_hubspot_sync_runs.incremental_cutoff_to is
  'Immutable exclusive upper UTC bound for incremental runs. Never replaced with wall clock on resume.';

-- One active incremental run per tenant + integration + dataset.
create unique index if not exists uq_hubspot_incremental_active_run
  on public.fi_external_hubspot_sync_runs (tenant_id, integration_id, incremental_dataset)
  where status = 'started'
    and backup_run_type = 'incremental'
    and incremental_dataset is not null;
