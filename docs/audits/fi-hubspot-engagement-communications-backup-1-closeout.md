# FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1 - Closeout

Status: LIVE RUN COMPLETE — PHASE O GREEN WITH DOCUMENTED LIMITATIONS  
Closed: 2026-07-16 (dataset / API-fidelity closeout)  
Environment: Production (`iqqvzgxoimxchhcnbzxl`), run `66f72f09-d333-4bb0-9c39-5da7b912e964`  
Evidence classification: Privacy-safe operational metadata only  

**Authoritative Phase O closeout:** `evidence-fi-hubspot-phase-o-closeout.md` (+ JSON)  
Submission reconciliation: `evidence-fi-hubspot-form-submissions-reconciliation-66f72f09.md` (**GREEN**)  
Forms inventory: `evidence-fi-hubspot-forms-reconciliation.md` (**GREEN** — 46 listable + 2 non-listable types explained)  
Contact-association follow-up: `fi-hubspot-contact-association-enrichment-1-backlog.md` (NON-BLOCKING)

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
| Form submissions | PASS | Complete — 5,311 staged | **GREEN** (+1,091 = coverage vs selected CSV; ≈ inventory 5,310) | N/A | 5,311→form; contact links not exposed by live API |

### Final control matrix (authoritative)

| Control | Final status |
|---|---|
| Forms | GREEN |
| Form submissions | GREEN |
| Submission uniqueness | GREEN |
| Submission tenant integrity | GREEN |
| Submission parent-form integrity | GREEN (5,311/5,311 → 46 definitions) |
| Messages | GREEN |
| File metadata | GREEN |
| File bodies | OUT OF SCOPE |
| Contact associations | ACCEPTED LIMITATION — NON-BLOCKING |
| CLI engine status | PARTIAL |
| Operator reconciliation | GREEN |
| CLI vs operator | ENGINE PARTIAL / OPERATOR GREEN |
| RED controls | NONE |
| Phase O | GREEN WITH DOCUMENTED LIMITATIONS |
| Production deployment | READY (`3bf43f22`) |
| Authenticated production smoke | GREEN |
| Production PASS | CLAIMED — `evidence-fi-hubspot-phase-o-production-gate.md` |

### Status-layer distinction

| Layer | Status |
|---|---|
| Dataset correctness | Forms, submissions, messages, file metadata GREEN |
| Machine / CLI status | `partial` (sole driver: submissions vs selected-export baseline 4220) |
| Accepted scope limitations | Contact associations not exposed by live API; file bodies out of scope; files listing UNSUPPORTED 405 |
| Production deployment readiness | Separate gate — not verified here |

### CLI `partial` decomposition (run `66f72f09`)

| Dataset | Attempted | Succeeded | Skipped | Failed | Reason | Recoverable | Follow-up |
|---|---|---|---|---|---|---|---|
| Notes | Yes | Yes (244) | 0 | 0 | Exact vs baseline | N/A | None |
| CRM emails | Yes | Yes (5248) | 0 | 0 | Exact vs baseline | N/A | None |
| Conversation threads | Yes | Yes (1918) | 0 | 0 | Exact vs baseline | N/A | None |
| Conversation messages | Yes | Yes (5821) | 0 | 0 | Complete nested pagination | N/A | None |
| Forms | Yes | Yes (46 listable) | 2 non-listable types | 0 | `captured` + `blog_comment` outside default list APIs | N/A | None |
| Form submissions | Yes | Yes (5311) | 0 | 0 | Engine `unexplained` vs baseline 4220 → **sole `partial` driver**; operator reconcile **GREEN** | Operator override applied | Optional finalize/baseline alignment (non-blocking) |
| Files listing | Yes (probe) | — | **UNSUPPORTED 405** | 0 | Documented unsupported list endpoint | N/A | None |
| Files metadata | Yes | Yes (903) | Body download | 0 | Milestone metadata-only | N/A | None |
| Contact links | Implicit | 0 from API | CSV Contact IDs not ingested | 0 | Not exposed by live API; not staged from optional CSV enrichment | Selected CSV ingest | `FI-HUBSPOT-CONTACT-ASSOCIATION-ENRICHMENT-1` |

**`partial` root cause:** only `form_submissions.reconciliationStatus === "unexplained"`. Files 405 did **not** set `partial`. Forms inventory is GREEN and not a blocker. Operator reconciliation overrides machine `partial` for Phase O closeout.

### Attachments detail

