-- ---------------------------------------------------------------------------
-- SECURITY FIX (lint 0029 authenticated_security_definer_function_executable)
-- SECURITY DEFINER RPC lockdown: revoke `authenticated` EXECUTE on internal
-- RLS / helper functions so signed-in users can no longer call them directly
-- via PostgREST `/rest/v1/rpc/...`.
--
-- Background:
--   Migration 20260922120002 already revoked anon/public EXECUTE on these
--   (lint 0028) but intentionally LEFT `authenticated` EXECUTE in place, which
--   is why lint 0029 still flags them. These helpers are only ever referenced
--   inside RLS policy expressions; they are not meant to be RPC endpoints.
--
-- Why this is safe (verified against the live database before writing):
--   * RLS policy evaluation does NOT require the querying role to hold EXECUTE
--     on functions referenced by the policy. A rolled-back probe confirmed an
--     `authenticated` SELECT through an RLS policy that calls a SECURITY DEFINER
--     helper still returns rows even with zero EXECUTE grant to `authenticated`.
--   * The SECURITY DEFINER helpers run as their owner (postgres), so calls made
--     from inside other SECURITY DEFINER functions (e.g. the academy_* RPCs that
--     call is_academy_admin()/is_faculty_user()) are unaffected.
--   * service_role keeps EXECUTE, so internal/backend access is preserved.
--
-- Scope decisions:
--   GROUP A (pure RLS helpers)  -> revoke public/anon/authenticated, keep service_role.
--   GROUP B (academy_* RPCs)    -> intentionally user-callable. They self-authorize
--                                  (auth.uid() + is_academy_admin()/is_faculty_user())
--                                  inside a SECURITY DEFINER body, i.e. they ARE the
--                                  policy-backed wrapper pattern. EXECUTE for
--                                  `authenticated` is preserved on purpose; only
--                                  anon/public are revoked defensively. Documented,
--                                  no business-logic change.
--
-- Forward-only, idempotent. Skips functions that do not exist (e.g. a fresh
-- FI-only local reset without the Academy objects). No signature or behaviour
-- change; SECURITY DEFINER is intentionally NOT converted to SECURITY INVOKER.
-- ---------------------------------------------------------------------------

-- Idempotent helper: revoke from a set of roles (handling the PUBLIC pseudo-role),
-- (re)grant to a set of roles, and set a documentation comment -- but only if the
-- target function actually exists in this database.
create or replace function pg_temp.fi_lockdown_secdef_function(
  fn_signature text,
  revoke_roles text[],
  grant_roles text[],
  doc_comment text
)
returns void
language plpgsql
as $$
declare
  role_name text;
begin
  if to_regprocedure(fn_signature) is null then
    return;
  end if;

  foreach role_name in array revoke_roles loop
    if lower(role_name) = 'public' then
      execute format('revoke execute on function %s from public', fn_signature);
    else
      execute format('revoke execute on function %s from %I', fn_signature, role_name);
    end if;
  end loop;

  foreach role_name in array grant_roles loop
    if lower(role_name) = 'public' then
      execute format('grant execute on function %s to public', fn_signature);
    else
      execute format('grant execute on function %s to %I', fn_signature, role_name);
    end if;
  end loop;

  execute format('comment on function %s is %L', fn_signature, doc_comment);
end;
$$;

-- ===========================================================================
-- GROUP A — pure RLS / internal helpers: lock down to owner + service_role.
-- ===========================================================================

