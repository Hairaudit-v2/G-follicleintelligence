# FI-HUBSPOT-BACKUP-1 — Stage P4 backup-health visibility

**Evidence classification:** Privacy-safe operational metadata only  
**Date:** 2026-07-16  
**Machine-readable:** `evidence-fi-hubspot-stage-p4-backup-health-visibility.json`

**Does not claim Stage P complete.**  
**Does not implement Stage P5.**

---

## 1. P4 verdict

### **GREEN**

Incremental notes backup health on HubSpot **Backup & Sync** is derived from live run, verification, watermark, schedule, and alert sources; production displays **Healthy** for the P3 `empty_success` verified run; ordinary staff receive no incremental execution controls; primary/secondary evidence remain separated; targeted tests and authenticated Backup & Sync smoke pass.

---

## 2. Production deployment and SHA

| Field | Value |
|-------|-------|
| Production deployment | `dpl_B4LZy2s65UsXssVeGzVN458DYMwz` |
| readyState | **READY** |
| Deployed SHA | `2aee523cb3ffff469f03a79aa8f99dc534c03fb0` |
| Alias | `follicleintelligence.ai` |
| Includes feat health UI | Yes (`e48dcff1`) |
| Includes health unit tests | Yes (`a039fd61`) |

---

## 3. Health derivation architecture

Pure derivation: `src/lib/onboarding-os/hubspotBackupHealthCore.ts`  
Server loader (read-only): `src/lib/onboarding-os/hubspotBackupHealth.server.ts`  
UI: `src/components/onboarding-os/HubspotBackupHealthSection.tsx`  
Wired into Backup & Sync via `app/(fi-admin)/fi-admin/[tenantId]/settings/integrations/hubspot/page.tsx`

Precedence: **Failed > Needs review > Healthy**. Never Healthy on source query error.

---

## 4. Primary data sources

1. `fi_external_hubspot_sync_runs` — latest terminal incremental notes run + any active `started` run  
2. Run verification state (`incremental_verification_state`)  
3. `fi_external_hubspot_backup_watermarks` — notes watermark  
4. Scheduler enabled flag (`FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED`) + cadence constants (`0 16 * * *` / 02:00 Australia/Brisbane)

---

## 5. Secondary data sources

1. `fi_admin_notifications` where `source = hubspot_incremental_backup` (HubSpot integration id in metadata)  
2. Existing primary/secondary Backup & Sync cards and Audit & History (unchanged separation)  
3. P2/P3 evidence references (documentation only; never used to force Healthy)

---

## 6. Status rules

| State | Key conditions |
|-------|----------------|
| Healthy | Verified completed/empty_success, watermark matches cutoff-to, schedule enabled, covered latest expected window (+ grace), no unresolved post-success critical alert |
| Needs review | Partial, verification pending, overdue window, scheduler disabled, missing watermark/runs/schedule, active run in progress, warning alert after success |
| Failed | Run/verification failed, stuck active run, watermark mismatch after verified completion, query error, unresolved critical alert after success |

Empty successful ranges classify as **Healthy** (`empty_success`).

---

## 7. Freshness rules

| Field | Value |
|-------|-------|
| Cadence | Daily |
| Local | 02:00 Australia/Brisbane |
| UTC | 16:00 UTC (`0 16 * * *`) |
| Grace | 2 hours after last expected 16:00 UTC |
| Stuck threshold | 30 minutes (`HUBSPOT_INCREMENTAL_STUCK_AGE_MS`) |
| Timestamps | Stored/compared UTC; displayed with timezone |

---

## 8. Current production health

| Field | Value |
|-------|-------|
| Status | **Healthy** |
| Reason | `empty_success` |
| Operator action required | No |

Confirmed by production smoke (`data-health-status="healthy"`) and derivation from live DB rows.

---

## 9. Last verified run

| Field | Value |
|-------|-------|
| Run ID | `3b0a231b-9a0c-4ab4-a6d9-81bca8b2c3b4` |
| Outcome | `empty_success` |
| Verification | passed |
| Cutoff | `2026-07-16T03:20:00.000Z` → `2026-07-16T03:45:02.366Z` |
| Completed | `2026-07-16T03:45:05.444Z` |

---

## 10. Current watermark

`2026-07-16T03:45:02.366Z` — matches latest verified cutoff-to.

---

## 11. Next expected run

