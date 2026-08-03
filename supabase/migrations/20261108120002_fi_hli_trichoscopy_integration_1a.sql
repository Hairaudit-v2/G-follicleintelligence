-- FI-TRICHOSCOPY-1A clinical integration tables (FiOS owns workflow; HLI owns evidence).
-- Additive, tenant-isolated, no raw image binaries. Soft cancellation; pack versions retained.

-- ---------------------------------------------------------------------------
-- fi_hli_trichoscopy_links
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  fios_patient_id uuid not null references public.fi_patients (id) on delete cascade,
  fios_case_id uuid references public.fi_cases (id) on delete set null,
  fios_consultation_id uuid,
  fios_treatment_plan_id uuid,
  fios_surgery_case_id uuid,
  hli_tenant_reference text not null,
  hli_patient_reference text not null,
  hli_intake_id text,
  hli_episode_id text,
  purpose text not null,
  status text not null default 'not_requested',
  active_evidence_pack_id uuid,
  latest_session_id text,
  latest_assessment_id text,
  requested_by_user_id uuid references public.fi_users (id) on delete set null,
  requested_at timestamptz,
  linked_at timestamptz,
  last_synced_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_links_purpose_chk check (
    purpose in (
      'consultation',
      'treatment_baseline',
      'treatment_followup',
      'donor_assessment',
      'recipient_assessment',
      'pre_surgery',
      'revision_review',
      'procedure_day',
      'post_surgery',
      'scalp_review',
      'custom'
    )
  ),
  constraint fi_hli_trichoscopy_links_status_chk check (
    status in (
      'not_requested',
      'requested',
      'linked',
      'capture_due',
      'capture_in_progress',
      'capture_complete',
      'analysis_pending',
      'review_pending',
      'confirmed',
      'confirmed_with_limitations',
      'repeat_capture_required',
      'medical_review_required',
      'completed',
      'cancelled',
      'integration_error'
    )
  ),
  constraint fi_hli_trichoscopy_links_hli_tenant_nonempty check (char_length(trim(hli_tenant_reference)) > 0),
  constraint fi_hli_trichoscopy_links_hli_patient_nonempty check (char_length(trim(hli_patient_reference)) > 0),
  constraint fi_hli_trichoscopy_links_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_links is
  'Durable FiOS↔HLI trichoscopy identity links. Tenant-scoped; historical links remain auditable.';

create index if not exists idx_fi_hli_trichoscopy_links_tenant_patient
  on public.fi_hli_trichoscopy_links (tenant_id, fios_patient_id, created_at desc);

create index if not exists idx_fi_hli_trichoscopy_links_tenant_episode
  on public.fi_hli_trichoscopy_links (tenant_id, hli_episode_id)
  where hli_episode_id is not null;

create unique index if not exists uq_fi_hli_trichoscopy_links_active_purpose
  on public.fi_hli_trichoscopy_links (tenant_id, fios_patient_id, coalesce(fios_case_id, '00000000-0000-0000-0000-000000000000'::uuid), purpose)
  where cancelled_at is null and status not in ('cancelled', 'completed');

-- ---------------------------------------------------------------------------
-- fi_hli_trichoscopy_requests
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  link_id uuid references public.fi_hli_trichoscopy_links (id) on delete set null,
  fios_patient_id uuid not null references public.fi_patients (id) on delete cascade,
  fios_case_id uuid references public.fi_cases (id) on delete set null,
  consultation_id uuid,
  treatment_plan_id uuid,
  surgery_case_id uuid,
  purpose text not null,
  requested_sites text[] not null default '{}'::text[],
  clinical_question text,
  target_date date,
  urgency text not null default 'routine',
  requested_by_user_id uuid not null references public.fi_users (id) on delete restrict,
  idempotency_key text not null,
  hli_request_id text,
  hli_patient_reference text,
  hli_intake_id text,
  hli_episode_id text,
  capture_protocol_version text,
  capture_url text,
  status text not null default 'requested',
  hli_response jsonb,
  entitlement_context jsonb not null default '{}'::jsonb,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_requests_idempotency_unique unique (tenant_id, idempotency_key),
  constraint fi_hli_trichoscopy_requests_urgency_chk check (urgency in ('routine', 'priority')),
  constraint fi_hli_trichoscopy_requests_status_chk check (
    status in (
      'requested',
      'accepted',
      'failed',
      'cancelled',
      'integration_error'
    )
  ),
  constraint fi_hli_trichoscopy_requests_entitlement_object check (jsonb_typeof(entitlement_context) = 'object')
);

