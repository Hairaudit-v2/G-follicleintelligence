# FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1 - Closeout

Status: LIVE RUN COMPLETE — PHASE O AMBER  
Closed: not yet  
Environment: Production (`iqqvzgxoimxchhcnbzxl`), run `66f72f09-d333-4bb0-9c39-5da7b912e964`  
Evidence classification: Privacy-safe operational metadata only  
Submission reconciliation: `evidence-fi-hubspot-form-submissions-reconciliation-66f72f09.md` (**GREEN**)  
Forms inventory: `evidence-fi-hubspot-forms-reconciliation.md` (**GREEN** — 46 listable + 2 non-listable types explained)

## Delivery summary

Additive parallel milestone on the existing HubSpot connector:

- Existing encrypted credential path reused (no new private app / connector)
- Restricted staging tables + service-role-only RLS
- Live capability probes and operator-gated resumable backup
- Workspace Backup & Sync + Audit sections (counts/metadata only; no content)
- No promotion into FI timelines, CRM, patients, documents, or clinical records
- Attachment path is metadata-only (`content_backed_up` remains 0)

## Phase O — Object matrix

| Object | Capability | Full backup | Reconciliation | Archived support | Associations |
|---|---|---|---|---|---|
| Notes | PASS | Complete — 244 staged | Exact vs 244 | Supported | 159 edges |
| CRM emails | PASS | Complete — 5,248 staged | Exact vs 5,248 | Supported | 7,515 edges |
| Conversation threads | PASS | Complete — 1,918 staged | Exact vs 1,918 | Supported | 1,918 edges |
| Conversation messages | PASS | Complete — 5,821 staged | Exact (no manual baseline) | N/A | 5,821 edges; 1,336 attachment refs |
| Attachments / files | UNSUPPORTED listing (405); metadata inventory from refs | 903 inventory rows; `content_backed_up=0` | Exact vs discovered refs | N/A | file ↔ source |
| Forms | PASS | Complete — 46 staged | **GREEN** vs export 48 (2 = `captured` + `blog_comment`, not in default list APIs) | When API provides | definitions staged |
| Form submissions | PASS | Complete — 5,311 staged | **GREEN** (+1,091 = coverage vs selected CSV; ≈ inventory 5,310) | N/A | 5,311→form; contact links 0 |

### Dataset / control verdicts

| Dataset/control | Verdict |
|---|---|
| Messages | GREEN (manifest check pending optional hash refresh) |
| Form submissions | GREEN |
| Submission uniqueness | GREEN |
| Submission tenant integrity | GREEN |
| Submission parent-form integrity | GREEN (5,311/5,311 → 46 definitions) |
| Forms inventory | **GREEN** — 48 export = 46 listable + `captured` + `blog_comment` |
| Contact associations | AMBER — unavailable in Forms Submissions API payload (`contactId` absent) |
| Files | GREEN for metadata inventory / `content_backed_up=0` (listing endpoint UNSUPPORTED 405) |
| CLI completion status | AMBER — causes enumerated below |
| Overall Phase O | **AMBER** |
| RED controls | None currently identified |

### CLI `partial` decomposition (run `66f72f09`)

| Dataset | Attempted | Succeeded | Skipped | Failed | Reason | Recoverable | Follow-up |
|---|---|---|---|---|---|---|---|
| Notes | Yes | Yes (244) | 0 | 0 | Exact vs baseline | N/A | None |
| CRM emails | Yes | Yes (5248) | 0 | 0 | Exact vs baseline | N/A | None |
| Conversation threads | Yes | Yes (1918) | 0 | 0 | Exact vs baseline | N/A | None |
| Conversation messages | Yes | Yes (5821) | 0 | 0 | Complete nested pagination | N/A | None |
| Forms | Yes | Yes (46 listable) | 2 non-listable types (`captured`, `blog_comment`) | 0 | Default Forms list APIs return 46; export listing-lib includes 2 extra types with 0 submissions | N/A | None for Phase O |
| Form submissions | Yes | Yes (5311) | 0 | 0 | Engine marked `unexplained` vs selected baseline 4220 → **forced CLI partial** even though operator reconcile is GREEN | Yes (baseline semantics / counter logic) | Optionally reclassify baseline or accept documented coverage |
| Files | Yes (metadata) | Yes (903 inventory) | Listing probe UNSUPPORTED 405 | 0 | Classified unsupported; content not downloaded | N/A | None for bodies |
| Contact links on submissions | Implicit | 0 links | N/A | 0 | Source payload has no `contactId` | Future enrichment only | Deterministic source only |

**Did the two-form delta alone cause `partial`?** Not proven as the sole cause. The finalize path sets `partial` when any supported kind has `reconciliationStatus === "unexplained"` (form_submissions vs 4220) **or** incomplete/missing-scope. Forms were `explained` (−2), not unexplained. Forms inventory BLOCKED remains a Phase O gate independent of that flag.

### Attachments detail

