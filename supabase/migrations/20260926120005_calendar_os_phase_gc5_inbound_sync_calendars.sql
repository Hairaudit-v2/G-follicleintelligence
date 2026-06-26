-- CalendarOS Phase GC-5 — Multi-calendar inbound Google Calendar sync scopes.

create table if not exists public.fi_calendar_inbound_sync_calendars (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_calendar_integrations (id) on delete cascade,
  provider text not null default 'google',
  google_calendar_id text not null,
  google_calendar_summary text,
  is_enabled boolean not null default true,
  is_primary boolean not null default false,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_calendar_inbound_sync_calendars_provider_chk check (provider in ('google')),
  constraint fi_calendar_inbound_sync_calendars_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_calendar_inbound_sync_calendars is
  'CalendarOS GC-5: per-integration inbound Google calendar scopes for multi-calendar sync.';

create unique index if not exists idx_fi_calendar_inbound_sync_calendars_integration_calendar
  on public.fi_calendar_inbound_sync_calendars (integration_id, google_calendar_id);

create index if not exists idx_fi_calendar_inbound_sync_calendars_tenant_integration
  on public.fi_calendar_inbound_sync_calendars (tenant_id, integration_id)
  where is_enabled = true;

alter table public.fi_calendar_inbound_sync_calendars enable row level security;

drop policy if exists fi_calendar_inbound_sync_calendars_select_tenant_member
  on public.fi_calendar_inbound_sync_calendars;
create policy fi_calendar_inbound_sync_calendars_select_tenant_member
  on public.fi_calendar_inbound_sync_calendars for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_inbound_sync_calendars.tenant_id
    )
  );

revoke all on public.fi_calendar_inbound_sync_calendars from public;
grant select on public.fi_calendar_inbound_sync_calendars to authenticated;
grant select, insert, update, delete on public.fi_calendar_inbound_sync_calendars to service_role;

drop trigger if exists trg_fi_calendar_inbound_sync_calendars_updated_at
  on public.fi_calendar_inbound_sync_calendars;
create trigger trg_fi_calendar_inbound_sync_calendars_updated_at
  before update on public.fi_calendar_inbound_sync_calendars
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
