# FI-TRUST-CI-AND-RECEPTION-1 — Audit plan

**Milestone:** `FI-TRUST-CI-AND-RECEPTION-1`  
**Validates:** Durable CI trust gates + deferred reception landing spot-check (carry-forward from `FI-TRUST-E2E-AND-PIPELINE-1` recommended next action)  
**Date:** 2026-07-14  
**Mode:** Audit-first (Phase 1), then evidence-backed CI/ops fixes + live bake (Phase 2)  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)

---

## 1. Scope

### In scope

| Area | Surfaces / artifacts | Trust question |
| ---- | -------------------- | -------------- |
| CI authenticated trust bundle | `.github/workflows/e2e-smoke.yml`, Playwright projects | Trust E2E (role landing, pipeline layout, golden spine) runs as a durable gate when secrets exist — not only ad-hoc local/production bakes |
| GitHub secrets / vars inventory | `FI_E2E_DEMO_ADMIN_*`, `FI_E2E_TENANT_ID`, spine fixture IDs, staging URL | Secret store has rotated credentials + enough fixtures for executable (non-skip) trust cases |
| Optional E2E fixture completeness | `FI_E2E_UNLINKED_LEAD_ID`, `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX`, `FI_E2E_LEAD_ID` / `PATIENT_ID` in CI | Negative spine + role-home path suffix no longer permanently skipped in CI when appropriate |
| Reception landing live bake | `crm_operator` / reception → `/front-desk` | Frontline reception lands on day board, not Cases (BAKE-1-LIVE-02 / E2E optional follow-up) |
| Typecheck hygiene (DEF-TC-01) | `npm run typecheck` nav/DOM test errors | CI typecheck green or remaining errors classified with owners |
| Staff mapping gate | `npm run audit:staff-mapping` | Remains 10/10 for active pilot operators |

### Out of scope

- Procedure Day product enablement (`FI_PROCEDURE_DAY_ENABLED` stays off)
- Payments inbox enablement (`FI_PAYMENTS_ENABLED` stays off unless ops approves)
- New OS modules / role redesign
- Pipeline V1 global cutover for all tenants (Evolved allowlist already signed off)
- Owner intelligence / patient portal / AI expansion
- Broad UX redesign
- Force-running authenticated E2E against production from every PR (staging or dedicated demo URL preferred)

---

## 2. Roles to validate

| Priority | Role | Operator (Evolved) | Why |
| -------- | ---- | ------------------ | --- |
| **P0** | Platform ops | Credential / secret-store holder | Confirm GH secrets + staging URL; rotate if needed |
| **P0** | Reception | `roslynhrichards@outlook.com` / Jesika `j***@hotmail.com` | Live post-login `/front-desk` (deferred spot-check) |
| **P1** | Consultant | `manager@evolvedhair.com.au` | Already GREEN via trust E2E; CI fixture identity must match |
| **P2** | Nurse | `evieshackleton1@gmail.com` | Regression only if CI role-home assert expands beyond consultant |
| **Defer** | Finance | `harsh@evolvedhair.com.au` | Signed off in FI-TRUST-MONEY-AND-READINESS-1 |

---

## 3. Environment flags / secrets

| Flag / secret | Expected (pilot) | Bake / CI impact |
| ------------- | ---------------- | ---------------- |
| `FI_E2E_DEMO_ADMIN_EMAIL` / `PASSWORD` | Present in GH Actions secrets (rotated) | Authenticated projects materialize; DEF-E2E-01 stay closed |
| `FI_E2E_TENANT_ID` | Evolved UUID in GH secrets | Tenant-scoped journeys |
| `FI_E2E_STAGING_URL` (repo var) | HTTPS staging (or demo) host — **not** bare localhost without a server job | Authenticated job must have a reachable host |
| `FI_E2E_LEAD_ID` / `FI_E2E_PATIENT_ID` | SMOKETEST golden pair in CI secrets/vars | Spine tests executable (not skip) |
| `FI_E2E_UNLINKED_LEAD_ID` | Optional unlinked lead | Negative linkage case |
| `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX` | Consultant: `/crm`; reception bake uses live session | Optional role-home assert |
| `FI_PIPELINE_V1_TENANT_ALLOWLIST` | Evolved UUID present (already signed) | No regression |
| `FI_PAYMENTS_ENABLED` / `FI_PROCEDURE_DAY_ENABLED` | `false` | No change |

