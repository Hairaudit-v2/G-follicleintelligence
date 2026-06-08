-- IIOHR HR (and future producers) staff sync API audit runs.

create table if not exists fi_staff_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  source_system text not null default 'iiohr_hr',
  mode text not null,
  status text not null,
  received_rows integer not null default 0,
  created_count integer default 0,
  updated_count integer default 0,
  linked_count integer default 0,
  skipped_count integer default 0,
  warning_count integer default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint fi_staff_sync_runs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_staff_sync_runs is
  'Audit log for external HR staff sync pushes (e.g. IIOHR HR API). Written by service role; tenant members may read for admin UI.';

create index if not exists idx_fi_staff_sync_runs_tenant_source_started
  on fi_staff_sync_runs (tenant_id, source_system, started_at desc);

create index if not exists idx_fi_staff_sync_runs_status on fi_staff_sync_runs (status);

alter table fi_staff_sync_runs enable row level security;

create policy fi_staff_sync_runs_select_tenant_member
  on fi_staff_sync_runs for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_sync_runs.tenant_id
    )
  );

grant select on fi_staff_sync_runs to authenticated, service_role;
grant insert, update, delete on fi_staff_sync_runs to service_role;
