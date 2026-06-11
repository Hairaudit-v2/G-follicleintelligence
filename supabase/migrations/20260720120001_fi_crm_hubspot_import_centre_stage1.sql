-- FI OS CRM Import Centre — Stage 1 (HubSpot contacts → persons / patients / leads).
-- Staging + batch tracking; server uses service_role only for writes.

-- ---------------------------------------------------------------------------
-- fi_import_batches
-- ---------------------------------------------------------------------------
create table if not exists fi_import_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  source_system text not null default 'hubspot',
  kind text not null default 'crm_hubspot_contacts_stage1',
  status text not null default 'uploaded',
  dry_run_passed boolean not null default false,
  dry_run_at timestamptz,
  dry_run_report jsonb not null default '{}'::jsonb,
  imported_at timestamptz,
  rolled_back_at timestamptz,
  row_count int not null default 0,
  imported_row_count int not null default 0,
  created_by_fi_user_id uuid references fi_users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_import_batches_status_check check (
    status in (
      'uploaded',
      'dry_run_passed',
      'dry_run_failed',
      'importing',
      'import_completed',
      'import_failed',
      'rolled_back'
    )
  ),
  constraint fi_import_batches_report_object check (jsonb_typeof(dry_run_report) = 'object'),
  constraint fi_import_batches_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_import_batches is
  'CRM Import Centre: tracks HubSpot (and future) import batches, dry-run results, and completion.';

create index if not exists idx_fi_import_batches_tenant_created
  on fi_import_batches (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- stg_hubspot_contacts_imports
-- ---------------------------------------------------------------------------
create table if not exists stg_hubspot_contacts_imports (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references fi_import_batches (id) on delete cascade,
  row_index int not null,
  record_id text,
  first_name text,
  last_name text,
  email text,
  phone_number text,
  contact_owner text,
  lead_status text,
  create_date text,
  last_modified_date text,
  contact_type text,
  lifecycle_stage text,
  lead_source text,
  stage_of_journey text,
  next_appointment_date text,
  associated_deal text,
  associated_company text,
  associated_deal_ids text,
  created_at timestamptz not null default now(),
  constraint stg_hubspot_contacts_row_index_positive check (row_index >= 0),
  constraint stg_hubspot_contacts_batch_row_unique unique (import_batch_id, row_index)
);

comment on table stg_hubspot_contacts_imports is
  'CRM Import Centre Stage 1: raw HubSpot contact CSV rows keyed by import_batch_id.';

create index if not exists idx_stg_hubspot_contacts_batch
  on stg_hubspot_contacts_imports (import_batch_id, row_index);

-- ---------------------------------------------------------------------------
-- updated_at on fi_import_batches
-- ---------------------------------------------------------------------------
create or replace function fi_import_batches_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_import_batches_set_updated_at on fi_import_batches;
create trigger trg_fi_import_batches_set_updated_at
  before update on fi_import_batches
  for each row
  execute procedure fi_import_batches_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: no tenant-member policies — access via service_role server actions only.
-- ---------------------------------------------------------------------------
alter table fi_import_batches enable row level security;
alter table stg_hubspot_contacts_imports enable row level security;

revoke all on fi_import_batches from anon;
revoke all on stg_hubspot_contacts_imports from anon;
revoke all on fi_import_batches from authenticated;
revoke all on stg_hubspot_contacts_imports from authenticated;

grant select, insert, update, delete on fi_import_batches to service_role;
grant select, insert, update, delete on stg_hubspot_contacts_imports to service_role;
