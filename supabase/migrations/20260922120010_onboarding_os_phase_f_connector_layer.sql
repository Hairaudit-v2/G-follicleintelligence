-- OnboardingOS Phase F1 — Legacy System Connector Layer foundation.
-- Architecture only: no live OAuth, webhooks, or external API sync yet.
-- RLS: tenant members may read integration metadata, sync status, mappings, and sync events;
-- credentials are service_role only (encrypted at rest by app).

-- ---------------------------------------------------------------------------
-- fi_tenant_external_integrations — tenant connector registrations
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_external_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null,
  category text not null,
  display_name text not null,
  status text not null default 'draft',
  sync_mode text not null default 'manual',
  config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_external_integrations_provider_chk check (
    provider in (
      'pabau',
      'cliniko',
      'hubspot',
      'google_calendar',
      'microsoft_outlook',
      'stripe',
      'xero',
      'meta_ads',
      'google_ads'
    )
  ),
  constraint fi_tenant_external_integrations_category_chk check (
    category in ('crm', 'calendar', 'finance', 'marketing')
  ),
  constraint fi_tenant_external_integrations_status_chk check (
    status in ('draft', 'configured', 'active', 'paused', 'error', 'disconnected')
  ),
  constraint fi_tenant_external_integrations_sync_mode_chk check (
    sync_mode in ('manual', 'scheduled', 'webhook', 'disabled')
  ),
  constraint fi_tenant_external_integrations_config_object check (jsonb_typeof(config) = 'object'),
  constraint fi_tenant_external_integrations_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_external_integrations is
  'OnboardingOS Phase F1: tenant external system connector registrations (architecture foundation).';

create unique index if not exists idx_fi_tenant_external_integrations_tenant_provider
  on public.fi_tenant_external_integrations (tenant_id, provider);

create index if not exists idx_fi_tenant_external_integrations_tenant
  on public.fi_tenant_external_integrations (tenant_id, created_at desc);

create index if not exists idx_fi_tenant_external_integrations_provider
  on public.fi_tenant_external_integrations (provider, created_at desc);

create index if not exists idx_fi_tenant_external_integrations_status
  on public.fi_tenant_external_integrations (status, created_at desc);

create index if not exists idx_fi_tenant_external_integrations_created_at
  on public.fi_tenant_external_integrations (created_at desc);

alter table public.fi_tenant_external_integrations enable row level security;

drop policy if exists fi_tenant_external_integrations_select_tenant_member on public.fi_tenant_external_integrations;
create policy fi_tenant_external_integrations_select_tenant_member
  on public.fi_tenant_external_integrations for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_tenant_external_integrations.tenant_id
    )
  );

grant select on public.fi_tenant_external_integrations to authenticated, service_role;
grant insert, update, delete on public.fi_tenant_external_integrations to service_role;

drop trigger if exists trg_fi_tenant_external_integrations_updated_at on public.fi_tenant_external_integrations;
create trigger trg_fi_tenant_external_integrations_updated_at
  before update on public.fi_tenant_external_integrations
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_connector_credentials — encrypted credential blobs (service_role only)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_connector_credentials (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  credential_kind text not null default 'api_key',
  credentials_encrypted text not null,
  key_version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_connector_credentials_kind_chk check (
    credential_kind in ('api_key', 'oauth_tokens', 'webhook_secret', 'account_id')
  ),
  constraint fi_external_connector_credentials_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_external_connector_credentials is
  'OnboardingOS Phase F1: encrypted connector credentials; ciphertext produced by app (AES-256-GCM).';

create unique index if not exists idx_fi_external_connector_credentials_integration_kind
  on public.fi_external_connector_credentials (integration_id, credential_kind);

create index if not exists idx_fi_external_connector_credentials_tenant
  on public.fi_external_connector_credentials (tenant_id, created_at desc);

create index if not exists idx_fi_external_connector_credentials_created_at
  on public.fi_external_connector_credentials (created_at desc);

alter table public.fi_external_connector_credentials enable row level security;

revoke all on public.fi_external_connector_credentials from public;
grant select, insert, update, delete on public.fi_external_connector_credentials to service_role;

drop trigger if exists trg_fi_external_connector_credentials_updated_at on public.fi_external_connector_credentials;
create trigger trg_fi_external_connector_credentials_updated_at
  before update on public.fi_external_connector_credentials
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_sync_status — current sync health per integration
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_sync_status (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  status text not null default 'idle',
  health_score integer not null default 0,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  records_synced integer not null default 0,
  records_failed integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_sync_status_status_chk check (
    status in ('idle', 'pending', 'syncing', 'success', 'partial', 'failed')
  ),
  constraint fi_external_sync_status_health_score_chk check (
    health_score >= 0 and health_score <= 100
  ),
  constraint fi_external_sync_status_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_sync_status is
  'OnboardingOS Phase F1: latest sync state per external integration.';

create unique index if not exists idx_fi_external_sync_status_integration
  on public.fi_external_sync_status (integration_id);

create index if not exists idx_fi_external_sync_status_tenant
  on public.fi_external_sync_status (tenant_id, created_at desc);

create index if not exists idx_fi_external_sync_status_status
  on public.fi_external_sync_status (status, created_at desc);

create index if not exists idx_fi_external_sync_status_created_at
  on public.fi_external_sync_status (created_at desc);

alter table public.fi_external_sync_status enable row level security;

drop policy if exists fi_external_sync_status_select_tenant_member on public.fi_external_sync_status;
create policy fi_external_sync_status_select_tenant_member
  on public.fi_external_sync_status for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_sync_status.tenant_id
    )
  );