**Compare local vs production:**

```bash
npm run compare:bake-env
```

---

## 4. Check matrix

| ID | Check | Route / artifact | Evidence |
| -- | ----- | ---------------- | -------- |
| C1 | GH secrets/vars inventory | GitHub Actions secret names (no values logged) | Ops checklist PASS / gap list |
| C2 | Authenticated job host | `e2e-smoke.yml` `authenticated-smoke` | Staging URL set **or** job builds+starts production host before Playwright |
| C3 | Trust bundle in CI | Explicit file list or grep limited to `e2e/fi-trust-*.spec.ts` | Workflow run green with credentials |
| C4 | Spine fixtures wired in CI | `FI_E2E_LEAD_ID` + `PATIENT_ID` | Spine cases not skipped in CI log |
| C5 | Optional fixtures policy | Unlinked lead + landing suffix | Documented decide: set or defer with rationale |
| R1 | Reception post-login landing | Live `crm_operator` session | Lands `/front-desk`, not `/cases` |
| R2 | Reception nav truth | Rail / More | Front desk reachable without hunting |
| T1 | Typecheck hygiene | `npm run typecheck` | 0 errors **or** DEF-TC-01 closed with remaining deferred items filed |
| S1 | Staff mapping gate | `audit:staff-mapping` | 10/10 PASS |

---

## 5. Evidence collection

### Automated (Phase 1 — safe)

**Workflow + config audit:**

```bash
rg -n "authenticated-smoke|FI_E2E_|fi-trust" .github/workflows playwright.config.ts e2e/README.md
```

**Typecheck baseline (DEF-TC-01):**

```bash
npm run typecheck
```

**Role landing unit (reception → `/front-desk`):**

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs --test \
  src/lib/fiOs/fiOsRoleLandingCore.test.ts
```

**Staff mapping:**

```bash
npm run audit:staff-mapping
```

**Trust E2E (local proof; credentials required — do not commit secrets):**

```bash
FI_E2E_BASE_URL=https://follicleintelligence.ai \
FI_E2E_BROWSERS=chromium \
npm run test:e2e -- \
  --project=chromium-authenticated \
  e2e/fi-trust-role-landing.spec.ts \
  e2e/fi-trust-pipeline-layout.spec.ts \
  e2e/fi-trust-golden-patient-spine.spec.ts
