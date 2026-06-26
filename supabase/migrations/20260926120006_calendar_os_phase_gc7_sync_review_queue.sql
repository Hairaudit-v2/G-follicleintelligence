-- CalendarOS Phase GC-7 — Google Calendar inbound sync review & conflict queue.

create table if not exists public.fi_calendar_sync_review_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_calendar_integrations (id) on delete cascade,
  provider text not null default 'google',
  google_calendar_id text,
  google_calendar_summary text,
  external_event_id text not null,
  event_summary text,
  event_start_at timestamptz,
  event_end_at timestamptz,
  event_location text,
  event_description text,
  event_status text,
  raw_event jsonb not null default '{}'::jsonb,
  mapped_fields jsonb not null default '{}'::jsonb,
  matched_local_event_id uuid references public.fi_calendar_events (id) on delete set null,
  matched_local_event_type text,
  conflict_type text not null,
  conflict_reason text not null,
  severity text not null default 'review',
  status text not null default 'open',
  resolution text,
  resolved_by uuid references public.fi_users (id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_calendar_sync_review_items_provider_chk check (provider in ('google')),
  constraint fi_calendar_sync_review_items_severity_chk check (severity in ('review', 'warning', 'block')),
  constraint fi_calendar_sync_review_items_status_chk check (
    status in ('open', 'ignored', 'linked', 'imported', 'dismissed', 'failed')
  ),
  constraint fi_calendar_sync_review_items_conflict_type_chk check (
    conflict_type in (
      'possible_duplicate',
      'time_overlap',
      'missing_required_fields',
      'unsupported_event_type',
      'cancelled_unmatched',
      'update_conflict',
      'permission_or_scope_warning'
    )
  ),
  constraint fi_calendar_sync_review_items_raw_event_object check (jsonb_typeof(raw_event) = 'object'),
  constraint fi_calendar_sync_review_items_mapped_fields_object check (jsonb_typeof(mapped_fields) = 'object'),
  constraint fi_calendar_sync_review_items_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_calendar_sync_review_items is
  'CalendarOS GC-7: staged inbound Google Calendar events requiring admin review before auto-sync.';

create unique index if not exists idx_fi_calendar_sync_review_items_unique_conflict
  on public.fi_calendar_sync_review_items (
    tenant_id,
    provider,
    coalesce(google_calendar_id, ''),
    external_event_id,
    conflict_type
  );

create index if not exists idx_fi_calendar_sync_review_items_tenant_status
  on public.fi_calendar_sync_review_items (tenant_id, status, created_at desc);

create index if not exists idx_fi_calendar_sync_review_items_integration
  on public.fi_calendar_sync_review_items (integration_id, status, created_at desc);

alter table public.fi_calendar_sync_review_items enable row level security;

drop policy if exists fi_calendar_sync_review_items_select_tenant_member
  on public.fi_calendar_sync_review_items;
create policy fi_calendar_sync_review_items_select_tenant_member
  on public.fi_calendar_sync_review_items for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_sync_review_items.tenant_id
    )
  );

revoke all on public.fi_calendar_sync_review_items from public;
grant select on public.fi_calendar_sync_review_items to authenticated;
grant select, insert, update, delete on public.fi_calendar_sync_review_items to service_role;

drop trigger if exists trg_fi_calendar_sync_review_items_updated_at
  on public.fi_calendar_sync_review_items;
create trigger trg_fi_calendar_sync_review_items_updated_at
  before update on public.fi_calendar_sync_review_items
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
