-- Audit Priority 1 (Critical): clinical PHI RLS on fi_clinical_notes + fi_patient_timeline_events.
-- Application servers continue to use service_role (bypasses RLS) for mutations and signed URLs.
--
-- storage.objects policies cannot run in standard Supabase migrations (table owner is
-- supabase_storage_admin). Apply separately via Dashboard SQL Editor:
--   supabase/manual/storage_objects_tenant_rls.sql

-- ---------------------------------------------------------------------------
-- Helper: clinical PHI read roles (aligned with src/lib/crm/crmGatePolicy.ts)
-- ---------------------------------------------------------------------------
create or replace function public.fi_auth_user_has_clinical_phi_read_access(p_tenant_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.fi_users u
    where u.auth_user_id = auth.uid()
      and u.tenant_id = p_tenant_id
      and lower(u.role) in (
        'fi_admin',
        'admin',
        'crm_operator',
        'owner',
        'doctor',
        'nurse',
        'consultant',
        'surgeon'
      )
  );
$$;

comment on function public.fi_auth_user_has_clinical_phi_read_access(uuid) is
  'RLS helper: true when the authenticated user has a clinical/operational role on the tenant.';

-- ---------------------------------------------------------------------------
-- fi_clinical_notes — restrict SELECT to clinical PHI roles (not all members)
-- ---------------------------------------------------------------------------
drop policy if exists fi_clinical_notes_select_tenant_member on public.fi_clinical_notes;
drop policy if exists fi_clinical_notes_select_clinical_phi_role on public.fi_clinical_notes;

create policy fi_clinical_notes_select_clinical_phi_role
  on public.fi_clinical_notes
  for select
  to authenticated
  using (public.fi_auth_user_has_clinical_phi_read_access(tenant_id));

comment on policy fi_clinical_notes_select_clinical_phi_role on public.fi_clinical_notes is
  'DoctorOS: voice transcripts and structured notes — minimum-necessary read (clinical roles only).';

-- ---------------------------------------------------------------------------
-- fi_patient_timeline_events — same clinical gate (detail JSON may contain PHI)
-- ---------------------------------------------------------------------------
drop policy if exists fi_patient_timeline_events_select_tenant_member on public.fi_patient_timeline_events;
drop policy if exists fi_patient_timeline_events_select_clinical_phi_role on public.fi_patient_timeline_events;

create policy fi_patient_timeline_events_select_clinical_phi_role
  on public.fi_patient_timeline_events
  for select
  to authenticated
  using (public.fi_auth_user_has_clinical_phi_read_access(tenant_id));