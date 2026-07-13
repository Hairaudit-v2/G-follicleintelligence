# FI-CI-SIGNAL-HYGIENE-1 — Findings

**Milestone:** `FI-CI-SIGNAL-HYGIENE-1`  
**Phase:** 2 — Buckets B+A fixes (2026-07-14); Phase 1 audit 2026-07-14  
**HEAD at audit:** `4fb3b6b4` (`docs(audit): confirm Keep Decision B for FI_E2E_STAGING_URL.`)  
**Prior milestone:** `FI-TRUST-CI-AND-RECEPTION-1` **GREEN** (trust trio + reception R1)  
**Decision B:** `FI_E2E_STAGING_URL` = `https://follicleintelligence.ai` — confirmed Keep B

---

## Executive summary

Public smoke remains **advisory** (`continue-on-error: true`) and was very red (~**126 failed** on the last completed cross-browser run before Phase 2). Failures cluster into a small number of root causes — mostly **CI signal hygiene** (authenticated `@smoke` on a credential-less public job; Front Desk label specs hitting protected routes without a session), not proven product P0s. Trust trio gate stays **GREEN**. DEF-TC-01 reconfirmed (**6** `tsc` errors, all in `*.test.ts`). CI-TRIAGE-TEAM-01 quarantine **in place**. Optional fixtures still **MISSING**.

**Phase 1 verdict:** **AMBER** for overall CI readability (trust GREEN; public smoke advisory-red); inventory complete for Phase 2.

**Phase 2 (PUB-AUTH-CRASH / Bucket B):** Public projects now `grepInvert: /@authenticated/`; `authenticatedTest` skips cleanly when `!hasDemoCredentials()` (no `.trim()` TypeError). Confirmed on [29282145316](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29282145316): **132 / 78 / 66** (−48 fails).

**Phase 2 (PUB-LABELS / Bucket A):** `fi-ux-audit-labels` re-tagged `@authenticated @smoke` + `authenticatedTest`; included in authenticated `testMatch`. Public job no longer selects Front Desk label cases (need session). **Expected public-job delta ≈ −60** (10 logical × 6 browsers). Remaining noise after A+B: C security status (~12), D procedure-day 200 (~6) → ~18 fails.

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
| **C. Security status mismatch** | 2 | 6 | **12** | patients API → **404** (want 401/403/redirect); cron → **503** (want 401/403/500) | P2 — confirm intended status before widening expect |
| **D. Procedure-day unauth HTTP 200** | 1 | 6 | **6** | `procedure-day` goto status **200**, not in deny list `[404,302,303,307,401,403]` | P1 investigate — soft page vs fail-closed; fix test **or** prove product gap |

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

## H2 — DEF-TC-01 typecheck (reconfirmed)

**Command:** `npm run typecheck`  
**Date:** 2026-07-14  
**Result:** **FAIL** — **6 errors** (unchanged class)

| File | Errors | Class |
| ---- | ------ | ----- |
| `src/lib/dom/bodyScrollLock.test.ts` | 3 | Window mock cast; `delete` operand not optional |
| `src/lib/fiOs/navigation/fiOsNavigationRegrouping.test.ts` | 1 | Nav slot union vs `"reports"` comparison |
| `src/lib/fiOs/navigation/fiOsRolePermissionPreflightAudit.test.ts` | 1 | Same `"reports"` overlap |
| `src/lib/fiOs/reports/fiOsReportsConsolidation.test.ts` | 1 | Same `"reports"` overlap |

**Status:** **Open** — test-file typing only; does not block trust E2E. Blocks claiming `ci.yml` typecheck **GREEN**.

---

## H3 — CI-TRIAGE-TEAM-01 quarantine

**File:** `e2e/journeys/team-workspace-nav.spec.ts`  
**Status:** **Active** — if neither `team-sub-nav` nor access-denied heading appears within timeout, `test.skip(..., "… (CI-TRIAGE-TEAM-01)")`.

On public smoke (Bucket B), this spec **does not reach** the quarantine path — it fails earlier in `authenticatedTest` worker setup (`trim` on missing email). Quarantine remains relevant for **credentialed** authenticated projects / manual runs against production.

Trust trio gate does **not** include this spec → **no impact on GREEN trust**.

---

## H4 — Optional fixtures MISSING list

**Checked:** `gh secret list` / `gh variable list` (names only) — 2026-07-14

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

**Public job:** does **not** wire demo admin secrets (by design for local placeholder build). That is why Bucket B is systematic.

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

## H6 — HR sync drift (ops monitor)

**Carry from** `FI-ROLE-JOURNEY-BAKE-1` / trust money readiness: iiohr HR sync can revert Evolved consultant `staff_role` / `full_name` (observed prior sync `2026-07-13T08:00:37Z`).

