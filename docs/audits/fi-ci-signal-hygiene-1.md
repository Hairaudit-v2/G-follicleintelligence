# FI-CI-SIGNAL-HYGIENE-1 — Findings

**Milestone:** `FI-CI-SIGNAL-HYGIENE-1`  
**Phase:** 2 — Buckets B+A+C+D fixes (2026-07-14); Phase 1 audit 2026-07-14  
**HEAD at audit:** `4fb3b6b4` (`docs(audit): confirm Keep Decision B for FI_E2E_STAGING_URL.`)  
**Prior milestone:** `FI-TRUST-CI-AND-RECEPTION-1` **GREEN** (trust trio + reception R1)  
**Decision B:** `FI_E2E_STAGING_URL` = `https://follicleintelligence.ai` — confirmed Keep B

---

## Executive summary

**Milestone verdict: GREEN** (2026-07-14).

Public smoke remains **advisory** (`continue-on-error: true`). Phase 2 closed buckets **B → A → C+D**: public fails **126 → 78 → 18 → 0**. Failures were **CI signal hygiene** (auth tag on credential-less job; Front Desk labels without session; narrow security status expects; procedure-day final-200 after login redirect), not proven product P0s. Trust trio gate stays **GREEN**. **DEF-TC-01 closed** — `npm run typecheck` **0 errors** (test-file typing only). CI-TRIAGE-TEAM-01 quarantine **in place** (deferred beyond milestone acceptance). Optional fixtures still **MISSING** (deferred — CI-FIX-01). HR-DRIFT-01 **deferred** (ops monitor).

**Phase 1 verdict:** **AMBER** for overall CI readability (trust GREEN; public smoke advisory-red); inventory complete for Phase 2.

**Phase 2 (PUB-AUTH-CRASH / Bucket B):** Public projects now `grepInvert: /@authenticated/`; `authenticatedTest` skips cleanly when `!hasDemoCredentials()` (no `.trim()` TypeError). Confirmed on [29282145316](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29282145316): **132 / 78 / 66** (−48 fails).

**Phase 2 (PUB-LABELS / Bucket A):** `fi-ux-audit-labels` re-tagged `@authenticated @smoke` + `authenticatedTest`; included in authenticated `testMatch`. Confirmed on [29290007344](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29290007344): **126 / 18 / 66** (−60 fails vs post-B).

**Phase 2 (PUB-SEC-STATUS / Bucket C + PUB-PROC-200 / Bucket D):** Expect updates only (intentional 404/503; soft 200 + no Surgery day chrome). Confirmed on [29291077366](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29291077366): **144 passed / 0 failed / 66 skipped** (−18 fails). Trust trio **GREEN**.

**Phase 2 (DEF-TC-01):** Test typing/casts only — bodyScrollLock window mock via `unknown`; nav `"reports"` compares cast to `string`. Local `npm run typecheck` **PASS** (0 errors). Only remaining Phase 2 acceptance item closed → milestone **GREEN**.

---

## Evidence — GH Actions

### Latest e2e-smoke runs (audit window)

| Run | Commit | Trust trio | Public smoke | Notes |
| --- | ------ | ---------- | ------------ | ----- |
| [29281462736](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29281462736) | `4fb3b6b4` | **success** (in progress at audit start) | in progress / may complete later | Current tip |
| [29279984484](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29279984484) | `0584739e` | (narrow gate) | **cancelled** | concurrency cancel-in-progress |
| [29278655946](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29278655946) | `1a953eed` | success path | **cancelled** | same |
| [29277960526](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29277960526) | `dfeb6555` | **success** 6/0/2 | **cancelled** | Trust GREEN documented prior |
| [29275224871](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29275224871) | `31d8d8ad` | failure (full suite era) | **completed failure** | **Last full public Playwright summary** |

**Primary public-smoke classification source:** run **29275224871** job *Public + security smoke (production build)* — **132 passed / 126 failed / 186 skipped** (~18.0m). Later pushes repeatedly **cancelled** the long public job before finish; bucket analysis therefore uses this completed run (still representative of current public grep + 6 browsers).

Commands:

