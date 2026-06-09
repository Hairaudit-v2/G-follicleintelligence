-- FI OS: map `fi_staff` rows to external HR / Academy producer ids (IIOHR, etc.).
-- RLS mirrors `fi_staff`: tenant members read; mutations via service_role only.

create table if not exists fi_staff_source_ids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  staff_id uuid not null references fi_staff (id) on delete cascade,
  source_system text not null,
  source_staff_id text not null,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_source_ids_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_staff_source_ids is
  'Clinic OS: links schedulable `fi_staff` to external systems (IIOHR HR, IIOHR Academy, etc.).';

create unique index if not exists idx_fi_staff_source_ids_tenant_source_staff
  on fi_staff_source_ids (tenant_id, source_system, source_staff_id);

create unique index if not exists idx_fi_staff_source_ids_tenant_staff_source
  on fi_staff_source_ids (tenant_id, staff_id, source_system);

create index if not exists idx_fi_staff_source_ids_staff on fi_staff_source_ids (staff_id);

alter table fi_staff_source_ids enable row level security;

drop policy if exists fi_staff_source_ids_select_tenant_member on fi_staff_source_ids;
create policy fi_staff_source_ids_select_tenant_member
  on fi_staff_source_ids for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_source_ids.tenant_id
    )
  );

grant select on fi_staff_source_ids to authenticated, service_role;
grant insert, update, delete on fi_staff_source_ids to service_role;