| ID | Priority | Action |
| -- | -------- | ------ |
| HR-DRIFT-01 | **P3 / ops** | Monitor HR sync health dashboard / staff mapping after overnight syncs; not a CI test fix this milestone |

No product redesign. Staff mapping gate (`npm run audit:staff-mapping`) remains the ops bar when checking drift.

---

## Check matrix results (Phase 1)

| ID | Result |
| -- | ------ |
| H1 Public buckets | **GREEN** (classified from 29275224871) |
| H2 DEF-TC-01 | **AMBER** (6 known test errors) |
| H3 CI-TRIAGE-TEAM-01 | **GREEN** (skip present) |
| H4 Fixtures inventory | **GREEN** (MISSING list current) |
| H5 Trust trio | **GREEN** (carry + tip run success) |
| H6 HR drift | **AMBER** (monitor filed; not re-probed this audit) |

---

## Recommended Phase 2 fix order

| Pri | ID | Fix | Expected fail delta (public) | Constraint |
| --- | -- | --- | ---------------------------- | ---------- |
| **P0** | PUB-AUTH-CRASH | Auth fixture: skip worker login when `!hasDemoCredentials()` **and/or** public projects exclude `@authenticated` | **−48** | No product change |
| **P1** | PUB-LABELS | `fi-ux-audit-labels`: require auth project **or** skip on login redirect / missing Today | **−60** | Test/quarantine only unless Today board proven broken with session |
| **P1** | PUB-PROC-200 | Procedure-day unauth **200** — inspect response (login soft-render vs open module) | **−6** | Product fix **only** if fail-closed proven broken on real host |
| **P2** | PUB-SEC-STATUS | patients **404** / cron **503** expects | **−12** | Prove status intentional on prod-like middleware |
| **P2** | DEF-TC-01 | Fix 6 test typing errors | N/A (unit CI) | Test types only |
| **P3** | CI-FIX-01 / HR-DRIFT-01 | Optional secrets + ops sync cadence | Skip→run when set | Ops |

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

**Bucket C (deferred):** patients API **404** and cron **503** vs narrow expect lists — still present after A+B (×6 browsers = 12). Not widened here; need intentional-status proof on prod-like middleware before changing expects.

**Bucket D (deferred):** procedure-day unauth HTTP **200** (~6). Soft page vs fail-closed — prove before product change.

---

## Phase 2 — PUB-LABELS (Bucket A) fix notes

| Field | Value |
| ----- | ----- |
| Status | **Implemented** — pending CI confirm on next `e2e-smoke` run |
| Date | 2026-07-14 |
| ID | PUB-LABELS |
| Evidence before | [29282145316](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29282145316) — **132 passed / 78 failed / 66 skipped**; all `fi-ux-audit-labels` fails = timeout on `heading "Today"` / Front Desk nav (no session on placeholder public build). One case per browser passed unauth: `staff cannot open /reception-os`. |
| Classification | **Needs auth** — not outdated selectors/copy, not flaky timeout of a broken board, not wrong product surface. Spec asserts live Front Desk chrome on protected `/fi-admin/{tenant}/front-desk*`. |
| Expected delta | **−60** public fails (10×6); also **−6** public passes (reception-os was the only labels pass) → expect ~**126 passed / 18 failed** residual (C+D) |
| Trust trio | Unchanged — still three explicit trust files on `chromium-authenticated` |

**Changes:**

1. `e2e/fi-ux-audit-labels.spec.ts` — switch to `authenticatedTest`; describe tag `@authenticated @smoke` (was bare `@smoke`).
2. `playwright.config.ts` — add `fi-ux-audit-labels.spec.ts` to authenticated projects `testMatch` so credentialed local/CI projects still select the file.

**Not done:** product UI redesign; keeping labels on public with soft skip (would leave dead `@smoke` selects). Auth tag + `grepInvert` is the same pattern as Bucket B.

---

## Phase 1 commands log

| Command | Result |
| ------- | ------ |
| `npm run typecheck` | **FAIL** — 6 errors (DEF-TC-01) |
| `gh run list --workflow=e2e-smoke.yml --limit 10` | Tip + cancelled chain + **29275224871** complete public |
| `gh run view 29275224871 --log` | Buckets A–D classified |
| `gh secret list` / `gh variable list` | MISSING optional fixtures confirmed |
| `rg CI-TRIAGE-TEAM-01 e2e/journeys/team-workspace-nav.spec.ts` | Quarantine present |

---

## Related

- [fi-ci-signal-hygiene-1-plan.md](./fi-ci-signal-hygiene-1-plan.md)
- [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md)
- [.github/workflows/e2e-smoke.yml](../../.github/workflows/e2e-smoke.yml)
