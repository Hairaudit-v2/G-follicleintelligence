-- CalendarOS Phase GC-8 — Scheduled background sync, health tracking, run history, and admin alerts.

-- ---------------------------------------------------------------------------
-- fi_calendar_integrations — scheduler controls (GC-8)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- fi_calendar_sync_health — per-integration rolling health metrics
-- ---------------------------------------------------------------------------
create table if not exists public.fi_calendar_sync_health (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_calendar_integrations (id) on delete cascade,
  provider text not null default 'google',
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,
  last_successful_sync_at timestamptz,
  consecutive_failures integer not null default 0,
  total_sync_runs integer not null default 0,
  total_events_fetched integer not null default 0,
  total_events_inserted integer not null default 0,
  total_events_updated integer not null default 0,
  total_events_skipped integer not null default 0,
  total_review_items_created integer not null default 0,
  average_sync_duration_ms integer,
  health_score integer not null default 100,
  health_status text not null default 'healthy',
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_calendar_sync_health_provider_chk check (provider in ('google')),
  constraint fi_calendar_sync_health_health_status_chk check (
    health_status in ('healthy', 'degraded', 'warning', 'failing', 'paused')
  ),
  constraint fi_calendar_sync_health_health_score_chk check (
    health_score >= 0 and health_score <= 100
  ),
  constraint fi_calendar_sync_health_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_calendar_sync_health is
  'CalendarOS GC-8: rolling Google Calendar sync health metrics per integration.';

create unique index if not exists idx_fi_calendar_sync_health_integration
  on public.fi_calendar_sync_health (integration_id);

create index if not exists idx_fi_calendar_sync_health_tenant_status
  on public.fi_calendar_sync_health (tenant_id, health_status);

alter table public.fi_calendar_sync_health enable row level security;

drop policy if exists fi_calendar_sync_health_select_tenant_member on public.fi_calendar_sync_health;
create policy fi_calendar_sync_health_select_tenant_member
  on public.fi_calendar_sync_health for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_sync_health.tenant_id
    )
  );

revoke all on public.fi_calendar_sync_health from public;
grant select on public.fi_calendar_sync_health to authenticated;
grant select, insert, update, delete on public.fi_calendar_sync_health to service_role;

drop trigger if exists trg_fi_calendar_sync_health_updated_at on public.fi_calendar_sync_health;
create trigger trg_fi_calendar_sync_health_updated_at
  before update on public.fi_calendar_sync_health
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_calendar_sync_runs — per-run history (retain last 500 per tenant in app code)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_calendar_integrations (id) on delete cascade,
  provider text not null default 'google',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  calendars_scanned integer not null default 0,
  events_fetched integer not null default 0,
  events_inserted integer not null default 0,
  events_updated integer not null default 0,
  events_skipped integer not null default 0,
  conflicts_detected integer not null default 0,
  review_items_created integer not null default 0,
  failed_calendars integer not null default 0,
  status text not null default 'running',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint fi_calendar_sync_runs_provider_chk check (provider in ('google')),
  constraint fi_calendar_sync_runs_status_chk check (
    status in ('running', 'success', 'partial', 'failed', 'skipped')
  ),
  constraint fi_calendar_sync_runs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_calendar_sync_runs is
  'CalendarOS GC-8: Google Calendar sync run history for admin monitoring.';

create index if not exists idx_fi_calendar_sync_runs_tenant_started
  on public.fi_calendar_sync_runs (tenant_id, started_at desc);

create index if not exists idx_fi_calendar_sync_runs_integration_started
  on public.fi_calendar_sync_runs (integration_id, started_at desc);

alter table public.fi_calendar_sync_runs enable row level security;

drop policy if exists fi_calendar_sync_runs_select_tenant_member on public.fi_calendar_sync_runs;
create policy fi_calendar_sync_runs_select_tenant_member
  on public.fi_calendar_sync_runs for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_sync_runs.tenant_id
    )
  );

revoke all on public.fi_calendar_sync_runs from public;
grant select on public.fi_calendar_sync_runs to authenticated;
grant select, insert, update, delete on public.fi_calendar_sync_runs to service_role;

-- ---------------------------------------------------------------------------
-- fi_admin_notifications — operational alerts surfaced in FI Admin
-- ---------------------------------------------------------------------------
create table if not exists public.fi_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid references public.fi_calendar_integrations (id) on delete cascade,
  source text not null default 'google_calendar_sync',
  event_type text not null,
  severity text not null default 'warning',
  title text not null,
  message text not null,
  status text not null default 'open',
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_admin_notifications_source_chk check (
    source in ('google_calendar_sync')
  ),
  constraint fi_admin_notifications_severity_chk check (
    severity in ('info', 'warning', 'high')
  ),
  constraint fi_admin_notifications_status_chk check (
    status in ('open', 'acknowledged', 'dismissed')
  ),
  constraint fi_admin_notifications_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_admin_notifications is
  'CalendarOS GC-8: FI Admin operational notifications (Google Calendar sync alerts).';

create unique index if not exists idx_fi_admin_notifications_idempotency
  on public.fi_admin_notifications (idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_fi_admin_notifications_tenant_status
  on public.fi_admin_notifications (tenant_id, status, created_at desc);

create index if not exists idx_fi_admin_notifications_tenant_event
  on public.fi_admin_notifications (tenant_id, event_type, created_at desc);

alter table public.fi_admin_notifications enable row level security;

drop policy if exists fi_admin_notifications_select_tenant_member on public.fi_admin_notifications;
create policy fi_admin_notifications_select_tenant_member
  on public.fi_admin_notifications for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_admin_notifications.tenant_id
    )
  );

revoke all on public.fi_admin_notifications from public;
grant select on public.fi_admin_notifications to authenticated;
grant select, insert, update, delete on public.fi_admin_notifications to service_role;

drop trigger if exists trg_fi_admin_notifications_updated_at on public.fi_admin_notifications;
create trigger trg_fi_admin_notifications_updated_at
  before update on public.fi_admin_notifications
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
