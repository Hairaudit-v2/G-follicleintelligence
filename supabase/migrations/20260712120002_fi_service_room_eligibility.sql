-- Which rooms may host each service.

create table if not exists fi_service_room_eligibility (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete cascade,
  service_id uuid not null references fi_services (id) on delete cascade,
  room_id uuid not null references fi_clinic_rooms (id) on delete cascade,
  is_preferred boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_service_room_eligibility_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_service_room_eligibility is
  'ClinicOS: eligible rooms per service (optional clinic scope).';

create unique index if not exists idx_fi_service_room_eligibility_unique
  on fi_service_room_eligibility (tenant_id, service_id, room_id);

create index if not exists idx_fi_service_room_eligibility_service
  on fi_service_room_eligibility (tenant_id, service_id, is_active);

alter table fi_service_room_eligibility enable row level security;

drop policy if exists fi_service_room_eligibility_select_tenant_member on fi_service_room_eligibility;
create policy fi_service_room_eligibility_select_tenant_member
  on fi_service_room_eligibility for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_service_room_eligibility.tenant_id
    )
  );

grant select on fi_service_room_eligibility to authenticated, service_role;
grant insert, update, delete on fi_service_room_eligibility to service_role;
