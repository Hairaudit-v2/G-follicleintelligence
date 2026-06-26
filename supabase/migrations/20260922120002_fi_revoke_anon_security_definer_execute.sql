-- ---------------------------------------------------------------------------
-- SECURITY FIX: revoke anon EXECUTE on SECURITY DEFINER functions (lint 0028)
--
-- Skips functions not present (e.g. Academy-only objects on a fresh FI local reset).
-- Forward-only; no signature or behaviour change.
-- ---------------------------------------------------------------------------

create or replace function pg_temp.fi_revoke_execute_if_exists(
  fn_signature text,
  revoke_roles text[],
  grant_roles text[] default array[]::text[]
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
    execute format('revoke execute on function %s from %I', fn_signature, role_name);
  end loop;

  foreach role_name in array grant_roles loop
    execute format('grant execute on function %s to %I', fn_signature, role_name);
  end loop;
end;
$$;

-- Group A: service_role-only
select pg_temp.fi_revoke_execute_if_exists(
  'public.fi_rls_status_check(text[])',
  array['public', 'anon', 'authenticated'],
  array['service_role']
);

do $$
begin
  if to_regprocedure('public.fi_rls_status_check(text[])') is not null then
    comment on function public.fi_rls_status_check(text[]) is
      'SECURITY DEFINER RLS regression helper. service_role-only: EXECUTE revoked '
      'from public/anon/authenticated to block unauthenticated RPC enumeration.';
  end if;
end $$;

select pg_temp.fi_revoke_execute_if_exists(
  'public.applications_prevent_applicant_status_change()',
  array['public', 'anon', 'authenticated']
);

-- Group B: FI OS RLS helpers — authenticated only
select pg_temp.fi_revoke_execute_if_exists(
  'public.fi_os_can_select_clinical_intelligence_tenant_data(uuid)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.fi_os_can_select_staff_feature_access_audit(uuid)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.fi_os_can_select_tenant_outcome_aggregate(uuid)',
  array['public', 'anon'],
  array['authenticated']
);

-- Group C: Academy RLS helpers — authenticated only
select pg_temp.fi_revoke_execute_if_exists(
  'public.is_academy_admin()',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.is_faculty_user()',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.faculty_can_access_stream(text)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.user_clinic_ids()',
  array['public', 'anon'],
  array['authenticated']
);

-- Group D: Academy admissions RPCs — authenticated only
select pg_temp.fi_revoke_execute_if_exists(
  'public.academy_admissions_accept_application(uuid)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.academy_admissions_admin_transition(uuid, public.application_status, text, text, jsonb)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.academy_applicant_resubmit_application(uuid)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.academy_applicant_submit_from_draft(uuid)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.academy_applicant_withdraw_application(uuid)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.academy_faculty_claim_attempt(uuid)',
  array['public', 'anon'],
  array['authenticated']
);
select pg_temp.fi_revoke_execute_if_exists(
  'public.academy_faculty_finalize_attempt(uuid, text, text, text)',
  array['public', 'anon'],
  array['authenticated']
);

drop function pg_temp.fi_revoke_execute_if_exists(text, text[], text[]);
