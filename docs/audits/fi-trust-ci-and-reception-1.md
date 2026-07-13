# FI-TRUST-CI-AND-RECEPTION-1

**Status:** **Phase 1+ — decision B recorded; workflow spine wired; GH Actions apply BLOCKED (no `gh` auth)** — local `.env.local` has all P0 + spine values; Commands below ready for ops  
**Date:** 2026-07-14  
**Depends on:** FI-TRUST-E2E-AND-PIPELINE-1 (GREEN — E2E, Pipeline allowlist, DEF-NURSE-01)  
**Plan:** [fi-trust-ci-and-reception-1-plan.md](./fi-trust-ci-and-reception-1-plan.md)  
**Inventory at:** `d9fdc346` (secrets MISSING) · Decision B + workflow harden this commit · GitHub apply pending ops login

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
| Effect after Decision B | Once `FI_E2E_STAGING_URL` is set to production HTTPS, job hits real host (no localhost). **Until GH var is applied, still MISSING → localhost + skip via empty credentials.** |
| Playwright | Config does **not** start a server; tests require a reachable `FI_E2E_BASE_URL` |
| Spine fixtures | Workflow **now wires** `secrets.FI_E2E_LEAD_ID` / `secrets.FI_E2E_PATIENT_ID` into job `env` (CI-SPINE-01 code path closed; secrets still need to be set in Actions) |

### Gap matrix (code / config)

| ID | Class | Finding | Evidence |
| -- | ----- | ------- | -------- |
| CI-HOST-01 | **P1 → ops apply** | Host path is correct in workflow (`vars.FI_E2E_STAGING_URL`). Decision **B** chosen: production URL. Gap remains until repo **variable** is set. | Decision B below; `.github/workflows/e2e-smoke.yml` |
| CI-TRUST-01 | **P1 (deferred)** | No **dedicated** trust-file step — full `@authenticated` suite runs. Accept for first gate; narrow later. | `npx playwright test --grep @authenticated` |
| CI-SPINE-01 | **P2 → code DONE / secrets pending** | Workflow env now passes `FI_E2E_LEAD_ID` / `FI_E2E_PATIENT_ID` from secrets. Spine still skips until those secrets exist in Actions. | `e2e-smoke.yml` `authenticated-smoke` env |
| CI-FIX-01 | **P2** | Optional `FI_E2E_UNLINKED_LEAD_ID` and `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` unset → permanent skips (documented acceptable unless ops chooses to enable). | E2E close-out 2 SKIP |
| CI-SEC-01 | **P0 (ops)** | **OPEN for apply** — agent session has no `gh` login (`GH_TOKEN` / `hosts.yml` missing). Local `.env.local` has P0 + spine values **PRESENT**. Until ops runs commands below, Actions store still empty from last API inventory. | Apply blocked 2026-07-14 |

**Playwright note:** `hasDemoCredentials()` gates `*-authenticated` projects. Trust specs are in `testMatch` for those projects and tagged `@authenticated` — wiring is code-ready; CI host var + secrets apply are the remaining barriers.

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

**Method:** Authenticated GitHub Actions API (inventory at `d9fdc346`) + local presence check (names only) + Decision B.  
**Repo:** `Hairaudit-v2/G-follicleintelligence` · **Date:** 2026-07-14  
**Agent apply:** **BLOCKED** — `gh` not logged in this session; cannot confirm post-apply state without ops login.

