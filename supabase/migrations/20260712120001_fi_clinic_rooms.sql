-- Clinic rooms as first-class scheduling resources (ClinicOS).

create table if not exists fi_clinic_rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid not null references fi_clinics (id) on delete cascade,
  room_code text not null,
  display_name text not null,
  physical_room_key text not null,
  room_type text not null,
  capabilities text[] not null default '{}'::text[],
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_clinic_rooms_room_type_check check (
    room_type in ('consult', 'prp', 'surgery', 'patient', 'multi_use', 'other')
  ),
  constraint fi_clinic_rooms_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_clinic_rooms is
  'ClinicOS: bookable clinic rooms. Labels sharing physical_room_key cannot overlap in time.';

create unique index if not exists idx_fi_clinic_rooms_tenant_clinic_code
  on fi_clinic_rooms (tenant_id, clinic_id, room_code);

create unique index if not exists idx_fi_clinic_rooms_tenant_clinic_physical_key
  on fi_clinic_rooms (tenant_id, clinic_id, physical_room_key);

create index if not exists idx_fi_clinic_rooms_tenant_clinic_active
  on fi_clinic_rooms (tenant_id, clinic_id, is_active, sort_order);

alter table fi_clinic_rooms enable row level security;

drop policy if exists fi_clinic_rooms_select_tenant_member on fi_clinic_rooms;
create policy fi_clinic_rooms_select_tenant_member
  on fi_clinic_rooms for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_clinic_rooms.tenant_id
    )
  );

grant select on fi_clinic_rooms to authenticated, service_role;
grant insert, update, delete on fi_clinic_rooms to service_role;
