-- OnboardingOS Phase F5 — Staged import engine.
-- Reordered from 20260622120014 — requires fi_tenant_external_integrations (20260922120010)
-- and fi_external_hubspot_import_audit (20260922120013).
-- Approved connector staging rows convert to native FI records only after explicit human approval.
-- HubSpot remains read-only; FI is the destination. Architecture supports future connectors.

-- ---------------------------------------------------------------------------
-- fi_external_record_mappings — integration-scoped external → FI entity links
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_record_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  source_provider text not null,
  source_entity_type text not null,
  external_id text not null,
  fi_entity_type text not null,
  fi_entity_id uuid not null,
  staging_record_type text,
  staging_record_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_external_record_mappings_source_provider_chk check (
    source_provider in ('hubspot', 'cliniko', 'pabau', 'salesforce', 'google_calendar')
  ),
  constraint fi_external_record_mappings_source_entity_type_chk check (
    source_entity_type in ('contact', 'deal', 'patient', 'appointment', 'lead', 'staff', 'service')
  ),
  constraint fi_external_record_mappings_fi_entity_type_chk check (
    fi_entity_type in ('person', 'lead', 'patient', 'case', 'opportunity')
  ),
  constraint fi_external_record_mappings_staging_record_type_chk check (
    staging_record_type is null
    or staging_record_type in ('hubspot_contact', 'hubspot_deal', 'calendar_event')
  ),
  constraint fi_external_record_mappings_external_id_nonempty check (char_length(trim(external_id)) > 0),
  constraint fi_external_record_mappings_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_record_mappings is
  'OnboardingOS Phase F5: maps external connector records (per integration) to native FI entity UUIDs.';

create unique index if not exists idx_fi_external_record_mappings_unique_external
  on public.fi_external_record_mappings (
    tenant_id,
    integration_id,
    source_provider,
    source_entity_type,
    external_id
  );

create index if not exists idx_fi_external_record_mappings_tenant
  on public.fi_external_record_mappings (tenant_id, created_at desc);

create index if not exists idx_fi_external_record_mappings_integration
  on public.fi_external_record_mappings (integration_id, created_at desc);

create index if not exists idx_fi_external_record_mappings_fi_entity
  on public.fi_external_record_mappings (tenant_id, fi_entity_type, fi_entity_id);

create index if not exists idx_fi_external_record_mappings_staging
  on public.fi_external_record_mappings (staging_record_type, staging_record_id)
  where staging_record_id is not null;

alter table public.fi_external_record_mappings enable row level security;

drop policy if exists fi_external_record_mappings_select_tenant_member on public.fi_external_record_mappings;
create policy fi_external_record_mappings_select_tenant_member
  on public.fi_external_record_mappings for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_record_mappings.tenant_id
    )
  );

grant select on public.fi_external_record_mappings to authenticated, service_role;
grant insert on public.fi_external_record_mappings to service_role;

-- ---------------------------------------------------------------------------
-- fi_external_import_events — append-only staged import audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_import_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  source_provider text not null,
  staging_record_type text,
  staging_record_id uuid,
  event_kind text not null,
  actor_auth_user_id uuid,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  actor_label text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fi_external_import_events_source_provider_chk check (
    source_provider in ('hubspot', 'cliniko', 'pabau', 'salesforce', 'google_calendar')
  ),
  constraint fi_external_import_events_staging_record_type_chk check (
    staging_record_type is null
    or staging_record_type in ('hubspot_contact', 'hubspot_deal', 'calendar_event')
  ),
  constraint fi_external_import_events_event_kind_chk check (
    event_kind in (
      'preview_built',
      'duplicate_check',
      'import_requested',
      'import_completed',
      'import_cancelled',
      'merge_existing',
      'import_blocked'
    )
  ),
  constraint fi_external_import_events_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_external_import_events is
  'OnboardingOS Phase F5: append-only audit for staged connector imports (service_role writes only).';

create index if not exists idx_fi_external_import_events_tenant
  on public.fi_external_import_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_external_import_events_integration
  on public.fi_external_import_events (integration_id, occurred_at desc);