```bash
gh run list --workflow=e2e-smoke.yml --limit 10
gh run view 29275224871 --log
```

---

## H1 — Public smoke failure buckets (126)

**Matrix:** 6 browsers × **21** logical failing cases = **126**.

| Browser | Fail count |
| ------- | ---------- |
| chromium | 21 |
| edge | 21 |
| firefox | 21 |
| webkit | 21 |
| mobile-chrome | 21 |
| mobile-safari | 21 |

### Bucket summary

| Bucket | Logical cases | × browsers | Fail count | Root cause (chromium sample) | Disposition (Phase 2) |
| ------ | ------------- | ---------- | ---------- | ---------------------------- | --------------------- |
| **A. Front Desk labels @smoke** | 10 | 6 | **60** | `fi-ux-audit-labels` — timeout waiting for `heading "Today"` on `/fi-admin/{tenant}/front-desk` | Re-tag `@authenticated` **or** skip when no session / login wall; not a product redesign |
| **B. Auth `@smoke` on public job (no creds)** | 8 | 6 | **48** | `fixtures/auth.ts:44` — `Cannot read properties of undefined (reading 'trim')` on `FI_E2E_DEMO_ADMIN_*` | **P0 first fix:** skip/guard fixture when `!hasDemoCredentials()` **or** exclude dual-tagged `@authenticated @smoke` from public projects |
| **C. Security status mismatch** | 2 | 6 | **12** | patients API → **404** (want 401/403/redirect); cron → **503** (want 401/403/500) | **Closed** — widen expects (intentional) |
| **D. Procedure-day unauth HTTP 200** | 1 | 6 | **6** | `procedure-day` goto status **200**, not in deny list `[404,302,303,307,401,403]` | **Closed** — allow 200 + assert no Surgery day chrome |

**Spec counts (raw):**

| Spec file | Fails |
| --------- | ----- |
| `e2e/fi-ux-audit-labels.spec.ts` | 60 |
| `e2e/fi-operational-day.spec.ts` | 18 (6 procedure-day + 12 authenticated) |
| `e2e/security/unauthenticated-access.spec.ts` | 12 |
| `e2e/fi-trust-pipeline-layout.spec.ts` | 12 |
| `e2e/journeys/treatment-imaging-protocol.spec.ts` | 12 |
| `e2e/journeys/patient-visual-summary-smoke.spec.ts` | 6 |
| `e2e/journeys/team-workspace-nav.spec.ts` | 6 |

**Logical `@authenticated @smoke` crashing on public job (Bucket B):** operational-day open board + cross-tenant; trust pipeline layout ×2; team-workspace-nav; treatment-imaging ×2; patient-visual-summary approve — all hit worker fixture login without secrets. Public job env intentionally omits `FI_E2E_DEMO_ADMIN_*` (placeholder Supabase only).

**Note:** Trust trio specs that are also `@smoke` appear in this historical full authenticated job era on **29275224871**; current workflow runs trust trio **only** on `authenticated-smoke` against production. Public job still greps `/@security|@smoke|@a11y/` across default browser projects — dual-tagged `@authenticated @smoke` therefore still execute (and crash) on public.

---

## H2 — DEF-TC-01 typecheck (**CLOSED**)

**Command:** `npm run typecheck`  
**Date:** 2026-07-14  
**Result:** **PASS** — **0 errors**

| File | Was | Fix |
| ---- | --- | --- |
| `src/lib/dom/bodyScrollLock.test.ts` | 3 | `globalThis` mock via `unknown`; optional `document`/`window` so `delete` is typed |
| `src/lib/fiOs/navigation/fiOsNavigationRegrouping.test.ts` | 1 | `(i.id as string) === "reports"` (assert absent from rail) |
| `src/lib/fiOs/navigation/fiOsRolePermissionPreflightAudit.test.ts` | 1 | Same string cast |
| `src/lib/fiOs/reports/fiOsReportsConsolidation.test.ts` | 1 | Same string cast |

**Status:** **Closed** — test-file typing only; no product redesign. `ci.yml` typecheck can claim **GREEN**.

---

## H3 — CI-TRIAGE-TEAM-01 quarantine (**DEFERRED**)

