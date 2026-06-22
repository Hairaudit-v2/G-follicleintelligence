-- OnboardingOS Phase F2 — Connector Authentication & Verification Engine.
-- Auth, verification, permission scope tracking, and connection health only — no live API sync.

-- ---------------------------------------------------------------------------
-- fi_external_connector_auth_sessions — per-integration auth lifecycle
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_connector_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null,
  auth_method text not null default 'manual_placeholder',
  auth_status text not null default 'not_started',
  credential_id uuid references public.fi_external_connector_credentials (id) on delete set null,
  scopes_granted jsonb not null default '[]'::jsonb,
  provider_payload jsonb not null default '{}'::jsonb,
  token_expires_at timestamptz,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_connector_auth_sessions_provider_chk check (
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
  constraint fi_external_connector_auth_sessions_method_chk check (
    auth_method in ('oauth2', 'api_key', 'webhook_secret', 'manual_placeholder')
  ),
  constraint fi_external_connector_auth_sessions_status_chk check (
    auth_status in (
      'not_started',
      'pending',
      'verified',
      'failed',
      'expired',
      'revoked',
      'insufficient_permissions'
    )
  ),
  constraint fi_external_connector_auth_sessions_scopes_array check (jsonb_typeof(scopes_granted) = 'array'),
  constraint fi_external_connector_auth_sessions_provider_payload_object check (jsonb_typeof(provider_payload) = 'object')
);

comment on table public.fi_external_connector_auth_sessions is
  'OnboardingOS Phase F2: connector auth sessions — status and scope tracking (no raw secrets).';

create unique index if not exists idx_fi_external_connector_auth_sessions_integration
  on public.fi_external_connector_auth_sessions (integration_id);

create index if not exists idx_fi_external_connector_auth_sessions_tenant
  on public.fi_external_connector_auth_sessions (tenant_id, created_at desc);

create index if not exists idx_fi_external_connector_auth_sessions_provider
  on public.fi_external_connector_auth_sessions (provider, created_at desc);

create index if not exists idx_fi_external_connector_auth_sessions_auth_status
  on public.fi_external_connector_auth_sessions (auth_status, created_at desc);

create index if not exists idx_fi_external_connector_auth_sessions_created_at
  on public.fi_external_connector_auth_sessions (created_at desc);

alter table public.fi_external_connector_auth_sessions enable row level security;

drop policy if exists fi_external_connector_auth_sessions_select_tenant_member on public.fi_external_connector_auth_sessions;
create policy fi_external_connector_auth_sessions_select_tenant_member
  on public.fi_external_connector_auth_sessions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_connector_auth_sessions.tenant_id
    )
  );

grant select on public.fi_external_connector_auth_sessions to authenticated, service_role;
grant insert, update, delete on public.fi_external_connector_auth_sessions to service_role;

drop trigger if exists trg_fi_external_connector_auth_sessions_updated_at on public.fi_external_connector_auth_sessions;
create trigger trg_fi_external_connector_auth_sessions_updated_at
  before update on public.fi_external_connector_auth_sessions
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_connector_token_refresh_events — append-only token refresh audit
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_connector_token_refresh_events (
  id uuid primary key default gen_random_uuid(),
  auth_session_id uuid not null references public.fi_external_connector_auth_sessions (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null,
  outcome text not null default 'skipped',
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_external_connector_token_refresh_events_outcome_chk check (
    outcome in ('success', 'failed', 'skipped')
  ),
  constraint fi_external_connector_token_refresh_events_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_connector_token_refresh_events is
  'OnboardingOS Phase F2: append-only OAuth token refresh events (service_role writes).';

create index if not exists idx_fi_external_connector_token_refresh_events_tenant
  on public.fi_external_connector_token_refresh_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_external_connector_token_refresh_events_integration
  on public.fi_external_connector_token_refresh_events (integration_id, occurred_at desc);

create index if not exists idx_fi_external_connector_token_refresh_events_auth_session
  on public.fi_external_connector_token_refresh_events (auth_session_id, occurred_at desc);

create index if not exists idx_fi_external_connector_token_refresh_events_provider
  on public.fi_external_connector_token_refresh_events (provider, occurred_at desc);

create index if not exists idx_fi_external_connector_token_refresh_events_created_at
  on public.fi_external_connector_token_refresh_events (created_at desc);

alter table public.fi_external_connector_token_refresh_events enable row level security;

drop policy if exists fi_external_connector_token_refresh_events_select_tenant_member on public.fi_external_connector_token_refresh_events;
create policy fi_external_connector_token_refresh_events_select_tenant_member
  on public.fi_external_connector_token_refresh_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_connector_token_refresh_events.tenant_id
    )
  );

