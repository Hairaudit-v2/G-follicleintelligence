# FI-HUBSPOT-BACKUP-1 — Stage P3 scheduled incremental backup operations

**Evidence classification:** Privacy-safe operational metadata only  
**Date:** 2026-07-16  
**Machine-readable:** `evidence-fi-hubspot-stage-p3-scheduled-operations.json`

**Does not claim Stage P complete.**  
**Does not implement Stage P4.**

---

## 1 / 24. P3 verdict

### **GREEN**

Production Vercel Cron scheduled notes incremental backup is enabled, observed one genuine empty-range success that advanced the watermark safely, concurrency/retry/notification paths are implemented and tested, and the permanent cadence is locked to 02:00 Australia/Brisbane (16:00 UTC).

---

## 2. Deployment ID and SHA

| Field | Value |
|-------|-------|
| Production deployment (observed run) | `dpl_5idosau1o4F7YXRm3BmzEpTLXKB5` |
| readyState | **READY** |
| Deployed SHA | `b48098e341a9ccfd33cfd37b8b78b4503936fe52` |
| Contains `d213ad51` (single-sort fix) | **Yes** |
| Alias | `follicleintelligence.ai` |

Pre-schedule gate: `dpl_E1D1yUDYneLFKzxn9wHDcGgEmosJ` @ `aac0d23f` confirmed READY with `d213ad51` before schedule enablement.

---

## 3–6. Scheduler

| Field | Value |
|-------|-------|
| Scheduler type | **Vercel Cron** (existing production infrastructure) |
| Schedule ID / path | `/api/cron/hubspot/incremental-notes-backup` |
| Auth | Bearer `CRON_SECRET` (or scoped alias) |
| Why appropriate | Production-managed; no laptop/TLS dependency; matches LeadFlow/reminder pattern |
| Enablement observation cadence | `*/15 * * * *` (temporary window to observe first fire) |
| Permanent cadence | `0 16 * * *` |
| Brisbane local time | **02:00 Australia/Brisbane** (no DST) |
| UTC time | **16:00 UTC** |

---

## 7. Watermark bootstrap

| Field | Value |
|-------|-------|
| Pre-schedule watermark | `2026-07-16T03:20:00.000Z` (from Stage P2) |
| First scheduled cutoff-from | `2026-07-16T03:20:00.000Z` |
| No backfill from zero | **Confirmed** |
| No watermark reset | **Confirmed** |

---

## 8–10. Concurrency, retry, notifications

| Capability | Result |
|------------|--------|
| DB active-run unique index | Reused `uq_hubspot_incremental_active_run` |
| Overlap fails closed | Covered by engine + unit test |
| Retry | Up to 3 transient attempts; immutable cutoffs; no 4xx loops |
| Stuck recovery | Operator CLI only; 30-minute threshold; no auto recovery |
| Notification path | `fi_admin_notifications` source `hubspot_incremental_backup` |
| Notification test | **PASS** — alert `12f38567-7874-4b05-8ae8-117d5ae285db` (no backup side effects) |

---

## 11–12. Manual recovery / runbook

Updated: `docs/runbooks/hubspot-incremental-backup.md`  
Includes watermark/run inspection, manual/resume/recover, disable/enable kill switch, notification test, and Brisbane/UTC cadence.

---

## 13–18. First scheduled production run

| Field | Value |
|-------|--------|
| Scheduler source | Vercel Cron (`vercel_cron`) |
| Invocation | ~`2026-07-16T03:45:02.366Z` |
| Run ID | `3b0a231b-9a0c-4ab4-a6d9-81bca8b2c3b4` |
| Cutoff-from | `2026-07-16T03:20:00.000Z` |
| Cutoff-to | `2026-07-16T03:45:02.366Z` (frozen at invocation) |
| Outcome | `empty_success` |
| Status / verification | `completed` / `passed` |
| Counts | discovered 0 · inRange 0 · inserted 0 · updated 0 · unchanged 0 · failed 0 |
| Watermark before | `2026-07-16T03:20:00.000Z` |
| Watermark after | `2026-07-16T03:45:02.366Z` |
| Verification event | `scheduled_invocation` + engine finalisation/verification/watermark events |
| Duration | ~2s |
| Notification | Not required (success/empty_success) |

Empty range classified GREEN per Stage P3 rules.

---

## 19. Post-run integrity

| Check | Result |
|-------|--------|
| Active notes runs | **0** |
| P2 test note rows (`113007728535`) | **1** |
| Duplicate groups | **0** |
| Cross-tenant rows | **0** |
| Non-notes watermarks | **0** |
| Watermark equals cutoff-to | **Yes** |
| Watermark regression | **No** |

---

## 20. Production logs

Filtered HubSpot error/warning/fatal logs on the observed deployment window: **no material hits**. Scheduled success recorded in verification events.

---

## 21. Schedule owner

| Field | Value |
|-------|--------|
| Owner | Follicle Intelligence / Evolved platform operations |
| Kill switch | `FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED` |
| Actor env | `FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID` |
| Tenant/integration env | `FI_HUBSPOT_INCREMENTAL_BACKUP_TENANT_ID` / `_INTEGRATION_ID` |

---

## 22. Disable / rollback

1. Set `FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED=false` in Vercel production  
2. Or remove cron path from `vercel.json` and redeploy  
3. Do not manually rewind watermarks  
4. Do not delete staging / verification history  
5. Application rollback: redeploy prior SHA if required  

---

## 23. Remaining risks

| Risk | Notes |
|------|-------|
| Enablement used temporary `*/15` then locked to daily | Documented; permanent cadence is daily |
| Archived-note Search limitation | Unchanged AMBER from prior stages |
| Search lag | Unchanged AMBER |
| Integration ID not stored on `fi_admin_notifications.integration_id` | FK targets calendar integrations; HubSpot ID kept in metadata |

---

## 24. Final P3 verdict

### **GREEN**

---

## 25. Exact next gate

Implement Stage P4 backup-health visibility in Backup & Sync using real run and verification data, with Healthy / Needs review / Failed states and no execution controls exposed to ordinary staff.

**Do not implement P4 in this evidence.**

---

## Validation checklist

- [x] Single-sort fix deployed before schedule enable
- [x] No full-history backup
- [x] No new HubSpot test object created in P3
- [x] No contact-association enrichment
- [x] No secrets in evidence
- [x] No patient data in evidence
- [x] Tests + migration checks passed
