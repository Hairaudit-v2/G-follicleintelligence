# FI-HUBSPOT-BACKUP-1 — Phase O production gate evidence

**Date:** 2026-07-16  
**Evidence classification:** Privacy-safe operational metadata only  
**Production PASS:** CLAIMED

---

## 1. Push — full recovery stack

| Field | Value |
|-------|-------|
| Feature branch | `codex/fi-hubspot-live-sync-recovery` |
| Feature tip | `cfdf08c4067c1f3a80c95c4398efc9c42b9a7ce6` |
| Merged to `main` | `8fe2a3924e644b78295017e07b304fc67f931a26` |
| Current `main` / suite commit | `3bf43f22d5828089ba48c086e21e60d62de51b8b` |
| `cfdf08c4` ancestor of production SHA | **Yes** |

---

## 2. Deploy — Vercel Git integration

| Field | Value |
|-------|-------|
| Mechanism | Vercel Git integration on `main` |
| Deployment ID | `dpl_6UF8GSzt4catsmfz1PqLmw7YoRgt` |
| Target | `production` |
| readyState | **READY** |
| Deployed SHA | `3bf43f22d5828089ba48c086e21e60d62de51b8b` |
| Matches `origin/main` HEAD | **Yes** |
| Production aliases | `follicleintelligence.ai`, `www.follicleintelligence.ai` |
| Inspector | https://vercel.com/fi-ai-ef8ee84f/g-follicleintelligence/6UF8GSzt4catsmfz1PqLmw7YoRgt |

Recovery-stack merge deploy (also READY, prior): `dpl_BqzrpkMs8UPac5L9vELaitzJBHMc` at `8fe2a392`.

---

## 3. Authenticated HubSpot workspace smoke

| Field | Value |
|-------|-------|
| Suite | `FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1` |
| Command | `npm run test:e2e:hubspot-production-smoke` |
| Target URL | `https://follicleintelligence.ai` |
| Auth | Configuration-hub admin via `FI_E2E_PRODUCTION_ADMIN_*` (local `.env.local`; not committed) |
| Suite commit | `3bf43f22d5828089ba48c086e21e60d62de51b8b` |
| Smoke timestamp (UTC) | `2026-07-16T01:37:47.958Z` |
| Playwright | **11 passed** |
| Summary verdict | **GREEN** |
| Summary artifact (local, not committed) | `test-results/hubspot-production-smoke-summary.json` |
| Screenshots (local, not committed) | `test-results/hubspot-production-smoke-screenshots/` |
| Traces | Disabled |

### Axis results

| Axis | Result |
|------|--------|
| A. Canonical workspace | PASS |
| B. Overview | PASS |
| C. Backup & Sync | PASS |
| D. Import Review | PASS |
| E. Activity & Webhooks | PASS |
| F. Configuration | PASS |
| G. Audit & History | PASS |
| H. Legacy redirects | PASS |
| I. Valid / invalid batchId | PASS |
| J. Tenant isolation | PASS |
| K. Low-role gating | PASS (executed with `FI_E2E_LOW_ROLE_*`; fail-closed denial) |
| Mutation guard | PASS |

Notes from summary: low-role user denied HubSpot Configuration and Import Review deep links (fail-closed). Re-verified `2026-07-16T01:43:14.939Z` with low-role secrets present (not AMBER skip). Deployed commit SHA unset in local harness env (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`); production deploy SHA confirmed independently via Vercel as `3bf43f22`.

---

## 4. Gate matrix

| Gate | Status |
|------|--------|
| Recovery stack pushed | PASS |
| Merged to `main` | PASS |
| Vercel production READY | PASS |
| Deployed SHA = `origin/main` HEAD | PASS |
| Deployed SHA contains Phase O closeout tip | PASS |
| Authenticated HubSpot production smoke | **PASS (GREEN)** |
| Production PASS | **CLAIMED** |

---

## 5. Relationship to Phase O closeout

Dataset Phase O remains **GREEN WITH DOCUMENTED LIMITATIONS** (`evidence-fi-hubspot-phase-o-closeout.md`).  
This production gate claims **Production PASS** for deploy readiness + authenticated workspace smoke only. It does not reopen forms/submissions reruns or contact-association enrichment.
