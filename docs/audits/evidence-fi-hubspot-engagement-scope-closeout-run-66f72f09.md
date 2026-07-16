# Evidence freeze — engagement scope closeout run `66f72f09`

**Frozen:** 2026-07-16 (operator closeout; do not delete staging or this evidence before Phase O sign-off)  
**Milestone:** `FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-SCOPE-CLOSEOUT-1`  
**Related:** `FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1`, `FI-HUBSPOT-BACKUP-1`

Companion artifacts (same directory):

| File | Purpose |
|------|---------|
| `evidence-fi-hubspot-engagement-scope-closeout-run-66f72f09-sync-run.json` | Compact freeze snapshot + baselines |
| `evidence-fi-hubspot-engagement-scope-closeout-run-66f72f09-final-process-output.json` | Exact CLI final JSON |
| `evidence-fi-hubspot-engagement-scope-closeout-run-66f72f09-terminal.txt` | Full terminal session (exit 0) |
| `evidence-fi-hubspot-engagement-scope-closeout-run-66f72f09-uncommitted.patch` | Working-tree diff used at runtime beyond pushed SHA |

Staging tables and original `FI-HUBSPOT-BACKUP-1` exports were **not** deleted.

---

## 1. Frozen identifiers

| Field | Value |
|------|-------|
| Backup run ID | `66f72f09-d333-4bb0-9c39-5da7b912e964` |
| CLI / process status | `partial` (exit code `0`) |
| Source system | HubSpot portal `21009770` |
| Destination Supabase project | `iqqvzgxoimxchhcnbzxl` (`https://iqqvzgxoimxchhcnbzxl.supabase.co`) |
| Tenant ID | `c2615b95-b707-4485-aa5f-be8f78ec868a` |
| Integration ID | `ade8a7d0-ad45-4fd7-8d53-61d4806b95f6` |
| Process start (shell) | `2026-07-15T23:33:00.607Z` |
| Process end (shell) | `2026-07-16T00:09:24.954Z` |
| Elapsed | `2,184,347` ms (~36.4 min for this resume process) |
| Last checkpoint (DB) | `2026-07-16 00:06:25.375+00` (files phase still finishing through process end) |
| Completed_at (DB) | Set by finalize path when status left `started` — treat CLI output below as authoritative for this freeze |
| Pushed commit SHA | `ea6bc78fb367a9af943a5729c4921cc89e5abc4a` |
| Branch | `codex/fi-hubspot-live-sync-recovery` |
| Runtime code note | Resume also used **uncommitted** fixes (stalled-cursor advance, resume `started` runs, finalize vs `UNSUPPORTED`). Patch frozen beside this file. |
| Terminal log SHA-256 | `02F44273BC2BE5A49E549589231E2D24831CC0A56A60F2F6A9AD4AD8A6C7EACA` |
| Manual backup manifest | `FI-HUBSPOT-BACKUP-1/manifest-and-verification/backup-manifest.txt` |

### Manual backup baselines used by the engine

Hard-coded in `ENGAGEMENT_MANUAL_BASELINES`:

| Kind | Baseline |
|------|----------|
| notes | 244 |
| emails (CRM email activities) | 5248 |
| conversation_threads | 1918 |
| forms | 48 |
| form_submissions | **4220** |

Forms inventory (same manifest) also records **Total recorded submissions: 5,310** across all 48 forms — this was **not** the engine baseline for submissions.

---

## 2. Final process counters (frozen)

From CLI final output (`status: partial`). `contentBackedUp = 0` for every kind. No file body download.

| Kind | discovered | staged | skipped | failed | distinctIds | associations | attachmentRefs | recon | exportDifference | baseline |
|------|------------|--------|---------|--------|-------------|----------------|----------------|-------|------------------|----------|
| notes | 244 | 244 | 0 | 0 | 244 | 159 | 0 | exact | 0 | 244 |
| emails | 5248 | 5248 | 0 | 0 | 5248 | 7515 | 1898 | exact | 0 | 5248 |
| conversation_threads | 1918 | 1918 | 0 | 0 | 1918 | 1918 | 0 | exact | 0 | 1918 |
| conversation_messages | 5821 | 5821 | 0 | 0 | 5821 | 5821 | 1336 | exact | null | null |
| forms | 46 | 46 | 0 | 0 | 46 | 0 | 0 | explained | −2 | 48 |
| form_submissions | 5311 | 5311 | 0 | 0 | 5311 | 5311 | 0 | unexplained | **+1091** | **4220** |
| files (metadata inventory) | 1033 | 903 | 0 | 0 | 903 | 903 | 903 | exact | null | null |

### Staging table row counts at freeze (SQL)

