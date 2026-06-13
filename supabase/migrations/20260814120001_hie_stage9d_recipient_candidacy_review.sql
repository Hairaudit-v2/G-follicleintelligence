-- Stage 9D (HIE): Recipient & surgical candidacy review intelligence — clinician review signals only (no plans, graft counts, or outcomes).
-- Runbook: docs/runbooks/hie-stage9d-recipient-candidacy-review-intelligence.md

create table if not exists public.hair_intelligence_recipient_candidacy_reviews (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_record_id text,
  tenant_id uuid references fi_tenants (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  hair_loss_classification_id uuid references public.hair_intelligence_hair_loss_classifications (id) on delete set null,
  donor_assessment_id uuid references public.hair_intelligence_donor_assessments (id) on delete set null,
  recipient_image_classification_id uuid references public.hli_image_classifications (id) on delete set null,
  progression_velocity numeric,
  confidence_score numeric not null default 0,
  recipient_quality_rating text not null,
  diffuse_thinning_risk text,
  shock_loss_risk text,
  density_expectation_risk text,
  medication_stabilisation_needed boolean not null default false,
  pathology_review_recommended boolean not null default false,
  surgical_timing_risk text,
  patient_expectation_risk text,
  documentation_gap_detected boolean not null default false,
  candidacy_summary text,
  review_topics jsonb not null default '[]'::jsonb,
  ai_notes text,
  review_status text not null default 'pending',
  reviewed_by_user_id uuid references fi_users (id) on delete set null,
  reviewed_at timestamptz,
  assessor_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipient_candidacy_source_system_chk check (
    source_system in ('fi_os', 'hairaudit', 'hair_longevity')
  ),
  constraint recipient_candidacy_recipient_quality_rating_chk check (
    recipient_quality_rating in ('excellent', 'good', 'moderate', 'poor', 'unsuitable', 'unknown')
  ),
  constraint recipient_candidacy_diffuse_thinning_risk_chk check (
    diffuse_thinning_risk is null or diffuse_thinning_risk in ('low', 'moderate', 'high', 'unknown')
  ),
  constraint recipient_candidacy_shock_loss_risk_chk check (
    shock_loss_risk is null or shock_loss_risk in ('low', 'moderate', 'high', 'unknown')
  ),
  constraint recipient_candidacy_density_expectation_risk_chk check (
    density_expectation_risk is null or density_expectation_risk in ('low', 'moderate', 'high', 'unknown')
  ),
  constraint recipient_candidacy_surgical_timing_risk_chk check (
    surgical_timing_risk is null
    or surgical_timing_risk in ('low', 'moderate', 'high', 'delay_recommended', 'unknown')
  ),
  constraint recipient_candidacy_patient_expectation_risk_chk check (
    patient_expectation_risk is null or patient_expectation_risk in ('low', 'moderate', 'high', 'unknown')
  ),
  constraint recipient_candidacy_review_status_chk check (
    review_status in ('pending', 'accepted', 'corrected', 'rejected')
  ),
  constraint recipient_candidacy_confidence_range check (
    confidence_score >= 0::numeric and confidence_score <= 1::numeric
  ),
  constraint recipient_candidacy_candidacy_summary_len check (
    candidacy_summary is null or char_length (candidacy_summary) <= 8000
  ),
  constraint recipient_candidacy_ai_notes_len check (ai_notes is null or char_length (ai_notes) <= 8000),
  constraint recipient_candidacy_review_topics_array check (jsonb_typeof (review_topics) = 'array')
);

comment on table public.hair_intelligence_recipient_candidacy_reviews is
  'HIE Stage 9D: recipient-area review signals and candidacy concerns for clinician discussion; not surgical planning or medical advice.';

create index if not exists idx_recipient_candidacy_tenant_patient
  on public.hair_intelligence_recipient_candidacy_reviews (tenant_id, patient_id, created_at desc)
  where tenant_id is not null and patient_id is not null;

create index if not exists idx_recipient_candidacy_tenant_source_system
  on public.hair_intelligence_recipient_candidacy_reviews (tenant_id, source_system, created_at desc)
  where tenant_id is not null;

create index if not exists idx_recipient_candidacy_review_status
  on public.hair_intelligence_recipient_candidacy_reviews (review_status, created_at desc);

create index if not exists idx_recipient_candidacy_recipient_quality_rating
  on public.hair_intelligence_recipient_candidacy_reviews (recipient_quality_rating, created_at desc);

create index if not exists idx_recipient_candidacy_created_at
  on public.hair_intelligence_recipient_candidacy_reviews (created_at desc);

alter table public.hair_intelligence_recipient_candidacy_reviews enable row level security;

drop policy if exists recipient_candidacy_select_member on public.hair_intelligence_recipient_candidacy_reviews;
create policy recipient_candidacy_select_member on public.hair_intelligence_recipient_candidacy_reviews for select to authenticated using (
  tenant_id is not null
  and exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = hair_intelligence_recipient_candidacy_reviews.tenant_id
  )
);

grant select on public.hair_intelligence_recipient_candidacy_reviews to authenticated, service_role;

grant insert, update on public.hair_intelligence_recipient_candidacy_reviews to service_role;

drop trigger if exists trg_recipient_candidacy_set_updated_at on public.hair_intelligence_recipient_candidacy_reviews;
create trigger trg_recipient_candidacy_set_updated_at
before update on public.hair_intelligence_recipient_candidacy_reviews
for each row
execute procedure public.fi_os_stage35_set_updated_at();
