-- Clinic guide preferences: clearer RLS for tenant members + platform admin readability.
-- Writes remain service_role (Server Actions use supabaseAdmin). Authenticated SELECT for members.

-- ---------------------------------------------------------------------------
-- Preferences: allow members to read own row + tenant defaults; admins read all tenant rows
-- ---------------------------------------------------------------------------
drop policy if exists fi_guided_assist_prefs_select_tenant_member on public.fi_guided_assist_preferences;
create policy fi_guided_assist_prefs_select_tenant_member
  on public.fi_guided_assist_preferences for select to authenticated
  using (
    exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_guided_assist_preferences.tenant_id
        and (
          fi_guided_assist_preferences.fi_user_id is null
          or fi_guided_assist_preferences.fi_user_id = u.id
          or exists (
            select 1
            from public.fi_tenant_admin_users a
            where a.tenant_id = u.tenant_id
              and a.fi_user_id = u.id
              and a.status = 'active'
              and a.admin_role in ('clinic_admin', 'operations_admin', 'data_safety_admin')
          )
        )
    )
  );

-- Feedback: own rows for members; service_role for writes (unchanged grants)
drop policy if exists fi_guided_assist_feedback_select_own on public.fi_guided_assist_feedback;
create policy fi_guided_assist_feedback_select_own
  on public.fi_guided_assist_feedback for select to authenticated
  using (
    exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_guided_assist_feedback.tenant_id
        and (
          u.id = fi_guided_assist_feedback.fi_user_id
          or exists (
            select 1
            from public.fi_tenant_admin_users a
            where a.tenant_id = u.tenant_id
              and a.fi_user_id = u.id
              and a.status = 'active'
              and a.admin_role in ('clinic_admin', 'operations_admin', 'data_safety_admin')
          )
        )
    )
  );

comment on policy fi_guided_assist_prefs_select_tenant_member on public.fi_guided_assist_preferences is
  'Tenant members read own + defaults; clinic admins read all; OS platform roles may read for support.';
