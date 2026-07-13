# FI-TRUST-CI-AND-RECEPTION-1

**Status:** **Phase 1+ ops APPLY DONE** — Decision B recorded; `FI_E2E_STAGING_URL` + P0/spine secrets **SET** in Actions; workflow spine wired; reception R1 still open  
**Date:** 2026-07-14  
**Depends on:** FI-TRUST-E2E-AND-PIPELINE-1 (GREEN — E2E, Pipeline allowlist, DEF-NURSE-01)  
**Plan:** [fi-trust-ci-and-reception-1-plan.md](./fi-trust-ci-and-reception-1-plan.md)  
**Inventory at:** `d9fdc346` (secrets MISSING) · Harden `0e012575` · GH apply confirmed 2026-07-14 (names only)

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
| Authenticated journeys | `e2e-smoke.yml` `authenticated-smoke` | `vars.FI_E2E_STAGING_URL` **or** localhost fallback | Job `if:` gates on **`vars.FI_E2E_STAGING_URL != ''`** (cannot use `secrets` in job `if` — parse error) | Runs `--grep @authenticated`; Playwright skips when demo creds empty |
| Lint / typecheck / unit | `ci.yml` | N/A | N/A | `typecheck` currently fails (DEF-TC-01) |

### Authenticated job host gap (CI-HOST-01)

| Item | Behavior |
| ---- | -------- |
| Host source | `FI_E2E_BASE_URL: ${{ vars.FI_E2E_STAGING_URL \|\| 'http://127.0.0.1:3000' }}` |
| Build / start | **None** on `authenticated-smoke` (public job builds + starts; authenticated does not) |
| Effect after Decision B | `FI_E2E_STAGING_URL` **SET** → `https://follicleintelligence.ai`. Authenticated job hits production HTTPS (no localhost fallback when var present). |
| Playwright | Config does **not** start a server; tests require a reachable `FI_E2E_BASE_URL` |
| Spine fixtures | Workflow wires `secrets.FI_E2E_LEAD_ID` / `secrets.FI_E2E_PATIENT_ID`; both secrets **SET** in Actions (CI-SPINE-01 closed) |

### Gap matrix (code / config)

| ID | Class | Finding | Evidence |
| -- | ----- | ------- | -------- |
| CI-HOST-01 | **CLOSED (ops)** | Decision **B** applied: `FI_E2E_STAGING_URL` = production HTTPS. | `gh variable list` 2026-07-14 |
| CI-TRUST-01 | **P1 (deferred)** | No **dedicated** trust-file step — full `@authenticated` suite runs. Accept for first gate; narrow later. | `npx playwright test --grep @authenticated` |
| CI-SPINE-01 | **CLOSED** | Workflow env + Actions secrets for `FI_E2E_LEAD_ID` / `FI_E2E_PATIENT_ID` both present. | `e2e-smoke.yml` + `gh secret list` |
| CI-FIX-01 | **P2** | Optional `FI_E2E_UNLINKED_LEAD_ID` and `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` unset → permanent skips (documented acceptable unless ops chooses to enable). | E2E close-out 2 SKIP |
| CI-SEC-01 | **CLOSED (ops)** | P0 secrets **SET**. Job gate uses staging **var** (secrets illegal in job `if` — fixed after 422 parse failures). | `gh secret list` + workflow `if: vars.FI_E2E_STAGING_URL` |

**Playwright note:** `hasDemoCredentials()` gates `*-authenticated` projects. Trust specs are in `testMatch` for those projects and tagged `@authenticated` — code + host var + P0/spine secrets are ready; remaining barriers are first CI run proof + reception R1.

---

## Decision B — `FI_E2E_STAGING_URL` (recorded 2026-07-14)

| Field | Value |
| ----- | ----- |
| **Choice** | **B — Production** |
| **Variable** | `FI_E2E_STAGING_URL` |
| **Value** | `https://follicleintelligence.ai` |
| **Rationale** | Matches prior manual trust bake; no dedicated staging host available this milestone |
| **Blast radius** | Authenticated CI (when secrets exist) hits **production**. Prefer workflow_dispatch / careful PR usage until a staging host exists. |

**Apply command (repo variable — not a secret):**

```bash
gh variable set FI_E2E_STAGING_URL --body "https://follicleintelligence.ai" --repo Hairaudit-v2/G-follicleintelligence
```

