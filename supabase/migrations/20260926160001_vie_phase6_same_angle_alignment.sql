-- VIE Phase 6 — Same angle alignment engine (metadata-driven scoring)

create table if not exists fi_vie_alignment_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  image_id uuid not null references fi_patient_images (id) on delete cascade,
  reference_image_id uuid references fi_patient_images (id) on delete set null,
  anatomical_region text not null,
  slot_family text not null,
  alignment_score numeric(5, 2) not null default 0,
  alignment_status text not null,
  confidence_band text not null default 'medium',
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_vie_alignment_results_status_chk check (
    alignment_status in (
      'excellent',
      'acceptable',
      'poor',
      'retake_recommended',
      'no_reference_available'
    )
  ),
  constraint fi_vie_alignment_results_confidence_chk check (
    confidence_band in ('high', 'medium', 'low')
  ),
  constraint fi_vie_alignment_results_warnings_array check (jsonb_typeof (warnings) = 'array'),
  constraint fi_vie_alignment_results_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_vie_alignment_results_score_range check (
    alignment_score >= 0
    and alignment_score <= 100
  )
);

comment on table fi_vie_alignment_results is
  'VIE Phase 6: deterministic same-angle alignment scores vs historical reference captures.';

create unique index if not exists idx_fi_vie_alignment_results_image
  on fi_vie_alignment_results (tenant_id, image_id);

create index if not exists idx_fi_vie_alignment_results_patient
  on fi_vie_alignment_results (tenant_id, patient_id, created_at desc);

create index if not exists idx_fi_vie_alignment_results_reference
  on fi_vie_alignment_results (tenant_id, reference_image_id)
  where reference_image_id is not null;

create index if not exists idx_fi_vie_alignment_results_status
  on fi_vie_alignment_results (tenant_id, alignment_status);

alter table fi_vie_alignment_results enable row level security;

drop policy if exists fi_vie_alignment_results_select_member on fi_vie_alignment_results;
create policy fi_vie_alignment_results_select_member on fi_vie_alignment_results for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_vie_alignment_results.tenant_id
  )
);

revoke all on fi_vie_alignment_results from public;
grant select on fi_vie_alignment_results to authenticated, service_role;
grant insert, update, delete on fi_vie_alignment_results to service_role;