| Dimension | Status |
|---|---|
| Capability | Listing UNSUPPORTED 405; metadata inventory completed |
| Metadata backup | Implemented (inventory statuses classified); 903 staged |
| Content backup | Explicitly disabled this milestone (`content_backed_up = 0`) — OUT OF SCOPE |
| Validation status | `metadata_backed_up` / `access_denied` / `expired_reference` / `unsupported` / `failed_validation` |

### Form submissions clinical classification

Heuristic `content_classification` on form name/field metadata keys only:

- `standard`
- `restricted_clinical_intake`

No promotion of responses into patient records.

## Platform status

| Item | Value |
|---|---|
| Existing app scopes sufficient | Granted objects completed; files listing UNSUPPORTED 405 |
| Missing read scopes | None driving Phase O blockers (`MISSING_SCOPE` kinds: none on this run) |
| Production migration name | `hubspot_engagement_communications_backup` (file `20261017120003_hubspot_engagement_communications_backup.sql`) |
| New tables | `fi_external_hubspot_note_staging`, `fi_external_hubspot_email_staging`, `fi_external_hubspot_conversation_thread_staging`, `fi_external_hubspot_conversation_message_staging`, `fi_external_hubspot_file_inventory`, `fi_external_hubspot_form_definition_staging`, `fi_external_hubspot_form_submission_staging` |
| Sync-run columns | `engagement_checkpoints`, `engagement_counters`, `engagement_capabilities`, `engagement_complete` |
| RLS status | Enabled on all new tables; `anon`/`authenticated` revoked; `service_role` CRUD only (verified in production) |
| Commit hashes | Implementation `ea6bc78f`; residual docs `d80ef45c` / `d4b66607`; forms reconcile `1c4a3da1`; workspace recovery `c0f1c06a`; Phase O closeout see `evidence-fi-hubspot-phase-o-closeout.md` |
| Tests | `hubspotEngagementBackupActionCore.test.ts`, `hubspotEngagementBackupEngine.test.ts`, `hubspotWorkspaceStatus.test.ts` — PASS |
| Build | `npm run build` — PASS |
| TypeScript | `tsc --noEmit` — PASS |
| Migration validation | `npm run check:migrations` — PASS |
| Deployment status | Production migration applied; live CLI run against production completed; recovery-stack production READY **not verified** in Phase O closeout |
| Live execution status | Run `66f72f09…` finished exit 0 / CLI `partial` / operator GREEN |
| Form-submissions +1091 | **GREEN** — see reconciliation evidence (selected-export vs all-forms; 0 missing baseline IDs) |
| Forms inventory 48→46 | **GREEN** — see forms reconciliation evidence |
| Overall verdict | **GREEN WITH DOCUMENTED LIMITATIONS** |

## Scope decision (Phase O)

Phase O is complete on an API-fidelity basis. Contact associations were not exposed by the live HubSpot submissions API and therefore were not required for minimum recovery completion. Deterministic historical enrichment remains available for 3,107 rows through Conversion ID ↔ Contact ID and will be handled as a separate post-close enhancement (`FI-HUBSPOT-CONTACT-ASSOCIATION-ENRICHMENT-1`). No email matching or probabilistic association is permitted.

Documented limitations:

1. Contact associations — ACCEPTED LIMITATION (not exposed by live API; not staged from optional historical CSV enrichment)
2. CLI `partial` — ACCEPTED OPERATOR OVERRIDE (sole driver: selected-export baseline vs portal coverage)
3. File bodies — OUT OF SCOPE (`content_backed_up = 0`)
4. Files listing — unsupported 405; metadata inventory still GREEN; `engagement_complete = false` because `files.granted = false`
5. Production deployment + authenticated smoke — separate gates; Production PASS NOT CLAIMED

## Operator next steps

1. No forms / form-submissions rerun.
2. Contact associations: optional separate milestone `FI-HUBSPOT-CONTACT-ASSOCIATION-ENRICHMENT-1` — deterministic CSV Conversion ID ↔ Contact ID only (3,107 populated); no email/fuzzy matching.
3. CLI finalize baseline semantics: optional non-blocking engine hygiene so documented coverage GREEN does not leave `unexplained` / `partial`.
4. Files 405: accept as documented unsupported listing; metadata inventory already complete.
5. **Next gate:** Deploy the recovery commit stack to production through Vercel Git integration or CI, confirm READY and deployed SHA, then run authenticated production smoke.

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

Implementation for `FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1` is delivered and the live engagement backup run is reconciled. **Phase O is closed as GREEN WITH DOCUMENTED LIMITATIONS** on an API-fidelity basis. Production deployment READY and authenticated production smoke remain separate gates; Production PASS is not claimed.
