# FI-HUBSPOT-WORKSPACE-CONSOLIDATION-1 - Closeout

**Milestone:** FI-HUBSPOT-WORKSPACE-CONSOLIDATION-CLOSEOUT-1  
Status: CLOSED  
Closed: 16 July 2026  
Environment: Production (`https://follicleintelligence.ai`)  
Tenant: `c2615b95-b707-4485-aa5f-be8f78ec868a`  
Canonical route: `/fi-admin/{tenant}/settings/integrations/hubspot`  
Evidence classification: Privacy-safe operational / access-control evidence only

## Final record

| Field | Value |
|---|---|
| Milestone | **FI-HUBSPOT-WORKSPACE-CONSOLIDATION-1** |
| Overall verdict | **GREEN** |
| Production URL | https://follicleintelligence.ai |
| Harness commit | `671fca23f568028cca87a3c98fe5dd0ee2435a99` (`test(hubspot): harden production smoke harness`) |
| Remote branch | `origin/codex/fi-hubspot-live-sync-recovery` (also merged to `main` for production lineage) |
| Workflow | HubSpot Production Smoke — `.github/workflows/hubspot-production-smoke.yml` |
| Suite | `FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1` |
| Smoke execution timestamp | `2026-07-15T21:59:55.051Z` (from `test-results/hubspot-production-smoke-summary.json`) |
| CI / workflow result | **LOCAL GREEN** (Playwright production smoke; GHA not authenticated / not checked in this closeout) |

## Evidence matrix (all PASS / GREEN)

| Evidence | Result |
|---|---|
| canonical workspace | **PASS** |
| Overview | **PASS** |
| Backup & Sync | **PASS** |
| Import Review | **PASS** |
| Activity & Webhooks | **PASS** |
| Configuration | **PASS** |
| Audit & History | **PASS** |
| legacy redirects | **PASS** |
| valid batchId preservation | **PASS** |
| invalid batchId handling | **PASS** |
| authorised access | **PASS** |
| Doctor native-role gating | **PASS** |
| Reception impersonation gating | **PASS** |
| cross-tenant isolation | **PASS** |
| mutation guard | **PASS** |
| runtime errors | **none** |
| privacy-safe evidence | **PASS** |
| automated production smoke A–K | **GREEN** |

## Automated production smoke (A–K)

Suite commit recorded in summary: `671fca23f568028cca87a3c98fe5dd0ee2435a99`  
Summary artifact: `test-results/hubspot-production-smoke-summary.json` (local; not committed)  
Verdict: **GREEN**

| Axis | Result |
|---|---|
| A. Canonical workspace | **PASS** |
| B. Overview | **PASS** |
| C. Backup & Sync | **PASS** |
| D. Import Review | **PASS** |
| E. Activity & Webhooks | **PASS** |
| F. Configuration | **PASS** |
| G. Audit & History | **PASS** |
| H. Legacy redirects | **PASS** |
| I. Valid batchId | **PASS** |
| I. Invalid batchId | **PASS** |
| J. Tenant isolation | **PASS** |
| K. Low-role gating | **PASS** |
| Mutation guard | **PASS** |
| Role-gating (K + manual Doctor/Reception) | **PASS** |
| Tenant isolation | **PASS** |
| Redirect and batchId | **PASS** |
| Runtime errors | **none** |

Spec: `e2e/hubspot-production-smoke/hubspot-production-smoke.spec.ts`  
Command: `npm run test:e2e:hubspot-production-smoke`

## Access-control evidence (production, 16 July 2026)

| Axis | Result | Notes |
|---|---|---|
| Doctor native-role gating | **PASS** | Tenant `/configuration` and HubSpot `?tab=configuration` → 404; Import Review read-only |
| Reception impersonation gating | **PASS** | Same after impersonation-cap + CRM-operator config-hub fixes |
| Configuration access restriction | **PASS** | Config hub requires clinic/finance/admin settings caps only |
| Import Review read-only access | **PASS** | CRM-read sessions limited to Import Review tab |
| Mutation controls hidden | **PASS** | Approve / Reject / Sync / CSV upload hidden without mutate rights |
| Clinic settings isolation | **PASS** | Configuration / Integrations / Admin Users hidden for Reception |
| Cross-tenant protection | **PASS** | Smoke axis J + portal tenant-isolation (established) |

## Mutation guard / non-mutating suite confirmation

The production smoke suite did **not** trigger any backup, sync, import, approval, rejection, credential, reconnect, revoke, or promotion action.

- Network + UI mutation guard: **PASS** / clean
- Suite contract: non-mutating read-only smoke only
- No HubSpot data was modified by this closeout run; no production backup or sync was re-run for closeout evidence

## Safety confirmation

- HubSpot remains read-only from FI; staged records are not auto-promoted.
- Credential values, customer review tables, and PHI are excluded from smoke screenshots and this closeout.
- Platform-admin impersonation no longer elevates tenant Configuration caps.
- CRM operators / operations-only roles no longer unlock Configuration hub via `manage_operations` alone.
- Storage-state, `.env`, and backup exports are never committed.

## Rollback (harness commit only)

To roll back **only** the smoke-harness hardening without reverting capability gates or workspace consolidation:

```bash
# On the branch that carries the harness tip (prefer codex/fi-hubspot-live-sync-recovery, or main after merge):
git revert 671fca23f568028cca87a3c98fe5dd0ee2435a99
```

That reverts `test(hubspot): harden production smoke harness` (`e2e/helpers/hubspotSmokeSummary.ts`, `e2e/hubspot-production-smoke/hubspot-production-smoke.spec.ts` only). Do **not** revert `e67bd4ec`, `49b63f2a`, `940b948e`, or the workspace consolidation commits.

## Closure decision

`FI-HUBSPOT-WORKSPACE-CONSOLIDATION-1` is complete and closed with overall verdict **GREEN**.

Ongoing duty: run **FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1** after HubSpot workspace or capability-gate deploys to catch regressions. Further HubSpot product work must preserve the canonical workspace route, staged-only import boundary, capability-based Configuration gate, and non-mutating production smoke contract.
