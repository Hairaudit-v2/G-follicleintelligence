-- OnboardingOS Phase F4 — HubSpot read-only lead connector.
-- External contacts and deals sync into staging tables only — no write-back, no FI lead creation.

-- ---------------------------------------------------------------------------
-- fi_external_hubspot_sync_runs — per-integration sync execution records
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_hubspot_sync_runs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  status text not null default 'started',
  contacts_discovered integer not null default 0,
  contacts_staged integer not null default 0,
  contacts_skipped integer not null default 0,
  deals_discovered integer not null default 0,
  deals_staged integer not null default 0,
  deals_skipped integer not null default 0,
  duplicate_risks_detected integer not null default 0,
  health_score integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fi_external_hubspot_sync_runs_status_chk check (
    status in ('started', 'completed', 'partial', 'failed')
  ),
  constraint fi_external_hubspot_sync_runs_health_score_chk check (
    health_score >= 0 and health_score <= 100
  ),
  constraint fi_external_hubspot_sync_runs_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_hubspot_sync_runs is
  'OnboardingOS Phase F4: HubSpot sync run records (read-only import; staging only).';

create index if not exists idx_fi_external_hubspot_sync_runs_tenant
  on public.fi_external_hubspot_sync_runs (tenant_id, started_at desc);

create index if not exists idx_fi_external_hubspot_sync_runs_integration
  on public.fi_external_hubspot_sync_runs (integration_id, started_at desc);

create index if not exists idx_fi_external_hubspot_sync_runs_status
  on public.fi_external_hubspot_sync_runs (status, created_at desc);

create index if not exists idx_fi_external_hubspot_sync_runs_created_at
  on public.fi_external_hubspot_sync_runs (created_at desc);

alter table public.fi_external_hubspot_sync_runs enable row level security;

drop policy if exists fi_external_hubspot_sync_runs_select_tenant_member on public.fi_external_hubspot_sync_runs;
create policy fi_external_hubspot_sync_runs_select_tenant_member
  on public.fi_external_hubspot_sync_runs for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_hubspot_sync_runs.tenant_id
    )
  );

grant select on public.fi_external_hubspot_sync_runs to authenticated, service_role;
grant insert, update, delete on public.fi_external_hubspot_sync_runs to service_role;

-- ---------------------------------------------------------------------------
-- fi_external_hubspot_contact_staging — HubSpot contacts awaiting review
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_hubspot_contact_staging (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_contact_id text not null,
  email text,
  phone text,
  lead_source text,
  duplicate_risk boolean not null default false,
  normalized_lead_type text not null default 'unknown',
  raw_payload jsonb not null default '{}'::jsonb,
  import_status text not null default 'staged',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_hubspot_contact_staging_lead_type_chk check (
    normalized_lead_type in (
      'hair_transplant',
      'trichology',
      'prp',
      'exosomes',
      'follow_up',
      'review',
      'unknown'
    )
  ),
  constraint fi_external_hubspot_contact_staging_import_status_chk check (
    import_status in ('staged', 'reviewed', 'approved', 'rejected', 'imported')
  ),
  constraint fi_external_hubspot_contact_staging_raw_payload_object check (
    jsonb_typeof(raw_payload) = 'object'
  )
);

comment on table public.fi_external_hubspot_contact_staging is
  'OnboardingOS Phase F4: staged HubSpot contacts — human approval required; no automatic FI lead creation.';

create unique index if not exists idx_fi_external_hubspot_contact_staging_integration_contact
  on public.fi_external_hubspot_contact_staging (integration_id, hubspot_contact_id);

create index if not exists idx_fi_external_hubspot_contact_staging_tenant
  on public.fi_external_hubspot_contact_staging (tenant_id, created_at desc);

create index if not exists idx_fi_external_hubspot_contact_staging_integration
  on public.fi_external_hubspot_contact_staging (integration_id, created_at desc);

create index if not exists idx_fi_external_hubspot_contact_staging_hubspot_contact_id
  on public.fi_external_hubspot_contact_staging (hubspot_contact_id);

create index if not exists idx_fi_external_hubspot_contact_staging_import_status
  on public.fi_external_hubspot_contact_staging (import_status, created_at desc);

create index if not exists idx_fi_external_hubspot_contact_staging_sync_run
  on public.fi_external_hubspot_contact_staging (sync_run_id, created_at desc);

create index if not exists idx_fi_external_hubspot_contact_staging_duplicate_risk
  on public.fi_external_hubspot_contact_staging (duplicate_risk, created_at desc);

