# FI-TRUST-CI-AND-RECEPTION-1

**Status:** **Reception R1 PASS** (live Jesika bake). CI still AMBER — pnpm align landed on `main` (`d6d4e474`); trust E2E re-dispatch not yet claimed GREEN in this close-out.  
**Date:** 2026-07-14  
**Depends on:** FI-TRUST-E2E-AND-PIPELINE-1 (GREEN — E2E, Pipeline allowlist, DEF-NURSE-01)  
**Plan:** [fi-trust-ci-and-reception-1-plan.md](./fi-trust-ci-and-reception-1-plan.md)  
**Inventory at:** `d9fdc346` (secrets MISSING) · Harden `0e012575` · Wire-up `8edf938b` · CI dry-run [29273920709](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29273920709) · Landing fix `b296e13e` · Reception live bake (this doc)

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
| CI-PNPM-01 | **P0 open** | `e2e-smoke.yml` pins `pnpm/action-setup` **version: 9** while `package.json` `packageManager` is **pnpm@10.30.3** → Setup pnpm fails on both jobs. | Run [29273920709](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29273920709) annotations |

**Playwright note:** `hasDemoCredentials()` gates `*-authenticated` projects. Trust specs are in `testMatch` for those projects and tagged `@authenticated` — code + host var + P0/spine secrets are ready; remaining barrier is CI-PNPM-01 then a GREEN trust run + reception R1.

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

## CI dry-run (workflow_dispatch · 2026-07-14)

| Field | Value |
| ----- | ----- |
| **Run** | [29273920709](https://github.com/Hairaudit-v2/G-follicleintelligence/actions/runs/29273920709) |
| **Commit** | `8edf938b` (FI_E2E wire-up / staging-var gate) |
| **Trigger** | `workflow_dispatch` on `main` |
| **Overall** | **failure** (completed ~17s — never reached Playwright) |

### Job outcomes

| Job | Status | Notes |
| --- | ------ | ----- |
| Authenticated journeys (staging credentials) | **RAN → failure** | **Not skipped** — `vars.FI_E2E_STAGING_URL` gate **worked**. Failed at **Setup pnpm**; “Authenticated e2e against staging” **skipped**. |
| Public + security smoke | **failure** | Same Setup pnpm failure; public Playwright never ran. |

### Trust E2E steps

| Check | Result |
| ----- | ------ |
| Trust / `@authenticated` Playwright | **Not executed** (upstream Setup pnpm failed) |
| Pass/fail of trust trio | **N/A** — no Playwright result this run |

### Root cause (CI-PNPM-01)

Annotation on both jobs:

> Multiple versions of pnpm specified: `version: 9` in `e2e-smoke.yml` (`pnpm/action-setup@v4`) vs `packageManager: pnpm@10.30.3+…` in `package.json`.

| ID | Class | Finding | Fix |
| -- | ----- | ------- | --- |
| CI-PNPM-01 | **P0 blocker** | Workflow pins pnpm **9**; repo declares pnpm **10.30.3** → Setup pnpm aborts. | Align `pnpm/action-setup` with `packageManager` (prefer omit `version:` or set `10` / `10.30.3` to match package.json). Re-run `e2e-smoke.yml`. |

**Gate proof (positive):** Decision B + secrets apply successfully opened `authenticated-smoke` (job executed; not skipped).

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

Reception / nurse / operations_admin resolve to `/front-desk` in pure core — **live bake completed** (Jesika R1 PASS below).

---

## Reception live bake (R1) — production Jesika · 2026-07-14

**Method:** cursor-ide-browser MCP on `https://follicleintelligence.ai`  
**Tenant:** Evolved `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Session:** Platform admin **impersonating** `jesika.watt11` (banner + Exit impersonation)  
**Landing fix under test:** `b296e13e` (bare tenant home → role landing)

### Identity

| Signal | Evidence |
| ------ | -------- |
| Handle | Impersonation banner: **jesika.watt11** |
| Email | Profile chip: **jesika.watt11@hotma…** |
| Workspace | **RECEPTION WORKSPACE** (not auditor / consultant / platform chrome as primary label) |
| Role truth | Frontline reception day board + CRM Pipeline access — matches prior `crm_operator` / reception bake |

### Check matrix

| ID | Check | Result | Evidence |
| -- | ----- | ------ | -------- |
| **R1** | Bare tenant home → `/front-desk` (not Cases) | **PASS** | Navigate `/fi-admin/c2615b95-…` → settles on `…/front-desk` with Front desk rail current, board title Today / Perth. Soft-nav briefly flashes Home/Today shell before redirect (~2–3s) — destination correct; does **not** land Cases. |
| R2 | Front desk board usable; desk CTAs discoverable | **PASS** | Take payment, Find patient, New booking, Open calendar; Arriving soon + Needs attention / blockers populated (SMOKETEST-TMRW). Front desk on primary rail. |
| CRM | `/crm` accessible; hold without `/cases` eject | **PASS** | Pipeline Enquiries board (VISIBLE 300 / ACTIVE 265); stayed on `/crm`. |
| Leadflow | `/leadflow` → `/crm` | **PASS** | Settled on Pipeline `/crm` after brief alias load. |
| Rail | Calendar + Patients sanity | **PASS** | Calendar week view loads (13–17 Jul); Patients journey board loads (819 active). |
| More | Pipeline discoverable | **PASS** | More drawer: Front desk, Pipeline, Patients, Clinical, Surgery, Team, Finance, Reports, Settings. |

### Defects

| ID | Class | Finding | Action |
| -- | ----- | ------- | ------ |
| REC-R1-FLASH | **P3** | Soft-nav to bare tenant home briefly shows Today/Home shell before server redirect completes. | Accept / polish later — final URL PASS. |
| REC-IMPERSONATION-CHROME | **P3** (known) | Under platform-admin impersonation: Profile → System administration; Patients Operators · System diagnostics shows `Session: fi_platform_admin`. Documented same class in FI-ROLE-JOURNEY-BAKE-1 — wrapper chrome, not raw reception login. | No product fix this bake; not a real-staff P0. |
| Calendar count vs desk | **P3** | Calendar “Today · 0 appointments” while Front desk Arriving soon = 2 (SMOKETEST) — likely TZ / day-window presentation; board itself truthful. | Defer — not R1 blocker. |

**No P0 / P1 / small P2 proven requiring code fix this bake.**

### Carry IDs closed / remaining

| ID | Status | Note |
| -- | ------ | ---- |
| BAKE-1-LIVE-02 | **CLOSED (Jesika path)** | Live reception session achieved via Jesika impersonation → workspace_profile reception + `/front-desk`. Roslyn raw-login still optional. |
| E2E optional reception spot-check | **CLOSED (manual live)** | Manual R1 PASS substitutes for optional Playwright reception spot-check this milestone. Automated CI reception case still optional. |

**Verdict (reception):** **GREEN** — R1 PASS; desk + CRM + leadflow + rail usable.

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
| **CI dry-run** | **FAIL** (prior) — run `29273920709`; CI-PNPM-01. Fix commits `4a77d4b8` / `d6d4e474` on `main` — re-dispatch still needed for trust GREEN claim |
| **Reception R1** | **PASS** — Jesika / reception → `/front-desk` on production |
| **Overall** | **AMBER** — reception LIVE GREEN; CI trust gate not yet re-proven GREEN after pnpm fix |
| Blockers for full GREEN | Successful authenticated CI run on production post–CI-PNPM-01 |
| **Next action** | Re-dispatch `e2e-smoke.yml` / confirm authenticated trust jobs GREEN; optional Roslyn raw-login spot-check |

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
