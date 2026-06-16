
-- PG16+: grant service_role the ability to SET ROLE authenticated without
-- inheriting authenticated's table-level permissions.
-- WITH INHERIT FALSE means service_role does NOT pick up authenticated's
-- grants by default; it must explicitly SET ROLE to use them.
-- This is the minimal grant needed for fi_rls_regression_check() to work.
GRANT authenticated TO service_role WITH INHERIT FALSE;

-- Allow service_role to call the jsonb helper (called after RESET ROLE)
GRANT EXECUTE ON FUNCTION public.fi_rls_build_result(text, text, bigint, bigint) TO service_role;
