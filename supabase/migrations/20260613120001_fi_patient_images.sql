-- Stage 4C: private patient images metadata + storage bucket `patient-images`.
-- Design: docs/design/22-patient-images-foundation.md

create table if not exists fi_patient_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  person_id uuid references fi_persons (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  booking_id uuid references fi_bookings (id) on delete set null,
  lead_id uuid references fi_crm_leads (id) on delete set null,
  image_category text not null default 'other',
  image_status text not null default 'active',
  storage_bucket text not null default 'patient-images',
  storage_path text not null,
  original_filename text,
  content_type text,
  file_size_bytes bigint,
  caption text,
  taken_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by_user_id uuid references fi_users (id) on delete set null,
  archived_at timestamptz,
  archived_by_user_id uuid references fi_users (id) on delete set null,
  archive_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_images_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_patient_images_category_chk check (
    image_category in (
      'consult',
      'scalp',
      'donor',
      'hairline',
      'trichoscopy',
      'post_op',
      'progress',
      'before',
      'after',
      'other'
    )
  ),
  constraint fi_patient_images_status_chk check (image_status in ('active', 'archived')),
  constraint fi_patient_images_archived_coherent check (
    (image_status = 'active' and archived_at is null)
    or (image_status = 'archived' and archived_at is not null)
  ),
  constraint fi_patient_images_storage_path_unique unique (storage_path),
  constraint fi_patient_images_caption_len check (caption is null or char_length (caption) <= 2000),
  constraint fi_patient_images_archive_reason_len check (
    archive_reason is null or char_length (archive_reason) <= 1000
  )
);

comment on table fi_patient_images is 'FI OS Stage 4C: tenant-scoped patient image metadata; storage is private; mutations via service role.';

create index if not exists idx_fi_patient_images_tenant_patient on fi_patient_images (tenant_id, patient_id);

create index if not exists idx_fi_patient_images_tenant_person on fi_patient_images (tenant_id, person_id);

create index if not exists idx_fi_patient_images_tenant_case on fi_patient_images (tenant_id, case_id);

create index if not exists idx_fi_patient_images_tenant_booking on fi_patient_images (tenant_id, booking_id);

create index if not exists idx_fi_patient_images_tenant_lead on fi_patient_images (tenant_id, lead_id);

create index if not exists idx_fi_patient_images_tenant_category on fi_patient_images (tenant_id, image_category);

create index if not exists idx_fi_patient_images_tenant_status on fi_patient_images (tenant_id, image_status);

create index if not exists idx_fi_patient_images_tenant_taken_at on fi_patient_images (tenant_id, taken_at desc nulls last);

create index if not exists idx_fi_patient_images_tenant_created on fi_patient_images (tenant_id, created_at desc);

alter table fi_patient_images enable row level security;

drop policy if exists fi_patient_images_select_tenant_member on fi_patient_images;
create policy fi_patient_images_select_tenant_member on fi_patient_images for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where
      u.auth_user_id = auth.uid()
      and u.tenant_id = fi_patient_images.tenant_id
  )
);

-- Private bucket; uploads and reads go through service role (API / loaders).
insert into
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'patient-images',
    'patient-images',
    false,
    20971520,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