grant select on public.fi_external_sync_status to authenticated, service_role;
grant insert, update, delete on public.fi_external_sync_status to service_role;

drop trigger if exists trg_fi_external_sync_status_updated_at on public.fi_external_sync_status;
create trigger trg_fi_external_sync_status_updated_at
  before update on public.fi_external_sync_status
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_sync_events — append-only sync audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_sync_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  event_kind text not null,
  status text not null,
  actor_auth_user_id uuid,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  actor_label text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_external_sync_events_kind_chk check (
    event_kind in (
      'connector_created',
      'connector_updated',
      'credential_stored',
      'sync_started',
      'sync_completed',
      'sync_failed',
      'mapping_updated',
      'health_check',
      'connector_paused',
      'connector_resumed'
    )
  ),
  constraint fi_external_sync_events_status_chk check (
    status in ('info', 'success', 'warning', 'error')
  ),
  constraint fi_external_sync_events_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_sync_events is
  'OnboardingOS Phase F1: append-only external connector sync and lifecycle events.';

create index if not exists idx_fi_external_sync_events_tenant
  on public.fi_external_sync_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_external_sync_events_integration
  on public.fi_external_sync_events (integration_id, occurred_at desc);

create index if not exists idx_fi_external_sync_events_status
  on public.fi_external_sync_events (status, occurred_at desc);

create index if not exists idx_fi_external_sync_events_created_at
  on public.fi_external_sync_events (created_at desc);

alter table public.fi_external_sync_events enable row level security;

drop policy if exists fi_external_sync_events_select_tenant_member on public.fi_external_sync_events;
create policy fi_external_sync_events_select_tenant_member
  on public.fi_external_sync_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_sync_events.tenant_id
    )
  );

grant select on public.fi_external_sync_events to authenticated, service_role;
grant insert on public.fi_external_sync_events to service_role;

-- ---------------------------------------------------------------------------
-- fi_external_data_mappings — field/entity mapping plans per integration
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_data_mappings (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  source_entity text not null,
  target_entity text not null,
  status text not null default 'draft',
  mapping jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_data_mappings_status_chk check (
    status in ('draft', 'active', 'paused', 'deprecated')
  ),
  constraint fi_external_data_mappings_mapping_object check (jsonb_typeof(mapping) = 'object'),
  constraint fi_external_data_mappings_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_external_data_mappings is
  'OnboardingOS Phase F1: external-to-FI entity field mapping plans (no live sync yet).';

create unique index if not exists idx_fi_external_data_mappings_integration_entities
  on public.fi_external_data_mappings (integration_id, source_entity, target_entity);

create index if not exists idx_fi_external_data_mappings_tenant
  on public.fi_external_data_mappings (tenant_id, created_at desc);

create index if not exists idx_fi_external_data_mappings_status
  on public.fi_external_data_mappings (status, created_at desc);

create index if not exists idx_fi_external_data_mappings_created_at
  on public.fi_external_data_mappings (created_at desc);

alter table public.fi_external_data_mappings enable row level security;

drop policy if exists fi_external_data_mappings_select_tenant_member on public.fi_external_data_mappings;
create policy fi_external_data_mappings_select_tenant_member
  on public.fi_external_data_mappings for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_data_mappings.tenant_id
    )
  );

grant select on public.fi_external_data_mappings to authenticated, service_role;
grant insert, update, delete on public.fi_external_data_mappings to service_role;

drop trigger if exists trg_fi_external_data_mappings_updated_at on public.fi_external_data_mappings;
create trigger trg_fi_external_data_mappings_updated_at
  before update on public.fi_external_data_mappings
  for each row execute procedure public.fi_onboarding_os_set_updated_at();
