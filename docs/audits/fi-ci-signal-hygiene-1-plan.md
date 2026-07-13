# FI-CI-SIGNAL-HYGIENE-1 — Audit plan

**Milestone:** `FI-CI-SIGNAL-HYGIENE-1`  
**Validates:** Readable CI signal — narrow public/advisory smoke noise, close known hygiene defects, keep trust gate GREEN  
**Date:** 2026-07-14  
**Mode:** Audit-first (Phase 1), then evidence-backed test/CI fixes only (Phase 2)  
**Prior:** `FI-TRUST-CI-AND-RECEPTION-1` **GREEN** (trust trio + reception R1)  
**Decision B:** `FI_E2E_STAGING_URL` = `https://follicleintelligence.ai` (production) — **Keep B**

---

## 1. Scope

### In scope

| Area | Surfaces / artifacts | Trust question |
| ---- | -------------------- | -------------- |
| Public + security smoke (advisory) | `e2e-smoke.yml` `public-smoke-cross-browser` (`continue-on-error: true`) | Failure buckets classified; path to fewer red lines without product redesign |
| Typecheck hygiene (DEF-TC-01) | `npm run typecheck` / `ci.yml` typecheck | 6 test-file errors fixed or formally deferred with owners |
| Team nav quarantine (CI-TRIAGE-TEAM-01) | `e2e/journeys/team-workspace-nav.spec.ts` | Quarantine skip still correct; no silent product P0 |
| Optional E2E fixtures | `FI_E2E_OTHER_TENANT_ID`, `UNLINKED_LEAD_ID`, `EXPECTED_LANDING_PATH_SUFFIX` | MISSING list current; set only if ops chooses executable coverage |
| HR sync drift monitor | Evolved staff mapping / iiohr sync (ops) | Drift still monitoring-only; no product redesign |

### Out of scope

- Product redesign / new OS modules / rail regrouping
- Procedure Day / Payments enablement
- Expanding authenticated CI beyond trust trio (already GREEN)
- Decision A staging host (deferred indefinitely)
- Force-blocking PRs on public smoke until Phase 2 acceptance explicitly flips advisory → gate
- Broad `@authenticated` suite as a required CI gate

### Constraint (hard)

**No product redesign.** Prefer: test expectation updates, quarantine/`test.skip`, public-job project/grep narrowing, auth-fixture guard when credentials absent. Fix **proven P0/P1 only** (security fail-closed regressions with production evidence, or CI crashes that destroy signal).

---

## 2. Defect inventory targets

| ID | Source | Symptom | Phase 1 goal |
| -- | ------ | ------- | ------------ |
| PUB-SMOKE-01 | Public smoke ~126 fails | Advisory job red; bucket classifications needed | Bucket counts + root causes from GH run logs |
| DEF-TC-01 | Prior bake / trust CI | `tsc --noEmit` 6 errors in `*.test.ts` | Reconfirm locally |
| CI-TRIAGE-TEAM-01 | Authenticated triage | `team-sub-nav` missing → skip | Confirm quarantine code present |
| CI-FIX-01 | Optional fixtures | Permanent skips for unlinked lead / landing suffix | Document MISSING list |
| HR-DRIFT-01 | Role bake | iiohr sync can revert `staff_role` / `full_name` | Ops monitor note only |

---

## 3. Check matrix

| ID | Check | Evidence | GREEN | AMBER | RED |
| -- | ----- | -------- | ----- | ----- | --- |
| H1 | Public smoke buckets classified | GH Actions log / artifact from latest **completed** public-smoke job | Counts + root causes filed | Partial (stale run only) | No log / inventing causes |
| H2 | DEF-TC-01 baseline | `npm run typecheck` | 0 errors | Same known 6 in tests only | New product src errors |
| H3 | CI-TRIAGE-TEAM-01 | Spec contains CI-TRIAGE-TEAM-01 skip | Skip present; trust gate unaffected | Skip present; nav still flaky on authenticated manual | Skip removed + failing gate |
| H4 | Optional fixtures inventory | `gh secret list` / `gh variable list` (names) | MISSING documented | Ops undecided | Claiming SET when unset |
| H5 | Trust trio unchanged | Latest `authenticated-smoke` | GREEN (6 pass / 0 fail) | Skipped (no staging var) | Fail on trust trio |
| H6 | HR drift | Ops note / prior bake | Monitor filed | Unobserved recently | Proven mapping break untreated as P0 |

**Phase 1 acceptance:** H1–H4 documented; H5 remains GREEN from prior; H6 recorded. No code fixes required for Phase 1 close.

**Phase 2 acceptance (preview):** Reduce public-smoke logical fails via quarantine/narrowing; DEF-TC-01 GREEN or deferred IDs; advisory job still `continue-on-error` unless explicitly promoted.

---

## 4. Exact commands

### Phase 1 — safe audit

```bash
# Typecheck (DEF-TC-01)
npm run typecheck

# Latest e2e-smoke runs
gh run list --workflow=e2e-smoke.yml --limit 10

# Inspect a completed public-smoke job (prefer last non-cancelled with Playwright summary)
gh run view <RUN_ID> --json conclusion,status,jobs,headSha,url
gh run view <RUN_ID> --log

# Names only — fixtures inventory
gh secret list --repo Hairaudit-v2/G-follicleintelligence
gh variable list --repo Hairaudit-v2/G-follicleintelligence

# Quarantine presence
rg -n "CI-TRIAGE-TEAM-01" e2e/journeys/team-workspace-nav.spec.ts
```

### Phase 2 — fix verification (do not run product redesign)

```bash
# After narrowing public smoke / auth fixture guard:
gh workflow run e2e-smoke.yml --ref main
gh run list --workflow=e2e-smoke.yml --limit 3

# Re-typecheck after DEF-TC-01 fixes:
npm run typecheck
```

---

## 5. Recommended Phase 2 order (audit→fix)

| Priority | Action | Rationale |
| -------- | ------ | --------- |
| **P0** | Guard public job against `@authenticated @smoke` credential crash (fixture skip **or** exclude dual-tagged tests from public projects) | Immediate ~48/126 fail reduction; pure signal hygiene — **DONE** (Bucket B) |
| **P1** | Re-tag or auth-wrap `fi-ux-audit-labels` (protected `/fi-admin/.../front-desk` on placeholder CI) | ~60/126; labels need session — **DONE** (Bucket A / PUB-LABELS: `@authenticated @smoke` + authenticated `testMatch`) |
| **P1** | Investigate procedure-day unauth **HTTP 200** (security `@smoke`) | **DONE** (PUB-PROC-200) — soft 200 + no Surgery day chrome |
| **P2** | Widen/tighten security expects for patients **404** + cron **503** only after confirming intended status | **DONE** (PUB-SEC-STATUS) — 404/503 intentional |
| **P2** | Close DEF-TC-01 test typing | Restores `ci.yml` typecheck claim — **still open** (overall AMBER) |
| **P3** | Optional fixtures (CI-FIX-01) + HR drift ops cadence | Coverage / ops only |

---

## 6. Related docs

- [fi-ci-signal-hygiene-1.md](./fi-ci-signal-hygiene-1.md) — Phase 1 findings
- [fi-trust-ci-and-reception-1.md](./fi-trust-ci-and-reception-1.md) — trust GREEN baseline
- [.github/workflows/e2e-smoke.yml](../../.github/workflows/e2e-smoke.yml)
- [e2e/README.md](../../e2e/README.md)