| Dimension | Status |
|---|---|
| Capability | Pending live probe |
| Metadata backup | Implemented (inventory statuses classified) |
| Content backup | Explicitly disabled this milestone (`content_backed_up = 0`) |
| Validation status | `metadata_backed_up` / `access_denied` / `expired_reference` / `unsupported` / `failed_validation` |

### Form submissions clinical classification

Heuristic `content_classification` on form name/field metadata keys only:

- `standard`
- `restricted_clinical_intake`

No promotion of responses into patient records.

## Platform status

| Item | Value |
|---|---|
| Existing app scopes sufficient | **PARTIAL** (awaiting live probe; partial scopes allowed to run) |
| Missing read scopes | Unknown until operator runs **Check engagement backup access** |
| Production migration name | `hubspot_engagement_communications_backup` (file `20261017120003_hubspot_engagement_communications_backup.sql`) |
| New tables | `fi_external_hubspot_note_staging`, `fi_external_hubspot_email_staging`, `fi_external_hubspot_conversation_thread_staging`, `fi_external_hubspot_conversation_message_staging`, `fi_external_hubspot_file_inventory`, `fi_external_hubspot_form_definition_staging`, `fi_external_hubspot_form_submission_staging` |
| Sync-run columns | `engagement_checkpoints`, `engagement_counters`, `engagement_capabilities`, `engagement_complete` |
| RLS status | Enabled on all new tables; `anon`/`authenticated` revoked; `service_role` CRUD only (verified in production) |
| Commit hashes | Pushed implementation `ea6bc78f`; resume used uncommitted pagination/resume fixes (patched in evidence freeze) |
| Tests | `hubspotEngagementBackupActionCore.test.ts`, `hubspotEngagementBackupEngine.test.ts`, `hubspotWorkspaceStatus.test.ts` — PASS |
| Build | `npm run build` — PASS |
| TypeScript | `tsc --noEmit` — PASS |
| Migration validation | `npm run check:migrations` — PASS |
| Deployment status | Production migration applied; live CLI run against production completed |
| Live execution status | Run `66f72f09…` finished exit 0 / CLI `partial` |
| Form-submissions +1091 | **GREEN** — see reconciliation evidence (selected-export vs all-forms; 0 missing baseline IDs) |
| Forms inventory 48→46 | **GREEN** — see forms reconciliation evidence |
| Overall verdict | **AMBER** (contact-link + CLI partial semantics remain) |

## Why not full GREEN

GREEN requires:

1. Live capabilities verified — yes for granted objects; files listing remains UNSUPPORTED 405
2. All supported objects complete pagination — yes for this run
3. Runs finalize correctly — CLI `partial` (finalize semantics / residuals)
4. Reconciliation exact or fully explained — submissions +1091 explained GREEN; forms −2 still residual
5. No communication content exposed — confirmed (`content_backed_up=0`; UI/logs counts only)
6. No records promoted — confirmed
7. Attachment handling classified — metadata-only confirmed
8. No required scope remains unresolved after operator probe — scopes granted; residual is API shape for contactId on submissions + forms inventory gap

Items 1–4 and 8 remain pending operator action.

## Operator next steps

1. No forms / form-submissions rerun.
2. Contact AMBER: optional separate ingest of selected-export CSV `Conversion ID` ↔ `Contact ID` (3,107 populated) — no email matching.
3. CLI AMBER: optional finalize change so documented coverage GREEN does not leave `unexplained` / `partial`.
4. Files 405: accept as documented unsupported listing; metadata inventory already complete.

CLI alternatives (trusted service runner only):

```bash
# probe only
pnpm exec tsx -r ./scripts/patch-server-only-for-scripts.cjs scripts/hubspot-engagement-communications-backup.ts --probe-only

# full backup (operator intent required)
pnpm exec tsx -r ./scripts/patch-server-only-for-scripts.cjs scripts/hubspot-engagement-communications-backup.ts
```

Requires `FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID`.

## Rollback instructions

1. Stop using engagement backup UI actions / CLI.
2. Application rollback to prior deploy.
3. Database rollback (after app rollback):
   - Restore association `from_object_type` / `to_object_type` checks to secondary-only set
   - Drop the seven engagement staging/inventory tables
   - Drop `engagement_checkpoints`, `engagement_counters`, `engagement_capabilities`, `engagement_complete` from `fi_external_hubspot_sync_runs`
4. Staged engagement data is discarded with table drop; primary/secondary backups are unaffected.

## Safety confirmation (design + schema)

- Restricted staging only; `promotion_enabled: false`
- No UI rendering of note/email/message/form/attachment content
- Provider response bodies not retained in error/evidence paths
- Credential path unchanged
- Secondary milestone semantics unchanged (`SECONDARY` classifier preserved)

## Closure decision

Implementation for `FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1` is delivered and production schema is applied. Milestone remains **AMBER** until the authorised clinic operator completes live capability verification and the engagement backup run with exact or explained reconciliation.
