-- FI-HUBSPOT-SECONDARY-OBJECT-BACKUP-1
-- Additive, tenant-isolated, read-only staging for HubSpot secondary objects.

alter table public.fi_external_hubspot_sync_runs
  add column if not exists secondary_checkpoints jsonb not null default '{}'::jsonb,
  add column if not exists secondary_counters jsonb not null default '{}'::jsonb,
  add column if not exists secondary_capabilities jsonb not null default '{}'::jsonb,
  add column if not exists secondary_complete boolean not null default false;

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'fi_external_hubspot_company_staging',
    'fi_external_hubspot_ticket_staging',
    'fi_external_hubspot_call_staging',
    'fi_external_hubspot_task_staging',
    'fi_external_hubspot_meeting_staging'
  ] loop
    execute format($ddl$
      create table if not exists public.%I (
        id uuid primary key default gen_random_uuid(),
        tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
        integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
        sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
        hubspot_record_id text not null check (char_length(trim(hubspot_record_id)) > 0),
        hubspot_created_at timestamptz,
        hubspot_updated_at timestamptz,
        archived boolean not null default false,
        raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
        payload_checksum text not null,
        review_status text not null default 'pending' check (review_status in ('pending','reviewed','ignored')),
        imported_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (tenant_id, integration_id, hubspot_record_id)
      )
    $ddl$, table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
    execute format('create index if not exists %I on public.%I (sync_run_id)', 'idx_' || table_name || '_run', table_name);
  end loop;
end
$migration$;

create table if not exists public.fi_external_hubspot_owner_inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_owner_id text not null check (char_length(trim(hubspot_owner_id)) > 0),
  hubspot_created_at timestamptz,
  hubspot_updated_at timestamptz,
  archived boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  payload_checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, hubspot_owner_id)
);

alter table public.fi_external_hubspot_owner_inventory enable row level security;
revoke all on public.fi_external_hubspot_owner_inventory from anon, authenticated;
grant select, insert, update, delete on public.fi_external_hubspot_owner_inventory to service_role;
create index if not exists idx_fi_external_hubspot_owner_inventory_run
  on public.fi_external_hubspot_owner_inventory (sync_run_id);

alter table public.fi_external_hubspot_association_staging
  drop constraint if exists fi_external_hubspot_association_staging_from_object_type_check,
  drop constraint if exists fi_external_hubspot_association_staging_to_object_type_check;

alter table public.fi_external_hubspot_association_staging
  add constraint fi_external_hubspot_association_staging_from_object_type_check
    check (from_object_type in ('contact','deal','company','ticket','call','task','meeting')),
  add constraint fi_external_hubspot_association_staging_to_object_type_check
    check (to_object_type in ('contact','deal','company'));

-- Rollback after application rollback: restore the original association checks,
-- drop the six staging/inventory tables, then drop the four sync-run columns.
