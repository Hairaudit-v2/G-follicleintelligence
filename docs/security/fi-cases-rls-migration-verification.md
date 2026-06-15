# Verification: `fi_cases` tenant RLS migration

**Migration:** `supabase/migrations/20260818120002_fi_cases_tenant_select_rls.sql`  
**Baseline pattern:** `supabase/migrations/20260605140009_fi_foundation_rls.sql`

## Consistency with foundation RLS

| Aspect | Foundation tables (`fi_patients`, `fi_organisations`, …) | `fi_cases` (new) | Match? |
|--------|------------------------------------------------------------|------------------|--------|
| RLS enabled | `ALTER TABLE … ENABLE ROW LEVEL SECURITY` | Same | Yes |
| `authenticated` role | Policies target `to authenticated` | Same | Yes |
| Membership predicate | `EXISTS (SELECT 1 FROM fi_users u WHERE u.auth_user_id = auth.uid() AND u.tenant_id = <table>.tenant_id)` | Identical shape with `fi_cases.tenant_id` | Yes |
| DML for `authenticated` | None (comment: writes denied unless policies added later) | None (no INSERT/UPDATE/DELETE policies) | Yes |
| Service role | Bypasses RLS (Supabase default) | Unchanged | Yes |

## Safety relative to application code

1. **Server routes and server actions** use `supabaseAdmin()` (service role), which **does not evaluate** these policies. Behaviour of existing Next.js ingestion and CRM APIs is **unchanged** after migration apply.

2. **Authenticated PostgREST / supabase-js with user JWT** can now only `SELECT` `fi_cases` rows for tenants where the user has a matching `fi_users` row. Previously, if grants allowed `authenticated` on `fi_cases` without RLS, exposure depended entirely on table grants; with RLS on, default deny applies except for the new `SELECT` policy.

3. **No `anon` policy** was added. If the project grants `SELECT` on `fi_cases` to `anon`, behaviour remains default-deny for `anon` under RLS unless a separate policy exists (none planned).

4. **Platform / cross-tenant roles** that use only the **service role** client are unaffected. Any future **browser** query of `fi_cases` with the user’s session will be tenant-scoped by RLS — aligning with other foundation entities.

## Historical comment drift

`20260605140009_fi_foundation_rls.sql` lines 17–18 state that `fi_cases` RLS was deferred. That comment is now **historically accurate only up to** the application of `20260818120002_*`. Do not edit the old migration file; the new migration is the source of truth for `fi_cases` RLS.

## Apply checklist

- [ ] Run on staging first; smoke tenant case list + CRM case APIs + FI event ingestion.
- [ ] Confirm no Edge Function or mobile client relied on `authenticated` **writes** to `fi_cases` (none identified in repo audit).
- [ ] Optional: `EXPLAIN` a representative `SELECT` as `authenticated` to confirm policy use in Supabase SQL editor.

---

*Continuation of infrastructure hardening — docs only.*
