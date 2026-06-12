-- Stage 8A: Hair Image Intelligence — shared classification ledger + FI OS denormalized columns on fi_patient_images.
-- Runbook: docs/runbooks/fi-os-stage8-ai-image-recognition.md

-- ---------------------------------------------------------------------------
-- Shared multi-product classification results (FI OS, HairAudit, Hair Longevity)
-- ---------------------------------------------------------------------------
create table if not exists public.hli_image_classifications (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_record_id text not null,
  tenant_id uuid references fi_tenants (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  image_url_or_storage_path text not null,
  image_category text not null,
  hair_state text not null,
  shave_state text not null,
  surgery_stage text not null,
  clinical_use_context text not null,
  confidence double precision not null default 0,
  classifier_version text,
  review_status text not null default 'pending',
  reviewed_by_user_id uuid references fi_users (id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint hli_image_classifications_source_system_chk check (
    source_system in ('fi_os', 'hairaudit', 'hair_longevity')
  ),
  constraint hli_image_classifications_image_category_chk check (
    image_category in (
      'front',
      'left_profile',
      'right_profile',
      'top',
      'crown',
      'donor',
      'graft_tray',
      'immediate_post_op',
      'follow_up',
      'microscopic',
      'unknown'
    )
  ),
  constraint hli_image_classifications_hair_state_chk check (hair_state in ('wet', 'dry', 'unknown')),
  constraint hli_image_classifications_shave_state_chk check (
    shave_state in ('shaved', 'non_shaved', 'partially_shaved', 'unknown')
  ),
  constraint hli_image_classifications_surgery_stage_chk check (
    surgery_stage in ('pre_op', 'intra_op', 'immediate_post_op', 'follow_up', 'unknown')
  ),
  constraint hli_image_classifications_clinical_use_context_chk check (
    clinical_use_context in (
      'consultation',
      'surgery',
      'audit',
      'follow_up',
      'hli_intake',
      'hli_progress',
      'trichoscopy',
      'microscopic',
      'unknown'
    )
  ),
  constraint hli_image_classifications_review_status_chk check (
    review_status in ('pending', 'accepted', 'corrected', 'rejected')
  ),
  constraint hli_image_classifications_confidence_range check (
    confidence >= 0::double precision and confidence <= 1::double precision
  ),
  constraint hli_image_classifications_notes_len check (notes is null or char_length (notes) <= 8000),
  constraint hli_image_classifications_storage_ref_len check (
    char_length (image_url_or_storage_path) <= 2048
  )
);

comment on table public.hli_image_classifications is
  'Hair Image Intelligence: append-only classification runs from FI OS, HairAudit, or Hair Longevity; never expose storage paths publicly.';

create index if not exists idx_hli_image_classifications_source_record
  on public.hli_image_classifications (source_system, source_record_id, created_at desc);

create index if not exists idx_hli_image_classifications_tenant_patient
  on public.hli_image_classifications (tenant_id, patient_id, created_at desc)
  where tenant_id is not null and patient_id is not null;

alter table public.hli_image_classifications enable row level security;

drop policy if exists hli_image_classifications_select_member on public.hli_image_classifications;
create policy hli_image_classifications_select_member on public.hli_image_classifications for select to authenticated using (
  tenant_id is not null
  and exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = hli_image_classifications.tenant_id
  )
);

grant select on public.hli_image_classifications to authenticated, service_role;

grant insert on public.hli_image_classifications to service_role;

-- ---------------------------------------------------------------------------
-- FI OS: denormalized AI columns on fi_patient_images (Twin / gallery / reports)
-- ---------------------------------------------------------------------------
alter table fi_patient_images
  add column if not exists ai_image_category text,
  add column if not exists ai_image_category_confidence double precision,
  add column if not exists ai_hair_state text,
  add column if not exists ai_shave_state text,
  add column if not exists ai_surgery_stage text,
  add column if not exists ai_image_ai_notes text,
  add column if not exists ai_image_review_status text not null default 'pending',
  add column if not exists ai_image_reviewed_by_staff_id uuid references fi_staff (id) on delete set null,
  add column if not exists ai_image_reviewed_at timestamptz,
  add column if not exists ai_image_classified_at timestamptz,
  add column if not exists ai_image_classifier_version text;

alter table fi_patient_images drop constraint if exists fi_patient_images_ai_image_category_chk;
alter table fi_patient_images
  add constraint fi_patient_images_ai_image_category_chk check (
    ai_image_category is null
    or ai_image_category in (
      'front',
      'left_profile',
      'right_profile',
      'top',
      'crown',
      'donor',
      'graft_tray',
      'immediate_post_op',
      'follow_up',
      'microscopic',
      'unknown'
    )
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_ai_hair_state_chk;
alter table fi_patient_images
  add constraint fi_patient_images_ai_hair_state_chk check (
    ai_hair_state is null or ai_hair_state in ('wet', 'dry', 'unknown')
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_ai_shave_state_chk;
alter table fi_patient_images
  add constraint fi_patient_images_ai_shave_state_chk check (
    ai_shave_state is null
    or ai_shave_state in ('shaved', 'non_shaved', 'partially_shaved', 'unknown')
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_ai_surgery_stage_chk;
alter table fi_patient_images
  add constraint fi_patient_images_ai_surgery_stage_chk check (
    ai_surgery_stage is null
    or ai_surgery_stage in ('pre_op', 'intra_op', 'immediate_post_op', 'follow_up', 'unknown')
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_ai_image_review_status_chk;
alter table fi_patient_images
  add constraint fi_patient_images_ai_image_review_status_chk check (
    ai_image_review_status in ('pending', 'accepted', 'corrected', 'rejected')
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_ai_image_category_confidence_range;
alter table fi_patient_images
  add constraint fi_patient_images_ai_image_category_confidence_range check (
    ai_image_category_confidence is null
    or (
      ai_image_category_confidence >= 0::double precision
      and ai_image_category_confidence <= 1::double precision
    )
  );

alter table fi_patient_images drop constraint if exists fi_patient_images_ai_image_ai_notes_len;
alter table fi_patient_images
  add constraint fi_patient_images_ai_image_ai_notes_len check (
    ai_image_ai_notes is null or char_length (ai_image_ai_notes) <= 8000
  );

create index if not exists idx_fi_patient_images_tenant_patient_ai_category
  on fi_patient_images (tenant_id, patient_id, ai_image_category)
  where image_status = 'active';

create index if not exists idx_fi_patient_images_tenant_patient_ai_surgery_stage
  on fi_patient_images (tenant_id, patient_id, ai_surgery_stage)
  where image_status = 'active';

create index if not exists idx_fi_patient_images_tenant_ai_review_status
  on fi_patient_images (tenant_id, ai_image_review_status)
  where image_status = 'active';

create index if not exists idx_fi_patient_images_tenant_ai_classified_at
  on fi_patient_images (tenant_id, ai_image_classified_at desc nulls last)
  where image_status = 'active';

comment on column fi_patient_images.ai_image_category is 'HLI / FI OS Stage 8A: AI view angle or clinical image class.';
comment on column fi_patient_images.ai_image_review_status is 'Staff review of AI classification: pending | accepted | corrected | rejected.';
