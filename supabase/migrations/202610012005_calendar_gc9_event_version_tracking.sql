-- CalendarOS Phase GC-9 — event version tracking for bi-directional sync.

create table if not exists public.fi_calendar_event_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null default 'google',
  google_calendar_id text not null,
  external_event_id text not null,
  local_event_id uuid references public.fi_calendar_events (id) on delete set null,
  external_etag text,
  external_updated_at timestamptz,
  local_updated_at timestamptz,
  ownership_source text not null default 'google_external',
  last_synced_at timestamptz,
  version_status text not null default 'synced',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_calendar_event_versions_provider_chk check (provider in ('google')),
  constraint fi_calendar_event_versions_ownership_chk check (
    ownership_source in ('fi_system', 'google_external', 'imported_external')
  ),
  constraint fi_calendar_event_versions_status_chk check (
    version_status in ('synced', 'pending_local', 'pending_external', 'conflict')
  ),
  constraint fi_calendar_event_versions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_calendar_event_versions is
  'CalendarOS GC-9: etag/timestamp version tracking for Google Calendar bi-directional reconciliation.';

create unique index if not exists idx_fi_calendar_event_versions_external
  on public.fi_calendar_event_versions (
    tenant_id,
    provider,
    google_calendar_id,
    external_event_id
  );

create index if not exists idx_fi_calendar_event_versions_tenant_status
  on public.fi_calendar_event_versions (tenant_id, version_status, updated_at desc);

create index if not exists idx_fi_calendar_event_versions_local_event
  on public.fi_calendar_event_versions (local_event_id)
  where local_event_id is not null;

create index if not exists idx_fi_calendar_event_versions_provider_external
  on public.fi_calendar_event_versions (provider, external_event_id);

alter table public.fi_calendar_event_versions enable row level security;

drop policy if exists fi_calendar_event_versions_select_tenant_member
  on public.fi_calendar_event_versions;
create policy fi_calendar_event_versions_select_tenant_member
  on public.fi_calendar_event_versions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_event_versions.tenant_id
    )
  );

revoke all on public.fi_calendar_event_versions from public;
grant select on public.fi_calendar_event_versions to authenticated;
grant select, insert, update, delete on public.fi_calendar_event_versions to service_role;

drop trigger if exists trg_fi_calendar_event_versions_updated_at
  on public.fi_calendar_event_versions;
create trigger trg_fi_calendar_event_versions_updated_at
  before update on public.fi_calendar_event_versions
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
