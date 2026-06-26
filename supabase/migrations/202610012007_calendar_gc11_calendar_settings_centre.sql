-- GC-11: Per-tenant / per-clinic calendar display settings (visible hours, slots, defaults).

create table if not exists fi_calendar_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete cascade,
  day_start_hour smallint not null default 6,
  day_end_hour smallint not null default 19,
  slot_minutes smallint not null default 15,
  default_view text not null default 'week',
  show_weekends boolean not null default false,
  buffer_minutes smallint not null default 15,
  resource_column_mode text not null default 'staff',
  show_cancelled_bookings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_cal_settings_day_start_chk check (day_start_hour >= 0 and day_start_hour <= 23),
  constraint fi_cal_settings_day_end_chk check (day_end_hour >= 1 and day_end_hour <= 24),
  constraint fi_cal_settings_day_range_chk check (day_end_hour > day_start_hour),
  constraint fi_cal_settings_slot_minutes_chk check (slot_minutes in (15, 30, 60)),
  constraint fi_cal_settings_default_view_chk check (
    default_view in ('day', '3day', 'week', 'month')
  ),
  constraint fi_cal_settings_buffer_chk check (buffer_minutes >= 0 and buffer_minutes <= 120),
  constraint fi_cal_settings_resource_mode_chk check (
    resource_column_mode in ('staff', 'room', 'clinic')
  )
);

comment on table fi_calendar_settings is
  'Calendar grid display settings. clinic_id null = tenant default; optional per-clinic override.';

create index if not exists idx_fi_cal_settings_tenant on fi_calendar_settings (tenant_id);
create index if not exists idx_fi_cal_settings_tenant_clinic on fi_calendar_settings (tenant_id, clinic_id);

create unique index if not exists idx_fi_cal_settings_tenant_default_unique
  on fi_calendar_settings (tenant_id)
  where clinic_id is null;

create unique index if not exists idx_fi_cal_settings_tenant_clinic_unique
  on fi_calendar_settings (tenant_id, clinic_id)
  where clinic_id is not null;

drop trigger if exists trg_fi_calendar_settings_updated_at on fi_calendar_settings;
create trigger trg_fi_calendar_settings_updated_at
  before update on fi_calendar_settings
  for each row execute function fi_onboarding_os_set_updated_at();

alter table fi_calendar_settings enable row level security;

drop policy if exists fi_calendar_settings_select_tenant_member on fi_calendar_settings;
create policy fi_calendar_settings_select_tenant_member
  on fi_calendar_settings for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_settings.tenant_id
    )
  );

grant select on fi_calendar_settings to authenticated, service_role;
grant insert, update, delete on fi_calendar_settings to service_role;
