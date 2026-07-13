# FI-TRUST-CI-AND-RECEPTION-1

**Status:** **Phase 1 IN PROGRESS** — audit gaps identified; CI/ops + reception live bake not started  
**Date:** 2026-07-14  
**Depends on:** FI-TRUST-E2E-AND-PIPELINE-1 (GREEN — E2E, Pipeline allowlist, DEF-NURSE-01)  
**Plan:** [fi-trust-ci-and-reception-1-plan.md](./fi-trust-ci-and-reception-1-plan.md)

## Goal

Make authenticated trust E2E a durable CI/ops gate (not only manual production bakes), close optional fixture / host gaps, and finish the deferred reception landing live spot-check.

---

## Phase 1 — CI / workflow audit

### Source of recommendation

`FI-TRUST-E2E-AND-PIPELINE-1` recommended next action (2026-07-13/14):

1. Wire `chromium-authenticated` trust bundle in CI once `FI_E2E_DEMO_ADMIN_*` secrets are in the deployment secret store.
2. Optional: `FI_E2E_UNLINKED_LEAD_ID`, `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX=/crm`.
3. Optional: reception landing spot-check (`crm_operator` → `/front-desk`).

### Current CI shape

| Job | Workflow | Host | Secrets gate | Trust specs |
| --- | -------- | ---- | ------------ | ----------- |
| Public + security smoke | `e2e-smoke.yml` | Builds + starts `127.0.0.1:3000` | Placeholder Supabase env | N/A (public tags) |
| Authenticated journeys | `e2e-smoke.yml` `authenticated-smoke` | `vars.FI_E2E_STAGING_URL` **or** `http://127.0.0.1:3000` | Requires `FI_E2E_DEMO_ADMIN_*` + `FI_E2E_TENANT_ID` | Runs `--grep @authenticated` (includes `fi-trust-*` via project `testMatch` when credentials present) |
| Lint / typecheck / unit | `ci.yml` | N/A | N/A | `typecheck` currently fails (DEF-TC-01) |

### Gap matrix (code / config)

| ID | Class | Finding | Evidence |
| -- | ----- | ------- | -------- |
| CI-HOST-01 | **P1** | Authenticated job has **no** build/start step. If `FI_E2E_STAGING_URL` is unset, Playwright targets localhost with nothing listening. | `.github/workflows/e2e-smoke.yml` lines 58–99 vs public job which builds+starts |
| CI-TRUST-01 | **P1** | No **dedicated** trust-file step — full `@authenticated` suite runs (broader than E2E milestone acceptance trio). Flake / runtime risk; trust signal diluted. | `npx playwright test --grep @authenticated` |
| CI-SPINE-01 | **P2** | CI env does not set `FI_E2E_LEAD_ID` / `FI_E2E_PATIENT_ID` — golden-patient spine remains skip in CI even when login works. | Workflow env block; prior production bake needed local `.env.local` fixtures |
| CI-FIX-01 | **P2** | Optional `FI_E2E_UNLINKED_LEAD_ID` and `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` unset → permanent skips (documented acceptable unless ops chooses to enable). | E2E close-out 2 SKIP |
| CI-SEC-01 | **P0 (ops)** | Secret store presence **unverified this session** (`gh` CLI unavailable on agent host). Must be confirmed by repo admin before claiming CI gate GREEN. | Agent environment 2026-07-14 |

**Playwright note:** `hasDemoCredentials()` gates `*-authenticated` projects. Trust specs are in `testMatch` for those projects and tagged `@authenticated` — wiring is code-ready; CI host + secrets + fixture env are the remaining barriers.

---

## Phase 1 — Typecheck baseline (DEF-TC-01)

**Command:** `npm run typecheck`  
**Date:** 2026-07-14  
**Result:** **FAIL** — 6 errors (same class as bake-1)

| File | Error class |
| ---- | ----------- |
| `src/lib/dom/bodyScrollLock.test.ts` | Window mock cast / `delete` operand |
| `src/lib/fiOs/navigation/fiOsNavigationRegrouping.test.ts` | Nav slot union vs `"reports"` comparison |
| `src/lib/fiOs/navigation/fiOsRolePermissionPreflightAudit.test.ts` | Same `"reports"` overlap |
| `src/lib/fiOs/reports/fiOsReportsConsolidation.test.ts` | Same `"reports"` overlap |

**Carry:** DEF-TC-01 remains **Open** — engineering hygiene; does not block reception bake or secret inventory, but blocks claiming full `ci.yml` typecheck GREEN.

---

## Phase 1 — Unit landing (reception path)

**Command:** `fiOsRoleLandingCore.test.ts` via tsx `--test`  
**Date:** 2026-07-14  
**Result:** **PASS** — 31/31

Reception / nurse / operations_admin resolve to `/front-desk` in pure core — live bake still required for operator session truth (Roslyn reclassified; Jesika prior GREEN expected).

---

## Reception carry-forward

| ID | Status | Note |
| -- | ------ | ---- |
| BAKE-1-LIVE-02 | **Open for this milestone** | Roslyn receptionist live session not achieved in bake-1 (impersonation landed platform admin) |
| E2E optional reception spot-check | **Open** | Explicitly deferred from E2E-AND-PIPELINE recommended next |

**Expected:** bare-tenant home → `/front-desk` for `crm_operator` + reception staff_role / workspace_profile.

---

## Prior proof (not re-run this phase)

| Artifact | Result | Ref |
| -------- | ------ | --- |
| Production trust E2E trio | 6 PASS / 0 FAIL / 2 SKIP | FI-TRUST-E2E-AND-PIPELINE-1 |
| Pipeline allowlist Evolved | PASS production + preview | DEF-PIPE-01 Closed |
| Nurse live bake | PASS | DEF-NURSE-01 Closed |
| HEAD at milestone start | `922fbe27` on `main` (synced) | Nurse close-out |

---

## Deferred / out of scope (unchanged)

| Item | Rationale |
| ---- | --------- |
| Procedure Day enablement | Explicit non-goal until separate product decision |
| Payments inbox enablement | Flag stays off |
| Full `@authenticated` suite expand | Prefer narrow trust trio gate first |

---

## Release verdict (current)

| Rubric | Assessment |
| ------ | ---------- |
| **Phase 1** | Gaps identified — **AMBER until ops secret/host confirmation** |
| Blockers for GREEN | CI-HOST-01 or staging URL; secret store confirm (CI-SEC-01); reception R1 live; optional spine fixtures |

---

## Recommended next action

1. **User / platform ops:** Confirm GitHub secrets + `FI_E2E_STAGING_URL` (see plan §9 suggested first action).
2. Harden `authenticated-smoke` host path and add explicit trust-spec step.
3. Reception live bake for `/front-desk`.
4. Optionally close DEF-TC-01 in the same milestone if capacity allows.

---

## Related docs

- [fi-trust-ci-and-reception-1-plan.md](./fi-trust-ci-and-reception-1-plan.md)
- [fi-trust-e2e-and-pipeline-1.md](./fi-trust-e2e-and-pipeline-1.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md)
- [e2e/README.md](../../e2e/README.md)