select pg_temp.fi_lockdown_secdef_function(
  'public.user_clinic_ids()',
  array['public', 'anon', 'authenticated'],
  array['service_role'],
  'Internal SECURITY DEFINER RLS helper (clinic scoping). NOT a public RPC: '
  || 'EXECUTE revoked from public/anon/authenticated; callable only by '
  || 'service_role and via RLS policy evaluation. Direct RPC calls are blocked.'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.fi_os_can_select_clinical_intelligence_tenant_data(uuid)',
  array['public', 'anon', 'authenticated'],
  array['service_role'],
  'Internal SECURITY DEFINER RLS helper used by FI OS clinical-intelligence '
  || 'tenant policies. NOT a public RPC: EXECUTE revoked from '
  || 'public/anon/authenticated; used only inside RLS policies (+ service_role).'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.fi_os_can_select_staff_feature_access_audit(uuid)',
  array['public', 'anon', 'authenticated'],
  array['service_role'],
  'Internal SECURITY DEFINER RLS helper used by the staff-feature-access audit '
  || 'policy. NOT a public RPC: EXECUTE revoked from public/anon/authenticated; '
  || 'used only inside RLS policies (+ service_role).'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.fi_os_can_select_tenant_outcome_aggregate(uuid)',
  array['public', 'anon', 'authenticated'],
  array['service_role'],
  'Internal SECURITY DEFINER RLS helper used by the tenant outcome-aggregate '
  || 'policy. NOT a public RPC: EXECUTE revoked from public/anon/authenticated; '
  || 'used only inside RLS policies (+ service_role).'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.is_academy_admin()',
  array['public', 'anon', 'authenticated'],
  array['service_role'],
  'Internal SECURITY DEFINER RLS helper (Academy admin check). NOT a public RPC: '
  || 'EXECUTE revoked from public/anon/authenticated. Referenced by RLS policies '
  || 'and called from inside other SECURITY DEFINER RPCs (run as owner), so '
  || 'revoking authenticated EXECUTE does not affect those paths.'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.is_faculty_user()',
  array['public', 'anon', 'authenticated'],
  array['service_role'],
  'Internal SECURITY DEFINER RLS helper (Academy faculty check). NOT a public '
  || 'RPC: EXECUTE revoked from public/anon/authenticated. Referenced by RLS '
  || 'policies and called from inside other SECURITY DEFINER RPCs (run as owner).'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.faculty_can_access_stream(text)',
  array['public', 'anon', 'authenticated'],
  array['service_role'],
  'Internal SECURITY DEFINER RLS helper (faculty stream scope). NOT a public '
  || 'RPC: EXECUTE revoked from public/anon/authenticated; used only inside RLS '
  || 'policies (+ service_role).'
);

-- ===========================================================================
-- GROUP B — intentionally user-callable SECURITY DEFINER RPCs.
-- These self-authorize internally (auth.uid() + is_academy_admin()/
-- is_faculty_user()) before performing privileged state transitions, so they
-- are the policy-backed wrapper pattern. `authenticated` EXECUTE is preserved
-- on purpose; anon/public are revoked defensively. Documented, no logic change.
-- ===========================================================================

