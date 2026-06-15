-- Infrastructure hardening: align fi_cases with foundation RLS posture.
-- Authenticated Supabase clients (anon JWT upgraded to authenticated) may SELECT only
-- rows for tenants where fi_users.auth_user_id = auth.uid().
-- Application servers continue to use the service role for ingestion and CRM APIs;
-- service_role bypasses RLS in Supabase, so this does not change server-route behaviour.
-- No INSERT/UPDATE/DELETE policies for authenticated — same conservative model as
-- fi_organisations / fi_patients in 20260605140009_fi_foundation_rls.sql.

alter table fi_cases enable row level security;

drop policy if exists fi_cases_select_tenant_member on fi_cases;
create policy fi_cases_select_tenant_member
  on fi_cases for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_cases.tenant_id
    )
  );

comment on table fi_cases is
  'Clinical / pipeline case episode. RLS: authenticated members SELECT by tenant; writes via service_role server routes.';
