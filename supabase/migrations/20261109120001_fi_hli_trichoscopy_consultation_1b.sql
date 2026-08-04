-- FI-TRICHOSCOPY-1B — Consultation integration tables.
-- Extends 1A; FiOS remains canonical consultation record. Additive, soft-disable friendly.
-- Do not drop tables on rollback; disable via flag / tenant config.

-- ---------------------------------------------------------------------------
-- Consultation-scoped link overlay (1:N consult↔request/assessment)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_consultation_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  consultation_id uuid not null references public.fi_consultations (id) on delete cascade,
  fios_patient_id uuid not null references public.fi_patients (id) on delete cascade,
  link_id uuid references public.fi_hli_trichoscopy_links (id) on delete set null,
  request_id uuid references public.fi_hli_trichoscopy_requests (id) on delete set null,
  evidence_pack_id uuid references public.fi_hli_trichoscopy_evidence_packs (id) on delete set null,
  request_mode text not null default 'new_assessment',
  consultation_status text not null default 'not_required',
  -- Frozen evidence identity once consultation review/decision pins a pack version
  pinned_hli_assessment_id text,
  pinned_evidence_pack_id uuid references public.fi_hli_trichoscopy_evidence_packs (id) on delete set null,
  pinned_pack_version text,
  pinned_findings_schema_version text,
  pinned_at timestamptz,
  pinned_by_user_id uuid references public.fi_users (id) on delete set null,
  consultation_finalised_at timestamptz,
  defer_reason text,
  not_required_reason text,
  blocking_reason_codes text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_consultation_links_mode_chk check (
    request_mode in (
      'new_assessment',
      'link_existing',
      'repeat_assessment',
      'additional_evidence'
    )
  ),
  constraint fi_hli_trichoscopy_consultation_links_status_chk check (
    consultation_status in (
      'not_required',
      'recommended',
      'required_before_treatment',
      'already_available',
      'requested',
      'in_progress',
      'ready_for_review',
      'reviewed',
      'insufficient',
      'superseded',
      'withdrawn',
      'failed',
      'deferred'
    )
  ),
  constraint fi_hli_trichoscopy_consultation_links_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_consultation_links is
  'Consultation↔HLI trichoscopy association. Pins evidence-pack version used for decisions; does not rewrite completed consultations.';

create unique index if not exists uq_fi_hli_trichoscopy_consultation_links_active
  on public.fi_hli_trichoscopy_consultation_links (tenant_id, consultation_id)
  where consultation_status not in ('withdrawn', 'failed');

create index if not exists idx_fi_hli_trichoscopy_consultation_links_patient
  on public.fi_hli_trichoscopy_consultation_links (tenant_id, fios_patient_id, created_at desc);

create index if not exists idx_fi_hli_trichoscopy_consultation_links_link
  on public.fi_hli_trichoscopy_consultation_links (link_id)
  where link_id is not null;

-- ---------------------------------------------------------------------------
-- Structured indication capture
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_indications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  consultation_id uuid not null references public.fi_consultations (id) on delete cascade,
  consultation_link_id uuid references public.fi_hli_trichoscopy_consultation_links (id) on delete set null,
  fios_patient_id uuid not null references public.fi_patients (id) on delete cascade,
  indication_codes text[] not null default '{}'::text[],
  clinician_note text,
  urgency text not null default 'routine',
  anatomical_regions text[] not null default '{}'::text[],
  wait_for_treatment_planning boolean not null default false,
  medical_review_required boolean not null default false,
  patient_consent_capture boolean not null default false,
  patient_consent_transfer boolean not null default false,
  symptoms text,
  onset_progression text,
  known_diagnoses text,
  current_treatments text,
  relevant_medications text,
  recent_procedures text,
  available_blood_results_summary text,
  clinician_question text,
  created_by_user_id uuid not null references public.fi_users (id) on delete restrict,
  updated_by_user_id uuid references public.fi_users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_indications_urgency_chk check (
    urgency in ('routine', 'priority', 'urgent')
  ),
  constraint fi_hli_trichoscopy_indications_codes_nonempty check (cardinality(indication_codes) > 0),
  constraint fi_hli_trichoscopy_indications_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_indications is
  'Structured trichoscopy indication for a consultation. Codes are clinical context for HLI, not confirmed diagnoses.';

