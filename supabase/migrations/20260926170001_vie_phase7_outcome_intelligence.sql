-- VIE Phase 7 — Outcome Intelligence Engine (evidence readiness summaries)

create table if not exists fi_vie_outcome_summaries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  case_id uuid references fi_cases (id) on delete set null,
  overall_outcome_readiness_score numeric(5, 2) not null default 0,
  confidence_band text not null default 'low',
  audit_ready boolean not null default false,
  clinical_review_recommended boolean not null default false,
  domains jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_vie_outcome_summaries_confidence_chk check (
    confidence_band in ('high', 'medium', 'low')
  ),
  constraint fi_vie_outcome_summaries_domains_array check (jsonb_typeof (domains) = 'array'),
  constraint fi_vie_outcome_summaries_warnings_array check (jsonb_typeof (warnings) = 'array'),
  constraint fi_vie_outcome_summaries_next_actions_array check (jsonb_typeof (next_actions) = 'array'),
  constraint fi_vie_outcome_summaries_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_vie_outcome_summaries_score_range check (
    overall_outcome_readiness_score >= 0
    and overall_outcome_readiness_score <= 100
  )
);

comment on table fi_vie_outcome_summaries is
  'VIE Phase 7: deterministic outcome readiness summaries from accepted captures, comparisons, and alignment.';

create unique index if not exists idx_fi_vie_outcome_summaries_patient_null_case
  on fi_vie_outcome_summaries (tenant_id, patient_id)
  where case_id is null;

create unique index if not exists idx_fi_vie_outcome_summaries_patient_case
  on fi_vie_outcome_summaries (tenant_id, patient_id, case_id)
  where case_id is not null;

create index if not exists idx_fi_vie_outcome_summaries_patient
  on fi_vie_outcome_summaries (tenant_id, patient_id, generated_at desc);

create index if not exists idx_fi_vie_outcome_summaries_case
  on fi_vie_outcome_summaries (tenant_id, case_id)
  where case_id is not null;

create index if not exists idx_fi_vie_outcome_summaries_audit_ready
  on fi_vie_outcome_summaries (tenant_id, audit_ready)
  where audit_ready = true;

create index if not exists idx_fi_vie_outcome_summaries_confidence
  on fi_vie_outcome_summaries (tenant_id, confidence_band);

create index if not exists idx_fi_vie_outcome_summaries_generated_at
  on fi_vie_outcome_summaries (tenant_id, generated_at desc);

alter table fi_vie_outcome_summaries enable row level security;

drop policy if exists fi_vie_outcome_summaries_select_member on fi_vie_outcome_summaries;
create policy fi_vie_outcome_summaries_select_member on fi_vie_outcome_summaries for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_vie_outcome_summaries.tenant_id
  )
);

revoke all on fi_vie_outcome_summaries from public;
grant select on fi_vie_outcome_summaries to authenticated, service_role;
grant insert, update, delete on fi_vie_outcome_summaries to service_role;
