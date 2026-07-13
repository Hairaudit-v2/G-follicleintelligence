# FI-TRUST-CI-AND-RECEPTION-1

**Status:** **Phase 1 — secrets inventory COMPLETE** — all expected `FI_E2E_*` GitHub secrets/vars **MISSING**; host gap confirmed; reception live bake + CI harden still open  
**Date:** 2026-07-14  
**Depends on:** FI-TRUST-E2E-AND-PIPELINE-1 (GREEN — E2E, Pipeline allowlist, DEF-NURSE-01)  
**Plan:** [fi-trust-ci-and-reception-1-plan.md](./fi-trust-ci-and-reception-1-plan.md)  
**Inventory at:** `8a062361` (main) · GitHub Actions API list 2026-07-14

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

### Authenticated job host gap (CI-HOST-01)

| Item | Behavior |
| ---- | -------- |
| Host source | `FI_E2E_BASE_URL: ${{ vars.FI_E2E_STAGING_URL \|\| 'http://127.0.0.1:3000' }}` |
| Build / start | **None** on `authenticated-smoke` (public job builds + starts; authenticated does not) |
| Effect today | `FI_E2E_STAGING_URL` **MISSING** → would hit bare localhost **and** job is skipped anyway because credential secrets are empty |
| Playwright | Config does **not** start a server; tests require a reachable `FI_E2E_BASE_URL` |
| Spine fixtures | Workflow does **not** pass `FI_E2E_LEAD_ID` / `FI_E2E_PATIENT_ID` (CI-SPINE-01) |

### Gap matrix (code / config)

| ID | Class | Finding | Evidence |
| -- | ----- | ------- | -------- |
| CI-HOST-01 | **P1** | Authenticated job has **no** build/start step. If `FI_E2E_STAGING_URL` is unset, Playwright targets localhost with nothing listening. | `.github/workflows/e2e-smoke.yml` lines 58–99 vs public job which builds+starts |
| CI-TRUST-01 | **P1** | No **dedicated** trust-file step — full `@authenticated` suite runs (broader than E2E milestone acceptance trio). Flake / runtime risk; trust signal diluted. | `npx playwright test --grep @authenticated` |
| CI-SPINE-01 | **P2** | CI env does not set `FI_E2E_LEAD_ID` / `FI_E2E_PATIENT_ID` — golden-patient spine remains skip in CI even when login works. | Workflow env block; prior production bake needed local `.env.local` fixtures |
| CI-FIX-01 | **P2** | Optional `FI_E2E_UNLINKED_LEAD_ID` and `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` unset → permanent skips (documented acceptable unless ops chooses to enable). | E2E close-out 2 SKIP |
| CI-SEC-01 | **P0 (ops)** | **CLOSED (inventory)** — GitHub Actions repo secrets + vars lists are empty (`total_count=0`). All expected `FI_E2E_*` names **MISSING**. Authenticated job cannot run until secrets are set. | Actions API 2026-07-14 (names only) |

**Playwright note:** `hasDemoCredentials()` gates `*-authenticated` projects. Trust specs are in `testMatch` for those projects and tagged `@authenticated` — wiring is code-ready; CI host + secrets + fixture env are the remaining barriers.

---

## Phase 1 — CI secrets / vars matrix (C1)

**Method:** Authenticated GitHub Actions API (`GET …/actions/secrets`, `…/variables`, per-environment secrets/vars). Values never logged.  
**Repo:** `Hairaudit-v2/G-follicleintelligence` · **Date:** 2026-07-14

| Name | Kind (workflow expects) | GitHub Actions | Vercel prod snapshot | Vercel preview snapshot | Local `.env.local` |
| ---- | ----------------------- | -------------- | -------------------- | ----------------------- | ------------------ |
| `FI_E2E_DEMO_ADMIN_EMAIL` | **secret** | **MISSING** | **MISSING** | **MISSING** | **PRESENT** |
| `FI_E2E_DEMO_ADMIN_PASSWORD` | **secret** | **MISSING** | **MISSING** | **MISSING** | **PRESENT** |
| `FI_E2E_TENANT_ID` | **secret** | **MISSING** | **MISSING** | **MISSING** | **PRESENT** |
| `FI_E2E_OTHER_TENANT_ID` | secret (optional) | **MISSING** | **MISSING** | **MISSING** | **MISSING** |
| `FI_E2E_STAGING_URL` | **repository variable** → `FI_E2E_BASE_URL` | **MISSING** | **MISSING** (N/A for app runtime) | **MISSING** | **MISSING** (local uses `FI_E2E_BASE_URL`) |
| `FI_E2E_BASE_URL` | derived in CI from staging var | N/A (set in workflow) | **MISSING** | **MISSING** | **PRESENT** |
| `FI_E2E_LEAD_ID` | secret/var (spine; not wired in workflow yet) | **MISSING** | **MISSING** | **MISSING** | **PRESENT** |
| `FI_E2E_PATIENT_ID` | secret/var (spine; not wired in workflow yet) | **MISSING** | **MISSING** | **MISSING** | **PRESENT** |
| `FI_E2E_UNLINKED_LEAD_ID` | optional | **MISSING** | **MISSING** | **MISSING** | **MISSING** |
| `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` | optional | **MISSING** | **MISSING** | **MISSING** | **MISSING** |

