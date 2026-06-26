-- CalendarOS Phase GC-6 — Multi-provider staff calendar links.
-- Maps external Google/Timely calendar IDs to fi_staff rows for provider-aware CalendarOS columns.

create table if not exists public.fi_staff_calendar_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff (id) on delete cascade,
  provider text not null default 'google',
  calendar_id text not null,
  calendar_label text,
  google_account_email text,
  timely_ics_url_encrypted text,
  source_system text not null default 'google_calendar',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_calendar_links_provider_chk check (provider in ('google', 'timely')),
  constraint fi_staff_calendar_links_status_chk check (status in ('active', 'inactive')),
  constraint fi_staff_calendar_links_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_calendar_links is
  'CalendarOS GC-6: maps external calendar IDs (Google/Timely) to fi_staff for CalendarOS provider columns.';

comment on column public.fi_staff_calendar_links.timely_ics_url_encrypted is
  'AES-256-GCM encrypted Timely ICS feed URL (FI_EXTERNAL_CONNECTOR_MASTER_KEY). Never expose to clients.';

create unique index if not exists idx_fi_staff_calendar_links_tenant_provider_calendar
  on public.fi_staff_calendar_links (tenant_id, provider, calendar_id);

create index if not exists idx_fi_staff_calendar_links_tenant_staff
  on public.fi_staff_calendar_links (tenant_id, staff_member_id);

create index if not exists idx_fi_staff_calendar_links_tenant_calendar
  on public.fi_staff_calendar_links (tenant_id, calendar_id);

create index if not exists idx_fi_staff_calendar_links_tenant_provider_calendar_lookup
  on public.fi_staff_calendar_links (tenant_id, provider, calendar_id)
  where status = 'active';

alter table public.fi_staff_calendar_links enable row level security;

drop policy if exists fi_staff_calendar_links_select_tenant_member on public.fi_staff_calendar_links;
create policy fi_staff_calendar_links_select_tenant_member
  on public.fi_staff_calendar_links for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_calendar_links.tenant_id
    )
  );

revoke all on public.fi_staff_calendar_links from public;
grant select on public.fi_staff_calendar_links to authenticated;
grant select, insert, update, delete on public.fi_staff_calendar_links to service_role;

drop trigger if exists trg_fi_staff_calendar_links_updated_at on public.fi_staff_calendar_links;
create trigger trg_fi_staff_calendar_links_updated_at
  before update on public.fi_staff_calendar_links
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