**File:** `e2e/journeys/team-workspace-nav.spec.ts`  
**Status:** **Deferred (out of milestone acceptance)** — skip still present: if neither `team-sub-nav` nor access-denied heading appears within timeout, `test.skip(..., "… (CI-TRIAGE-TEAM-01)")`.

Public job no longer selects this `@authenticated` spec (`grepInvert`). Quarantine remains relevant for **credentialed** authenticated projects / manual runs. Not a product P0 for this milestone; trust trio gate does **not** include this spec → **no impact on GREEN trust / milestone GREEN**.

---

## H4 — Optional fixtures MISSING list (**DEFERRED** — CI-FIX-01)

**Checked:** `gh secret list` / `gh variable list` (names only) — 2026-07-14  
**Milestone disposition:** Inventory **GREEN**; optional secrets remain **MISSING** by choice — **deferred** (not blocking milestone GREEN).

| Name | Kind | Status | Notes |
| ---- | ---- | ------ | ----- |
| `FI_E2E_DEMO_ADMIN_EMAIL` | secret | **SET** | P0 trust |
| `FI_E2E_DEMO_ADMIN_PASSWORD` | secret | **SET** | P0 trust |
| `FI_E2E_TENANT_ID` | secret | **SET** | P0 trust |
| `FI_E2E_LEAD_ID` | secret | **SET** | Spine |
| `FI_E2E_PATIENT_ID` | secret | **SET** | Spine |
| `FI_E2E_STAGING_URL` | variable | **SET** = production HTTPS | Decision B |
| `FI_E2E_OTHER_TENANT_ID` | secret | **MISSING** | Cross-tenant skip — leave unless ops wants coverage |
| `FI_E2E_UNLINKED_LEAD_ID` | secret | **MISSING** | CI-FIX-01 defer |
| `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` | — | **MISSING** | CI-FIX-01 defer (trust role-home optional assert) |

**Public job:** does **not** wire demo admin secrets (by design for local placeholder build). Bucket B fixed via `grepInvert` + fixture skip.

---

## H5 — Trust gate (carry-forward)

| Field | Value |
| ----- | ----- |
| Workflow | `e2e-smoke.yml` → `Trust trio (authenticated gate)` |
| Host | `vars.FI_E2E_STAGING_URL` = production (Decision B) |
| Last documented GREEN | [29277960526](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29277960526) — 6 passed / 0 failed / 2 skipped |
| Audit tip | [29281462736](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29281462736) trust job **success** at audit time |

**Do not regress** trust-trio-only scope while cleaning public smoke.

---

## H6 — HR sync drift (ops monitor) (**DEFERRED**)

**Carry from** `FI-ROLE-JOURNEY-BAKE-1` / trust money readiness: iiohr HR sync can revert Evolved consultant `staff_role` / `full_name` (observed prior sync `2026-07-13T08:00:37Z`).

| ID | Priority | Action |
| -- | -------- | ------ |
| HR-DRIFT-01 | **P3 / ops** | **Deferred** — monitor HR sync health / staff mapping after overnight syncs; not a CI test fix; **does not block milestone GREEN** |

No product redesign. Staff mapping gate (`npm run audit:staff-mapping`) remains the ops bar when checking drift.

---

## Check matrix results (Phase 2 close)

| ID | Result |
| -- | ------ |
| H1 Public buckets | **GREEN** (A–D closed; 0 public fails on 29291077366) |
| H2 DEF-TC-01 | **GREEN** (0 `tsc` errors) |
| H3 CI-TRIAGE-TEAM-01 | **GREEN** (skip present; **deferred** beyond acceptance) |
| H4 Fixtures inventory | **GREEN** (MISSING list current; optional set **deferred**) |
| H5 Trust trio | **GREEN** (carry + tip run success) |
| H6 HR drift | **GREEN** for milestone (**deferred** ops monitor; not a CI blocker) |

**Overall milestone:** **GREEN**

---

## Recommended Phase 2 fix order

