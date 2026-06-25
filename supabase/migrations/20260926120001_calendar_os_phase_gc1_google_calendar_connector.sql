-- CalendarOS Phase GC-1 — Native Google Calendar connector layer.
-- Production calendar infrastructure: encrypted OAuth tokens + FI event mirror (fi_calendar_events).
-- Complements OnboardingOS F3 staging tables; FI OS never depends on Google as sole source of truth.

-- ---------------------------------------------------------------------------
-- fi_calendar_integrations — tenant Google Calendar connections
-- ---------------------------------------------------------------------------
create table if not exists public.fi_calendar_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null default 'google',
  google_account_email text,
  calendar_id text not null,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_calendar_integrations_provider_chk check (provider in ('google')),
  constraint fi_calendar_integrations_status_chk check (
    status in ('active', 'disconnected', 'error', 'expired')
  )
);

comment on table public.fi_calendar_integrations is
  'CalendarOS GC-1: tenant Google Calendar OAuth integrations with encrypted tokens (service_role writes).';

create unique index if not exists idx_fi_calendar_integrations_tenant_calendar
  on public.fi_calendar_integrations (tenant_id, calendar_id);

create index if not exists idx_fi_calendar_integrations_tenant
  on public.fi_calendar_integrations (tenant_id, created_at desc);

create index if not exists idx_fi_calendar_integrations_status
  on public.fi_calendar_integrations (status, updated_at desc);

alter table public.fi_calendar_integrations enable row level security;

drop policy if exists fi_calendar_integrations_select_tenant_member on public.fi_calendar_integrations;
create policy fi_calendar_integrations_select_tenant_member
  on public.fi_calendar_integrations for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_integrations.tenant_id
    )
  );

revoke all on public.fi_calendar_integrations from public;
grant select on public.fi_calendar_integrations to authenticated;
grant select, insert, update, delete on public.fi_calendar_integrations to service_role;

drop trigger if exists trg_fi_calendar_integrations_updated_at on public.fi_calendar_integrations;
create trigger trg_fi_calendar_integrations_updated_at
  before update on public.fi_calendar_integrations
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_calendar_events — FI mirror of Google Calendar events (source of truth for FI OS)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  external_event_id text,
  provider text not null default 'google',
  calendar_id text not null,
  title text not null default '',
  description text,
  location text,
  start_time timestamptz,
  end_time timestamptz,
  event_type text,
  google_meet_url text,
  patient_id uuid references public.fi_patients (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_calendar_events_provider_chk check (provider in ('google')),
  constraint fi_calendar_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_calendar_events is
  'CalendarOS GC-1: FI-native calendar event mirror — created on Google write; synced on pull; never sole dependency on Google.';

create unique index if not exists idx_fi_calendar_events_external_event_id
  on public.fi_calendar_events (external_event_id)
  where external_event_id is not null;

create index if not exists idx_fi_calendar_events_tenant_calendar
  on public.fi_calendar_events (tenant_id, calendar_id);

create index if not exists idx_fi_calendar_events_tenant_start
  on public.fi_calendar_events (tenant_id, start_time);

create index if not exists idx_fi_calendar_events_patient
  on public.fi_calendar_events (tenant_id, patient_id)
  where patient_id is not null;

create index if not exists idx_fi_calendar_events_lead
  on public.fi_calendar_events (tenant_id, lead_id)
  where lead_id is not null;

create index if not exists idx_fi_calendar_events_created_at
  on public.fi_calendar_events (created_at desc);

alter table public.fi_calendar_events enable row level security;

drop policy if exists fi_calendar_events_select_tenant_member on public.fi_calendar_events;
create policy fi_calendar_events_select_tenant_member
  on public.fi_calendar_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_events.tenant_id
    )
  );

grant select on public.fi_calendar_events to authenticated, service_role;
grant insert, update, delete on public.fi_calendar_events to service_role;

drop trigger if exists trg_fi_calendar_events_updated_at on public.fi_calendar_events;
create trigger trg_fi_calendar_events_updated_at
  before update on public.fi_calendar_events
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