---

## Phase 1 — CI secrets / vars matrix (C1) — updated

**Method:** Post-apply `gh variable list` / `gh secret list` (names only) after piping from local `.env.local`.  
**Repo:** `Hairaudit-v2/G-follicleintelligence` · **Date:** 2026-07-14  
**Agent apply:** **DONE** — variable + 5 secrets set in this session.

| Name | Kind (workflow expects) | GitHub Actions | Local `.env.local` | Notes |
| ---- | ----------------------- | -------------- | ------------------ | ----- |
| `FI_E2E_DEMO_ADMIN_EMAIL` | **secret** | **SET** | **PRESENT** | P0 |
| `FI_E2E_DEMO_ADMIN_PASSWORD` | **secret** | **SET** | **PRESENT** | P0 |
| `FI_E2E_TENANT_ID` | **secret** | **SET** | **PRESENT** | P0 / Evolved |
| `FI_E2E_OTHER_TENANT_ID` | secret (optional) | **MISSING** | **MISSING** | leave unset |
| `FI_E2E_STAGING_URL` | **repository variable** | **SET** = `https://follicleintelligence.ai` | N/A | Decision B |
| `FI_E2E_BASE_URL` | derived in CI from staging var | N/A (workflow) | **PRESENT** (local bake) | from var in CI |
| `FI_E2E_LEAD_ID` | **secret** (spine) | **SET** | **PRESENT** | wired in workflow |
| `FI_E2E_PATIENT_ID` | **secret** (spine) | **SET** | **PRESENT** | wired in workflow |
| `FI_E2E_UNLINKED_LEAD_ID` | optional | **MISSING** | **MISSING** | defer (CI-FIX-01) |
| `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` | optional | **MISSING** | **MISSING** | defer (CI-FIX-01) |

**Vercel notes:** Unchanged — `FI_E2E_*` belong in GitHub Actions, not Vercel app runtime.

**Implication:** `authenticated-smoke` credential gate can open. First GREEN claim still needs a successful workflow run against production.

---

## Ops apply (completed 2026-07-14)

Applied via `gh variable set` / `gh secret set` piping from `.env.local` (values never logged). Commands retained in git history of this audit for rotate/re-apply.

**Still MISSING (optional / defer):** `FI_E2E_OTHER_TENANT_ID`, `FI_E2E_UNLINKED_LEAD_ID`, `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX`.

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

**Carry:** DEF-TC-01 remains **Open** — engineering hygiene; does not block reception bake or secret apply, but blocks claiming full `ci.yml` typecheck GREEN.

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

**Next after CI gate unblocked:** Run reception live bake (R1) with real `crm_operator` session — prefer Jesika / known-good reception operator; avoid platform-admin impersonation path that failed BAKE-1-LIVE-02.

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
| Full `@authenticated` suite expand | Prefer narrow trust trio gate first (CI-TRUST-01 still optional) |

---

## Release verdict (current)

| Rubric | Assessment |
| ------ | ---------- |
| **Phase 1 inventory** | **DONE** |
| **Decision B** | **APPLIED** — production URL variable SET |
| **Workflow harden** | **DONE** — spine IDs wired; staging var consumed |
| **GH Actions apply** | **DONE** — P0 + spine secrets SET |
| **Overall** | **AMBER → CI path unblocked** — claim durable gate GREEN only after first successful `authenticated-smoke` run; reception R1 still open |
| Blockers for GREEN | Successful authenticated CI run on production; reception R1 live |

---

## Verify after ops apply

```bash
# Names only
gh variable list
gh secret list

# Manual CI check (after push of workflow + secrets)
gh workflow run e2e-smoke.yml --ref main
gh run list --workflow=e2e-smoke.yml --limit 5
```

Or open next PR / push to `main` and confirm `Authenticated journeys (staging credentials)` is **not** skipped and uses `https://follicleintelligence.ai`.

---

## Related docs

- [fi-trust-ci-and-reception-1-plan.md](./fi-trust-ci-and-reception-1-plan.md)
- [fi-trust-e2e-and-pipeline-1.md](./fi-trust-e2e-and-pipeline-1.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md)
- [e2e/README.md](../../e2e/README.md)
- [.github/workflows/e2e-smoke.yml](../../.github/workflows/e2e-smoke.yml)
