-- ---------------------------------------------------------------------------
-- RECONSTRUCTED HISTORICAL MIGRATION — drift repair (do NOT treat as new change)
--
-- This migration was ALREADY APPLIED to the Follicle Intelligence production
-- database on 2026-07-01 (schema_migrations version 20260701220529, applied by
-- tlbpmg@gmail.com) but had no corresponding file in the repository, causing
-- repo <-> production drift.
--
-- The SQL below was recovered verbatim from the remote
-- `supabase_migrations.schema_migrations.statements` metadata and verified
-- against the live production objects (function definition + policy names match
-- exactly). It is committed here ONLY to remove the drift and restore an
-- accurate, reviewable migration history — the effect is already live in
-- production. Treat this as a historical record, not a new schema change.
--
-- Security intent (PHI hardening — TIGHTENS access, never loosens):
--   * Adds fi_auth_user_has_clinical_phi_read_access(uuid): SECURITY INVOKER,
--     STABLE, fixed search_path; true only when the current auth user belongs to
--     the tenant AND holds a clinical/authorised role.
--   * Replaces the broad "tenant member" SELECT policies on the PHI-bearing
--     tables fi_clinical_notes and fi_patient_timeline_events with role-gated
--     policies that call the helper — so ordinary tenant members can no longer
--     read clinical notes / patient timeline PHI unless they hold a clinical role.
--
-- Idempotency: `create or replace function` and `drop policy if exists` make this
-- safe to replay (e.g. `supabase db reset`). The added `drop policy if exists`
-- for the new policy names is purely for replay-safety and changes nothing about
-- the enforced protection.
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
        'fi_admin', 'admin', 'crm_operator', 'owner', 'doctor', 'nurse', 'consultant', 'surgeon'
      )
  );
$$;

drop policy if exists fi_clinical_notes_select_tenant_member on public.fi_clinical_notes;
drop policy if exists fi_clinical_notes_select_clinical_phi_role on public.fi_clinical_notes;
create policy fi_clinical_notes_select_clinical_phi_role
  on public.fi_clinical_notes for select to authenticated
  using (public.fi_auth_user_has_clinical_phi_read_access(tenant_id));

drop policy if exists fi_patient_timeline_events_select_tenant_member on public.fi_patient_timeline_events;
drop policy if exists fi_patient_timeline_events_select_clinical_phi_role on public.fi_patient_timeline_events;
create policy fi_patient_timeline_events_select_clinical_phi_role
  on public.fi_patient_timeline_events for select to authenticated
  using (public.fi_auth_user_has_clinical_phi_read_access(tenant_id));
