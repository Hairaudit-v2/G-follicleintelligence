-- CalendarOS Phase GC-8a — Scheduled background sync controls on fi_calendar_integrations.

alter table public.fi_calendar_integrations
  add column if not exists sync_enabled boolean not null default true,
  add column if not exists scheduled_sync_enabled boolean not null default true,
  add column if not exists sync_frequency_minutes integer not null default 15,
  add column if not exists scheduled_sync_paused_at timestamptz,
  add column if not exists scheduled_sync_paused_reason text;

alter table public.fi_calendar_integrations
  drop constraint if exists fi_calendar_integrations_sync_frequency_minutes_chk;

alter table public.fi_calendar_integrations
  add constraint fi_calendar_integrations_sync_frequency_minutes_chk check (
    sync_frequency_minutes in (5, 15, 30, 60)
  );

comment on column public.fi_calendar_integrations.sync_enabled is
  'CalendarOS GC-8: master switch for inbound Google Calendar sync (manual + scheduled).';
comment on column public.fi_calendar_integrations.scheduled_sync_enabled is
  'CalendarOS GC-8: when false, cron skips this integration; manual sync still allowed.';
comment on column public.fi_calendar_integrations.sync_frequency_minutes is
  'CalendarOS GC-8: target interval between scheduled sync runs (5, 15, 30, or 60 minutes).';
