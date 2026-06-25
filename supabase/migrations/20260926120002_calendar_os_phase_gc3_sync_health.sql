-- CalendarOS Phase GC-3 — Google Calendar sync health + validation tracking.
-- Extends fi_calendar_integrations with operational sync/validation metadata for cron + admin diagnostics.

alter table public.fi_calendar_integrations
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_status text not null default 'never_synced',
  add column if not exists last_sync_error text,
  add column if not exists sync_failure_count integer not null default 0,
  add column if not exists last_validated_at timestamptz,
  add column if not exists last_validation_status text,
  add column if not exists last_validation_error text;

alter table public.fi_calendar_integrations
  drop constraint if exists fi_calendar_integrations_last_sync_status_chk;

alter table public.fi_calendar_integrations
  add constraint fi_calendar_integrations_last_sync_status_chk check (
    last_sync_status in ('never_synced', 'success', 'failed')
  );

alter table public.fi_calendar_integrations
  drop constraint if exists fi_calendar_integrations_last_validation_status_chk;

alter table public.fi_calendar_integrations
  add constraint fi_calendar_integrations_last_validation_status_chk check (
    last_validation_status is null
    or last_validation_status in ('success', 'failed')
  );

create index if not exists idx_fi_calendar_integrations_tenant_status
  on public.fi_calendar_integrations (tenant_id, status);

create index if not exists idx_fi_calendar_integrations_tenant_last_synced
  on public.fi_calendar_integrations (tenant_id, last_synced_at desc nulls last);

comment on column public.fi_calendar_integrations.last_synced_at is
  'CalendarOS GC-3: timestamp of last successful or attempted sync run.';
comment on column public.fi_calendar_integrations.last_sync_status is
  'CalendarOS GC-3: never_synced | success | failed.';
comment on column public.fi_calendar_integrations.sync_failure_count is
  'CalendarOS GC-3: consecutive or cumulative sync failures (incremented on failure, reset on success).';
