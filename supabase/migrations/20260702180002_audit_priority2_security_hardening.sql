-- Audit Priority 2: patient portal image release gate (held until staff approves).

alter table public.fi_patient_images
  add column if not exists patient_portal_release_status text not null default 'held';

alter table public.fi_patient_images
  add column if not exists portal_released_at timestamptz;

alter table public.fi_patient_images
  add column if not exists portal_released_by_fi_user_id uuid references public.fi_users (id) on delete set null;

alter table public.fi_patient_images
  drop constraint if exists fi_patient_images_portal_release_status_chk;

alter table public.fi_patient_images
  add constraint fi_patient_images_portal_release_status_chk
  check (patient_portal_release_status in ('held', 'released'));

comment on column public.fi_patient_images.patient_portal_release_status is
  'Patient portal visibility gate: held (default) until staff releases; released images may appear in portal loaders.';

create index if not exists idx_fi_patient_images_tenant_portal_release
  on public.fi_patient_images (tenant_id, patient_id, patient_portal_release_status)
  where image_status = 'active';