comment on table public.fi_hli_trichoscopy_requests is
  'FiOS trichoscopy request records with HLI idempotency keys. Persist HLI response before success.';

create index if not exists idx_fi_hli_trichoscopy_requests_tenant_patient
  on public.fi_hli_trichoscopy_requests (tenant_id, fios_patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- fi_hli_trichoscopy_event_receipts
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_event_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  event_id text not null,
  event_type text not null,
  event_version text not null,
  occurred_at timestamptz not null,
  idempotency_key text not null,
  link_id uuid references public.fi_hli_trichoscopy_links (id) on delete set null,
  hli_episode_id text,
  hli_session_id text,
  hli_assessment_id text,
  hli_evidence_pack_id text,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'accepted',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_event_receipts_event_unique unique (tenant_id, event_id),
  constraint fi_hli_trichoscopy_event_receipts_idempotency_unique unique (tenant_id, idempotency_key),
  constraint fi_hli_trichoscopy_event_receipts_processing_chk check (
    processing_status in ('accepted', 'processed', 'ignored', 'failed', 'queued')
  ),
  constraint fi_hli_trichoscopy_event_receipts_payload_object check (jsonb_typeof(payload) = 'object')
);

comment on table public.fi_hli_trichoscopy_event_receipts is
  'Authenticated HLI trichoscopy event receipts with deduplication by event_id and idempotency_key.';

create index if not exists idx_fi_hli_trichoscopy_event_receipts_tenant_created
  on public.fi_hli_trichoscopy_event_receipts (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- fi_hli_trichoscopy_evidence_packs
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_evidence_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  link_id uuid not null references public.fi_hli_trichoscopy_links (id) on delete cascade,
  hli_evidence_pack_id text not null,
  pack_type text not null,
  pack_version text not null,
  hli_episode_id text,
  hli_assessment_id text,
  confirmation_state text not null default 'confirmed',
  reviewer_reference text,
  confirmed_at timestamptz,
  sites_assessed text[] not null default '{}'::text[],
  sites_missing text[] not null default '{}'::text[],
  findings_summary jsonb not null default '{}'::jsonb,
  metrics_summary jsonb not null default '{}'::jsonb,
  confidence numeric,
  limitations text[] not null default '{}'::text[],
  escalations text[] not null default '{}'::text[],
  patient_publication_state text,
  safety_assertions jsonb not null default '{}'::jsonb,
  source_checksum text,
  local_state text not null default 'active',
  superseded_by_id uuid references public.fi_hli_trichoscopy_evidence_packs (id) on delete set null,
  retrieved_at timestamptz not null default now(),
  pack_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_evidence_packs_hli_pack_unique unique (tenant_id, hli_evidence_pack_id, pack_version),
  constraint fi_hli_trichoscopy_evidence_packs_local_state_chk check (
    local_state in ('active', 'superseded', 'withdrawn')
  ),
  constraint fi_hli_trichoscopy_evidence_packs_findings_object check (jsonb_typeof(findings_summary) = 'object'),
  constraint fi_hli_trichoscopy_evidence_packs_metrics_object check (jsonb_typeof(metrics_summary) = 'object'),
  constraint fi_hli_trichoscopy_evidence_packs_safety_object check (jsonb_typeof(safety_assertions) = 'object'),
  constraint fi_hli_trichoscopy_evidence_packs_payload_object check (jsonb_typeof(pack_payload) = 'object')
);

comment on table public.fi_hli_trichoscopy_evidence_packs is
  'Imported confirmed HLI evidence packs. Immutable versions; newer packs supersede without overwrite.';

