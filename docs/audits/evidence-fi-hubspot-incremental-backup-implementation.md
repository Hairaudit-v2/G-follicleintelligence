# FI-HUBSPOT-INCREMENTAL-BACKUP-1 — implementation evidence

**Date:** 2026-07-16  
**Evidence classification:** Privacy-safe operational metadata only  
**Milestone verdict:** **GREEN**

**Does not claim Stage P2 GREEN.**

---

## 1. Milestone verdict

| Gate | Status |
|------|--------|
| Incremental notes command exists | PASS |
| Fixed UTC cutoffs | PASS |
| Same-range rerun idempotent | PASS (unique + upsert + tests) |
| Watermark only after finalisation + verification | PASS |
| Partial/failure never advances watermark | PASS |
| Resume preserves original range | PASS |
| Concurrency fails closed | PASS (unique active-run index + tests) |
| Automated tests pass | PASS (21/21) |
| No production backup run | PASS |
| No production TEST note created | PASS |
| Typecheck / full-backup regression / migrations | PASS |

**Verdict: GREEN** — prerequisite ready to deploy, then re-observe (P1), then Stage P2 proof.

---

## 2. Architecture summary

Incremental notes backup reuses:

- HubSpot credential load + write auth from `hubspotConnector.server.ts`
- Notes staging/upsert from `stageHubspotNotesPage` → `fi_external_hubspot_note_staging`
- New CRM Search collector: `POST /crm/v3/objects/notes/search` with `hs_lastmodifieddate` filters
- Local inclusive/exclusive filter + ID tiebreaker for deterministic range semantics
- Per-dataset watermark table + immutable cutoff columns on `fi_external_hubspot_sync_runs`

Does **not** silently fall back to full-history pagination when incremental args are missing/invalid.

---

## 3. Files changed

| Path | Role |
|------|------|
| `supabase/migrations/202610189001_hubspot_incremental_backup_watermarks.sql` | Watermark table + incremental run columns + active-run unique index |
| `src/lib/onboarding-os/hubspotIncrementalBackupCore.ts` | Pure cutoff/watermark/filter helpers |
| `src/lib/onboarding-os/hubspotIncrementalBackup.server.ts` | Orchestration |
| `src/lib/onboarding-os/hubspotConnector.server.ts` | Public CLI entrypoints |
| `src/lib/onboarding-os/hubspotBackupEngine.server.ts` | `hubspotPostJson` |
| `src/lib/onboarding-os/hubspotEngagementBackupEngine.server.ts` | Export `stageHubspotNotesPage` |
| `scripts/hubspot-backup-incremental.ts` | Incremental CLI |
| `scripts/hubspot-backup-resume.ts` | Resume CLI |
| `scripts/hubspot-backup-recover-stuck.ts` | Stuck recovery CLI |
| `package.json` | npm scripts + `test:hubspot-incremental` |
| `src/lib/onboarding-os/hubspotIncrementalBackupCore.test.ts` | Unit tests |
| `src/lib/onboarding-os/hubspotIncrementalBackup.server.test.ts` | Orchestration tests |
| `docs/runbooks/hubspot-incremental-backup.md` | Operator runbook |
| `docs/audits/evidence-fi-hubspot-incremental-backup-implementation.md` | This evidence |

---

## 4. Schema changes

**Table `fi_external_hubspot_backup_watermarks`**

- Unique `(tenant_id, source_system, dataset)`
- Fields: `watermark_timestamp`, `watermark_tiebreaker`, `last_successful_run_id`, `last_verified_run_id`, `version`, timestamps
- No speculative backfill

**Columns on `fi_external_hubspot_sync_runs`**

- `backup_run_type`, `incremental_dataset`, `incremental_cutoff_from`, `incremental_cutoff_to`, `incremental_verification_state`, `incremental_checkpoint`

**Concurrency**

- Unique index `uq_hubspot_incremental_active_run` on `(tenant_id, integration_id, incremental_dataset)` where `status='started' and backup_run_type='incremental'`

Additive only. Phase O staging rows untouched. Rolling back app code leaves the table/columns harmless.

---

## 5. CLI commands

```bash
npm run hubspot:backup:incremental -- --dataset notes --cutoff-from <UTC> --cutoff-to <UTC>
npm run hubspot:backup:resume -- --run-id <uuid>
npm run hubspot:backup:recover-stuck -- --run-id <uuid> --reason "<text>" [--to failed|started]
npm run test:hubspot-incremental
```

Requires `FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID` for live CLIs.

---

## 6. Cutoff semantics