**Store-level totals (names only):**

| Store | Secrets | Variables |
| ----- | ------- | --------- |
| Repository Actions | `total_count=0` | `total_count=0` |
| Environments (Preview / Production × project labels, 6 total) | all `0` | all `0` |

**Vercel notes:** On-disk snapshots (`.env.vercel.check-prod-live`, `.env.vercel.check-preview-live`, `.env.vercel.production`) contain **no** `FI_E2E_*` keys. That is expected for **app** runtime — authenticated Playwright credentials belong in **GitHub Actions**, with `FI_E2E_STAGING_URL` pointing at a deployed HTTPS host (staging preferred; production used only with ops approval). Live `vercel env ls` was blocked this session (TLS cert error); inventory used existing compare snapshots. `FI_BASE_URL` / `NEXT_PUBLIC_SITE_URL` appear as empty keys in those snapshots (not used as the GH `FI_E2E_STAGING_URL` source).

**Implication:** With credential secrets empty, `authenticated-smoke` `if:` gate keeps the job from starting — there is **no** durable authenticated trust gate in CI today.

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
| **Phase 1 inventory** | **DONE** — secret store empty; host gap confirmed |
| **Overall** | **AMBER** — cannot claim CI trust gate until secrets + host remediated; reception R1 still open |
| Blockers for GREEN | Set P0 secrets + `FI_E2E_STAGING_URL` (or build+start); CI-HOST-01 / CI-TRUST-01 harden; reception R1 live; C4 spine fixtures (or defer) |

---

## Recommended remediation (ops + eng)

### P0 — GitHub Actions (required for job to run)

Set as **repository secrets** (Settings → Secrets and variables → Actions):

1. `FI_E2E_DEMO_ADMIN_EMAIL`
2. `FI_E2E_DEMO_ADMIN_PASSWORD`
3. `FI_E2E_TENANT_ID` — Evolved UUID `c2615b95-b707-4485-aa5f-be8f78ec868a`

Set as **repository variable**:

4. `FI_E2E_STAGING_URL` — HTTPS host Playwright should hit (**decision needed** — see below)

Do **not** put demo admin password into Vercel production/preview env for this gate; CI credentials stay in Actions.

### P1 — Host path (CI-HOST-01)

After `FI_E2E_STAGING_URL` is set, `authenticated-smoke` can run against that host.  
**Alternative** (if no staging URL): add build+start to the authenticated job (mirror public smoke) and keep `FI_E2E_BASE_URL=http://127.0.0.1:3000` — only if local production build can auth against real Supabase with those secrets.

### P2 — Spine + optional fixtures

5. Add secrets/vars `FI_E2E_LEAD_ID` + `FI_E2E_PATIENT_ID` (SMOKETEST UUIDs from local bake) **and** wire them into `authenticated-smoke` `env:` (CI-SPINE-01).
6. Optional: `FI_E2E_UNLINKED_LEAD_ID`, `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX=/crm`.

### P1 — Workflow harden (eng, after secrets)

7. Narrow trust step to `e2e/fi-trust-*.spec.ts` (CI-TRUST-01).
8. Reception live bake `/front-desk`; optionally DEF-TC-01.

### Decision needed (user)

**What value for `FI_E2E_STAGING_URL`?** Options:

| Option | URL pattern | Notes |
| ------ | ----------- | ----- |
| A — Dedicated staging / preview | Stable HTTPS preview or staging hostname | **Preferred** per plan (avoid forcing every-PR auth against production) |
| B — Production | `https://follicleintelligence.ai` | Matches prior manual trust bake; higher blast radius |
| C — Localhost + build/start | Leave var unset; change workflow | No staging host required |

Until that URL is chosen, set P0 secrets (1–3) first; variable (4) waits on the decision.

---

## Related docs

- [fi-trust-ci-and-reception-1-plan.md](./fi-trust-ci-and-reception-1-plan.md)
- [fi-trust-e2e-and-pipeline-1.md](./fi-trust-e2e-and-pipeline-1.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md)
- [e2e/README.md](../../e2e/README.md)
- [.github/workflows/e2e-smoke.yml](../../.github/workflows/e2e-smoke.yml)
