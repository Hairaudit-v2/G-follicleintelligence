# Supabase advisor / database-linter exceptions registry

Formal sign-off for Supabase **Security Advisor** (database linter) findings that are
**intentional and accepted** rather than fixed. Each entry documents why the finding is
a false positive or an accepted risk, who reviewed it, and the migration that recorded
the decision.

Run the advisor anytime with the Supabase MCP (`get_advisors`, `type: "security"`) or in
the Supabase dashboard → Advisors. Findings **not** listed here are expected to be
remediated, not waived.

---

## Lint 0029 — `authenticated_security_definer_function_executable`

> Detects `SECURITY DEFINER` functions that are callable by the `authenticated` role via
> `/rest/v1/rpc/...`. Remediation options: revoke `EXECUTE`, switch to `SECURITY INVOKER`,
> or move out of the exposed API schema.

### Accepted exceptions (Group B — intentional user-callable RPCs)

The functions below are **intentional** authenticated RPC endpoints, not RLS-only helpers.
Each is a `SECURITY DEFINER` wrapper that **self-authorizes internally** (`auth.uid()` plus
`is_academy_admin()` and/or `is_faculty_user()` / applicant row ownership) before performing
a privileged state transition. This is the recommended "policy-backed wrapper" pattern, so
`authenticated` EXECUTE **must remain**. `anon`/`public` EXECUTE is revoked; `service_role`
is retained.

| Function signature | Internal authorization | Reason kept for `authenticated` |
|---|---|---|
| `public.academy_admissions_accept_application(p_application_id uuid)` | `auth.uid()` + `is_academy_admin()` | Admin accepts an admissions application from the Academy UI. |
| `public.academy_admissions_admin_transition(p_application_id uuid, p_to_status public.application_status, p_internal_note text, p_applicant_message text, p_answers_snapshot jsonb)` | `auth.uid()` + `is_academy_admin()` | Admin transitions application status with audit note/message. |
| `public.academy_applicant_resubmit_application(p_application_id uuid)` | `auth.uid()` + applicant row ownership | Applicant resubmits their own application. |
| `public.academy_applicant_submit_from_draft(p_application_id uuid)` | `auth.uid()` + applicant row ownership | Applicant submits their own draft. |
| `public.academy_applicant_withdraw_application(p_application_id uuid)` | `auth.uid()` + applicant row ownership | Applicant withdraws their own application. |
| `public.academy_faculty_claim_attempt(p_attempt_id uuid)` | `auth.uid()` + (`is_academy_admin()` OR `is_faculty_user()`) | Faculty/admin claims an assessment attempt for review. |
| `public.academy_faculty_finalize_attempt(p_attempt_id uuid, p_outcome text, p_notes text, p_rubric_summary text)` | `auth.uid()` + faculty/admin checks | Faculty/admin finalizes an assessment attempt outcome. |

**Final exposure (all Group B):** `authenticated = EXECUTE`, `anon = revoked`,
`public = revoked`, `service_role = EXECUTE`. `SECURITY DEFINER` retained (not converted to
`SECURITY INVOKER`).

**Reviewer note:** These endpoints are safe under lint 0029 because a signed-in user cannot
escalate privileges by calling them directly — the function body rejects the call unless the
caller passes its internal authorization checks. Revoking `authenticated` here would break the
Academy applicant/faculty/admin flows. Do **not** "fix" this finding by revoking `authenticated`
or switching to `SECURITY INVOKER` without redesigning the wrappers.

**Recorded by migration:** `supabase/migrations/202610017001_audit_security_definer_rpc_lockdown.sql`
(date logical prefix `20260701`, audit block `70xx`).

**Date:** 2026-07-01.

### Remediated (Group A — internal RLS helpers, NOT waived)

For completeness: the following `SECURITY DEFINER` helpers were **actually remediated** in the
same migration (revoked from `public`/`anon`/`authenticated`, kept for `service_role`), because
they are only referenced inside RLS policy expressions and never meant to be RPCs:
`user_clinic_ids()`, `fi_os_can_select_clinical_intelligence_tenant_data(uuid)`,
`fi_os_can_select_staff_feature_access_audit(uuid)`,
`fi_os_can_select_tenant_outcome_aggregate(uuid)`, `is_academy_admin()`, `is_faculty_user()`,
`faculty_can_access_stream(text)`. These should clear lint 0029 after the migration is applied.

---

## Verification

- Migration self-verifies grants on apply (trailing `DO $$ ... $$` block asserts Group A locked,
  Group B intentional).
- Standalone check / regression:
  `node scripts/run-supabase-sql-docker.mjs supabase/smoke/fi_security_definer_rpc_lockdown_check.sql`
- Live confirmation: run `get_advisors(type: "security")` after deploy; Group A findings should
  disappear, Group B findings for the functions above are **expected and waived per this file**.