create index if not exists idx_fi_external_hubspot_contact_staging_created_at
  on public.fi_external_hubspot_contact_staging (created_at desc);

alter table public.fi_external_hubspot_contact_staging enable row level security;

drop policy if exists fi_external_hubspot_contact_staging_select_tenant_member on public.fi_external_hubspot_contact_staging;
create policy fi_external_hubspot_contact_staging_select_tenant_member
  on public.fi_external_hubspot_contact_staging for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_hubspot_contact_staging.tenant_id
    )
  );

grant select on public.fi_external_hubspot_contact_staging to authenticated, service_role;
grant insert, update, delete on public.fi_external_hubspot_contact_staging to service_role;

drop trigger if exists trg_fi_external_hubspot_contact_staging_updated_at on public.fi_external_hubspot_contact_staging;
create trigger trg_fi_external_hubspot_contact_staging_updated_at
  before update on public.fi_external_hubspot_contact_staging
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_hubspot_deal_staging — HubSpot deals awaiting review
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_hubspot_deal_staging (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_deal_id text not null,
  hubspot_contact_id text,
  email text,
  phone text,
  lead_source text,
  pipeline_name text,
  deal_stage text,
  duplicate_risk boolean not null default false,
  normalized_lead_type text not null default 'unknown',
  raw_payload jsonb not null default '{}'::jsonb,
  import_status text not null default 'staged',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_hubspot_deal_staging_lead_type_chk check (
    normalized_lead_type in (
      'hair_transplant',
      'trichology',
      'prp',
      'exosomes',
      'follow_up',
      'review',
      'unknown'
    )
  ),
  constraint fi_external_hubspot_deal_staging_import_status_chk check (
    import_status in ('staged', 'reviewed', 'approved', 'rejected', 'imported')
  ),
  constraint fi_external_hubspot_deal_staging_raw_payload_object check (
    jsonb_typeof(raw_payload) = 'object'
  )
);

comment on table public.fi_external_hubspot_deal_staging is
  'OnboardingOS Phase F4: staged HubSpot deals — human approval required; no automatic FI opportunity creation.';

create unique index if not exists idx_fi_external_hubspot_deal_staging_integration_deal
  on public.fi_external_hubspot_deal_staging (integration_id, hubspot_deal_id);

create index if not exists idx_fi_external_hubspot_deal_staging_tenant
  on public.fi_external_hubspot_deal_staging (tenant_id, created_at desc);

create index if not exists idx_fi_external_hubspot_deal_staging_integration
  on public.fi_external_hubspot_deal_staging (integration_id, created_at desc);

create index if not exists idx_fi_external_hubspot_deal_staging_hubspot_deal_id
  on public.fi_external_hubspot_deal_staging (hubspot_deal_id);

create index if not exists idx_fi_external_hubspot_deal_staging_hubspot_contact_id
  on public.fi_external_hubspot_deal_staging (hubspot_contact_id);

create index if not exists idx_fi_external_hubspot_deal_staging_import_status
  on public.fi_external_hubspot_deal_staging (import_status, created_at desc);

create index if not exists idx_fi_external_hubspot_deal_staging_sync_run
  on public.fi_external_hubspot_deal_staging (sync_run_id, created_at desc);

create index if not exists idx_fi_external_hubspot_deal_staging_duplicate_risk
  on public.fi_external_hubspot_deal_staging (duplicate_risk, created_at desc);

create index if not exists idx_fi_external_hubspot_deal_staging_created_at
  on public.fi_external_hubspot_deal_staging (created_at desc);

alter table public.fi_external_hubspot_deal_staging enable row level security;

drop policy if exists fi_external_hubspot_deal_staging_select_tenant_member on public.fi_external_hubspot_deal_staging;
create policy fi_external_hubspot_deal_staging_select_tenant_member
  on public.fi_external_hubspot_deal_staging for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_hubspot_deal_staging.tenant_id
    )
  );

grant select on public.fi_external_hubspot_deal_staging to authenticated, service_role;
grant insert, update, delete on public.fi_external_hubspot_deal_staging to service_role;