| Pri | ID | Fix | Expected fail delta (public) | Constraint |
| --- | -- | --- | ---------------------------- | ---------- |
| **P0** | PUB-AUTH-CRASH | Auth fixture: skip worker login when `!hasDemoCredentials()` **and/or** public projects exclude `@authenticated` | **−48** | No product change |
| **P1** | PUB-LABELS | `fi-ux-audit-labels`: require auth project **or** skip on login redirect / missing Today | **−60** | Test/quarantine only unless Today board proven broken with session |
| **P1** | PUB-PROC-200 | Procedure-day unauth **200** — soft login final status + no Surgery day chrome | **−6** | Expect update (mirror reception) |
| **P2** | PUB-SEC-STATUS | patients **404** / cron **503** expects | **−12** | Expect update (intentional) |
| **P2** | DEF-TC-01 | Fix 6 test typing errors | N/A (unit CI) | **Closed** — milestone GREEN |
| **P3** | CI-FIX-01 / HR-DRIFT-01 | Optional secrets + ops sync cadence | Skip→run when set | **Deferred** (ops; not milestone blockers) |

### Proposed Phase 2 **first** fix

**Harden `e2e/fixtures/auth.ts` (and/or public project grep) so missing `FI_E2E_DEMO_ADMIN_*` yields a clean skip instead of `trim` TypeError on every `@authenticated @smoke` case in the public job.**

This is the highest-leverage, lowest-risk signal win (~38% of the 126) and does not touch product UI.

---

## Phase 2 — PUB-AUTH-CRASH (Bucket B) fix notes

| Field | Value |
| ----- | ----- |
| Status | **Confirmed** on CI run [29282145316](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29282145316) |
| Date | 2026-07-14 |
| Commit | `16b29652` |
| ID | PUB-AUTH-CRASH |
| Expected delta | **−48** public fails (8×6) |
| Actual public summary | **132 passed / 78 failed / 66 skipped** (was 132 / **126** / 186 on 29275224871) → **−48 fails** |
| Auth `trim` crashes | **0** (was Bucket B systematic) |
| Trust trio | **GREEN** (same run) |

**Changes:**

1. `playwright.config.ts` — public projects add `grepInvert: /@authenticated/` so dual-tagged `@authenticated @smoke` never select into the credential-less job.
2. `e2e/fixtures/auth.ts` — auto `testInfo.skip` when `!hasDemoCredentials()`; worker fixture returns empty storage state instead of calling `.trim()` on unset env; login uses `demoAdminEmail()` / `demoAdminPassword()`.
3. `e2e/helpers/credentials.test.ts` — unit guard for unset / whitespace / present demo creds.

**Trust trio:** Unchanged — still `authenticated-smoke` → `--project=chromium-authenticated` with secrets. Confirmed GREEN on the fix run.

**Bucket C+D:** Closed after A+B residual — see PUB-SEC-STATUS / PUB-PROC-200 notes below.

---

## Phase 2 — PUB-LABELS (Bucket A) fix notes

| Field | Value |
| ----- | ----- |
| Status | **Confirmed** on CI run [29290007344](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29290007344) |
| Date | 2026-07-14 |
| Commit | `5204ba69` |
| ID | PUB-LABELS |
| Evidence before | [29282145316](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29282145316) — **132 passed / 78 failed / 66 skipped**; all `fi-ux-audit-labels` fails = timeout on `heading "Today"` / Front Desk nav (no session on placeholder public build). One case per browser passed unauth: `staff cannot open /reception-os`. |
| Classification | **Needs auth** — not outdated selectors/copy, not flaky timeout of a broken board, not wrong product surface. Spec asserts live Front Desk chrome on protected `/fi-admin/{tenant}/front-desk*`. |
| Expected delta | **−60** public fails (10×6); also **−6** public passes (reception-os was the only labels pass) |
| Actual public summary | **126 passed / 18 failed / 66 skipped** → **−60 fails** (residual = Buckets C+D) |
| Labels on public job | **0** selections (`grepInvert: /@authenticated/`) |
| Trust trio | **GREEN** (same run: 6 passed / 2 skipped) |

**Changes:**

