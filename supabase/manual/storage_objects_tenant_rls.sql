-- FI OS: storage.objects tenant isolation (manual apply — not a standard migration).
--
-- Why manual: on Supabase hosted, storage.objects is owned by supabase_storage_admin;
-- `supabase db push` migrations fail with "must be owner of table objects".
--
-- How to apply:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Paste this file and Run (runs as postgres / storage owner)
--   3. Or: Storage → Policies → New policy (equivalent rules)
--
-- Defence in depth only: FI OS already serves images via service-role signed URLs.
-- These policies restrict direct authenticated Storage API access to tenant/{tenant_id}/ paths.

alter table storage.objects enable row level security;

drop policy if exists fi_storage_patient_images_select_tenant_member on storage.objects;
create policy fi_storage_patient_images_select_tenant_member
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'patient-images'
    and (storage.foldername(name))[1] = 'tenant'
    and exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists fi_storage_case_files_select_tenant_member on storage.objects;
create policy fi_storage_case_files_select_tenant_member
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'case-files'
    and (storage.foldername(name))[1] = 'tenant'
    and exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id::text = (storage.foldername(name))[2]
    )
  );