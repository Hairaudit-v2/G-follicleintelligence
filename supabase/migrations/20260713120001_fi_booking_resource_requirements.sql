-- SurgeryOS: service-defined resource requirements and per-booking extra staff/room assignments.

create table if not exists fi_service_resource_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  service_id uuid not null references fi_services (id) on delete cascade,
  resource_type text not null,
  resource_key text not null,
  requirement_label text not null,
  is_required boolean not null default true,
  quantity int not null default 1,
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_service_resource_requirements_resource_type_check check (
    resource_type in ('staff_role', 'staff_member', 'room_type', 'room_id')
  ),
  constraint fi_service_resource_requirements_quantity_positive check (quantity > 0 and quantity <= 20),
  constraint fi_service_resource_requirements_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_service_resource_requirements_rule_unique unique (
    tenant_id,
    service_id,
    resource_type,
    resource_key,
    requirement_label
  )
);

comment on table fi_service_resource_requirements is
  'SurgeryOS: catalog rules for which staff roles, staff members, room types, or specific rooms a service needs.';

create index if not exists idx_fi_service_resource_requirements_service
  on fi_service_resource_requirements (tenant_id, service_id, sort_order);

alter table fi_service_resource_requirements enable row level security;

drop policy if exists fi_service_resource_requirements_select_tenant_member on fi_service_resource_requirements;
create policy fi_service_resource_requirements_select_tenant_member
  on fi_service_resource_requirements for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_service_resource_requirements.tenant_id
    )
  );

grant select on fi_service_resource_requirements to authenticated, service_role;
grant insert, update, delete on fi_service_resource_requirements to service_role;

-- ---------------------------------------------------------------------------
-- Booking assignments: supporting staff and additional rooms (primary stays on fi_bookings).
-- ---------------------------------------------------------------------------

create table if not exists fi_booking_resource_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  booking_id uuid not null references fi_bookings (id) on delete cascade,
  resource_type text not null,
  resource_id uuid not null,
  role_label text,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_booking_resource_assignments_resource_type_check check (resource_type in ('staff', 'room')),
  constraint fi_booking_resource_assignments_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_booking_resource_assignments is
  'Extra staff and rooms for a booking; primary room and provider remain on fi_bookings.';

create index if not exists idx_fi_booking_resource_assignments_booking
  on fi_booking_resource_assignments (tenant_id, booking_id);

create index if not exists idx_fi_booking_resource_assignments_staff
  on fi_booking_resource_assignments (tenant_id, resource_id)
  where resource_type = 'staff';

create index if not exists idx_fi_booking_resource_assignments_room
  on fi_booking_resource_assignments (tenant_id, resource_id)
  where resource_type = 'room';

create unique index if not exists idx_fi_booking_resource_assignments_unique
  on fi_booking_resource_assignments (tenant_id, booking_id, resource_type, resource_id);

alter table fi_booking_resource_assignments enable row level security;

drop policy if exists fi_booking_resource_assignments_select_tenant_member on fi_booking_resource_assignments;
create policy fi_booking_resource_assignments_select_tenant_member
  on fi_booking_resource_assignments for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_booking_resource_assignments.tenant_id
    )
  );

grant select on fi_booking_resource_assignments to authenticated, service_role;
grant insert, update, delete on fi_booking_resource_assignments to service_role;

-- ---------------------------------------------------------------------------
-- Seed Evolved Perth service requirements (by tenant slug + fi_services.booking_type).
-- ---------------------------------------------------------------------------

do $$
declare
  v_tenant_id uuid;
  v_now timestamptz := now();
  r record;
begin
  select id into v_tenant_id from fi_tenants where slug = 'evolved' limit 1;
  if v_tenant_id is null then
    return;
  end if;

  for r in
    select id, booking_type
    from fi_services
    where tenant_id = v_tenant_id
      and booking_type is not null
      and is_active = true
  loop
    if r.booking_type = 'surgery' then
      insert into fi_service_resource_requirements (
        tenant_id, service_id, resource_type, resource_key, requirement_label, is_required, quantity, sort_order, metadata, created_at, updated_at
      ) values
        (v_tenant_id, r.id, 'room_type', 'surgery', 'Surgery room', true, 1, 10, '{}'::jsonb, v_now, v_now),
        (v_tenant_id, r.id, 'staff_role', 'surgeon|doctor', 'Surgeon', true, 1, 20, '{}'::jsonb, v_now, v_now),
        (v_tenant_id, r.id, 'staff_role', 'nurse', 'Nurse', true, 1, 30, '{}'::jsonb, v_now, v_now),
        (v_tenant_id, r.id, 'staff_role', 'technician', 'Technician', true, 1, 40, '{}'::jsonb, v_now, v_now),
        (v_tenant_id, r.id, 'room_type', 'patient', 'Patient room', false, 1, 50, '{}'::jsonb, v_now, v_now)
      on conflict on constraint fi_service_resource_requirements_rule_unique do nothing;
    elsif r.booking_type in ('prp', 'exosomes', 'prf', 'mesotherapy') then
      insert into fi_service_resource_requirements (
        tenant_id, service_id, resource_type, resource_key, requirement_label, is_required, quantity, sort_order, metadata, created_at, updated_at
      ) values
        (v_tenant_id, r.id, 'room_type', 'prp', 'PRP / procedure room', true, 1, 10, '{}'::jsonb, v_now, v_now),
        (v_tenant_id, r.id, 'staff_role', 'nurse|doctor', 'Nurse or doctor', true, 1, 20, '{}'::jsonb, v_now, v_now)
      on conflict on constraint fi_service_resource_requirements_rule_unique do nothing;
    elsif r.booking_type = 'consultation' then
      insert into fi_service_resource_requirements (
        tenant_id, service_id, resource_type, resource_key, requirement_label, is_required, quantity, sort_order, metadata, created_at, updated_at
      ) values
        (v_tenant_id, r.id, 'room_type', 'consult', 'Consult room', true, 1, 10, '{}'::jsonb, v_now, v_now),
        (v_tenant_id, r.id, 'staff_role', 'consultant|trichologist|doctor', 'Consultant', true, 1, 20, '{}'::jsonb, v_now, v_now)
      on conflict on constraint fi_service_resource_requirements_rule_unique do nothing;
    end if;
  end loop;
end $$;
