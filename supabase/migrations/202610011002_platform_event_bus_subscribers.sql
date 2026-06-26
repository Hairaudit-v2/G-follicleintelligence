-- Platform Core 10xx — FI Event Bus subscribers and delivery tracking (GC-10).

create table if not exists public.fi_platform_event_subscribers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  subscriber_key text not null,
  source_module text,
  event_name text not null,
  target_module text not null,
  handler_key text not null,
  is_enabled boolean not null default true,
  retry_limit integer not null default 3,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_platform_event_subscribers_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_platform_event_subscribers_subscriber_key_nonempty check (char_length(trim(subscriber_key)) > 0),
  constraint fi_platform_event_subscribers_event_name_nonempty check (char_length(trim(event_name)) > 0),
  constraint fi_platform_event_subscribers_target_module_nonempty check (char_length(trim(target_module)) > 0),
  constraint fi_platform_event_subscribers_handler_key_nonempty check (char_length(trim(handler_key)) > 0),
  constraint fi_platform_event_subscribers_retry_limit_nonneg check (retry_limit >= 0)
);

comment on table public.fi_platform_event_subscribers is
  'FI Platform Event Bus subscriber registry — maps event names to downstream module handlers.';

create unique index if not exists idx_fi_platform_event_subscribers_key_event
  on public.fi_platform_event_subscribers (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    subscriber_key,
    event_name
  );

create index if not exists idx_fi_platform_event_subscribers_lookup
  on public.fi_platform_event_subscribers (event_name, is_enabled, source_module);

create index if not exists idx_fi_platform_event_subscribers_tenant
  on public.fi_platform_event_subscribers (tenant_id, event_name, is_enabled);

alter table public.fi_platform_event_subscribers enable row level security;

drop policy if exists fi_platform_event_subscribers_select_tenant_member
  on public.fi_platform_event_subscribers;
create policy fi_platform_event_subscribers_select_tenant_member
  on public.fi_platform_event_subscribers for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_platform_event_subscribers.tenant_id
    )
  );

revoke all on public.fi_platform_event_subscribers from public;
grant select on public.fi_platform_event_subscribers to authenticated;
grant select, insert, update, delete on public.fi_platform_event_subscribers to service_role;

drop trigger if exists trg_fi_platform_event_subscribers_updated_at
  on public.fi_platform_event_subscribers;
create trigger trg_fi_platform_event_subscribers_updated_at
  before update on public.fi_platform_event_subscribers
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_platform_event_deliveries
-- ---------------------------------------------------------------------------

create table if not exists public.fi_platform_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  event_id uuid not null references public.fi_platform_events (id) on delete cascade,
  subscriber_id uuid references public.fi_platform_event_subscribers (id) on delete set null,
  subscriber_key text not null,
  target_module text not null,
  handler_key text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_platform_event_deliveries_status_chk check (
    status in ('pending', 'processing', 'delivered', 'failed', 'skipped')
  ),
  constraint fi_platform_event_deliveries_attempt_count_nonneg check (attempt_count >= 0)
);

comment on table public.fi_platform_event_deliveries is
  'FI Platform Event Bus per-subscriber delivery attempts and retry state.';

create index if not exists idx_fi_platform_event_deliveries_tenant_status
  on public.fi_platform_event_deliveries (tenant_id, status, created_at desc);

create index if not exists idx_fi_platform_event_deliveries_event
  on public.fi_platform_event_deliveries (event_id, status);

create index if not exists idx_fi_platform_event_deliveries_pending_retry
  on public.fi_platform_event_deliveries (status, next_attempt_at)
  where status in ('pending', 'failed');

create index if not exists idx_fi_platform_event_deliveries_subscriber_key
  on public.fi_platform_event_deliveries (subscriber_key, status);

alter table public.fi_platform_event_deliveries enable row level security;

drop policy if exists fi_platform_event_deliveries_select_tenant_member
  on public.fi_platform_event_deliveries;
create policy fi_platform_event_deliveries_select_tenant_member
  on public.fi_platform_event_deliveries for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_platform_event_deliveries.tenant_id
    )
  );

revoke all on public.fi_platform_event_deliveries from public;
grant select on public.fi_platform_event_deliveries to authenticated;
grant select, insert, update, delete on public.fi_platform_event_deliveries to service_role;

drop trigger if exists trg_fi_platform_event_deliveries_updated_at
  on public.fi_platform_event_deliveries;
create trigger trg_fi_platform_event_deliveries_updated_at
  before update on public.fi_platform_event_deliveries
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