create unique index if not exists uq_fi_hli_trichoscopy_indications_consultation
  on public.fi_hli_trichoscopy_indications (tenant_id, consultation_id);

create index if not exists idx_fi_hli_trichoscopy_indications_patient
  on public.fi_hli_trichoscopy_indications (tenant_id, fios_patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Normalised, versioned findings from HLI evidence packs
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  consultation_id uuid references public.fi_consultations (id) on delete set null,
  consultation_link_id uuid references public.fi_hli_trichoscopy_consultation_links (id) on delete set null,
  link_id uuid not null references public.fi_hli_trichoscopy_links (id) on delete cascade,
  evidence_pack_id uuid not null references public.fi_hli_trichoscopy_evidence_packs (id) on delete cascade,
  hli_assessment_id text,
  hli_finding_id text,
  finding_domain text not null,
  finding_code text not null,
  observed_region text,
  severity text,
  extent text,
  confidence numeric,
  evidence_quality text,
  supporting_evidence_refs jsonb not null default '[]'::jsonb,
  alternative_interpretations jsonb not null default '[]'::jsonb,
  limitations text[] not null default '{}'::text[],
  recommended_next_step text,
  is_significant boolean not null default false,
  is_escalation boolean not null default false,
  pack_version text not null,
  findings_schema_version text not null default '1b.1',
  generated_at timestamptz,
  received_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_findings_domain_chk check (
    finding_domain in (
      'evidence_quality',
      'hair_follicular',
      'scalp_inflammatory',
      'distribution_pattern',
      'donor',
      'interpretation',
      'safety_escalation',
      'limitation',
      'other'
    )
  ),
  constraint fi_hli_trichoscopy_findings_supporting_array check (jsonb_typeof(supporting_evidence_refs) = 'array'),
  constraint fi_hli_trichoscopy_findings_alt_array check (jsonb_typeof(alternative_interpretations) = 'array'),
  constraint fi_hli_trichoscopy_findings_raw_object check (jsonb_typeof(raw_payload) = 'object'),
  constraint fi_hli_trichoscopy_findings_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_findings is
  'Normalised HLI trichoscopy findings. Observations and assessment support only — never auto-diagnoses.';

create unique index if not exists uq_fi_hli_trichoscopy_findings_pack_code
  on public.fi_hli_trichoscopy_findings (
    tenant_id,
    evidence_pack_id,
    coalesce(hli_finding_id, finding_code),
    coalesce(observed_region, '-')
  );

create index if not exists idx_fi_hli_trichoscopy_findings_consultation
  on public.fi_hli_trichoscopy_findings (tenant_id, consultation_id, created_at desc)
  where consultation_id is not null;

create index if not exists idx_fi_hli_trichoscopy_findings_significant
  on public.fi_hli_trichoscopy_findings (tenant_id, consultation_id)
  where is_significant = true or is_escalation = true;

-- ---------------------------------------------------------------------------
-- Clinician acknowledgement / interpretation
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_finding_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  consultation_id uuid not null references public.fi_consultations (id) on delete cascade,
  finding_id uuid not null references public.fi_hli_trichoscopy_findings (id) on delete cascade,
  evidence_pack_id uuid not null references public.fi_hli_trichoscopy_evidence_packs (id) on delete cascade,
  pack_version text not null,
  acknowledgement_state text not null default 'not_reviewed',
  clinician_interpretation text,
  disagreement_reason text,
  qualification_note text,
  associated_action_type text,
  associated_action_id uuid,
  reviewing_user_id uuid not null references public.fi_users (id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_finding_reviews_state_chk check (
    acknowledgement_state in (
      'not_reviewed',
      'acknowledged',
      'accepted_into_assessment',
      'accepted_with_qualification',
      'not_clinically_significant',
      'disagreed',
      'requires_more_evidence',
      'escalated',
      'superseded'
    )
  ),
  constraint fi_hli_trichoscopy_finding_reviews_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_finding_reviews is
  'Clinician acknowledgement of HLI findings. Diagnosis/treatment requires explicit acceptance.';

create unique index if not exists uq_fi_hli_trichoscopy_finding_reviews_latest
  on public.fi_hli_trichoscopy_finding_reviews (tenant_id, consultation_id, finding_id);

create index if not exists idx_fi_hli_trichoscopy_finding_reviews_state
  on public.fi_hli_trichoscopy_finding_reviews (tenant_id, consultation_id, acknowledgement_state);

-- ---------------------------------------------------------------------------
-- Decision provenance: finding → diagnosis / investigation / treatment / follow-up
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_decision_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  consultation_id uuid not null references public.fi_consultations (id) on delete cascade,
  finding_id uuid references public.fi_hli_trichoscopy_findings (id) on delete set null,
  finding_review_id uuid references public.fi_hli_trichoscopy_finding_reviews (id) on delete set null,
  evidence_pack_id uuid references public.fi_hli_trichoscopy_evidence_packs (id) on delete set null,
  pack_version text,
  decision_kind text not null,
  target_entity_type text not null,
  target_entity_id uuid,
  target_code text,
  decision_summary text,
  qualification_note text,
  accepting_user_id uuid not null references public.fi_users (id) on delete restrict,
  accepted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_decision_links_kind_chk check (
    decision_kind in (
      'primary_diagnosis',
      'differential_diagnosis',
      'working_diagnosis',
      'diagnosis_under_investigation',
      'exclusion',
      'investigation',
      'treatment',
      'referral',
      'biopsy_consideration',
      'escalation',
      'monitoring',
      'follow_up_trichoscopy',
      'defer_treatment',
      'patient_communication'
    )
  ),
  constraint fi_hli_trichoscopy_decision_links_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_decision_links is
  'Auditable chain: evidence → finding → clinician interpretation → FiOS clinical decision.';

create index if not exists idx_fi_hli_trichoscopy_decision_links_consultation
  on public.fi_hli_trichoscopy_decision_links (tenant_id, consultation_id, created_at desc);

create index if not exists idx_fi_hli_trichoscopy_decision_links_finding
  on public.fi_hli_trichoscopy_decision_links (finding_id)
  where finding_id is not null;

-- ---------------------------------------------------------------------------
-- Tenant consultation rules (recommendation / blocking)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_consultation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  enabled boolean not null default true,
  recommend_on_indication_codes text[] not null default '{}'::text[],
  require_before_treatment_codes text[] not null default '{}'::text[],
  block_on_scarring_escalation boolean not null default true,
  block_on_urgent_medical_unresolved boolean not null default true,
  block_before_surgical_suitability boolean not null default false,
  allow_complete_when_pending boolean not null default true,
  allow_complete_when_hli_unavailable boolean not null default true,
  default_followup_interval_months integer,
  settings jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references public.fi_users (id) on delete set null,
  updated_by_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_consultation_rules_tenant_unique unique (tenant_id),
  constraint fi_hli_trichoscopy_consultation_rules_settings_object check (jsonb_typeof(settings) = 'object')
);

comment on table public.fi_hli_trichoscopy_consultation_rules is
  'Tenant-configurable trichoscopy recommendation and consultation-completion rules.';

-- ---------------------------------------------------------------------------
-- Follow-up reassessment plans
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_followups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  consultation_id uuid not null references public.fi_consultations (id) on delete cascade,
  fios_patient_id uuid not null references public.fi_patients (id) on delete cascade,
  baseline_consultation_link_id uuid references public.fi_hli_trichoscopy_consultation_links (id) on delete set null,
  baseline_link_id uuid references public.fi_hli_trichoscopy_links (id) on delete set null,
  baseline_evidence_pack_id uuid references public.fi_hli_trichoscopy_evidence_packs (id) on delete set null,
  followup_request_id uuid references public.fi_hli_trichoscopy_requests (id) on delete set null,
  target_date date,
  target_interval_months integer,
  regions_to_repeat text[] not null default '{}'::text[],
  treatment_being_monitored text,
  expected_evidence_requirements text,
  responsible_user_id uuid references public.fi_users (id) on delete set null,
  responsible_team text,
  patient_instructions text,
  status text not null default 'scheduled',
  created_by_user_id uuid not null references public.fi_users (id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_followups_status_chk check (
    status in ('scheduled', 'requested', 'completed', 'cancelled', 'overdue')
  ),
  constraint fi_hli_trichoscopy_followups_interval_chk check (
    target_interval_months is null
    or target_interval_months in (3, 6, 9, 12)
    or target_interval_months > 0
  ),
  constraint fi_hli_trichoscopy_followups_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_hli_trichoscopy_followups is
  'Longitudinal trichoscopy follow-up plans linked to baseline assessments without overwriting them.';

create index if not exists idx_fi_hli_trichoscopy_followups_patient
  on public.fi_hli_trichoscopy_followups (tenant_id, fios_patient_id, target_date);

create index if not exists idx_fi_hli_trichoscopy_followups_open
  on public.fi_hli_trichoscopy_followups (tenant_id, status, target_date)
  where status in ('scheduled', 'requested', 'overdue');

-- ---------------------------------------------------------------------------
-- Consultation trichoscopy audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.fi_hli_trichoscopy_consultation_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  consultation_id uuid not null references public.fi_consultations (id) on delete cascade,
  fios_patient_id uuid references public.fi_patients (id) on delete set null,
  actor_user_id uuid references public.fi_users (id) on delete set null,
  action text not null,
  source text not null default 'fios',
  evidence_pack_id uuid,
  pack_version text,
  finding_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_hli_trichoscopy_consultation_audit_action_nonempty check (char_length(trim(action)) > 0),
  constraint fi_hli_trichoscopy_consultation_audit_payload_object check (jsonb_typeof(payload) = 'object')
);

comment on table public.fi_hli_trichoscopy_consultation_audit is
  'Audit of consultation trichoscopy indication, request, review, decision, and access events.';

create index if not exists idx_fi_hli_trichoscopy_consultation_audit_consult
  on public.fi_hli_trichoscopy_consultation_audit (tenant_id, consultation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse 1A function if present)
-- ---------------------------------------------------------------------------
create or replace function public.fi_hli_trichoscopy_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_hli_trichoscopy_consultation_links_updated_at
  on public.fi_hli_trichoscopy_consultation_links;
create trigger trg_fi_hli_trichoscopy_consultation_links_updated_at
  before update on public.fi_hli_trichoscopy_consultation_links
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

drop trigger if exists trg_fi_hli_trichoscopy_indications_updated_at
  on public.fi_hli_trichoscopy_indications;
create trigger trg_fi_hli_trichoscopy_indications_updated_at
  before update on public.fi_hli_trichoscopy_indications
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

drop trigger if exists trg_fi_hli_trichoscopy_findings_updated_at
  on public.fi_hli_trichoscopy_findings;
create trigger trg_fi_hli_trichoscopy_findings_updated_at
  before update on public.fi_hli_trichoscopy_findings
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

drop trigger if exists trg_fi_hli_trichoscopy_finding_reviews_updated_at
  on public.fi_hli_trichoscopy_finding_reviews;
create trigger trg_fi_hli_trichoscopy_finding_reviews_updated_at
  before update on public.fi_hli_trichoscopy_finding_reviews
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

drop trigger if exists trg_fi_hli_trichoscopy_consultation_rules_updated_at
  on public.fi_hli_trichoscopy_consultation_rules;
create trigger trg_fi_hli_trichoscopy_consultation_rules_updated_at
  before update on public.fi_hli_trichoscopy_consultation_rules
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

drop trigger if exists trg_fi_hli_trichoscopy_followups_updated_at
  on public.fi_hli_trichoscopy_followups;
create trigger trg_fi_hli_trichoscopy_followups_updated_at
  before update on public.fi_hli_trichoscopy_followups
  for each row execute procedure public.fi_hli_trichoscopy_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.fi_hli_trichoscopy_consultation_links enable row level security;
alter table public.fi_hli_trichoscopy_indications enable row level security;
alter table public.fi_hli_trichoscopy_findings enable row level security;
alter table public.fi_hli_trichoscopy_finding_reviews enable row level security;
alter table public.fi_hli_trichoscopy_decision_links enable row level security;
alter table public.fi_hli_trichoscopy_consultation_rules enable row level security;
alter table public.fi_hli_trichoscopy_followups enable row level security;
alter table public.fi_hli_trichoscopy_consultation_audit enable row level security;

revoke all on public.fi_hli_trichoscopy_consultation_links from public;
revoke all on public.fi_hli_trichoscopy_indications from public;
revoke all on public.fi_hli_trichoscopy_findings from public;
revoke all on public.fi_hli_trichoscopy_finding_reviews from public;
revoke all on public.fi_hli_trichoscopy_decision_links from public;
revoke all on public.fi_hli_trichoscopy_consultation_rules from public;
revoke all on public.fi_hli_trichoscopy_followups from public;
revoke all on public.fi_hli_trichoscopy_consultation_audit from public;

create policy fi_hli_trichoscopy_consultation_links_select_member
  on public.fi_hli_trichoscopy_consultation_links for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_consultation_links.tenant_id
    )
  );