```

### Live browser (Phase 2)

1. **Reception** — platform-admin impersonation or real reception login; bare-tenant entry → `/front-desk`.
2. **Confirm Roslyn / Jesika** — workspace_profile `reception`, expected landing suffix `/front-desk`.
3. **Optional** — set `FI_E2E_EXPECTED_LANDING_PATH_SUFFIX=/crm` for consultant CI identity if demo admin remains consultant.

---

## 6. Gaps to close (from prior milestones)

| ID | Source | Finding |
| -- | ------ | ------- |
| CI-TRUST-01 | FI-TRUST-E2E-AND-PIPELINE-1 § Recommended next | Wire `chromium-authenticated` trust bundle in CI once secrets are in the secret store |
| CI-HOST-01 | Phase 1 audit (this plan) | `authenticated-smoke` falls back to `127.0.0.1:3000` **without** build/start — likely fails unless `FI_E2E_STAGING_URL` is set |
| CI-SPINE-01 | E2E close-out skips | CI job does not pass `FI_E2E_LEAD_ID` / `PATIENT_ID` — golden spine skipped even when credentials work |
| BAKE-1-LIVE-02 | FI-ROLE-JOURNEY-BAKE-1 | Roslyn receptionist live session not achieved — reception landing expected post-reclassify |
| DEF-TC-01 | FI-ROLE-JOURNEY-BAKE-1 | Pre-existing `typecheck` failures in nav/DOM test files (still open) |

---

## 7. Acceptance criteria

| # | Criterion | Phase |
| - | --------- | ----- |
| 1 | Secrets inventory documented (names only); demo admin credentials present or ops ticket filed | Audit |
| 2 | Authenticated CI job has a reachable host (staging URL **or** build+start) | Fix |
| 3 | Trust E2E trio runs in CI (PASS or documented skip policy) when secrets present | Fix + CI log |
| 4 | Spine fixtures in CI **or** explicit defer of C4 with owner | Audit / fix |
| 5 | Reception live landing `/front-desk` PASS | Live |
| 6 | Typecheck GREEN **or** DEF-TC-01 closed with residual backlog IDs | Fix / defer |
| 7 | Staff mapping 10/10 | Gate |
| 8 | No new modules; no production secret values in docs/commits | Review |

---

## 8. Release decision rubric

| Verdict | Conditions |
| ------- | ---------- |
| **GREEN** | C2–C3 PASS; R1 PASS; S1 PASS; C4 PASS or deferred with ops sign-off; T1 PASS or DEF-TC-01 formally deferred |
| **AMBER** | CI trust wired but secrets missing (job skipped) **and** reception live PASS; or reception live blocked but CI trust green |
| **RED** | Authenticated job claims green while host unreachable / credentials broken; reception still lands on `/cases`; staff mapping regression |

---

## 9. Recommended bake sequence

1. **Phase 1 audit** — workflow gaps, typecheck baseline, unit landing, staff mapping (this doc + findings).
2. **Ops: secret store** — confirm/add `FI_E2E_*` secrets + `FI_E2E_STAGING_URL` (or decide build+start path).
3. **CI harden** — narrow trust bundle step; wire fixtures; fix localhost host gap.
4. **Reception live bake** — Roslyn or Jesika → `/front-desk`.
5. **Typecheck hygiene** — fix DEF-TC-01 test typing errors if in-scope for GREEN.
6. **Close-out** — update findings + release verdict.

### Suggested first action for user

**Confirm GitHub Actions secrets/vars** for the Follicle Intelligence repo (names only in chat):

1. Are `FI_E2E_DEMO_ADMIN_EMAIL`, `FI_E2E_DEMO_ADMIN_PASSWORD`, `FI_E2E_TENANT_ID` set?
2. Is `FI_E2E_STAGING_URL` (repository variable) set to a reachable HTTPS host?
3. Approve adding `FI_E2E_LEAD_ID` + `FI_E2E_PATIENT_ID` (SMOKETEST UUIDs already used in local/prod trust bake) as secrets/vars for CI spine coverage?

Until (1)+(2) are confirmed, Phase 2 CI changes stay audit-documented only.

---

## 10. Phase 1 audit commands log

| Command | Date | Result |
| ------- | ---- | ------ |
| Workflow / Playwright config audit | 2026-07-14 | **Gaps recorded** — see findings § CI |
| `npm run typecheck` | 2026-07-14 | **FAIL** — 6 errors (DEF-TC-01 still open) |
| `fiOsRoleLandingCore.test.ts` | 2026-07-14 | **PASS** — 31/31 |
| Prior trust E2E on production | 2026-07-13 | **PASS** — 6/0/2 (documented in E2E milestone) |

---

## 11. Related docs

- [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md) — findings log
- [fi-trust-e2e-and-pipeline-1.md](./fi-trust-e2e-and-pipeline-1.md) — prior GREEN; recommended next → this milestone
- [fi-trust-e2e-and-pipeline-1-plan.md](./fi-trust-e2e-and-pipeline-1-plan.md)
- [fi-role-journey-bake-1.md](./fi-role-journey-bake-1.md) — BAKE-1-LIVE-02, DEF-TC-01
- [e2e/README.md](../../e2e/README.md) — authenticated fixture wiring
- [.github/workflows/e2e-smoke.yml](../../.github/workflows/e2e-smoke.yml)
