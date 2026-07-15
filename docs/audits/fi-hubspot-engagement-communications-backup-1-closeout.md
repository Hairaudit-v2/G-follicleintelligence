# FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1 - Closeout

Status: IMPLEMENTATION COMPLETE — LIVE EXECUTION PENDING OPERATOR  
Closed: not yet (awaiting live capability verification + operator backup)  
Environment: Production schema applied (`iqqvzgxoimxchhcnbzxl`)  
Evidence classification: Privacy-safe operational metadata only

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
| Notes | Pending live probe (`crm.objects.notes.read`) | Implemented, not executed | Baseline 244 — pending run | Probed when granted | contact/deal/company/ticket |
| CRM emails | Pending live probe (`crm.objects.emails.read` + aliases) | Implemented, not executed | Baseline 5,248 — pending run | Probed when granted | contact/deal/company/ticket |
| Conversation threads | Pending live probe (`conversations.read`) | Implemented, not executed | Baseline 1,918 — pending run | Probed when granted | contact/ticket (formal API fields) |
| Conversation messages | Pending live probe (`conversations.read`) | Nested pagination implemented, not executed | Pending run | N/A (message archive probe not assumed) | message ↔ conversation |
| Attachments | Pending live probe (`files` / `files.ui_hidden.read`) | Metadata inventory only | N/A | N/A | file ↔ source record |
| Forms | Pending live probe (`forms`) | Implemented, not executed | Baseline 48 — pending run | When API provides | form definitions staged |
| Form submissions | Pending live probe (`forms`) | Event-preserving upserts, not executed | Baseline 4,220 — pending run | N/A | submission ↔ form (+ contact when formal) |

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
| Commit hashes | Implementation uncommitted at closeout draft time (workspace HEAD was `bd207a03`) |
| Tests | `hubspotEngagementBackupActionCore.test.ts`, `hubspotEngagementBackupEngine.test.ts`, `hubspotWorkspaceStatus.test.ts` — PASS |
| Build | `npm run build` — PASS |
| TypeScript | `tsc --noEmit` — PASS |
| Migration validation | `npm run check:migrations` — PASS |
| Deployment status | Production migration applied via Supabase MCP; application code deploy pending |
| Live execution status | **NOT RUN** (operator-gated by design) |
| Overall verdict | **AMBER** |

## Why not GREEN

GREEN requires:

1. Live capabilities verified
2. All supported objects complete pagination
3. Runs finalize correctly
4. Reconciliation exact or fully explained
5. No communication content exposed
6. No records promoted
7. Attachment handling classified (metadata-only confirmed in code)
8. No required scope remains unresolved after operator probe

Items 1–4 and 8 remain pending operator action.

## Operator next steps

1. Deploy application code containing engagement backup actions/UI.
2. In HubSpot workspace → Backup & Sync → **Check engagement backup access**.
3. Review missing-scope warnings; add minimum HubSpot read scopes if needed (do not create a replacement private app unless scopes cannot be granted on the existing app).
4. Click **Back up engagements and communications** once.
5. Confirm run finalizes `completed` or explained `partial`; update this closeout to GREEN only after reconciliation evidence is privacy-safe and complete.

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
