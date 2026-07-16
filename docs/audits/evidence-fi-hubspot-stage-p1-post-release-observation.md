# FI-HUBSPOT-BACKUP-1 — Stage P1 controlled post-release observation

**Evidence classification:** Privacy-safe operational metadata only  
**Date:** 2026-07-16  
**Milestone:** Stage P1 (controlled post-release observation)  
**Machine-readable:** `evidence-fi-hubspot-stage-p1-post-release-observation.json`  

**Precondition:** Stage P0 AMBER — `docs/audits/evidence-fi-hubspot-stage-p0-operational-baseline.md` (commit `6ba5b623`)

**Explicit no-write statement:** P1 did **not** create HubSpot test records, did **not** run a production backup, did **not** click Sync / secondary / engagement backup controls, did **not** deploy, and did **not** change production environment variables.

---

## 1. Production baseline observed

| Field | Value |
|-------|-------|
| Production URL | `https://follicleintelligence.ai` |
| Production deployment | `dpl_CqkWx7FXXGf7jwbpupKu1pSv3fuw` |
| Production readyState | **READY** |
| Production SHA | `687410c158018a545de3025b9c1093ce6212653d` |
| Production commit message | `audit(hubspot): record low-role smoke executed with secrets` |
| Inspector | https://vercel.com/fi-ai-ef8ee84f/g-follicleintelligence/CqkWx7FXXGf7jwbpupKu1pSv3fuw |
| Local suite HEAD (P0 evidence, not yet on production) | `6ba5b62361637a9f8444bc788813f089f8b14d55` |
| Destination tenant | `c2615b95-b707-4485-aa5f-be8f78ec868a` (Evolved) |
| Observation method | `npm run test:e2e:hubspot-production-smoke` (non-mutating) |

P0 evidence commit is documentation-only and is **not required** on the production deploy for this observation. Production already carries Phase O recovery + workspace consolidation.

---

## 2. Observation matrix

| Axis | How verified | Result |
|------|--------------|--------|
| Platform admin | `FI_E2E_PRODUCTION_ADMIN_*` against canonical HubSpot workspace | **PASS** |
| Ordinary authorised staff | `FI_E2E_LOW_ROLE_*` — Configuration + Import Review deep links denied (fail-closed) | **PASS** |
| Invalid `batchId` | `not-a-uuid` discarded safely; workspace remains usable | **PASS** |
| Valid `batchId` | `11111111-1111-4111-8111-111111111111` preserved on import-review | **PASS** |
| Legacy redirect routes | `/settings/imports/hubspot` + `/onboarding-os/import-review` → canonical import-review; browser back OK | **PASS** |
| Backup & Sync | Tab loads staged evidence; primary/secondary status + checkpoint + reconciliation visible; **controls never clicked** | **PASS** |
| Audit & History | Privacy-safe sections + timestamps; no customer payloads | **PASS** |
| Configuration | Auth/scopes/verification visible; Sync now / secondary backup **absent** on this tab | **PASS** |
| Production logs | Vercel runtime logs during smoke window — HubSpot routes 200; no UUID error lines in last 2h | **PASS** |
| Browser console | Playwright collected `console.error` per axis A; empty | **PASS** |
| Network failures | Playwright `requestfailed` filter (hubspot / document); soft `ERR_ABORTED` ignored; suite GREEN | **PASS** |
| Cross-tenant access | Invalid tenant `00000000-0000-4000-8000-111111111111` denied (307 / fail-closed) | **PASS** |

Smoke summary (local, not committed): `test-results/hubspot-production-smoke-summary.json`  
Timestamp UTC: `2026-07-16T01:58:19.135Z`  
Playwright: **11 passed** · Verdict: **GREEN**

---

## 3. P1 exit gate

| Gate | Status |
|------|--------|
| No new UUID/query failures | **PASS** — no `invalid input syntax for type uuid` in last 2h; HubSpot route errors for `smoke-safe-id` last seen `2026-07-15T10:00:42Z` on older deploy (historical, not P1) |
| No route loops | **PASS** — legacy redirects + browser back asserted |
| No hidden execution controls | **PASS** — mutation guard; Overview has no Sync/backup buttons; Backup & Sync controls visible but never clicked; Configuration lacks Sync now / secondary backup |
| No tenant leakage | **PASS** — invalid tenant denied; low-role denied config deep links |
| No repeated frontend errors | **PASS** — console error collectors empty on canonical load |
| No new production regression | **PASS** — 11/11 smoke GREEN on READY production |

---

## 4. Production log notes (privacy-safe)

During the smoke window (~`2026-07-16T01:52Z`–`01:58Z`) on deploy `dpl_CqkWx7FXXGf7jwbpupKu1pSv3fuw`:

- Canonical HubSpot GETs returned **200** for overview, backup-sync, import-review, activity-webhooks, configuration, audit-history.
- Valid `batchId` import-review requests returned **200**.
- Cross-tenant probe returned **307** (denied).
- Low-role login then Configuration probe returned **200** on login redirect path with fail-closed denial asserted by Playwright.
- Query for uuid errors in last 2h: **no logs**.
- Unrelated background noise (refresh-token / cipher / patients Bad Request) pre-exists outside HubSpot P1 scope and did not surface in the smoke assertions.

---

## 5. Relationship to Stage P0 / P2

| Item | State |
|------|-------|
| Stage P0 verdict | AMBER — no incremental entry point / no fixed cutoff |
| Stage P1 (this file) | **GREEN** — post-release workspace observation |
| Stage P2 incremental proof | **BLOCKED** until incremental engine + fixed cutoff lands (P0 §12) |
| TEST HubSpot object creation | **Not performed** (correctly deferred until after P1 and after incremental capability exists) |

P2 must not substitute a full-history backup for incremental proof.

---

## 6. P1 verdict

### **GREEN**

Controlled post-release observation passed all exit gates. Safe to proceed to **engine work required for Stage P2** (incremental + fixed cutoff), not to an immediate production incremental backup run.

---

## 7. Rollback

```bash
git revert <this-commit-sha>
```
