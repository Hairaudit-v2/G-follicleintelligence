-- ---------------------------------------------------------------------------
-- SECURITY FIX: lock down fi_admin_lookup_auth_user_id_by_email
--
-- The function is SECURITY DEFINER and was EXECUTABLE by `anon` and
-- `authenticated` with no internal authorization check. Its body returns
-- `auth.users.id` for any email:
--
--     select id from auth.users where lower(trim(email)) = lower(trim(_email)) limit 1;
--
-- Because the anon key ships in the browser bundle, anyone could call
-- POST /rest/v1/rpc/fi_admin_lookup_auth_user_id_by_email with an arbitrary
-- email and learn (a) whether an account exists and (b) its auth UUID — an
-- unauthenticated account-existence + identifier-disclosure oracle.
--
-- This migration removes the public/role grants so only `service_role`
-- (which bypasses GRANTs server-side) can invoke it. PUBLIC is revoked first
-- because EXECUTE is granted to PUBLIC by default on function creation.
--
-- Forward-only; safe against production. No signature/behaviour change.
-- ---------------------------------------------------------------------------

revoke execute on function public.fi_admin_lookup_auth_user_id_by_email(text) from public;
revoke execute on function public.fi_admin_lookup_auth_user_id_by_email(text) from anon;
revoke execute on function public.fi_admin_lookup_auth_user_id_by_email(text) from authenticated;

comment on function public.fi_admin_lookup_auth_user_id_by_email(text) is
  'SECURITY DEFINER auth.users lookup. service_role-only: EXECUTE is revoked '
  'from public/anon/authenticated to prevent unauthenticated email->auth UUID '
  'enumeration. Do NOT re-grant to client roles.';
