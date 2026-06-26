-- CalendarOS Phase GC-8c — FI Admin operational alerts for Google Calendar sync failures.

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