| Rule | Value |
|------|-------|
| Lower | Inclusive `updatedAt >= cutoff_from` |
| Upper | Exclusive `updatedAt < cutoff_to` |
| Input | Explicit ISO-8601 with `Z` or numeric offset only |
| Normalization | Stored/compared as UTC ISO |
| HubSpot search | `hs_lastmodifieddate` GTE/LT (epoch ms) + local filter |
| Tiebreaker | `(updatedAt ASC, hubspot_record_id ASC)` |
| Archived notes | Not in Search path (v1); full backup remains authoritative for archived inventory |

---

## 7. Watermark rules

Advance only when:

1. Pagination complete
2. Staging complete
3. Run finalised to `completed`
4. Verification state `passed`
5. No unresolved failures

New watermark = `cutoff_to` (exclusive upper bound becomes next inclusive lower for subsequent ranges when operators chain windows).

Does **not** advance on `started`, `partial`, `failed`, verification failure, or stuck recovery.

---

## 8. Resume behaviour

- Loads run by ID + tenant + integration
- Requires `backup_run_type=incremental` and `status=started`
- Reloads immutable `incremental_cutoff_from` / `incremental_cutoff_to`
- Rejects widened/replaced cutoffs
- Continues from `incremental_checkpoint` (`searchAfter`, `lastUpdatedAt`, `lastId`)
- Never advances watermark early

---

## 9. Stuck-run recovery

- Age threshold: 30 minutes
- Requires explicit `--reason` (≥8 chars) and run ID
- Transitions to `failed` or keeps `started` for resume
- Retains checkpoints
- Records `stuck_run_recovered`
- Refuses completed runs
- Never advances watermark

---

## 10. Concurrency protection

Unique active incremental run per tenant + integration + dataset. Overlap → fail-closed, non-zero exit, no watermark mutation.

---

## 11. Notes canonical identity

`(tenant_id, integration_id, hubspot_record_id)` — existing unique constraint on `fi_external_hubspot_note_staging`.

Counters distinguish `inserted` / `updated` / `unchanged` / `failed` via pre-read `payload_checksum`.

---

## 12. Verification-event coverage

Privacy-safe events via `fi_external_connector_verification_events` with `detail.verification_mode = incremental_backup`:

`run_created`, `run_started`, `page_checkpointed`, `run_resumed`, `finalisation_completed`, `verification_passed`, `verification_failed`, `watermark_advanced`, `run_failed`, `stuck_run_recovered`

No note bodies in events.

---

## 13. Test matrix

| # | Case | Result |
|---|------|--------|
| 1–5 | UTC accept / reject / range order | PASS |
| 6–8 | Empty range + watermark after verify | PASS |
| 9–10 | Insert + same-range unchanged | PASS |
| 11–12 | Finalize failure → no watermark | PASS |
| 13–14 | Resume cutoff preservation | PASS |
| 15 | Stuck recovery no watermark | PASS |
| 16 | Concurrent active run conflict | PASS |
| 17–18 | Equal-timestamp ordering / tiebreaker | PASS |
| 19 | Dataset gate (notes only) | PASS |
| 20 | Upsert classification | PASS |

Command: `npm run test:hubspot-incremental` → **21 passed**.  
Also: engagement + primary backup engine tests **9 passed**; `tsc --noEmit` OK; `check:migrations` OK.

---

## 14. Deployment prerequisites

1. Apply migration `202610189001_hubspot_incremental_backup_watermarks.sql` to production
2. Deploy application commit containing this milestone
3. Confirm Vercel READY + SHA
4. Re-run P1 production observation (non-mutating smoke)
5. Only then execute Stage P2 controlled notes proof with explicit cutoffs

---

## 15. Production-write statement

This task did **not**:

- create HubSpot objects
- run a production incremental or full backup
- add schedules/cron
- deploy
- change production env vars
- reopen forms/submissions/files/contact-association reconciliation

---

## 16. Remaining risks

| Risk | Class | Notes |
|------|-------|-------|
| Search API vs list property lag | AMBER | Local filter mitigates; monitor P2 |
| Archived notes not in incremental search | AMBER | Documented; full backup covers archived |
| Watermark/finalize not single DB transaction | AMBER | Finalize precedes watermark; failure after finalize before watermark leaves completed run without watermark (safe, re-runnable) |
| HubSpot sorts support for dual sort keys | AMBER | Tiebreaker also applied locally |
| Multi-tenant CLI defaults to Evolved IDs | AMBER | Explicit `--tenant-id` supported |

No RED skip/duplicate/cutoff-mutation issues identified in tests.

---

## 17. Exact next gate

Deploy the incremental-backup implementation through Vercel Git integration or CI, confirm READY and deployed SHA, rerun the P1 production observation, then execute the Stage P2 controlled notes proof.

**Do not claim Stage P2 GREEN from this evidence.**
