-- OnboardingOS Phase F3 — Google Calendar read-only connector.
-- External events sync into staging tables only — no write-back, no FI booking creation.

-- ---------------------------------------------------------------------------
-- fi_external_calendar_sync_runs — per-integration sync execution records
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_calendar_sync_runs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  status text not null default 'started',
  events_discovered integer not null default 0,
  events_staged integer not null default 0,
  events_skipped integer not null default 0,
  health_score integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fi_external_calendar_sync_runs_status_chk check (
    status in ('started', 'completed', 'partial', 'failed')
  ),
  constraint fi_external_calendar_sync_runs_health_score_chk check (
    health_score >= 0 and health_score <= 100
  ),
  constraint fi_external_calendar_sync_runs_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_calendar_sync_runs is
  'OnboardingOS Phase F3: Google Calendar sync run records (read-only import; staging only).';

create index if not exists idx_fi_external_calendar_sync_runs_tenant
  on public.fi_external_calendar_sync_runs (tenant_id, started_at desc);

create index if not exists idx_fi_external_calendar_sync_runs_integration
  on public.fi_external_calendar_sync_runs (integration_id, started_at desc);

create index if not exists idx_fi_external_calendar_sync_runs_status
  on public.fi_external_calendar_sync_runs (status, created_at desc);

create index if not exists idx_fi_external_calendar_sync_runs_created_at
  on public.fi_external_calendar_sync_runs (created_at desc);

alter table public.fi_external_calendar_sync_runs enable row level security;

drop policy if exists fi_external_calendar_sync_runs_select_tenant_member on public.fi_external_calendar_sync_runs;
create policy fi_external_calendar_sync_runs_select_tenant_member
  on public.fi_external_calendar_sync_runs for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_calendar_sync_runs.tenant_id
    )
  );

grant select on public.fi_external_calendar_sync_runs to authenticated, service_role;
grant insert, update, delete on public.fi_external_calendar_sync_runs to service_role;

-- ---------------------------------------------------------------------------
-- fi_external_calendar_event_staging — external calendar events awaiting review
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_calendar_event_staging (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  sync_run_id uuid references public.fi_external_calendar_sync_runs (id) on delete set null,
  google_event_id text not null,
  calendar_id text not null,
  event_title text not null default '',
  start_at timestamptz,
  end_at timestamptz,
  attendee_emails jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_event_type text not null default 'unknown',
  import_status text not null default 'staged',
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_calendar_event_staging_type_chk check (
    normalized_event_type in (
      'consultation',
      'surgery',
      'prp',
      'exosomes',
      'follow_up',
      'review',
      'unknown'
    )
  ),
  constraint fi_external_calendar_event_staging_import_status_chk check (
    import_status in ('staged', 'reviewed', 'approved', 'rejected', 'imported')
  ),
  constraint fi_external_calendar_event_staging_attendee_emails_array check (
    jsonb_typeof(attendee_emails) = 'array'
  ),
  constraint fi_external_calendar_event_staging_raw_payload_object check (
    jsonb_typeof(raw_payload) = 'object'
  )
);

comment on table public.fi_external_calendar_event_staging is
  'OnboardingOS Phase F3: staged Google Calendar events — human approval required; no automatic FI booking creation.';

create unique index if not exists idx_fi_external_calendar_event_staging_integration_google_event
  on public.fi_external_calendar_event_staging (integration_id, google_event_id);

create index if not exists idx_fi_external_calendar_event_staging_tenant
  on public.fi_external_calendar_event_staging (tenant_id, created_at desc);

create index if not exists idx_fi_external_calendar_event_staging_integration
  on public.fi_external_calendar_event_staging (integration_id, created_at desc);

create index if not exists idx_fi_external_calendar_event_staging_google_event_id
  on public.fi_external_calendar_event_staging (google_event_id);

create index if not exists idx_fi_external_calendar_event_staging_import_status
  on public.fi_external_calendar_event_staging (import_status, created_at desc);

create index if not exists idx_fi_external_calendar_event_staging_sync_run
  on public.fi_external_calendar_event_staging (sync_run_id, created_at desc);

create index if not exists idx_fi_external_calendar_event_staging_created_at
  on public.fi_external_calendar_event_staging (created_at desc);

alter table public.fi_external_calendar_event_staging enable row level security;

drop policy if exists fi_external_calendar_event_staging_select_tenant_member on public.fi_external_calendar_event_staging;
create policy fi_external_calendar_event_staging_select_tenant_member
  on public.fi_external_calendar_event_staging for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_calendar_event_staging.tenant_id
    )
  );

grant select on public.fi_external_calendar_event_staging to authenticated, service_role;
grant insert, update, delete on public.fi_external_calendar_event_staging to service_role;