| Name | Kind (workflow expects) | GitHub Actions (last known) | Local `.env.local` | Target after ops apply |
| ---- | ----------------------- | --------------------------- | ------------------ | ---------------------- |
| `FI_E2E_DEMO_ADMIN_EMAIL` | **secret** | **MISSING** | **PRESENT** | **SET** from local |
| `FI_E2E_DEMO_ADMIN_PASSWORD` | **secret** | **MISSING** | **PRESENT** | **SET** from local |
| `FI_E2E_TENANT_ID` | **secret** | **MISSING** | **PRESENT** | **SET** from local |
| `FI_E2E_OTHER_TENANT_ID` | secret (optional) | **MISSING** | **MISSING** | leave unset |
| `FI_E2E_STAGING_URL` | **repository variable** → `FI_E2E_BASE_URL` | **MISSING** | N/A (Decision B = production URL) | **SET** `https://follicleintelligence.ai` |
| `FI_E2E_BASE_URL` | derived in CI from staging var | N/A (set in workflow) | **PRESENT** (local bake) | from var after apply |
| `FI_E2E_LEAD_ID` | **secret** (spine; wired in workflow) | **MISSING** | **PRESENT** | **SET** from local |
| `FI_E2E_PATIENT_ID` | **secret** (spine; wired in workflow) | **MISSING** | **PRESENT** | **SET** from local |
| `FI_E2E_UNLINKED_LEAD_ID` | optional | **MISSING** | **MISSING** | defer |
| `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` | optional | **MISSING** | **MISSING** | defer |

**Vercel notes:** Unchanged — `FI_E2E_*` belong in GitHub Actions, not Vercel app runtime.

**Implication:** Until ops applies variable + secrets, `authenticated-smoke` `if:` gate still skips — no durable authenticated trust gate in CI yet.

---

## Ops apply commands (secrets — values never echoed)

Requires: `gh auth login` (or `GH_TOKEN` with `repo` + Actions secrets/vars scopes).  
Run from repo root with `.env.local` present. PowerShell-safe (pipes value; does not print):

```powershell
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = "Hairaudit-v2/G-follicleintelligence"

# 1) Decision B — repository variable
& $gh variable set FI_E2E_STAGING_URL --body "https://follicleintelligence.ai" --repo $repo

# 2) Load keys from .env.local without printing values
function Get-DotEnvValue([string]$key) {
  $line = Get-Content .env.local | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { throw "Missing $key in .env.local" }
  return ($line -replace "^$key=", "").Trim().Trim('"').Trim("'")
}

foreach ($key in @(
  "FI_E2E_DEMO_ADMIN_EMAIL",
  "FI_E2E_DEMO_ADMIN_PASSWORD",
  "FI_E2E_TENANT_ID",
  "FI_E2E_LEAD_ID",
  "FI_E2E_PATIENT_ID"
)) {
  $val = Get-DotEnvValue $key
  $val | & $gh secret set $key --repo $repo
  Write-Output "SET $key (value not shown)"
}

# 3) Verify names only
& $gh variable list --repo $repo
& $gh secret list --repo $repo
```

Bash equivalent:

```bash
gh variable set FI_E2E_STAGING_URL --body "https://follicleintelligence.ai"

set -a
# shellcheck disable=SC1091
source <(grep -E '^(FI_E2E_DEMO_ADMIN_EMAIL|FI_E2E_DEMO_ADMIN_PASSWORD|FI_E2E_TENANT_ID|FI_E2E_LEAD_ID|FI_E2E_PATIENT_ID)=' .env.local | sed 's/\r$//')
set +a

printf '%s' "$FI_E2E_DEMO_ADMIN_EMAIL" | gh secret set FI_E2E_DEMO_ADMIN_EMAIL
printf '%s' "$FI_E2E_DEMO_ADMIN_PASSWORD" | gh secret set FI_E2E_DEMO_ADMIN_PASSWORD
printf '%s' "$FI_E2E_TENANT_ID" | gh secret set FI_E2E_TENANT_ID
printf '%s' "$FI_E2E_LEAD_ID" | gh secret set FI_E2E_LEAD_ID
printf '%s' "$FI_E2E_PATIENT_ID" | gh secret set FI_E2E_PATIENT_ID

gh variable list
gh secret list
```

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
| **Decision B** | **RECORDED** — production URL |
| **Workflow harden** | **DONE** — spine IDs wired; staging var already wired |
| **GH Actions apply** | **BLOCKED** — no `gh` auth in agent session; commands documented |
| **Overall** | **AMBER** — cannot claim CI trust gate until ops sets variable + P0/spine secrets; reception R1 still open |
| Blockers for GREEN | Ops apply commands above; then verify `authenticated-smoke` runs; reception R1 live |

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