1. `e2e/fi-ux-audit-labels.spec.ts` — switch to `authenticatedTest`; describe tag `@authenticated @smoke` (was bare `@smoke`).
2. `playwright.config.ts` — add `fi-ux-audit-labels.spec.ts` to authenticated projects `testMatch` so credentialed local/CI projects still select the file.

**Not done:** product UI redesign; keeping labels on public with soft skip (would leave dead `@smoke` selects). Auth tag + `grepInvert` is the same pattern as Bucket B.

**Next residual (~18):** Bucket C security expects (~12) + Bucket D procedure-day HTTP 200 (~6) — closed in PUB-SEC-STATUS / PUB-PROC-200.

---

## Phase 2 — PUB-SEC-STATUS (Bucket C) + PUB-PROC-200 (Bucket D) fix notes

| Field | Value |
| ----- | ----- |
| Status | **Confirmed** on CI run [29291077366](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29291077366) |
| Date | 2026-07-14 |
| Commit | `83965f20` |
| Evidence before | [29290007344](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29290007344) — **126 / 18 / 66**; C+D only |
| IDs | PUB-SEC-STATUS, PUB-PROC-200 |
| Expected delta | **−18** public fails (12+6) → **0** residual public fails from H1 buckets |
| Actual public summary | **144 passed / 0 failed / 66 skipped** → **−18 fails** (H1 buckets A–D closed) |
| Trust trio | **GREEN** (same run) |

### Disposition table (C+D)

| Case | Observed | Root cause | Disposition |
| ---- | -------- | ---------- | ----------- |
| Patients `GET /api/tenants/{tid}/patients` | **404** | No collection Route Handler (only `/patients/[patientId]/…`); Next 404 | **Expect update** — treat 404 as fail-closed (no leak). Aligns with `fi-production-smoke-test` accept list. |
| Cron `GET /api/cron/fi-reminder-jobs` | **503** | `assertCronAuthorized` returns 503 when no valid-length cron secrets (CI placeholder unset) | **Expect update** — 503 intentional deny; unit-tested in `cronAuth.test.ts`. |
| Procedure-day unauth goto | **200** | Prod middleware redirects to login; Playwright final status after follow is often 200; board chrome absent | **Expect update** — allow 200 + assert `heading "Surgery day"` not visible (mirror reception-board soft check). No product gate change. |

**Not product defects:** No route-gate redesign; no fail-open proven.

**Changes:**

1. `e2e/security/unauthenticated-access.spec.ts` — patients accept **404**; cron accept **503**.
2. `e2e/fi-operational-day.spec.ts` — procedure-day allow **200** + no Surgery day heading when flag off.

**Milestone verdict (post C+D):** Public smoke H1 **met** (**0** public fails). Overall still **AMBER** until DEF-TC-01 closed (see below).

---

## Phase 2 — DEF-TC-01 fix notes

| Field | Value |
| ----- | ----- |
| Status | **Closed** — local `npm run typecheck` **PASS** |
| Date | 2026-07-14 |
| ID | DEF-TC-01 |
| Changes | Test-only typing: bodyScrollLock mock via `unknown` + optional globals; rail `"reports"` absence asserts use `(i.id as string)` |

**Deferred (explicit, not blocking GREEN):** CI-TRIAGE-TEAM-01 quarantine remains; CI-FIX-01 optional fixtures MISSING; HR-DRIFT-01 ops monitor.

**Overall milestone verdict:** **GREEN**

---

## Phase 1 commands log

| Command | Result |
| ------- | ------ |
| `npm run typecheck` | **PASS** — 0 errors (DEF-TC-01 closed) |
| `gh run list --workflow=e2e-smoke.yml --limit 10` | Tip + cancelled chain + **29275224871** complete public |
| `gh run view 29275224871 --log` | Buckets A–D classified |
| `gh secret list` / `gh variable list` | MISSING optional fixtures confirmed |
| `rg CI-TRIAGE-TEAM-01 e2e/journeys/team-workspace-nav.spec.ts` | Quarantine present |

---

## Related

- [fi-ci-signal-hygiene-1-plan.md](./fi-ci-signal-hygiene-1-plan.md)
- [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md)
- [.github/workflows/e2e-smoke.yml](../../.github/workflows/e2e-smoke.yml)