drop trigger if exists trg_fi_external_hubspot_deal_staging_updated_at on public.fi_external_hubspot_deal_staging;
create trigger trg_fi_external_hubspot_deal_staging_updated_at
  before update on public.fi_external_hubspot_deal_staging
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_hubspot_pipeline_mappings — HubSpot pipeline metadata (no live import)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_hubspot_pipeline_mappings (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  hubspot_pipeline_id text not null,
  pipeline_name text not null default '',
  fi_pipeline_id uuid,
  mapping_status text not null default 'pending',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_hubspot_pipeline_mappings_status_chk check (
    mapping_status in ('pending', 'approved', 'rejected', 'linked')
  ),
  constraint fi_external_hubspot_pipeline_mappings_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_hubspot_pipeline_mappings is
  'OnboardingOS Phase F4: HubSpot pipeline mapping records — fi_pipeline_id remains null until explicit future import phase.';

create unique index if not exists idx_fi_external_hubspot_pipeline_mappings_integration_pipeline
  on public.fi_external_hubspot_pipeline_mappings (integration_id, hubspot_pipeline_id);

create index if not exists idx_fi_external_hubspot_pipeline_mappings_tenant
  on public.fi_external_hubspot_pipeline_mappings (tenant_id, created_at desc);

create index if not exists idx_fi_external_hubspot_pipeline_mappings_integration
  on public.fi_external_hubspot_pipeline_mappings (integration_id, created_at desc);

create index if not exists idx_fi_external_hubspot_pipeline_mappings_created_at
  on public.fi_external_hubspot_pipeline_mappings (created_at desc);

alter table public.fi_external_hubspot_pipeline_mappings enable row level security;

drop policy if exists fi_external_hubspot_pipeline_mappings_select_tenant_member on public.fi_external_hubspot_pipeline_mappings;
create policy fi_external_hubspot_pipeline_mappings_select_tenant_member
  on public.fi_external_hubspot_pipeline_mappings for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_hubspot_pipeline_mappings.tenant_id
    )
  );

grant select on public.fi_external_hubspot_pipeline_mappings to authenticated, service_role;
grant insert, update, delete on public.fi_external_hubspot_pipeline_mappings to service_role;

drop trigger if exists trg_fi_external_hubspot_pipeline_mappings_updated_at on public.fi_external_hubspot_pipeline_mappings;
create trigger trg_fi_external_hubspot_pipeline_mappings_updated_at
  before update on public.fi_external_hubspot_pipeline_mappings
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_hubspot_import_audit — append-only sync and review audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_hubspot_import_audit (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staging_contact_id uuid references public.fi_external_hubspot_contact_staging (id) on delete set null,
  staging_deal_id uuid references public.fi_external_hubspot_deal_staging (id) on delete set null,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  action text not null,
  actor_auth_user_id uuid,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  actor_label text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_external_hubspot_import_audit_action_chk check (
    action in (
      'sync_started',
      'sync_completed',
      'sync_failed',
      'contact_staged',
      'deal_staged',
      'contact_duplicate',
      'deal_duplicate',
      'contact_approved',
      'contact_rejected',
      'deal_approved',
      'deal_rejected',
      'pipeline_mapped'
    )
  ),
  constraint fi_external_hubspot_import_audit_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_hubspot_import_audit is
  'OnboardingOS Phase F4: append-only HubSpot sync and staging review audit (service_role writes).';

create index if not exists idx_fi_external_hubspot_import_audit_tenant
  on public.fi_external_hubspot_import_audit (tenant_id, occurred_at desc);

create index if not exists idx_fi_external_hubspot_import_audit_integration
  on public.fi_external_hubspot_import_audit (integration_id, occurred_at desc);

create index if not exists idx_fi_external_hubspot_import_audit_staging_contact
  on public.fi_external_hubspot_import_audit (staging_contact_id, occurred_at desc);

create index if not exists idx_fi_external_hubspot_import_audit_staging_deal
  on public.fi_external_hubspot_import_audit (staging_deal_id, occurred_at desc);

create index if not exists idx_fi_external_hubspot_import_audit_sync_run
  on public.fi_external_hubspot_import_audit (sync_run_id, occurred_at desc);

create index if not exists idx_fi_external_hubspot_import_audit_action
  on public.fi_external_hubspot_import_audit (action, occurred_at desc);

create index if not exists idx_fi_external_hubspot_import_audit_created_at
  on public.fi_external_hubspot_import_audit (created_at desc);

alter table public.fi_external_hubspot_import_audit enable row level security;

drop policy if exists fi_external_hubspot_import_audit_select_tenant_member on public.fi_external_hubspot_import_audit;
create policy fi_external_hubspot_import_audit_select_tenant_member
  on public.fi_external_hubspot_import_audit for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_hubspot_import_audit.tenant_id
    )
  );

grant select on public.fi_external_hubspot_import_audit to authenticated, service_role;
grant insert on public.fi_external_hubspot_import_audit to service_role;
