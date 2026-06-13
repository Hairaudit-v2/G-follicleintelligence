-- Stage 9C (HIE): Donor Intelligence Engine — shared donor-zone quality / capacity bands (FI OS, HairAudit, HLI).
-- Runbook: docs/runbooks/hie-stage9c-donor-intelligence-engine.md

create table if not exists public.hair_intelligence_donor_assessments (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_record_id text,
  tenant_id uuid references fi_tenants (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  image_classification_id uuid references public.hli_image_classifications (id) on delete set null,
  hair_loss_classification_id uuid references public.hair_intelligence_hair_loss_classifications (id) on delete set null,
  donor_region text not null,
  donor_quality_rating text not null,
  confidence_score numeric not null default 0,
  estimated_density_band text,
  miniaturisation_risk text,
  retrograde_risk text,
  overharvesting_risk text,
  safe_donor_capacity_band text,
  lifetime_graft_budget_band text,
  extraction_caution_level text,
  clinical_observations text,
  ai_notes text,
  review_status text not null default 'pending',
  reviewed_by_user_id uuid references fi_users (id) on delete set null,
  reviewed_at timestamptz,
  assessor_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donor_assessments_source_system_chk check (
    source_system in ('fi_os', 'hairaudit', 'hair_longevity')
  ),
  constraint donor_assessments_donor_region_chk check (
    donor_region in (
      'occipital',
      'left_parietal',
      'right_parietal',
      'nape',
      'beard',
      'body',
      'mixed',
      'unknown'
    )
  ),
  constraint donor_assessments_donor_quality_rating_chk check (
    donor_quality_rating in ('excellent', 'good', 'moderate', 'poor', 'unsafe', 'unknown')
  ),
  constraint donor_assessments_estimated_density_band_chk check (
    estimated_density_band is null
    or estimated_density_band in ('very_low', 'low', 'moderate', 'high', 'very_high', 'unknown')
  ),
  constraint donor_assessments_miniaturisation_risk_chk check (
    miniaturisation_risk is null or miniaturisation_risk in ('low', 'moderate', 'high', 'unknown')
  ),
  constraint donor_assessments_retrograde_risk_chk check (
    retrograde_risk is null or retrograde_risk in ('low', 'moderate', 'high', 'unknown')
  ),
  constraint donor_assessments_overharvesting_risk_chk check (
    overharvesting_risk is null or overharvesting_risk in ('low', 'moderate', 'high', 'unknown')
  ),
  constraint donor_assessments_safe_donor_capacity_band_chk check (
    safe_donor_capacity_band is null
    or safe_donor_capacity_band in ('under_1500', '1500_2500', '2500_4000', '4000_6000', 'over_6000', 'unknown')
  ),
  constraint donor_assessments_lifetime_graft_budget_band_chk check (
    lifetime_graft_budget_band is null
    or lifetime_graft_budget_band in ('under_3000', '3000_5000', '5000_7000', 'over_7000', 'unknown')
  ),
  constraint donor_assessments_extraction_caution_level_chk check (
    extraction_caution_level is null
    or extraction_caution_level in ('low', 'moderate', 'high', 'avoid', 'unknown')
  ),
  constraint donor_assessments_review_status_chk check (
    review_status in ('pending', 'accepted', 'corrected', 'rejected')
  ),
  constraint donor_assessments_confidence_range check (
    confidence_score >= 0::numeric and confidence_score <= 1::numeric
  ),
  constraint donor_assessments_clinical_observations_len check (
    clinical_observations is null or char_length (clinical_observations) <= 8000
  ),
  constraint donor_assessments_ai_notes_len check (ai_notes is null or char_length (ai_notes) <= 8000)
);

comment on table public.hair_intelligence_donor_assessments is
  'HIE Stage 9C: image-based donor quality / capacity band estimates; not diagnostic; clinician review required.';

create index if not exists idx_donor_assessments_tenant_patient
  on public.hair_intelligence_donor_assessments (tenant_id, patient_id, created_at desc)
  where tenant_id is not null and patient_id is not null;

create index if not exists idx_donor_assessments_tenant_source_system
  on public.hair_intelligence_donor_assessments (tenant_id, source_system, created_at desc)
  where tenant_id is not null;

create index if not exists idx_donor_assessments_donor_quality_rating
  on public.hair_intelligence_donor_assessments (donor_quality_rating, created_at desc);

create index if not exists idx_donor_assessments_review_status
  on public.hair_intelligence_donor_assessments (review_status, created_at desc);

create index if not exists idx_donor_assessments_created_at
  on public.hair_intelligence_donor_assessments (created_at desc);

alter table public.hair_intelligence_donor_assessments enable row level security;

drop policy if exists donor_assessments_select_member on public.hair_intelligence_donor_assessments;
create policy donor_assessments_select_member on public.hair_intelligence_donor_assessments for select to authenticated using (
  tenant_id is not null
  and exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = hair_intelligence_donor_assessments.tenant_id
  )
);

grant select on public.hair_intelligence_donor_assessments to authenticated, service_role;

grant insert, update on public.hair_intelligence_donor_assessments to service_role;

drop trigger if exists trg_donor_assessments_set_updated_at on public.hair_intelligence_donor_assessments;
create trigger trg_donor_assessments_set_updated_at
before update on public.hair_intelligence_donor_assessments
for each row
execute procedure public.fi_os_stage35_set_updated_at();
