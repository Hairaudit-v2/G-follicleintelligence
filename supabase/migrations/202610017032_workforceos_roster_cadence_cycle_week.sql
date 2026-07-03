-- WorkforceOS — roster cadence support: fortnightly cycle_week on standard hours.

alter table fi_staff_standard_hours
  add column if not exists cycle_week smallint not null default 1;

comment on column fi_staff_standard_hours.cycle_week is
  'Fortnightly roster cycle: 1=Week A, 2=Week B. Weekly and monthly patterns use 1.';

alter table fi_staff_standard_hours
  drop constraint if exists fi_staff_standard_hours_cycle_week;

alter table fi_staff_standard_hours
  add constraint fi_staff_standard_hours_cycle_week
  check (cycle_week >= 1 and cycle_week <= 2);

create index if not exists idx_fi_staff_standard_hours_tenant_staff_cycle
  on fi_staff_standard_hours (tenant_id, staff_id, cycle_week, weekday)
  where status = 'active';
