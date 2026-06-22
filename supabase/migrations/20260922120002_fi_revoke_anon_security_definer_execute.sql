-- ---------------------------------------------------------------------------
-- SECURITY FIX: revoke anon EXECUTE on SECURITY DEFINER functions (lint 0028)
--
-- Supabase advisor flagged 16 public SECURITY DEFINER functions callable by
-- the anon role via POST /rest/v1/rpc/<fn>. Even when function bodies reject
-- auth.uid() IS NULL, retaining anon EXECUTE widens the attack surface
-- (enumeration, timing, and future regression if a guard is removed).
--
-- Triage summary (live DB inspection + repo migration intent):
--
-- | Function | anon revoke | authenticated kept | Notes |
-- |----------|-------------|--------------------|-------|
-- | fi_rls_status_check | yes | no (service_role only) | RLS regression helper; never a client RPC |
-- | applications_prevent_applicant_status_change | yes | no | Trigger-only; not an RPC entrypoint |
-- | fi_os_can_select_* (3) | yes | yes | RLS policy helpers; need authenticated for policy eval |
-- | is_academy_admin / is_faculty_user / faculty_can_access_stream | yes | yes | Academy RLS policy helpers |
-- | user_clinic_ids | yes | yes | Legacy stub; no policy refs today; harmless if kept |
-- | academy_* RPCs (7) | yes | yes | All require auth.uid(); academy clients use JWT |
--
-- Pattern follows 20260719120002_fi_admin_lookup_revoke_anon.sql:
-- revoke public first, then anon explicitly. Re-grant authenticated only
-- where client/RLS callers still need EXECUTE.
--
-- Forward-only; no signature or behaviour change.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Group A: service_role-only (also strip authenticated — prior revoke missed anon)
-- ---------------------------------------------------------------------------

revoke execute on function public.fi_rls_status_check(text[]) from public;
revoke execute on function public.fi_rls_status_check(text[]) from anon;
revoke execute on function public.fi_rls_status_check(text[]) from authenticated;
grant execute on function public.fi_rls_status_check(text[]) to service_role;

comment on function public.fi_rls_status_check(text[]) is
  'SECURITY DEFINER RLS regression helper. service_role-only: EXECUTE revoked '
  'from public/anon/authenticated to block unauthenticated RPC enumeration.';

-- Trigger function; must not be invokable via PostgREST RPC.
revoke execute on function public.applications_prevent_applicant_status_change() from public;
revoke execute on function public.applications_prevent_applicant_status_change() from anon;
revoke execute on function public.applications_prevent_applicant_status_change() from authenticated;

-- ---------------------------------------------------------------------------
-- Group B: FI OS RLS helpers — authenticated only (used inside RLS policies)
-- ---------------------------------------------------------------------------

revoke execute on function public.fi_os_can_select_clinical_intelligence_tenant_data(uuid) from public;
revoke execute on function public.fi_os_can_select_clinical_intelligence_tenant_data(uuid) from anon;
grant execute on function public.fi_os_can_select_clinical_intelligence_tenant_data(uuid) to authenticated;

revoke execute on function public.fi_os_can_select_staff_feature_access_audit(uuid) from public;
revoke execute on function public.fi_os_can_select_staff_feature_access_audit(uuid) from anon;
grant execute on function public.fi_os_can_select_staff_feature_access_audit(uuid) to authenticated;

revoke execute on function public.fi_os_can_select_tenant_outcome_aggregate(uuid) from public;
revoke execute on function public.fi_os_can_select_tenant_outcome_aggregate(uuid) from anon;
grant execute on function public.fi_os_can_select_tenant_outcome_aggregate(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Group C: Academy RLS helpers — authenticated only
-- ---------------------------------------------------------------------------

revoke execute on function public.is_academy_admin() from public;
revoke execute on function public.is_academy_admin() from anon;
grant execute on function public.is_academy_admin() to authenticated;

revoke execute on function public.is_faculty_user() from public;
revoke execute on function public.is_faculty_user() from anon;
grant execute on function public.is_faculty_user() to authenticated;

revoke execute on function public.faculty_can_access_stream(text) from public;
revoke execute on function public.faculty_can_access_stream(text) from anon;
grant execute on function public.faculty_can_access_stream(text) to authenticated;

revoke execute on function public.user_clinic_ids() from public;
revoke execute on function public.user_clinic_ids() from anon;
grant execute on function public.user_clinic_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Group D: Academy admissions RPCs — authenticated only (all guard auth.uid())
-- ---------------------------------------------------------------------------

revoke execute on function public.academy_admissions_accept_application(uuid) from public;
revoke execute on function public.academy_admissions_accept_application(uuid) from anon;
grant execute on function public.academy_admissions_accept_application(uuid) to authenticated;

revoke execute on function public.academy_admissions_admin_transition(uuid, public.application_status, text, text, jsonb) from public;
revoke execute on function public.academy_admissions_admin_transition(uuid, public.application_status, text, text, jsonb) from anon;
grant execute on function public.academy_admissions_admin_transition(uuid, public.application_status, text, text, jsonb) to authenticated;

revoke execute on function public.academy_applicant_resubmit_application(uuid) from public;
revoke execute on function public.academy_applicant_resubmit_application(uuid) from anon;
grant execute on function public.academy_applicant_resubmit_application(uuid) to authenticated;

revoke execute on function public.academy_applicant_submit_from_draft(uuid) from public;
revoke execute on function public.academy_applicant_submit_from_draft(uuid) from anon;
grant execute on function public.academy_applicant_submit_from_draft(uuid) to authenticated;

revoke execute on function public.academy_applicant_withdraw_application(uuid) from public;
revoke execute on function public.academy_applicant_withdraw_application(uuid) from anon;
grant execute on function public.academy_applicant_withdraw_application(uuid) to authenticated;

revoke execute on function public.academy_faculty_claim_attempt(uuid) from public;
revoke execute on function public.academy_faculty_claim_attempt(uuid) from anon;
grant execute on function public.academy_faculty_claim_attempt(uuid) to authenticated;

revoke execute on function public.academy_faculty_finalize_attempt(uuid, text, text, text) from public;
revoke execute on function public.academy_faculty_finalize_attempt(uuid, text, text, text) from anon;
grant execute on function public.academy_faculty_finalize_attempt(uuid, text, text, text) to authenticated;
