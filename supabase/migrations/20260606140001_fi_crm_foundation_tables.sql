-- Follicle Intelligence CRM foundation (Stage 2A): additive `fi_crm_*` tables only.
--
-- Design: docs/design/17-crm-foundation-architecture.md,
--         docs/design/18-crm-foundation-implementation-checklist.md
--
-- Does not: seed pipeline stages; alter existing foundation / ingest / dual-write tables.
-- RLS + privileges: `20260606150001_fi_crm_foundation_rls.sql` (Stage 2B).

-- ---------------------------------------------------------------------------
-- 1. fi_crm_pipeline_stages — tenant- (and optional org/clinic-) scoped funnel stages
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  organisation_id uuid references fi_organisations (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete cascade,
  pipeline_key text not null default 'hair_restoration_default',
  slug text not null,
  label text not null,
  sort_order int not null,
  is_entry boolean not null default false,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_crm_pipeline_stages is
  'CRM foundation: ordered pipeline stages per tenant (optional org/clinic scope). Default stages are lazy-seeded per tenant (doc 18), not via global migration.';

create index if not exists idx_fi_crm_pipeline_stages_tenant on fi_crm_pipeline_stages (tenant_id);
create index if not exists idx_fi_crm_pipeline_stages_tenant_org_clinic_pipeline
  on fi_crm_pipeline_stages (tenant_id, organisation_id, clinic_id, pipeline_key, sort_order);

create unique index if not exists idx_fi_crm_pipeline_stages_slug_tenant_default
  on fi_crm_pipeline_stages (tenant_id, pipeline_key, slug)
  where organisation_id is null and clinic_id is null;

create unique index if not exists idx_fi_crm_pipeline_stages_slug_tenant_org
  on fi_crm_pipeline_stages (tenant_id, organisation_id, pipeline_key, slug)
  where organisation_id is not null and clinic_id is null;

create unique index if not exists idx_fi_crm_pipeline_stages_slug_tenant_org_clinic
  on fi_crm_pipeline_stages (tenant_id, organisation_id, clinic_id, pipeline_key, slug)
  where organisation_id is not null and clinic_id is not null;

create unique index if not exists idx_fi_crm_pipeline_stages_slug_tenant_clinic_only
  on fi_crm_pipeline_stages (tenant_id, clinic_id, pipeline_key, slug)
  where clinic_id is not null and organisation_id is null;

-- ---------------------------------------------------------------------------
-- 2. fi_crm_leads — commercial journey anchor (person_id required per Stage 1O)
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  organisation_id uuid references fi_organisations (id) on delete set null,
  clinic_id uuid references fi_clinics (id) on delete set null,
  person_id uuid not null references fi_persons (id) on delete restrict,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  current_stage_id uuid references fi_crm_pipeline_stages (id) on delete set null,
  primary_owner_user_id uuid,
  status text not null default 'open',
  priority text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_crm_leads is
  'CRM foundation: primary commercial opportunity row; always tied to fi_persons; optional links to patient/case and pipeline stage.';

create index if not exists idx_fi_crm_leads_tenant on fi_crm_leads (tenant_id);
create index if not exists idx_fi_crm_leads_tenant_person on fi_crm_leads (tenant_id, person_id);
create index if not exists idx_fi_crm_leads_tenant_patient on fi_crm_leads (tenant_id, patient_id)
  where patient_id is not null;
create index if not exists idx_fi_crm_leads_tenant_case on fi_crm_leads (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_crm_leads_current_stage on fi_crm_leads (tenant_id, current_stage_id)
  where current_stage_id is not null;
create index if not exists idx_fi_crm_leads_tenant_org_clinic_updated
  on fi_crm_leads (tenant_id, organisation_id, clinic_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. fi_crm_lead_stage_history — append-only stage transitions
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid not null references fi_crm_leads (id) on delete cascade,
  from_stage_id uuid references fi_crm_pipeline_stages (id) on delete set null,
  to_stage_id uuid not null references fi_crm_pipeline_stages (id) on delete restrict,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  reason text,
  source text not null default 'user',
  fi_timeline_event_id uuid references fi_timeline_events (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

comment on table fi_crm_lead_stage_history is
  'CRM foundation: immutable audit of pipeline stage changes for analytics and external CRM sync.';

create index if not exists idx_fi_crm_lead_stage_history_tenant on fi_crm_lead_stage_history (tenant_id);
create index if not exists idx_fi_crm_lead_stage_history_lead_changed
  on fi_crm_lead_stage_history (lead_id, changed_at desc);
create index if not exists idx_fi_crm_lead_stage_history_timeline
  on fi_crm_lead_stage_history (fi_timeline_event_id)
  where fi_timeline_event_id is not null;

-- ---------------------------------------------------------------------------
-- 4. fi_crm_activity_events — CRM-native activity before/with clinical timeline rows
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_activity_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid not null references fi_crm_leads (id) on delete cascade,
  activity_kind text not null,
  title text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  fi_timeline_event_id uuid references fi_timeline_events (id) on delete set null,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null
);

comment on table fi_crm_activity_events is
  'CRM foundation: append-only activity stream for leads (including pre-case); links optionally to fi_timeline_events when a case-scoped timeline row exists.';

create index if not exists idx_fi_crm_activity_events_tenant on fi_crm_activity_events (tenant_id);
create index if not exists idx_fi_crm_activity_events_lead_occurred
  on fi_crm_activity_events (lead_id, occurred_at desc);
create index if not exists idx_fi_crm_activity_events_tenant_patient
  on fi_crm_activity_events (tenant_id, patient_id)
  where patient_id is not null;
create index if not exists idx_fi_crm_activity_events_tenant_case
  on fi_crm_activity_events (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_crm_activity_events_timeline
  on fi_crm_activity_events (fi_timeline_event_id)
  where fi_timeline_event_id is not null;

-- ---------------------------------------------------------------------------
-- 5. fi_crm_tasks — operational tasks (lead_id required per Stage 1O)
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid not null references fi_crm_leads (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  title text not null,
  description text,
  task_type text not null default 'follow_up',
  status text not null default 'open',
  due_at timestamptz,
  completed_at timestamptz,
  assignee_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_crm_tasks is
  'CRM foundation: work items (calls, follow-ups) anchored on fi_crm_leads with optional patient/case for navigation.';

create index if not exists idx_fi_crm_tasks_tenant on fi_crm_tasks (tenant_id);
create index if not exists idx_fi_crm_tasks_lead on fi_crm_tasks (tenant_id, lead_id);
create index if not exists idx_fi_crm_tasks_tenant_patient on fi_crm_tasks (tenant_id, patient_id)
  where patient_id is not null;
create index if not exists idx_fi_crm_tasks_tenant_case on fi_crm_tasks (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_crm_tasks_status_due
  on fi_crm_tasks (tenant_id, status, due_at);

-- ---------------------------------------------------------------------------
-- 6. fi_crm_notes — free-text notes (at least one anchor required)
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid references fi_crm_leads (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  author_user_id uuid,
  visibility text not null default 'team',
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_crm_notes_has_anchor check (
    lead_id is not null or patient_id is not null or case_id is not null
  )
);

comment on table fi_crm_notes is
  'CRM foundation: notes on lead and/or patient/case; visibility semantics enforced in app/RLS later.';

create index if not exists idx_fi_crm_notes_tenant on fi_crm_notes (tenant_id);
create index if not exists idx_fi_crm_notes_lead on fi_crm_notes (tenant_id, lead_id)
  where lead_id is not null;
create index if not exists idx_fi_crm_notes_tenant_patient on fi_crm_notes (tenant_id, patient_id)
  where patient_id is not null;
create index if not exists idx_fi_crm_notes_tenant_case on fi_crm_notes (tenant_id, case_id)
  where case_id is not null;

-- ---------------------------------------------------------------------------
-- 7. fi_crm_messages — channel-agnostic message log (metadata / preview first)
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid references fi_crm_leads (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  channel text not null,
  direction text not null,
  subject text,
  body_preview text,
  body_storage_ref text,
  external_thread_id text,
  external_message_id text,
  sent_at timestamptz,
  received_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_crm_messages_has_anchor check (
    lead_id is not null or patient_id is not null or case_id is not null
  )
);

comment on table fi_crm_messages is
  'CRM foundation: message log (preview/metadata in Phase 1); no full body in Postgres per implementation checklist.';

create index if not exists idx_fi_crm_messages_tenant on fi_crm_messages (tenant_id);
create index if not exists idx_fi_crm_messages_lead on fi_crm_messages (tenant_id, lead_id)
  where lead_id is not null;
create index if not exists idx_fi_crm_messages_tenant_patient on fi_crm_messages (tenant_id, patient_id)
  where patient_id is not null;
create index if not exists idx_fi_crm_messages_tenant_case on fi_crm_messages (tenant_id, case_id)
  where case_id is not null;
create unique index if not exists idx_fi_crm_messages_external_dedupe
  on fi_crm_messages (tenant_id, external_message_id)
  where external_message_id is not null;

-- ---------------------------------------------------------------------------
-- 8. fi_crm_quote_templates — reusable quote structure (no enforced global pricing)
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_quote_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  organisation_id uuid references fi_organisations (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  schema_version int not null default 1,
  line_items_schema jsonb not null default '[]'::jsonb,
  terms_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_crm_quote_templates is
  'CRM foundation: tenant/org/clinic-scoped quote templates (line-item shape via JSON; amounts live on quote instances).';

create index if not exists idx_fi_crm_quote_templates_tenant on fi_crm_quote_templates (tenant_id);

create unique index if not exists idx_fi_crm_quote_templates_slug_tenant_default
  on fi_crm_quote_templates (tenant_id, slug)
  where organisation_id is null and clinic_id is null;

create unique index if not exists idx_fi_crm_quote_templates_slug_tenant_org
  on fi_crm_quote_templates (tenant_id, organisation_id, slug)
  where organisation_id is not null and clinic_id is null;

create unique index if not exists idx_fi_crm_quote_templates_slug_tenant_org_clinic
  on fi_crm_quote_templates (tenant_id, organisation_id, clinic_id, slug)
  where organisation_id is not null and clinic_id is not null;

create unique index if not exists idx_fi_crm_quote_templates_slug_tenant_clinic_only
  on fi_crm_quote_templates (tenant_id, clinic_id, slug)
  where clinic_id is not null and organisation_id is null;

-- ---------------------------------------------------------------------------
-- 9. fi_crm_quotes — issued proposal snapshots
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid references fi_crm_leads (id) on delete cascade,
  case_id uuid references fi_cases (id) on delete cascade,
  quote_template_id uuid references fi_crm_quote_templates (id) on delete set null,
  status text not null default 'draft',
  currency text,
  line_items_snapshot jsonb not null default '[]'::jsonb,
  subtotal_amount numeric,
  total_amount numeric,
  valid_until timestamptz,
  sent_at timestamptz,
  responded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_crm_quotes_has_anchor check (lead_id is not null or case_id is not null)
);

comment on table fi_crm_quotes is
  'CRM foundation: quote instances with JSON snapshots and optional monetary totals.';

create index if not exists idx_fi_crm_quotes_tenant on fi_crm_quotes (tenant_id);
create index if not exists idx_fi_crm_quotes_lead on fi_crm_quotes (tenant_id, lead_id)
  where lead_id is not null;
create index if not exists idx_fi_crm_quotes_case on fi_crm_quotes (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_crm_quotes_template on fi_crm_quotes (tenant_id, quote_template_id)
  where quote_template_id is not null;

-- ---------------------------------------------------------------------------
-- 10. fi_crm_lead_source_ids — external CRM/marketing id → fi_crm_leads
-- ---------------------------------------------------------------------------
create table if not exists fi_crm_lead_source_ids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid not null references fi_crm_leads (id) on delete cascade,
  source_system text not null,
  source_lead_id text not null,
  created_at timestamptz not null default now(),
  constraint fi_crm_lead_source_ids_unique_mapping unique (tenant_id, source_system, source_lead_id)
);

comment on table fi_crm_lead_source_ids is
  'CRM foundation: idempotent mapping of external lead/deal identifiers (e.g. hubspot) to fi_crm_leads.';

create index if not exists idx_fi_crm_lead_source_ids_lead on fi_crm_lead_source_ids (tenant_id, lead_id);
create index if not exists idx_fi_crm_lead_source_ids_lookup
  on fi_crm_lead_source_ids (tenant_id, source_system, source_lead_id);