create index if not exists idx_fi_external_import_events_staging
  on public.fi_external_import_events (staging_record_type, staging_record_id, occurred_at desc)
  where staging_record_id is not null;

create index if not exists idx_fi_external_import_events_event_kind
  on public.fi_external_import_events (event_kind, occurred_at desc);

create index if not exists idx_fi_external_import_events_created_at
  on public.fi_external_import_events (created_at desc);

alter table public.fi_external_import_events enable row level security;

drop policy if exists fi_external_import_events_select_tenant_member on public.fi_external_import_events;
create policy fi_external_import_events_select_tenant_member
  on public.fi_external_import_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_import_events.tenant_id
    )
  );

grant select on public.fi_external_import_events to authenticated, service_role;
grant insert on public.fi_external_import_events to service_role;

-- ---------------------------------------------------------------------------
-- fi_external_import_preview_cache — deterministic preview + duplicate check cache
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_import_preview_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  source_provider text not null,
  staging_record_type text not null,
  staging_record_id uuid not null,
  preview_payload jsonb not null default '{}'::jsonb,
  duplicate_check_payload jsonb not null default '{}'::jsonb,
  proposed_action text not null default 'create_lead',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_import_preview_cache_source_provider_chk check (
    source_provider in ('hubspot', 'cliniko', 'pabau', 'salesforce', 'google_calendar')
  ),
  constraint fi_external_import_preview_cache_staging_record_type_chk check (
    staging_record_type in ('hubspot_contact', 'hubspot_deal', 'calendar_event')
  ),
  constraint fi_external_import_preview_cache_proposed_action_chk check (
    proposed_action in (
      'create_lead',
      'create_opportunity',
      'merge_person',
      'merge_lead',
      'skip',
      'blocked'
    )
  ),
  constraint fi_external_import_preview_cache_preview_object check (jsonb_typeof(preview_payload) = 'object'),
  constraint fi_external_import_preview_cache_duplicate_object check (jsonb_typeof(duplicate_check_payload) = 'object')
);

comment on table public.fi_external_import_preview_cache is
  'OnboardingOS Phase F5: cached import preview and duplicate-check results for human review.';

create unique index if not exists idx_fi_external_import_preview_cache_unique_staging
  on public.fi_external_import_preview_cache (
    tenant_id,
    integration_id,
    staging_record_type,
    staging_record_id
  );

create index if not exists idx_fi_external_import_preview_cache_tenant
  on public.fi_external_import_preview_cache (tenant_id, computed_at desc);

create index if not exists idx_fi_external_import_preview_cache_integration
  on public.fi_external_import_preview_cache (integration_id, computed_at desc);

alter table public.fi_external_import_preview_cache enable row level security;

drop policy if exists fi_external_import_preview_cache_select_tenant_member on public.fi_external_import_preview_cache;
create policy fi_external_import_preview_cache_select_tenant_member
  on public.fi_external_import_preview_cache for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_import_preview_cache.tenant_id
    )
  );

grant select on public.fi_external_import_preview_cache to authenticated, service_role;
grant insert, update, delete on public.fi_external_import_preview_cache to service_role;

drop trigger if exists trg_fi_external_import_preview_cache_updated_at on public.fi_external_import_preview_cache;
create trigger trg_fi_external_import_preview_cache_updated_at
  before update on public.fi_external_import_preview_cache
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- ---------------------------------------------------------------------------
-- Extend HubSpot import audit actions for F5 import lifecycle
-- ---------------------------------------------------------------------------
alter table public.fi_external_hubspot_import_audit
  drop constraint if exists fi_external_hubspot_import_audit_action_chk;

alter table public.fi_external_hubspot_import_audit
  add constraint fi_external_hubspot_import_audit_action_chk check (
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
      'pipeline_mapped',
      'contact_imported',
      'deal_imported',
      'contact_import_cancelled',
      'deal_import_cancelled',
      'contact_merged',
      'deal_merged'
    )
  );
