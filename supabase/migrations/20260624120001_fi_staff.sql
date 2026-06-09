-- Evolved Hair Clinics CRM: clinical staff directory (`fi_staff`) + booking assignment.
-- Optional link to `fi_users` for login-linked clinicians; calendar assigns `fi_staff.id`.

create table if not exists fi_staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  fi_user_id uuid references fi_users (id) on delete set null,
  full_name text not null,
  staff_role text not null default 'consultant',
  email text,
  mobile text,
  default_timezone text,
  working_hours jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  calendar_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_working_hours_object check (jsonb_typeof(working_hours) = 'object')
);

comment on table fi_staff is
  'Clinic OS: schedulable staff (surgeon, consultant, nurse, etc.). Optional fi_user_id links a login row.';

create index if not exists idx_fi_staff_tenant on fi_staff (tenant_id);
create index if not exists idx_fi_staff_tenant_active on fi_staff (tenant_id, is_active);

create unique index if not exists idx_fi_staff_tenant_user_unique
  on fi_staff (tenant_id, fi_user_id)
  where fi_user_id is not null;

alter table fi_bookings
  add column if not exists assigned_staff_id uuid references fi_staff (id) on delete set null;

create index if not exists idx_fi_bookings_tenant_staff
  on fi_bookings (tenant_id, assigned_staff_id)
  where assigned_staff_id is not null;

comment on column fi_bookings.assigned_staff_id is
  'Clinic OS: primary assignee for calendar conflicts; may mirror fi_users via fi_staff.fi_user_id.';

alter table fi_staff enable row level security;

drop policy if exists fi_staff_select_tenant_member on fi_staff;
create policy fi_staff_select_tenant_member
  on fi_staff for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff.tenant_id
    )
  );

grant select on fi_staff to authenticated, service_role;
grant insert, update, delete on fi_staff to service_role;