create policy fi_hli_trichoscopy_indications_select_member
  on public.fi_hli_trichoscopy_indications for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_indications.tenant_id
    )
  );

create policy fi_hli_trichoscopy_findings_select_member
  on public.fi_hli_trichoscopy_findings for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_findings.tenant_id
    )
  );

create policy fi_hli_trichoscopy_finding_reviews_select_member
  on public.fi_hli_trichoscopy_finding_reviews for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_finding_reviews.tenant_id
    )
  );

create policy fi_hli_trichoscopy_decision_links_select_member
  on public.fi_hli_trichoscopy_decision_links for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_decision_links.tenant_id
    )
  );

create policy fi_hli_trichoscopy_consultation_rules_select_member
  on public.fi_hli_trichoscopy_consultation_rules for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_consultation_rules.tenant_id
    )
  );

create policy fi_hli_trichoscopy_followups_select_member
  on public.fi_hli_trichoscopy_followups for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_followups.tenant_id
    )
  );

create policy fi_hli_trichoscopy_consultation_audit_select_member
  on public.fi_hli_trichoscopy_consultation_audit for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid() and u.tenant_id = fi_hli_trichoscopy_consultation_audit.tenant_id
    )
  );

grant select, insert, update, delete on public.fi_hli_trichoscopy_consultation_links to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_indications to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_findings to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_finding_reviews to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_decision_links to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_consultation_rules to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_followups to service_role;
grant select, insert, update, delete on public.fi_hli_trichoscopy_consultation_audit to service_role;

grant select on public.fi_hli_trichoscopy_consultation_links to authenticated;
grant select on public.fi_hli_trichoscopy_indications to authenticated;
grant select on public.fi_hli_trichoscopy_findings to authenticated;
grant select on public.fi_hli_trichoscopy_finding_reviews to authenticated;
grant select on public.fi_hli_trichoscopy_decision_links to authenticated;
grant select on public.fi_hli_trichoscopy_consultation_rules to authenticated;
grant select on public.fi_hli_trichoscopy_followups to authenticated;
grant select on public.fi_hli_trichoscopy_consultation_audit to authenticated;
