
-- ============================================================================
-- Patch 4a: fi_users self-select policy
--
-- All Patch 4 clinical table policies contain:
--   EXISTS (SELECT 1 FROM fi_users u WHERE u.auth_user_id = auth.uid() AND ...)
--
-- fi_users already has RLS enabled. Without a permissive SELECT policy,
-- that EXISTS subquery always returns false for authenticated users —
-- effectively denying all rows from every Patch 4 protected table.
--
-- This policy allows each authenticated user to read their own fi_users row
-- only. It is the minimal prerequisite for the clinical table policies to
-- function when client-side Supabase access is introduced.
--
-- No INSERT/UPDATE/DELETE policies are added here — all writes remain
-- service_role (server-side) only.
-- ============================================================================

CREATE POLICY fi_users_select_own ON public.fi_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

COMMENT ON POLICY fi_users_select_own ON public.fi_users IS
  'Allows authenticated users to read their own fi_users row only. '
  'Required prerequisite for all Patch 4 clinical table RLS policies, '
  'which resolve tenant membership via EXISTS (SELECT 1 FROM fi_users ...).';