create index if not exists idx_fi_hli_trichoscopy_evidence_packs_link
  on public.fi_hli_trichoscopy_evidence_packs (link_id, retrieved_at desc);

create index if not exists idx_fi_hli_trichoscopy_evidence_packs_tenant_state
  on public.fi_hli_trichoscopy_evidence_packs (tenant_id, local_state);

-- ---------------------------------------------------------------------------
-- fi_hli_trichoscopy_sync_failures
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_sync_failures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  link_id uuid references public.fi_hli_trichoscopy_links (id) on delete set null,
  request_id uuid references public.fi_hli_trichoscopy_requests (id) on delete set null,
  failure_kind text not null,
  error_code text,
  error_message text not null,
  retryable boolean not null default true,
  attempt_count integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_sync_failures_kind_nonempty check (char_length(trim(failure_kind)) > 0),
  constraint fi_hli_trichoscopy_sync_failures_message_nonempty check (char_length(trim(error_message)) > 0),
  constraint fi_hli_trichoscopy_sync_failures_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_sync_failures is
  'Technical sync failures for authorised retry. Not shown to patients.';

create index if not exists idx_fi_hli_trichoscopy_sync_failures_open
  on public.fi_hli_trichoscopy_sync_failures (tenant_id, created_at desc)
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- fi_hli_trichoscopy_reconciliation_runs
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  link_id uuid references public.fi_hli_trichoscopy_links (id) on delete set null,
  hli_episode_id text,
  run_type text not null default 'manual',
  status text not null default 'running',
  changes_made jsonb not null default '[]'::jsonb,
  discrepancies jsonb not null default '[]'::jsonb,
  failures jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  triggered_by_user_id uuid references public.fi_users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_reconciliation_runs_status_chk check (
    status in ('running', 'completed', 'failed', 'partial')
  ),
  constraint fi_hli_trichoscopy_reconciliation_runs_run_type_chk check (
    run_type in ('manual', 'scheduled', 'event_driven')
  ),
  constraint fi_hli_trichoscopy_reconciliation_runs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_reconciliation_runs is
  'Reconciliation runs comparing FiOS link state with HLI episode / evidence state.';

create index if not exists idx_fi_hli_trichoscopy_reconciliation_runs_tenant
  on public.fi_hli_trichoscopy_reconciliation_runs (tenant_id, started_at desc);

