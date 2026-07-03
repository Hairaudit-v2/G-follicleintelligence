-- WorkforceOS — normalized staff standard hours + roster shift source tracking.

-- ---------------------------------------------------------------------------
-- fi_staff_standard_hours
-- ---------------------------------------------------------------------------

create table if not exists fi_staff_standard_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  staff_id uuid not null references fi_staff (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete set null,
  weekday smallint not null,
  start_time time,
  end_time time,
  break_minutes integer,
  shift_label text,
  role_code text,
  is_working_day boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_standard_hours_weekday check (weekday >= 0 and weekday <= 6),
  constraint fi_staff_standard_hours_status check (status in ('active', 'archived')),
  constraint fi_staff_standard_hours_break_minutes check (
    break_minutes is null or (break_minutes >= 0 and break_minutes <= 480)
  ),
  constraint fi_staff_standard_hours_effective_range check (
    effective_to is null or effective_to >= effective_from
  ),
  constraint fi_staff_standard_hours_working_times check (
    (is_working_day = false)
    or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

comment on table fi_staff_standard_hours is
  'WorkforceOS: recurring weekly standard working pattern per staff member (Mon=0 … Sun=6).';

comment on column fi_staff_standard_hours.weekday is
  'Day of week: 0=Monday through 6=Sunday (ISO weekday minus 1).';

create index if not exists idx_fi_staff_standard_hours_tenant
  on fi_staff_standard_hours (tenant_id);

create index if not exists idx_fi_staff_standard_hours_tenant_staff
  on fi_staff_standard_hours (tenant_id, staff_id);

create index if not exists idx_fi_staff_standard_hours_tenant_staff_active
  on fi_staff_standard_hours (tenant_id, staff_id, weekday)
  where status = 'active';

create index if not exists idx_fi_staff_standard_hours_tenant_clinic
  on fi_staff_standard_hours (tenant_id, clinic_id)
  where clinic_id is not null;

alter table fi_staff_standard_hours enable row level security;

drop policy if exists fi_staff_standard_hours_select_tenant_member on fi_staff_standard_hours;
create policy fi_staff_standard_hours_select_tenant_member
  on fi_staff_standard_hours for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_standard_hours.tenant_id
    )
  );

grant select on fi_staff_standard_hours to authenticated, service_role;
grant insert, update, delete on fi_staff_standard_hours to service_role;

-- ---------------------------------------------------------------------------
-- fi_staff_shifts.shift_source
-- ---------------------------------------------------------------------------

alter table fi_staff_shifts
  add column if not exists shift_source text not null default 'manual';

alter table fi_staff_shifts
  drop constraint if exists fi_staff_shifts_shift_source;

alter table fi_staff_shifts
  add constraint fi_staff_shifts_shift_source check (
    shift_source in ('manual', 'standard_hours', 'copy_week')
  );

comment on column fi_staff_shifts.shift_source is
  'Provenance: manual adjustment, generated from standard hours, or copied from previous week.';
