-- Temporary discovery + future integration webhook inbox (Timely Zapier, etc.).
-- RLS: tenant members SELECT; service_role DML (Next.js server routes / actions).

create table if not exists fi_integration_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  provider text not null,
  event_type text not null,
  route text not null,
  status text not null default 'received',
  payload jsonb not null,
  payload_hash text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint fi_integration_webhook_events_provider_check check (
    provider in ('timely', 'hubspot', 'cliniko', 'pabau', 'fresha')
  ),
  constraint fi_integration_webhook_events_status_check check (
    status in ('received', 'processed', 'error')
  )
);

comment on table fi_integration_webhook_events is
  'Inbound integration webhooks (raw JSON) for debugging and future processors; not booking/patient truth.';

create index if not exists idx_fi_integration_webhook_events_tenant_provider_created
  on fi_integration_webhook_events (tenant_id, provider, created_at desc);

create index if not exists idx_fi_integration_webhook_events_tenant_provider_event_type
  on fi_integration_webhook_events (tenant_id, provider, event_type);

create index if not exists idx_fi_integration_webhook_events_payload_hash
  on fi_integration_webhook_events (payload_hash)
  where payload_hash is not null;

alter table fi_integration_webhook_events enable row level security;

drop policy if exists fi_integration_webhook_events_select_tenant_member on fi_integration_webhook_events;
create policy fi_integration_webhook_events_select_tenant_member
  on fi_integration_webhook_events for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_integration_webhook_events.tenant_id
    )
  );

grant select on fi_integration_webhook_events to authenticated, service_role;
grant insert, update, delete on fi_integration_webhook_events to service_role;