`2026-07-16T16:00:00.000Z` (02:00 Australia/Brisbane on 2026-07-17 local calendar day for that UTC instant).

---

## 12. Role behaviour

| Audience | Sees |
|----------|------|
| Staff with Backup & Sync access (non-mutate) | Status, summary, last verified, next expected, operator action required, outcome label; **no** run ID / cutoffs / watermark / reason code / alert detail |
| Admin/mutate roles (`canMutateHubspotWorkspace`) | Technical counts, run ID, cutoffs, watermark match, reason code, runbook reference |

---

## 13. Execution-control absence

- P4 adds **no** write endpoints for incremental backup.  
- Smoke confirmed no resume/recover/replay/watermark buttons.  
- Existing primary/secondary Sync controls remain gated by `canMutate` (unchanged Phase O behaviour); Configuration still excludes Sync now / secondary backup.  
- Page view does not start a backup (active started runs after smoke: **0**).

---

## 14. Tests

| Suite | Result |
|-------|--------|
| `npm run test:hubspot-incremental` (includes P4 health tests) | **58 pass** |
| `hubspotWorkspaceStatus` / routes regressions | **6 pass** |
| `tsc --noEmit` | **pass** |

---

## 15. Authenticated production smoke

| Test | Result |
|------|--------|
| C. Backup & Sync (health Healthy + evidence cards) | **PASS** |
| F. Configuration (no Sync now / secondary on config) | **PASS** |
| K. Low-role optional | **PASS** |
| Full suite B (hard-coded overview totals) | FAIL — stale expected contact counts (`4,750`); **non-blocking for P4** (orthogonal to health visibility) |

Command: `npm run test:e2e:hubspot-production-smoke` (targeted `-g "Backup & Sync"` / Configuration / low-role for P4 gate).

---

## 16. Console / network / log result

- Playwright Backup & Sync smoke: no mutation-guard violations.  
- Vercel runtime error/fatal logs for HubSpot on deployment window: **none found**.  
- Active incremental `started` runs after page smoke: **0**.

---

## 17. Performance result

Loader uses bounded queries only (latest terminal run, latest active run, watermark single row, ≤20 notifications). No full history scan.

---

## 18. Files changed

- `src/lib/onboarding-os/hubspotBackupHealthCore.ts`
- `src/lib/onboarding-os/hubspotBackupHealth.server.ts`
- `src/components/onboarding-os/HubspotBackupHealthSection.tsx`
- `app/(fi-admin)/fi-admin/[tenantId]/settings/integrations/hubspot/page.tsx`
- `src/lib/onboarding-os/hubspotBackupHealthCore.test.ts`
- `src/lib/onboarding-os/hubspotBackupHealth.server.test.ts`
- `src/lib/onboarding-os/hubspotBackupHealthSection.model.test.ts`
- `e2e/hubspot-production-smoke/hubspot-production-smoke.spec.ts`
- `package.json` (test script includes P4 tests)
- `docs/audits/evidence-fi-hubspot-stage-p4-backup-health-visibility.md`
- `docs/audits/evidence-fi-hubspot-stage-p4-backup-health-visibility.json`

---

## 19. Commit hashes

| Commit | Message |
|--------|---------|
| `e48dcff1` | feat(hubspot): add backup health visibility |
| `a039fd61` | test(hubspot): verify backup health states |
| `2aee523c` | test(hubspot): assert backup health on production smoke |
| *(follow-up)* | smoke Healthy assertion + audit evidence |

---

## 20. Rollback

Revert the P4 commits above (feat + tests + smoke + audit). Scheduler cadence and incremental engine are unchanged; rollback removes visibility only.

---

## 21. Remaining risks

- Archived notes remain outside Search path (known).  
- HubSpot Search indexing lag (known).  
- `fi_admin_notifications.integration_id` still calendar-FK constrained; HubSpot id remains in metadata.  
- Full overview smoke totals fixture is stale (non-P4).  
- After 16:00 UTC + grace without a new verified success, status correctly becomes Needs review until the daily run completes.

---

## 22. Exact next gate

Run Stage P5 final closeout for FI-HUBSPOT-BACKUP-1, confirming historical recovery, production recovery, incremental capture, idempotent replay, scheduled operation, alerting, and backup-health visibility are GREEN, while contact-association enrichment remains optional and non-blocking.

**Do not perform P5 in this evidence package.**
