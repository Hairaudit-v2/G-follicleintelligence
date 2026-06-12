-- Stage 9A (HIE): Hair Loss Classification Engine — shared ledger (FI OS, HairAudit, Hair Longevity).
-- Runbook: docs/runbooks/hie-stage9a-hair-loss-classification-engine.md

create table if not exists public.hair_intelligence_hair_loss_classifications (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_record_id text,
  tenant_id uuid references fi_tenants (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  image_classification_id uuid references public.hli_image_classifications (id) on delete set null,
  classification_system text not null,
  pattern_type text not null,
  classification_grade text not null,
  confidence_score numeric not null default 0,
  frontal_loss_score numeric,
  temporal_recession_score numeric,
  mid_scalp_score numeric,
  crown_loss_score numeric,
  diffuse_thinning_score numeric,
  retrograde_pattern_detected boolean not null default false,
  suspected_scarring_pattern boolean not null default false,
  sex_classification text,
  age_estimate_range text,
  ai_notes text,
  review_status text not null default 'pending',
  reviewed_by_user_id uuid references fi_users (id) on delete set null,
  reviewed_at timestamptz,
  classifier_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hair_loss_classifications_source_system_chk check (
    source_system in ('fi_os', 'hairaudit', 'hair_longevity')
  ),
  constraint hair_loss_classifications_classification_system_chk check (
    classification_system in ('norwood', 'ludwig', 'sinclair', 'olsen', 'custom')
  ),
  constraint hair_loss_classifications_pattern_type_chk check (
    pattern_type in (
      'male_pattern_baldness',
      'diffuse_male_pattern',
      'retrograde_alopecia',
      'female_pattern_loss',
      'diffuse_female_thinning',
      'traction_pattern',
      'frontal_fibrosing_pattern',
      'unknown'
    )
  ),
  constraint hair_loss_classifications_review_status_chk check (
    review_status in ('pending', 'accepted', 'corrected', 'rejected')
  ),
  constraint hair_loss_classifications_sex_classification_chk check (
    sex_classification is null or sex_classification in ('male', 'female', 'unknown')
  ),
  constraint hair_loss_classifications_confidence_range check (
    confidence_score >= 0::numeric and confidence_score <= 1::numeric
  ),
  constraint hair_loss_classifications_severity_range_chk check (
    (frontal_loss_score is null or (frontal_loss_score >= 0::numeric and frontal_loss_score <= 10::numeric))
    and (temporal_recession_score is null or (temporal_recession_score >= 0::numeric and temporal_recession_score <= 10::numeric))
    and (mid_scalp_score is null or (mid_scalp_score >= 0::numeric and mid_scalp_score <= 10::numeric))
    and (crown_loss_score is null or (crown_loss_score >= 0::numeric and crown_loss_score <= 10::numeric))
    and (diffuse_thinning_score is null or (diffuse_thinning_score >= 0::numeric and diffuse_thinning_score <= 10::numeric))
  ),
  constraint hair_loss_classifications_ai_notes_len check (
    ai_notes is null or char_length (ai_notes) <= 8000
  ),
  constraint hair_loss_classifications_age_estimate_len check (
    age_estimate_range is null or char_length (age_estimate_range) <= 128
  ),
  constraint hair_loss_classifications_classification_grade_len check (
    char_length (classification_grade) <= 64
  )
);

comment on table public.hair_intelligence_hair_loss_classifications is
  'HIE Stage 9A: shared hair loss pattern classifications; do not expose storage paths; not diagnostic.';

create index if not exists idx_hair_loss_classifications_tenant_patient
  on public.hair_intelligence_hair_loss_classifications (tenant_id, patient_id, created_at desc)
  where tenant_id is not null and patient_id is not null;

create index if not exists idx_hair_loss_classifications_tenant_source_system
  on public.hair_intelligence_hair_loss_classifications (tenant_id, source_system, created_at desc)
  where tenant_id is not null;

create index if not exists idx_hair_loss_classifications_classification_system
  on public.hair_intelligence_hair_loss_classifications (classification_system, created_at desc);

create index if not exists idx_hair_loss_classifications_pattern_type
  on public.hair_intelligence_hair_loss_classifications (pattern_type, created_at desc);

create index if not exists idx_hair_loss_classifications_review_status
  on public.hair_intelligence_hair_loss_classifications (review_status, created_at desc);

create index if not exists idx_hair_loss_classifications_created_at
  on public.hair_intelligence_hair_loss_classifications (created_at desc);

alter table public.hair_intelligence_hair_loss_classifications enable row level security;

drop policy if exists hair_loss_classifications_select_member on public.hair_intelligence_hair_loss_classifications;
create policy hair_loss_classifications_select_member on public.hair_intelligence_hair_loss_classifications for select to authenticated using (
  tenant_id is not null
  and exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = hair_intelligence_hair_loss_classifications.tenant_id
  )
);

grant select on public.hair_intelligence_hair_loss_classifications to authenticated, service_role;

grant insert, update on public.hair_intelligence_hair_loss_classifications to service_role;

drop trigger if exists trg_hair_loss_classifications_set_updated_at on public.hair_intelligence_hair_loss_classifications;
create trigger trg_hair_loss_classifications_set_updated_at
before update on public.hair_intelligence_hair_loss_classifications
for each row
execute procedure public.fi_os_stage35_set_updated_at();
