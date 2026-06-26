-- CalendarOS Phase GC-9 — Google Calendar webhook push subscriptions.

create table if not exists public.fi_calendar_webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_calendar_integrations (id) on delete cascade,
  provider text not null default 'google',
  google_calendar_id text not null,
  channel_id text not null,
  resource_id text,
  resource_uri text,
  sync_token text,
  expiration_at timestamptz,
  status text not null default 'active',
  last_notification_at timestamptz,
  failure_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_calendar_webhook_subscriptions_provider_chk check (provider in ('google')),
  constraint fi_calendar_webhook_subscriptions_status_chk check (
    status in ('active', 'expired', 'stopped', 'failed')
  ),
  constraint fi_calendar_webhook_subscriptions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_calendar_webhook_subscriptions is
  'CalendarOS GC-9: Google Calendar push notification channel subscriptions per tenant calendar.';

create unique index if not exists idx_fi_calendar_webhook_subscriptions_channel_id
  on public.fi_calendar_webhook_subscriptions (channel_id);

create unique index if not exists idx_fi_calendar_webhook_subscriptions_active_calendar
  on public.fi_calendar_webhook_subscriptions (tenant_id, provider, google_calendar_id)
  where status = 'active';

create index if not exists idx_fi_calendar_webhook_subscriptions_tenant_status
  on public.fi_calendar_webhook_subscriptions (tenant_id, status, expiration_at);

create index if not exists idx_fi_calendar_webhook_subscriptions_integration
  on public.fi_calendar_webhook_subscriptions (integration_id, status);

create index if not exists idx_fi_calendar_webhook_subscriptions_expiring
  on public.fi_calendar_webhook_subscriptions (status, expiration_at)
  where status = 'active';

alter table public.fi_calendar_webhook_subscriptions enable row level security;

drop policy if exists fi_calendar_webhook_subscriptions_select_tenant_member
  on public.fi_calendar_webhook_subscriptions;
create policy fi_calendar_webhook_subscriptions_select_tenant_member
  on public.fi_calendar_webhook_subscriptions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_webhook_subscriptions.tenant_id
    )
  );

revoke all on public.fi_calendar_webhook_subscriptions from public;
grant select on public.fi_calendar_webhook_subscriptions to authenticated;
grant select, insert, update, delete on public.fi_calendar_webhook_subscriptions to service_role;

drop trigger if exists trg_fi_calendar_webhook_subscriptions_updated_at
  on public.fi_calendar_webhook_subscriptions;
create trigger trg_fi_calendar_webhook_subscriptions_updated_at
  before update on public.fi_calendar_webhook_subscriptions
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

alter table public.fi_calendar_integrations
  add column if not exists realtime_sync_enabled boolean not null default false;

comment on column public.fi_calendar_integrations.realtime_sync_enabled is
  'CalendarOS GC-9: when true, FI maintains Google Calendar push webhook subscriptions for real-time sync.';