-- ---------------------------------------------------------------------------
-- fi_hli_trichoscopy_status_history
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  link_id uuid not null references public.fi_hli_trichoscopy_links (id) on delete cascade,
  previous_status text,
  new_status text not null,
  source text not null default 'system',
  actor_user_id uuid references public.fi_users (id) on delete set null,
  event_receipt_id uuid references public.fi_hli_trichoscopy_event_receipts (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_status_history_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_fi_hli_trichoscopy_status_history_link
  on public.fi_hli_trichoscopy_status_history (link_id, created_at desc);

-- ---------------------------------------------------------------------------
-- fi_hli_trichoscopy_case_actions
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_case_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  link_id uuid not null references public.fi_hli_trichoscopy_links (id) on delete cascade,
  fios_patient_id uuid not null references public.fi_patients (id) on delete cascade,
  action_type text not null,
  status text not null default 'open',
  title text not null,
  description text,
  assignee_role text,
  idempotency_key text not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_case_actions_idempotency_unique unique (tenant_id, idempotency_key),
  constraint fi_hli_trichoscopy_case_actions_status_chk check (
    status in ('open', 'closed', 'cancelled')
  ),
  constraint fi_hli_trichoscopy_case_actions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_fi_hli_trichoscopy_case_actions_open
  on public.fi_hli_trichoscopy_case_actions (tenant_id, fios_patient_id, status)
  where status = 'open';

-- updated_at
create or replace function public.fi_hli_trichoscopy_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_hli_trichoscopy_links_updated_at on public.fi_hli_trichoscopy_links;
create trigger trg_fi_hli_trichoscopy_links_updated_at
  before update on public.fi_hli_trichoscopy_links
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

drop trigger if exists trg_fi_hli_trichoscopy_requests_updated_at on public.fi_hli_trichoscopy_requests;
create trigger trg_fi_hli_trichoscopy_requests_updated_at
  before update on public.fi_hli_trichoscopy_requests
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

drop trigger if exists trg_fi_hli_trichoscopy_evidence_packs_updated_at on public.fi_hli_trichoscopy_evidence_packs;
create trigger trg_fi_hli_trichoscopy_evidence_packs_updated_at
  before update on public.fi_hli_trichoscopy_evidence_packs
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

drop trigger if exists trg_fi_hli_trichoscopy_case_actions_updated_at on public.fi_hli_trichoscopy_case_actions;
create trigger trg_fi_hli_trichoscopy_case_actions_updated_at
  before update on public.fi_hli_trichoscopy_case_actions
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: authenticated tenant members may select; service_role for DML
-- ---------------------------------------------------------------------------
alter table public.fi_hli_trichoscopy_links enable row level security;
alter table public.fi_hli_trichoscopy_requests enable row level security;
alter table public.fi_hli_trichoscopy_event_receipts enable row level security;
alter table public.fi_hli_trichoscopy_evidence_packs enable row level security;
alter table public.fi_hli_trichoscopy_sync_failures enable row level security;
alter table public.fi_hli_trichoscopy_reconciliation_runs enable row level security;
alter table public.fi_hli_trichoscopy_status_history enable row level security;
alter table public.fi_hli_trichoscopy_case_actions enable row level security;

revoke all on public.fi_hli_trichoscopy_links from public;
revoke all on public.fi_hli_trichoscopy_requests from public;
revoke all on public.fi_hli_trichoscopy_event_receipts from public;
revoke all on public.fi_hli_trichoscopy_evidence_packs from public;
revoke all on public.fi_hli_trichoscopy_sync_failures from public;
revoke all on public.fi_hli_trichoscopy_reconciliation_runs from public;
revoke all on public.fi_hli_trichoscopy_status_history from public;
revoke all on public.fi_hli_trichoscopy_case_actions from public;

-- Clinical tables: tenant member select (server still enforces capability gates)
drop policy if exists fi_hli_trichoscopy_links_select_member on public.fi_hli_trichoscopy_links;
create policy fi_hli_trichoscopy_links_select_member on public.fi_hli_trichoscopy_links
  for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_links.tenant_id
    )
  );

drop policy if exists fi_hli_trichoscopy_requests_select_member on public.fi_hli_trichoscopy_requests;
create policy fi_hli_trichoscopy_requests_select_member on public.fi_hli_trichoscopy_requests
  for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_requests.tenant_id
    )
  );

drop policy if exists fi_hli_trichoscopy_evidence_packs_select_member on public.fi_hli_trichoscopy_evidence_packs;
create policy fi_hli_trichoscopy_evidence_packs_select_member on public.fi_hli_trichoscopy_evidence_packs
  for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_evidence_packs.tenant_id
    )
  );

drop policy if exists fi_hli_trichoscopy_status_history_select_member on public.fi_hli_trichoscopy_status_history;
create policy fi_hli_trichoscopy_status_history_select_member on public.fi_hli_trichoscopy_status_history
  for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_status_history.tenant_id
    )
  );

drop policy if exists fi_hli_trichoscopy_case_actions_select_member on public.fi_hli_trichoscopy_case_actions;
create policy fi_hli_trichoscopy_case_actions_select_member on public.fi_hli_trichoscopy_case_actions
  for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_case_actions.tenant_id
    )
  );

-- Event receipts, sync failures, reconciliation: service_role only (technical)
grant select, insert, update, delete on public.fi_hli_trichoscopy_links to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_requests to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_event_receipts to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_evidence_packs to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_sync_failures to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_reconciliation_runs to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_status_history to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_case_actions to service_role;

grant select on public.fi_hli_trichoscopy_links to authenticated;
grant select on public.fi_hli_trichoscopy_requests to authenticated;
grant select on public.fi_hli_trichoscopy_evidence_packs to authenticated;
grant select on public.fi_hli_trichoscopy_status_history to authenticated;
grant select on public.fi_hli_trichoscopy_case_actions to authenticated;
