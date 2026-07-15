# FI-HUBSPOT-WORKSPACE-CONSOLIDATION-1 - Closeout

**Milestone:** FI-HUBSPOT-WORKSPACE-CONSOLIDATION-CLOSEOUT-1  
Status: CLOSED  
Closed: 16 July 2026  
Environment: Production (`https://follicleintelligence.ai`)  
Tenant: `c2615b95-b707-4485-aa5f-be8f78ec868a` (ID only; no customer PHI)  
Canonical route: `/fi-admin/{tenant}/settings/integrations/hubspot`  
Evidence classification: Privacy-safe operational / access-control evidence only

---

## FI-HUBSPOT-WORKSPACE-CONSOLIDATION-1

**Overall verdict: GREEN**

### Production deployment

| Field | Value |
|---|---|
| Commit | `c0f1c06a` (`fix(hubspot): complete workspace recovery`) |
| Deployment ID | `dpl_EfW2pAS67AAvscgXqKxuyww5UCvw` |
| Status | **READY** |
| Aliases | `follicleintelligence.ai`, `www.follicleintelligence.ai` |

### Meta (harness / workflow)

| Field | Value |
|---|---|
| Harness commit | `671fca23f568028cca87a3c98fe5dd0ee2435a99` (`test(hubspot): harden production smoke harness`) |
| Closeout doc commit(s) | Latest docs update on same lineage as harness |
| Remote branch | `origin/codex/fi-hubspot-live-sync-recovery` (also merged to `main` for production lineage) |
| Workflow name | HubSpot Production Smoke |
| Workflow file | `.github/workflows/hubspot-production-smoke.yml` |
| Suite | `FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1` |
| Invocation | `npm run test:e2e:hubspot-production-smoke` |
| Production URL | https://follicleintelligence.ai |
| Smoke execution timestamp | `2026-07-15T21:59:55.051Z` (from `test-results/hubspot-production-smoke-summary.json`) |
| CI / workflow status | **LOCAL GREEN** (Playwright; GHA not authenticated in this closeout session) |
| Summary artifact (local, not committed) | `test-results/hubspot-production-smoke-summary.json` |
| Privacy-safe screenshots (local, not committed) | `test-results/hubspot-production-smoke-screenshots/` |
| Traces | **Disabled** (`trace: "off"` in `playwright.hubspot-production-smoke.config.ts`) |

### Automated production smoke evidence

| Evidence | Result |
|---|---|
| Canonical workspace | **PASS** |
| Overview | **PASS** |
| Backup & Sync | **PASS** |
| Import Review | **PASS** |
| Activity & Webhooks | **PASS** |
| Configuration | **PASS** |
| Audit & History | **PASS** |
| Legacy tenant-scoped redirects | **PASS** |
| Public alias redirect | **PASS** |
| Valid batchId preservation | **PASS** |
| Invalid batchId rejection | **PASS** |
| Browser back navigation | **PASS** |
| Authorised admin access | **PASS** |
| Doctor native-role gating | **PASS** (manual production evidence) |
| Reception impersonation gating | **PASS** (manual production evidence) |
| Cross-tenant isolation | **PASS** |
| Mutation guard | **PASS** |
| Runtime errors | **none** |
| Privacy-safe evidence | **PASS** |
| Automated production smoke A–K | **GREEN** |

### A–K axis results (machine-readable summary)

| Axis | Result |
|---|---|
| A. Canonical workspace | **PASS** |
| B. Overview | **PASS** |
| C. Backup & Sync | **PASS** |
| D. Import Review | **PASS** |
| E. Activity & Webhooks | **PASS** |
| F. Configuration | **PASS** |
| G. Audit & History | **PASS** |
| H. Legacy redirects (+ browser back) | **PASS** |
| I. Valid / invalid batchId | **PASS** |
| J. Tenant isolation | **PASS** |
| K. Low-role gating | **PASS** |
| Mutation guard | **PASS** |
| Verdict | **GREEN** |

### Backup data evidence (counts only — no PII)

| Object | Count |
|---|---|
| Primary — contacts | 4,750 |
| Primary — deals | 4,958 |
| Secondary — companies | 653 |
| Secondary — tickets | 682 |
| Secondary — owners | 31 |
| Secondary — calls | 2,093 |
| Secondary — tasks | 1,680 |
| Secondary — meetings | 17 |

### Harness contract validation (Part A)

Confirmed from suite code + GREEN summary:

- Authenticated production session via `FI_E2E_PRODUCTION_ADMIN_*` + generated storage-state (gitignored; never committed)
- Production read-only mutation guard (`e2e/helpers/hubspotMutationGuard.ts`) — network + click
- Axes A–K covering overview / backup / import / activity / config / audit
- Tenant-scoped legacy redirects to canonical Import Review
- Valid `batchId` preserved; invalid `batchId` discarded
- Tenant isolation fail-closed
- Doctor + Reception gating: manual closeout evidence + automated axis K
- Privacy-safe screenshots via `capturePrivacySafeHubspotShot`
- Machine-readable summary via `hubspotSmokeSummary` helpers

Harness **never** activates: Sync now, Back up secondary, Approve, Reject, Import, Promote, Verify credentials, Reconnect, Revoke.

No auth storage-state, secrets, `.env`, or customer-info traces are committed. Workflow and harness are on remote.

### Mutation / safety confirmation

Smoke triggered **none** of: backup, sync, approve, reject, import, promote, verify credentials, reconnect, revoke.

- Mutation guard: **PASS** / clean
- No customer names, emails, phones, raw payloads, message bodies, or PHI in this closeout or privacy-safe screenshots
- No HubSpot staging/customer data modified by closeout
- This closeout did **not** re-run production smoke; evidence taken from existing GREEN summary

### Access-control evidence (manual, production)

| Axis | Result | Notes (no PHI) |
|---|---|---|
| Doctor native-role gating | **PASS** | Configuration hub + HubSpot config tab denied; Import Review read-only |
| Reception impersonation gating | **PASS** | Same under impersonation after cap + config-hub fixes |
| Authorised admin access | **PASS** | Canonical workspace tabs A–G reachable for admin |

---

## Rollback (harness + closeout docs only)

Roll back harness and/or closeout documentation without touching production recovery or gates:

```powershell
# Harness harden commit (primary):
git revert 671fca23f568028cca87a3c98fe5dd0ee2435a99

# Optionally revert subsequent closeout doc commit(s) on the same branch if needed:
# git revert <CLOSEOUT_DOC_COMMIT>
```

**Do not** roll back:

- `c0f1c06a` (workspace recovery)
- READY production deployment `dpl_EfW2pAS67AAvscgXqKxuyww5UCvw`
- HubSpot staging data
- Credential repairs
- Capability-gate commits (`e67bd4ec`, `49b63f2a`, `940b948e`)

---

## Closure decision

`FI-HUBSPOT-WORKSPACE-CONSOLIDATION-1` is complete and closed with overall verdict **GREEN**.

Ongoing duty: run **FI-HUBSPOT-AUTHENTICATED-PRODUCTION-SMOKE-1** (`npm run test:e2e:hubspot-production-smoke` or workflow_dispatch on HubSpot Production Smoke) after HubSpot workspace or capability-gate deploys. Preserve canonical workspace route, staged-only import boundary, capability-based Configuration gate, and non-mutating production smoke contract.
