# FI-HUBSPOT-IMPORT-1E-W — Watermark provenance and scope reconciliation

**Verdict:** AMBER  
**Watermark recommendation:** `retain_current_watermark`  
**Date:** 2026-07-16  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a`  
**Integration:** `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6`  
**E11 audit commit:** `4fc4fcbc` (on `origin/main` before this gate)

## Required answers

| # | Question | Finding |
|---|----------|---------|
| 1 | Which run advanced the watermark? | `916c3102-548d-4758-9339-7f1e24d4d1d0` |
| 2 | Actor / process | Vercel Cron → `/api/cron/hubspot/incremental-notes-backup`; actor auth `d82c54e2-7347-4fc4-b93a-c75ceecb3731`; labels `HubSpot recovery service` / `HubSpot scheduled incremental backup` |
| 3 | Run ID | `916c3102-548d-4758-9339-7f1e24d4d1d0` |
| 4 | Start / complete | `2026-07-16T16:00:34.679Z` → `2026-07-16T16:00:37.032Z` |
| 5 | Datasets | `notes` only |
| 6 | Global or dataset-specific? | Tenant + source_system + dataset (`notes`); not a contact watermark |
| 7 | Source cutoff | Logged `cutoff_from=2026-07-16T03:20:00.000Z`, `cutoff_to=2026-07-16T16:00:34.530Z` |
| 8 | Expected under backup policy? | Yes — daily `0 16 * * *` empty-success advances notes watermark after verification |
| 9 | Did migration write watermark? | No — 1E allowlist excludes watermark table; E11 before/after identical |
| 10 | Contacts created in interval? | Live HubSpot: **1** (`229761370222`) |
| 11 | Included in 4,750 inventory? | **No** — not in contact staging |
| 12 | Classification changes after advance? | Staging inventory aggregates unchanged except E11 link apply (472 ready→applied). Live HubSpot shows 21 modified contacts; 2 absent from staging |
| 13 | Contacts skipped via stale inventory? | **Yes (2)** live contacts outside staging snapshot |
| 14 | Mappings from older snapshot than watermark? | Contact staging max `hubspot_updated_at` is `2026-07-15T03:26:27.759Z`; notes watermark is later. Mappings were built from staging, not from the notes watermark |
| 15 | Safe to retain current watermark? | **Yes for notes**. Contact staging freshness is a separate follow-up |

## Ownership model

Table: `fi_external_hubspot_backup_watermarks`  
Unique key: `(tenant_id, source_system, dataset)`  
Implemented dataset: `notes` only  

Current row:

| Field | Value |
|-------|-------|
| watermark_timestamp | `2026-07-16T16:00:34.53+00:00` |
| previous programme baseline | `2026-07-16T03:45:02.366+00:00` |
| last_verified_run_id | `916c3102-548d-4758-9339-7f1e24d4d1d0` |
| version | 4 |
| updated_at | `2026-07-16T16:00:37.498+00:00` |

This is **not** contact coverage and must not be treated as such.

## Owning-run attribution

| Field | Value |
|-------|-------|
| Trigger | scheduled (`vercel_cron`) |
| Deployment | `dpl_3Pmfhw4yzaoefYUnkyATUrdo7Jvm` (`74638e0e`) |
| Status | `completed` |
| Verification | `passed` |
| Empty range | `true` |
| Attempts | 1 |
| Counters | all zero |
| Watermark commit event | `2026-07-16T16:00:38.083Z` (`watermark_advanced`) |
| Scheduled outcome | `empty_success` |
| Next expected run | `2026-07-17T16:00:00.000Z` |

Controls held for the notes run:

- fixed UTC cutoffs persisted on the run row
- pages fetched (1 page, empty)
- counters recorded
- verification passed before watermark advance
- tenant-scoped
- retry did not rewrite cutoffs (single attempt)

### Cutoff discrepancy (AMBER limitation)

E10 apply at `2026-07-16T10:47:02Z` observed watermark `03:45:02.366`.  
The 16:00 cron logged `watermark_before` / `cutoff_from` as `03:20:00.000Z`.

Interpretation:

- Coverage impact for notes is **overlap**, not a gap (`[03:20,16:00)` includes already-covered `[03:20,03:45)`).
- Empty-range upserts remain idempotent.
- Exact reason the scheduler read `03:20` despite E10 observing `03:45` is not fully reconstructed from durable history (no watermark history table).
- Repository hardening added in this gate: monotonic no-rewind guard + zero-row optimistic-lock failure.

## Contact interval reconciliation

Interval: `[2026-07-16T03:45:02.366Z, 2026-07-16T16:00:34.530Z)`

| Metric | Count |
|--------|------:|
| Live created | 1 |
| Live modified | 21 |
| Unique live contacts | 21 |
| In staging + inventory | 19 |
| Missing from staging/inventory | 2 |
| Revalidation safe | 13 |
| Named follow-up (create/quarantine/missing) | 8 |

Missing from staging (named follow-up cohort `live_contacts_absent_from_staging`):

1. `229761370222` — created `2026-07-16T04:15:52.321Z`
2. `235542182239` — created `2026-07-16T03:21:41.141Z`, modified in interval

Mapped contacts modified in-interval kept the same unique lead target and remain `already_applied`.

Create-candidate / quarantine rows among the 21 are already in named non-link cohorts for later gates; they are not unexplained.

## Inventory A / B

| Inventory | Source | Total | Ready | Mapped | Create | Patient review | Quarantine | Signature |
|-----------|--------|------:|------:|-------:|-------:|---------------:|-----------:|-----------|
| A | post-E10 / pre-E11 aggregates | 4750 | 472 | 4124 | 46 | 4 | 104 | not preserved per-contact |
| B | live staging rebuild | 4750 | 0 | 4596 | 46 | 4 | 104 | `e66bd6d93aa78cfc9616dae2bd0b9b87e2b332317bf8d1ce5f62a171b282a2ca` |

Aggregate classification delta inside staging: exactly E11’s 472 `link_existing_lead → already_applied`.  
Unexplained staging delta: **0**.

Coverage equation (unique contact→lead entity type):

`4596 mapped + 46 create + 4 patient-review + 104 quarantined = 4750`

Confirmed:

- mapping rows are `source_entity_type=contact` / `fi_entity_type=lead` only
- unique external IDs = 4596
- wrong-tenant mappings = 0
- missing lead targets = 0
- FI leads 4706 / patients 829 unchanged during this read-only gate

## Migration non-ownership

- 1E mutation allowlist rejects `fi_external_hubspot_backup_watermarks`
- Apply path only reads watermark and fails closed if it changes mid-apply
- E11 metadata: before = after = `2026-07-16T16:00:34.53+00:00`
- No 1E code path updates backup watermarks

## Tests run (50 pass / 0 fail)

- `hubspotIncrementalBackupCore.test.ts` — including monotonic watermark rules
- `hubspotIncrementalBackup.server.test.ts` — including rewind rejection / already_at_target
- `hubspotScheduledIncrementalBackup.server.test.ts`
- `hubspotContactLeadExpansion.test.ts` — allowlist, signature, delta, coverage, revalidation

## Code hardening in this gate (repo only; no production watermark rewrite)

- `decideMonotonicWatermarkAdvance` — forbid rewind; same-range no-op
- Optimistic watermark update now fails closed on zero-row version conflict
- Inventory signature / classification delta / coverage reconciliation helpers
- Read-only contact interval scan script

## Watermark retention decision

**`retain_current_watermark`**

Rationale:

- notes advance is attributable to the expected daily cron empty success
- notes coverage is overlap-safe
- migration did not own the change
- current notes watermark must not be rewound

Not GREEN because:

1. scheduler `cutoff_from` discrepancy vs E10-observed watermark remains incompletely explained
2. live HubSpot shows 2 contacts outside the 4,750 staging inventory for the same wall-clock interval

## Remaining risks

- Contact staging is stale relative to live HubSpot; notes watermark must not be used as a contacts freshness signal
- No durable watermark history table (only current row + verification events)
- Service-role clients can still touch the watermark table outside allowlisted app paths

## Exact next gate

**Do not process the 46 create candidates yet.**

Required follow-up before or as preflight to create-candidate review:

1. Refresh / reconcile HubSpot **contact** staging for at least the two missing IDs (and preferably the 21-interval set)
2. Then open **FI-HUBSPOT-IMPORT-1E-C — Controlled new-lead candidate review**

## Evidence artifacts

- `docs/audits/evidence-fi-hubspot-import-1e-watermark-provenance.json`
- `docs/audits/.tmp-import-1e-w-contact-interval.json`
- `docs/audits/.tmp-import-1e-w-inventory-summary.json`
- Production queries via Supabase project `iqqvzgxoimxchhcnbzxl`
- Vercel runtime log for `hubspot_scheduled_incremental_notes_backup` at 16:00 UTC
