-- CalendarOS Phase GC-9 — reconciliation audit log and GC-9 alert event types.

create table if not exists public.fi_calendar_reconciliation_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid references public.fi_calendar_integrations (id) on delete set null,
  provider text not null default 'google',
  google_calendar_id text,
  external_event_id text,
  local_event_id uuid references public.fi_calendar_events (id) on delete set null,
  decision text not null,
  conflict_type text,
  ownership_source text,
  external_etag text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_calendar_reconciliation_logs_provider_chk check (provider in ('google')),
  constraint fi_calendar_reconciliation_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_calendar_reconciliation_logs is
  'CalendarOS GC-9: audit trail for Google Calendar bi-directional reconciliation decisions.';

create index if not exists idx_fi_calendar_reconciliation_logs_tenant_created
  on public.fi_calendar_reconciliation_logs (tenant_id, created_at desc);

create index if not exists idx_fi_calendar_reconciliation_logs_external
  on public.fi_calendar_reconciliation_logs (tenant_id, external_event_id, created_at desc)
  where external_event_id is not null;

alter table public.fi_calendar_reconciliation_logs enable row level security;

drop policy if exists fi_calendar_reconciliation_logs_select_tenant_member
  on public.fi_calendar_reconciliation_logs;
create policy fi_calendar_reconciliation_logs_select_tenant_member
  on public.fi_calendar_reconciliation_logs for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_reconciliation_logs.tenant_id
    )
  );

revoke all on public.fi_calendar_reconciliation_logs from public;
grant select on public.fi_calendar_reconciliation_logs to authenticated;
grant select, insert, update, delete on public.fi_calendar_reconciliation_logs to service_role;

-- Extend admin notification source constraint for GC-9 webhook alerts.
alter table public.fi_admin_notifications
  drop constraint if exists fi_admin_notifications_source_chk;

alter table public.fi_admin_notifications
  add constraint fi_admin_notifications_source_chk check (
    source in ('google_calendar_sync', 'google_calendar_webhook')
  );