grant select on public.fi_external_connector_token_refresh_events to authenticated, service_role;
grant insert on public.fi_external_connector_token_refresh_events to service_role;

-- ---------------------------------------------------------------------------
-- fi_external_connector_permission_scopes — required vs granted scope tracking
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_connector_permission_scopes (
  id uuid primary key default gen_random_uuid(),
  auth_session_id uuid not null references public.fi_external_connector_auth_sessions (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null,
  scope_key text not null,
  scope_label text,
  required boolean not null default false,
  granted boolean not null default false,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.fi_external_connector_permission_scopes is
  'OnboardingOS Phase F2: connector permission scope requirements and grants.';

create unique index if not exists idx_fi_external_connector_permission_scopes_session_key
  on public.fi_external_connector_permission_scopes (auth_session_id, scope_key);

create index if not exists idx_fi_external_connector_permission_scopes_tenant
  on public.fi_external_connector_permission_scopes (tenant_id, created_at desc);

create index if not exists idx_fi_external_connector_permission_scopes_integration
  on public.fi_external_connector_permission_scopes (integration_id, created_at desc);

create index if not exists idx_fi_external_connector_permission_scopes_provider
  on public.fi_external_connector_permission_scopes (provider, created_at desc);

create index if not exists idx_fi_external_connector_permission_scopes_created_at
  on public.fi_external_connector_permission_scopes (created_at desc);

alter table public.fi_external_connector_permission_scopes enable row level security;

drop policy if exists fi_external_connector_permission_scopes_select_tenant_member on public.fi_external_connector_permission_scopes;
create policy fi_external_connector_permission_scopes_select_tenant_member
  on public.fi_external_connector_permission_scopes for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_connector_permission_scopes.tenant_id
    )
  );

grant select on public.fi_external_connector_permission_scopes to authenticated, service_role;
grant insert, update, delete on public.fi_external_connector_permission_scopes to service_role;

-- ---------------------------------------------------------------------------
-- fi_external_connector_verification_events — append-only verification audit
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_connector_verification_events (
  id uuid primary key default gen_random_uuid(),
  auth_session_id uuid not null references public.fi_external_connector_auth_sessions (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null,
  auth_status text not null,
  outcome text not null default 'info',
  actor_auth_user_id uuid,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  actor_label text,
  detail jsonb not null default '{}'::jsonb,
  provider_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_external_connector_verification_events_status_chk check (
    auth_status in (
      'not_started',
      'pending',
      'verified',
      'failed',
      'expired',
      'revoked',
      'insufficient_permissions'
    )
  ),
  constraint fi_external_connector_verification_events_outcome_chk check (
    outcome in ('success', 'warning', 'error', 'info')
  ),
  constraint fi_external_connector_verification_events_detail_object check (jsonb_typeof(detail) = 'object'),
  constraint fi_external_connector_verification_events_provider_payload_object check (jsonb_typeof(provider_payload) = 'object')
);

comment on table public.fi_external_connector_verification_events is
  'OnboardingOS Phase F2: append-only connector credential verification events.';

create index if not exists idx_fi_external_connector_verification_events_tenant
  on public.fi_external_connector_verification_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_external_connector_verification_events_integration
  on public.fi_external_connector_verification_events (integration_id, occurred_at desc);

create index if not exists idx_fi_external_connector_verification_events_auth_session
  on public.fi_external_connector_verification_events (auth_session_id, occurred_at desc);

create index if not exists idx_fi_external_connector_verification_events_provider
  on public.fi_external_connector_verification_events (provider, occurred_at desc);

create index if not exists idx_fi_external_connector_verification_events_auth_status
  on public.fi_external_connector_verification_events (auth_status, occurred_at desc);

create index if not exists idx_fi_external_connector_verification_events_created_at
  on public.fi_external_connector_verification_events (created_at desc);

alter table public.fi_external_connector_verification_events enable row level security;

drop policy if exists fi_external_connector_verification_events_select_tenant_member on public.fi_external_connector_verification_events;
create policy fi_external_connector_verification_events_select_tenant_member
  on public.fi_external_connector_verification_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_connector_verification_events.tenant_id
    )
  );

grant select on public.fi_external_connector_verification_events to authenticated, service_role;
grant insert on public.fi_external_connector_verification_events to service_role;