drop trigger if exists trg_fi_external_calendar_event_staging_updated_at on public.fi_external_calendar_event_staging;
create trigger trg_fi_external_calendar_event_staging_updated_at
  before update on public.fi_external_calendar_event_staging
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_calendar_event_mappings — staging-to-FI mapping plans (no live import)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_calendar_event_mappings (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staging_event_id uuid not null references public.fi_external_calendar_event_staging (id) on delete cascade,
  google_event_id text not null,
  fi_booking_id uuid,
  mapping_status text not null default 'pending',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_calendar_event_mappings_status_chk check (
    mapping_status in ('pending', 'approved', 'rejected', 'linked')
  ),
  constraint fi_external_calendar_event_mappings_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_calendar_event_mappings is
  'OnboardingOS Phase F3: external calendar event mapping records — fi_booking_id remains null until explicit future import phase.';

create unique index if not exists idx_fi_external_calendar_event_mappings_staging_event
  on public.fi_external_calendar_event_mappings (staging_event_id);

create index if not exists idx_fi_external_calendar_event_mappings_tenant
  on public.fi_external_calendar_event_mappings (tenant_id, created_at desc);

create index if not exists idx_fi_external_calendar_event_mappings_integration
  on public.fi_external_calendar_event_mappings (integration_id, created_at desc);

create index if not exists idx_fi_external_calendar_event_mappings_google_event_id
  on public.fi_external_calendar_event_mappings (google_event_id);

create index if not exists idx_fi_external_calendar_event_mappings_mapping_status
  on public.fi_external_calendar_event_mappings (mapping_status, created_at desc);

create index if not exists idx_fi_external_calendar_event_mappings_created_at
  on public.fi_external_calendar_event_mappings (created_at desc);

alter table public.fi_external_calendar_event_mappings enable row level security;

drop policy if exists fi_external_calendar_event_mappings_select_tenant_member on public.fi_external_calendar_event_mappings;
create policy fi_external_calendar_event_mappings_select_tenant_member
  on public.fi_external_calendar_event_mappings for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_calendar_event_mappings.tenant_id
    )
  );

grant select on public.fi_external_calendar_event_mappings to authenticated, service_role;
grant insert, update, delete on public.fi_external_calendar_event_mappings to service_role;

drop trigger if exists trg_fi_external_calendar_event_mappings_updated_at on public.fi_external_calendar_event_mappings;
create trigger trg_fi_external_calendar_event_mappings_updated_at
  before update on public.fi_external_calendar_event_mappings
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_external_calendar_import_audit — append-only sync and review audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_calendar_import_audit (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staging_event_id uuid references public.fi_external_calendar_event_staging (id) on delete set null,
  sync_run_id uuid references public.fi_external_calendar_sync_runs (id) on delete set null,
  action text not null,
  actor_auth_user_id uuid,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  actor_label text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_external_calendar_import_audit_action_chk check (
    action in (
      'sync_started',
      'sync_completed',
      'sync_failed',
      'event_staged',
      'event_duplicate',
      'event_approved',
      'event_rejected',
      'event_reviewed'
    )
  ),
  constraint fi_external_calendar_import_audit_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_calendar_import_audit is
  'OnboardingOS Phase F3: append-only Google Calendar sync and staging review audit (service_role writes).';

create index if not exists idx_fi_external_calendar_import_audit_tenant
  on public.fi_external_calendar_import_audit (tenant_id, occurred_at desc);

create index if not exists idx_fi_external_calendar_import_audit_integration
  on public.fi_external_calendar_import_audit (integration_id, occurred_at desc);

create index if not exists idx_fi_external_calendar_import_audit_staging_event
  on public.fi_external_calendar_import_audit (staging_event_id, occurred_at desc);

create index if not exists idx_fi_external_calendar_import_audit_sync_run
  on public.fi_external_calendar_import_audit (sync_run_id, occurred_at desc);

create index if not exists idx_fi_external_calendar_import_audit_action
  on public.fi_external_calendar_import_audit (action, occurred_at desc);

create index if not exists idx_fi_external_calendar_import_audit_created_at
  on public.fi_external_calendar_import_audit (created_at desc);

alter table public.fi_external_calendar_import_audit enable row level security;

drop policy if exists fi_external_calendar_import_audit_select_tenant_member on public.fi_external_calendar_import_audit;
create policy fi_external_calendar_import_audit_select_tenant_member
  on public.fi_external_calendar_import_audit for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_calendar_import_audit.tenant_id
    )
  );

grant select on public.fi_external_calendar_import_audit to authenticated, service_role;
grant insert on public.fi_external_calendar_import_audit to service_role;
