-- Follicle Intelligence Foundation Layer (Stage 1C): conservative RLS
-- Authenticated users may read rows for tenants they belong to (fi_users.auth_user_id).
-- Writes are denied for authenticated unless additional policies are added later.
-- Service role (ingest / admin) bypasses RLS in Supabase.

alter table fi_organisations enable row level security;
alter table fi_clinics enable row level security;
alter table fi_clinic_source_ids enable row level security;
alter table fi_persons enable row level security;
alter table fi_person_source_ids enable row level security;
alter table fi_person_roles enable row level security;
alter table fi_patients enable row level security;
alter table fi_patient_source_ids enable row level security;
alter table fi_timeline_events enable row level security;
alter table fi_media_assets enable row level security;

-- fi_cases: intentionally NOT enabling RLS here — it previously had none; authenticated clients
-- use fi_cases from API routes; adding RLS without full INSERT/UPDATE policies would be breaking.

-- ---------- fi_organisations ----------
drop policy if exists fi_organisations_select_tenant_member on fi_organisations;
create policy fi_organisations_select_tenant_member
  on fi_organisations for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_organisations.tenant_id
    )
  );

-- ---------- fi_clinics ----------
drop policy if exists fi_clinics_select_tenant_member on fi_clinics;
create policy fi_clinics_select_tenant_member
  on fi_clinics for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_clinics.tenant_id
    )
  );

-- ---------- fi_clinic_source_ids ----------
drop policy if exists fi_clinic_source_ids_select_tenant_member on fi_clinic_source_ids;
create policy fi_clinic_source_ids_select_tenant_member
  on fi_clinic_source_ids for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_clinic_source_ids.tenant_id
    )
  );

-- ---------- fi_persons ----------
drop policy if exists fi_persons_select_tenant_member on fi_persons;
create policy fi_persons_select_tenant_member
  on fi_persons for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_persons.tenant_id
    )
  );

-- ---------- fi_person_source_ids ----------
drop policy if exists fi_person_source_ids_select_tenant_member on fi_person_source_ids;
create policy fi_person_source_ids_select_tenant_member
  on fi_person_source_ids for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_person_source_ids.tenant_id
    )
  );

-- ---------- fi_person_roles ----------
drop policy if exists fi_person_roles_select_tenant_member on fi_person_roles;
create policy fi_person_roles_select_tenant_member
  on fi_person_roles for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_person_roles.tenant_id
    )
  );

-- ---------- fi_patients ----------
drop policy if exists fi_patients_select_tenant_member on fi_patients;
create policy fi_patients_select_tenant_member
  on fi_patients for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patients.tenant_id
    )
  );

-- ---------- fi_patient_source_ids ----------
drop policy if exists fi_patient_source_ids_select_tenant_member on fi_patient_source_ids;
create policy fi_patient_source_ids_select_tenant_member
  on fi_patient_source_ids for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_source_ids.tenant_id
    )
  );

-- ---------- fi_timeline_events ----------
drop policy if exists fi_timeline_events_select_tenant_member on fi_timeline_events;
create policy fi_timeline_events_select_tenant_member
  on fi_timeline_events for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_timeline_events.tenant_id
    )
  );

-- ---------- fi_media_assets ----------
drop policy if exists fi_media_assets_select_tenant_member on fi_media_assets;
create policy fi_media_assets_select_tenant_member
  on fi_media_assets for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_media_assets.tenant_id
    )
  );
