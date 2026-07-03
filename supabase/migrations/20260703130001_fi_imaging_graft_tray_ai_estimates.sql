-- IMAGING-AI-GRAFT-PILOT-1: staff-only graft tray AI count estimates + job kind.

create table if not exists public.fi_imaging_graft_tray_ai_estimates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  image_id uuid not null references public.fi_patient_images (id) on delete cascade,
  graft_tray_link_id uuid references public.fi_imaging_graft_tray_links (id) on delete set null,
  surgery_id uuid references public.fi_surgeries (id) on delete set null,
  surgery_case_id uuid references public.fi_cases (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,
  graft_session_id uuid references public.fi_surgery_graft_sessions (id) on delete set null,
  graft_count_event_id uuid references public.fi_surgery_graft_count_events (id) on delete set null,
  analysis_job_id uuid references public.fi_imaging_ai_analysis_jobs (id) on delete set null,
  estimated_graft_count integer,
  manual_graft_count integer,
  manual_count_source text,
  corrected_graft_count integer,
  delta integer,
  tolerance_percent numeric(5, 2) not null default 5,
  mismatch_band text not null default 'unable_to_assess',
  confidence numeric(5, 4) not null default 0,
  confidence_band text not null default 'unknown',
  image_quality text not null default 'unknown',
  assessable boolean not null default false,
  review_status text not null default 'pending_review',
  reviewer_decision text,
  reviewed_by_fi_user_id uuid,
  reviewed_at timestamptz,
  provider text not null default 'stub',
  provider_version text not null default 'graft_tray_stub_v1',
  uncertainty_notes jsonb not null default '[]'::jsonb,
  review_reasons jsonb not null default '[]'::jsonb,
  raw_provider_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_imaging_graft_tray_ai_estimates_mismatch_band_chk check (
    mismatch_band in (
      'within_tolerance',
      'minor_mismatch',
      'material_mismatch',
      'unable_to_assess',
      'manual_count_missing',
      'image_not_assessable'
    )
  ),
  constraint fi_imaging_graft_tray_ai_estimates_review_status_chk check (
    review_status in (
      'pending_review',
      'accepted_ai',
      'accepted_manual',
      'corrected',
      'rejected_ai',
      'retake_requested'
    )
  ),
  constraint fi_imaging_graft_tray_ai_estimates_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_imaging_graft_tray_ai_estimates_raw_metadata_object check (jsonb_typeof (raw_provider_metadata) = 'object')
);

comment on table public.fi_imaging_graft_tray_ai_estimates is
  'Staff-only AI graft tray count estimates compared to SurgeryOS manual counts. Never patient-facing.';

create unique index if not exists idx_fi_imaging_graft_tray_ai_estimates_image_unique
  on public.fi_imaging_graft_tray_ai_estimates (tenant_id, image_id);

create index if not exists idx_fi_imaging_graft_tray_ai_estimates_surgery
  on public.fi_imaging_graft_tray_ai_estimates (tenant_id, surgery_id);

create index if not exists idx_fi_imaging_graft_tray_ai_estimates_review
  on public.fi_imaging_graft_tray_ai_estimates (tenant_id, review_status);

alter table public.fi_imaging_graft_tray_ai_estimates enable row level security;

drop policy if exists fi_imaging_graft_tray_ai_estimates_select_tenant_member
  on public.fi_imaging_graft_tray_ai_estimates;

create policy fi_imaging_graft_tray_ai_estimates_select_tenant_member
  on public.fi_imaging_graft_tray_ai_estimates for select to authenticated
  using (
    exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_imaging_graft_tray_ai_estimates.tenant_id
    )
  );

grant select on public.fi_imaging_graft_tray_ai_estimates to authenticated, service_role;
grant insert, update, delete on public.fi_imaging_graft_tray_ai_estimates to service_role;

alter table public.fi_imaging_ai_analysis_jobs drop constraint if exists fi_imaging_ai_analysis_jobs_kind_chk;

alter table public.fi_imaging_ai_analysis_jobs
  add constraint fi_imaging_ai_analysis_jobs_kind_chk check (
    analysis_kind in (
      'density_estimate',
      'norwood_grade',
      'donor_assessment',
      'recipient_assessment',
      'clinical_image_analysis',
      'outcome_score',
      'graft_tray_count_estimate'
    )
  );