-- Platform Core 10xx — FI Event Bus foundation (GC-10).

create table if not exists public.fi_platform_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  event_name text not null,
  event_version integer not null default 1,
  source_module text not null,
  entity_type text,
  entity_id uuid,
  actor_id uuid,
  correlation_id uuid,
  causation_id uuid,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  processing_status text not null default 'pending',
  failure_count integer not null default 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fi_platform_events_processing_status_chk check (
    processing_status in ('pending', 'processing', 'processed', 'failed', 'ignored')
  ),
  constraint fi_platform_events_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint fi_platform_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_platform_events_event_name_nonempty check (char_length(trim(event_name)) > 0),
  constraint fi_platform_events_source_module_nonempty check (char_length(trim(source_module)) > 0)
);

comment on table public.fi_platform_events is
  'FI Platform Event Bus — durable operational events emitted by OS modules (CalendarOS first consumer).';

create index if not exists idx_fi_platform_events_tenant_occurred
  on public.fi_platform_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_platform_events_tenant_event_name
  on public.fi_platform_events (tenant_id, event_name, occurred_at desc);

create index if not exists idx_fi_platform_events_processing_status
  on public.fi_platform_events (processing_status, created_at asc);

create index if not exists idx_fi_platform_events_occurred_at
  on public.fi_platform_events (occurred_at desc);

create unique index if not exists idx_fi_platform_events_idempotency
  on public.fi_platform_events (tenant_id, event_name, (metadata ->> 'idempotencyKey'))
  where (metadata ->> 'idempotencyKey') is not null
    and char_length(trim(metadata ->> 'idempotencyKey')) > 0;

alter table public.fi_platform_events enable row level security;

drop policy if exists fi_platform_events_select_tenant_member on public.fi_platform_events;
create policy fi_platform_events_select_tenant_member
  on public.fi_platform_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_platform_events.tenant_id
    )
  );

revoke all on public.fi_platform_events from public;
grant select on public.fi_platform_events to authenticated;
grant select, insert, update, delete on public.fi_platform_events to service_role;