select pg_temp.fi_lockdown_secdef_function(
  'public.academy_admissions_accept_application(uuid)',
  array['public', 'anon'],
  array['authenticated', 'service_role'],
  'Intentional authenticated RPC (not an RLS-only helper). Self-authorizing '
  || 'SECURITY DEFINER wrapper: enforces auth.uid() + is_academy_admin() before '
  || 'accepting an application. anon/public EXECUTE revoked; authenticated + '
  || 'service_role retained by design. Reviewed and signed off under Supabase '
  || 'security scan lint 0029 (authenticated_security_definer_function_executable) '
  || '-- see migration 202610017001 and docs/security/supabase-advisor-lint-exceptions.md.'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.academy_admissions_admin_transition(uuid, public.application_status, text, text, jsonb)',
  array['public', 'anon'],
  array['authenticated', 'service_role'],
  'Intentional authenticated RPC (not an RLS-only helper). Self-authorizing '
  || 'SECURITY DEFINER wrapper: enforces auth.uid() + is_academy_admin() before '
  || 'transitioning application status. anon/public EXECUTE revoked; authenticated + '
  || 'service_role retained by design. Reviewed and signed off under Supabase '
  || 'security scan lint 0029 (authenticated_security_definer_function_executable) '
  || '-- see migration 202610017001 and docs/security/supabase-advisor-lint-exceptions.md.'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.academy_applicant_resubmit_application(uuid)',
  array['public', 'anon'],
  array['authenticated', 'service_role'],
  'Intentional authenticated RPC for applicants (not an RLS-only helper). '
  || 'Self-authorizing SECURITY DEFINER wrapper: enforces auth.uid() + applicant '
  || 'row ownership before resubmitting. anon/public EXECUTE revoked; authenticated + '
  || 'service_role retained by design. Reviewed and signed off under Supabase '
  || 'security scan lint 0029 (authenticated_security_definer_function_executable) '
  || '-- see migration 202610017001 and docs/security/supabase-advisor-lint-exceptions.md.'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.academy_applicant_submit_from_draft(uuid)',
  array['public', 'anon'],
  array['authenticated', 'service_role'],
  'Intentional authenticated RPC for applicants (not an RLS-only helper). '
  || 'Self-authorizing SECURITY DEFINER wrapper: enforces auth.uid() + applicant '
  || 'row ownership before submitting a draft. anon/public EXECUTE revoked; '
  || 'authenticated + service_role retained by design. Reviewed and signed off '
  || 'under Supabase security scan lint 0029 (authenticated_security_definer_function_executable) '
  || '-- see migration 202610017001 and docs/security/supabase-advisor-lint-exceptions.md.'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.academy_applicant_withdraw_application(uuid)',
  array['public', 'anon'],
  array['authenticated', 'service_role'],
  'Intentional authenticated RPC for applicants (not an RLS-only helper). '
  || 'Self-authorizing SECURITY DEFINER wrapper: enforces auth.uid() + applicant '
  || 'row ownership before withdrawing. anon/public EXECUTE revoked; authenticated + '
  || 'service_role retained by design. Reviewed and signed off under Supabase '
  || 'security scan lint 0029 (authenticated_security_definer_function_executable) '
  || '-- see migration 202610017001 and docs/security/supabase-advisor-lint-exceptions.md.'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.academy_faculty_claim_attempt(uuid)',
  array['public', 'anon'],
  array['authenticated', 'service_role'],
  'Intentional authenticated RPC (not an RLS-only helper). Self-authorizing '
  || 'SECURITY DEFINER wrapper: enforces auth.uid() + (is_academy_admin() OR '
  || 'is_faculty_user()) before claiming an attempt. anon/public EXECUTE revoked; '
  || 'authenticated + service_role retained by design. Reviewed and signed off '
  || 'under Supabase security scan lint 0029 (authenticated_security_definer_function_executable) '
  || '-- see migration 202610017001 and docs/security/supabase-advisor-lint-exceptions.md.'
);

select pg_temp.fi_lockdown_secdef_function(
  'public.academy_faculty_finalize_attempt(uuid, text, text, text)',
  array['public', 'anon'],
  array['authenticated', 'service_role'],
  'Intentional authenticated RPC (not an RLS-only helper). Self-authorizing '
  || 'SECURITY DEFINER wrapper: enforces auth.uid() + faculty/admin checks before '
  || 'finalizing an attempt. anon/public EXECUTE revoked; authenticated + '
  || 'service_role retained by design. Reviewed and signed off under Supabase '
  || 'security scan lint 0029 (authenticated_security_definer_function_executable) '
  || '-- see migration 202610017001 and docs/security/supabase-advisor-lint-exceptions.md.'
);