| Table / object | Rows | Distinct IDs |
|----------------|------|--------------|
| notes | 244 | — |
| emails | 5248 | — |
| threads | 1918 | — |
| messages | 5821 | — |
| form definitions | 46 | — |
| form submissions | 5311 | 5311 |
| file inventory | 903 | — |

### Checkpoint / resume state (summary)

- Notes / emails / threads: phases complete; counters mark reconciliation complete/exact (some checkpointStatus fields still `in_progress` in counter JSON — cosmetic inconsistency, objects marked `complete: true`).
- Conversation messages: phase `complete`, `thread_index` reached end of 1918 threads.
- Forms: phase `complete`.
- Form submissions: phase `complete`.
- Files: built from attachment references (+ discovery); `complete: true`, `contentBackedUp: 0`.

---

## 3. What the two submission counts actually represent

### Verdict: **not like-for-like**

| Dimension | Export baseline **4220** | Live backup **5311** |
|-----------|--------------------------|----------------------|
| What was counted | Distinct submission **events** in **selected** HubSpot form CSV exports | Distinct HubSpot submission/conversion IDs returned by Forms Submissions API for **every form ID** present in `fi_external_hubspot_form_definition_staging` (46 forms) |
| Form coverage | **13 high-value forms** intentionally exported | **All forms** retrieved via API (46 staged; inventory had 48) |
| Source artifact | Per-form CSVs under `FI-HUBSPOT-BACKUP-1/record-exports/forms-and-submissions/submissions/**` | `/form-integrations/v1/submissions/forms/{formId}` paginated (`limit=50`) |
| Unit of identity | Conversion IDs in CSV (manifest: unique conversion IDs preserved) | `conversionId` / `submissionId` / `id` → `hubspot_submission_id` (unique per `(form_id, submission_id)`) |
| Revisions | One CSV row per exported submission event; no revision model visible | One API result row per submission event; upsert on conflict; not a revision ledger |
| Deleted / archived | Manual export of then-available submissions; no archived flag model in CSVs | Engine sets `archived: false` always for submissions; API path does not use CRM “archived” listing |
| Test / partial | Included if present in the selected CSVs | Included if HubSpot API returns them for a form |
| Inactive / unpublished forms | Only if that form was among the 13 selected | Only if listed by forms API into the 46 staged definitions |
| Point-in-time | Export dated **2026-07-15**; selected secure count frozen in manifest as 4,220 | Live pull during resume finishing **2026-07-16T00:09Z**; appointment booking alone is 1585 staged vs 1584 CSV (+1) |

### Arithmetic check on the baseline

Re-counted local CSVs (data rows via `Import-Csv`):

| Selected form export | Rows |
|----------------------|------|
| Appointment booking | 1584 |
| Evolved transplant LP 2023 | 932 |
| Perth pre-consultation | 420 |
| eBook download | 393 |
| Brisbane transplant LP | 300 |
| Perth new LP | 269 |
| Brisbane pre-consultation | 106 |
| Post-consultation survey | 97 |
| Form 2 | 49 |
| Post-surgery survey | 45 |
| Eyebrow transplant LP | 15 |
| Contact us | 9 |
| Questionnaire | 1 |
| **Sum** | **4220** |

Manifest Step 9 explicitly: *“Distinct submission events secured: 4,220”* and *“Low-value remaining forms intentionally excluded: Yes”*.

### Why live ≈ inventory total, not 4220

| Source | Count |
|--------|-------|
| Forms inventory “Total recorded submissions” | **5310** |
| Live API staging rows / distinct IDs | **5311** |
| Selected-export baseline | **4220** |
| Difference live − baseline | **+1091** |

So the engine’s `unexplained +1091` is primarily **coverage drift** (all API forms vs selected CSV set), not unexplained duplicates inside staging:

- Staging: `5311` rows = `5311` distinct `hubspot_submission_id`.
- Live vs inventory portal total: **+1** (timing / one additional appointment-booking event vs CSV).

The unused remainder ≈ `5310 − 4220 = 1090` matches the engine delta within 1.

### Forms 48 → 46

Inventory: 48 published forms. Live staged definitions: 46 (`explained`, exportDifference −2). Submission coverage is still essentially portal-wide for returned API forms, not limited to the 13 CSV forms.

---

## 4. Operator implications (do not rerun yet)

1. Keep staging / evidence frozen.
2. Reclassify submission reconciliation: baseline **4220** is a **selected-export** control total; like-for-like control against portal inventory is **5310** (or a new frozen all-forms inventory).
3. Optionally map the 13 CSV conversion-ID sets into staging for subset reconcile (exactness on the high-value set) — separate from portal-wide completeness.
4. Forms −2 still needs a short explained note (which 2 inventory forms the API did not return) before Green.
5. Do not treat +1091 as data loss or overcount until coverage semantics above are recorded in Phase O.
