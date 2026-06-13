-- Stage 10 (HIE): Surgeon consultation checklist engine — structured discussion topics for clinician review only (no plans, graft counts, hairlines, outcomes, or autonomous decisions).
-- Runbook: docs/runbooks/hie-stage10-consultation-checklist-engine.md

create table if not exists public.hair_intelligence_consultation_checklists (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_record_id text,
  tenant_id uuid references fi_tenants (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  hair_loss_classification_id uuid references public.hair_intelligence_hair_loss_classifications (id) on delete set null,
  donor_assessment_id uuid references public.hair_intelligence_donor_assessments (id) on delete set null,
  recipient_review_id uuid references public.hair_intelligence_recipient_candidacy_reviews (id) on delete set null,
  confidence_score numeric not null default 0,
  checklist_status text not null default 'generated',
  priority_level text not null,
  medication_discussion_required boolean not null default false,
  stabilisation_discussion_required boolean not null default false,
  donor_preservation_discussion_required boolean not null default false,
  expectation_management_required boolean not null default false,
  consent_complexity_level text,
  documentation_required boolean not null default false,
  follow_up_required boolean not null default false,
  delay_recommended boolean not null default false,
  consultation_summary text,
  checklist_items jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  ai_notes text,
  review_status text not null default 'pending',
  reviewed_by_user_id uuid references fi_users (id) on delete set null,
  reviewed_at timestamptz,
  generator_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consultation_checklist_source_system_chk check (
    source_system in ('fi_os', 'hairaudit', 'hair_longevity')
  ),
  constraint consultation_checklist_status_chk check (
    checklist_status in ('generated', 'reviewed', 'approved', 'archived')
  ),
  constraint consultation_checklist_priority_chk check (
    priority_level in ('low', 'moderate', 'high', 'urgent')
  ),
  constraint consultation_checklist_consent_complexity_chk check (
    consent_complexity_level is null
    or consent_complexity_level in ('standard', 'moderate', 'high', 'complex', 'unknown')
  ),
  constraint consultation_checklist_review_status_chk check (
    review_status in ('pending', 'accepted', 'corrected', 'rejected')
  ),
  constraint consultation_checklist_confidence_range check (
    confidence_score >= 0::numeric and confidence_score <= 1::numeric
  ),
  constraint consultation_checklist_summary_len check (
    consultation_summary is null or char_length (consultation_summary) <= 8000
  ),
  constraint consultation_checklist_ai_notes_len check (ai_notes is null or char_length (ai_notes) <= 8000),
  constraint consultation_checklist_items_array check (jsonb_typeof (checklist_items) = 'array'),
  constraint consultation_checklist_risk_flags_array check (jsonb_typeof (risk_flags) = 'array')
);

comment on table public.hair_intelligence_consultation_checklists is
  'HIE Stage 10: surgeon-facing consultation checklist topics assembled from existing intelligence; clinician decision-maker; not surgical planning.';

create index if not exists idx_consultation_checklist_tenant_patient
  on public.hair_intelligence_consultation_checklists (tenant_id, patient_id, created_at desc)
  where tenant_id is not null and patient_id is not null;

create index if not exists idx_consultation_checklist_tenant_source_system
  on public.hair_intelligence_consultation_checklists (tenant_id, source_system, created_at desc)
  where tenant_id is not null;

create index if not exists idx_consultation_checklist_priority
  on public.hair_intelligence_consultation_checklists (priority_level, created_at desc);

create index if not exists idx_consultation_checklist_review_status
  on public.hair_intelligence_consultation_checklists (review_status, created_at desc);

create index if not exists idx_consultation_checklist_created_at
  on public.hair_intelligence_consultation_checklists (created_at desc);

alter table public.hair_intelligence_consultation_checklists enable row level security;

drop policy if exists consultation_checklist_select_member on public.hair_intelligence_consultation_checklists;
create policy consultation_checklist_select_member on public.hair_intelligence_consultation_checklists for select to authenticated using (
  tenant_id is not null
  and exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = hair_intelligence_consultation_checklists.tenant_id
  )
);

grant select on public.hair_intelligence_consultation_checklists to authenticated, service_role;

grant insert, update on public.hair_intelligence_consultation_checklists to service_role;

drop trigger if exists trg_consultation_checklist_set_updated_at on public.hair_intelligence_consultation_checklists;
create trigger trg_consultation_checklist_set_updated_at
before update on public.hair_intelligence_consultation_checklists
for each row
execute procedure public.fi_os_stage35_set_updated_at();