-- ===========================================================================
-- Self-verification: fail the migration loudly if the resulting grants are
-- not what we intend. Skips functions that do not exist in this database.
-- ===========================================================================
do $$
declare
  helper text;
  rpc text;
  helpers text[] := array[
    'public.user_clinic_ids()',
    'public.fi_os_can_select_clinical_intelligence_tenant_data(uuid)',
    'public.fi_os_can_select_staff_feature_access_audit(uuid)',
    'public.fi_os_can_select_tenant_outcome_aggregate(uuid)',
    'public.is_academy_admin()',
    'public.is_faculty_user()',
    'public.faculty_can_access_stream(text)'
  ];
  rpcs text[] := array[
    'public.academy_admissions_accept_application(uuid)',
    'public.academy_admissions_admin_transition(uuid, public.application_status, text, text, jsonb)',
    'public.academy_applicant_resubmit_application(uuid)',
    'public.academy_applicant_submit_from_draft(uuid)',
    'public.academy_applicant_withdraw_application(uuid)',
    'public.academy_faculty_claim_attempt(uuid)',
    'public.academy_faculty_finalize_attempt(uuid, text, text, text)'
  ];
begin
  -- GROUP A: authenticated/anon must NOT have EXECUTE; service_role MUST keep it.
  foreach helper in array helpers loop
    if to_regprocedure(helper) is null then
      continue;
    end if;
    if has_function_privilege('authenticated', helper, 'execute') then
      raise exception 'LOCKDOWN FAIL: authenticated still has EXECUTE on RLS helper %', helper;
    end if;
    if has_function_privilege('anon', helper, 'execute') then
      raise exception 'LOCKDOWN FAIL: anon still has EXECUTE on RLS helper %', helper;
    end if;
    if not has_function_privilege('service_role', helper, 'execute') then
      raise exception 'LOCKDOWN FAIL: service_role lost EXECUTE on RLS helper %', helper;
    end if;
  end loop;

  -- GROUP B: authenticated/service_role keep EXECUTE; anon must NOT have it.
  foreach rpc in array rpcs loop
    if to_regprocedure(rpc) is null then
      continue;
    end if;
    if not has_function_privilege('authenticated', rpc, 'execute') then
      raise exception 'LOCKDOWN FAIL: authenticated unexpectedly lost EXECUTE on user RPC %', rpc;
    end if;
    if not has_function_privilege('service_role', rpc, 'execute') then
      raise exception 'LOCKDOWN FAIL: service_role lost EXECUTE on user RPC %', rpc;
    end if;
    if has_function_privilege('anon', rpc, 'execute') then
      raise exception 'LOCKDOWN FAIL: anon still has EXECUTE on user RPC %', rpc;
    end if;
  end loop;
end $$;

drop function pg_temp.fi_lockdown_secdef_function(text, text[], text[], text);

-- ---------------------------------------------------------------------------
-- VERIFICATION (run manually; read-only). Expected results:
--   GROUP A helpers -> authenticated=f, anon=f, service_role=t
--   GROUP B RPCs    -> authenticated=t, anon=f, service_role=t
--
--   select p.proname,
--          pg_get_function_identity_arguments(p.oid) as args,
--          p.prosecdef as security_definer,
--          has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec,
--          has_function_privilege('anon',          p.oid, 'execute') as anon_exec,
--          has_function_privilege('service_role',  p.oid, 'execute') as service_role_exec,
--          coalesce(array_to_string(p.proacl::text[], ' | '), '(default PUBLIC)') as acl
--   from pg_proc p
--   where p.pronamespace = 'public'::regnamespace
--     and p.proname in (
--       'user_clinic_ids','fi_os_can_select_clinical_intelligence_tenant_data',
--       'fi_os_can_select_staff_feature_access_audit','fi_os_can_select_tenant_outcome_aggregate',
--       'is_academy_admin','is_faculty_user','faculty_can_access_stream',
--       'academy_admissions_accept_application','academy_admissions_admin_transition',
--       'academy_applicant_resubmit_application','academy_applicant_submit_from_draft',
--       'academy_applicant_withdraw_application','academy_faculty_claim_attempt',
--       'academy_faculty_finalize_attempt'
--     )
--   order by p.proname;
-- ---------------------------------------------------------------------------
