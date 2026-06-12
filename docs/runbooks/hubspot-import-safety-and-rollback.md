# HubSpot CRM import safety and rollback

This runbook covers the **scripted** HubSpot Stage 1 import (`scripts/hubspot-import-next-500.ts`), the **commit confirmation** guard, and **batch rollback** (plan + optional execute).

## Always dry-run first

1. Run a dry-run against the same CSV and selection you intend to commit:

   ```bash
   npm run hubspot:import-last-500-dry-run
   ```

   Or (first *N* rows from the CSV, not `--last`):

   ```bash
   node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/hubspot-import-next-500.ts --dry-run
   ```

2. Review the JSON: `planned_rows`, `intended_selection_mode`, `classification_counts_planned`, and any CSV-level notes.

Dry-run performs **no** `fi_import_batches` insert and **no** person/lead/patient writes.

## Commit requires `FI_HUBSPOT_IMPORT_CONFIRM=1`

Commit mode (anything **without** `--dry-run`) **refuses** to run unless:

```bash
FI_HUBSPOT_IMPORT_CONFIRM=1
```

If the variable is missing or not exactly `1`, the script prints a JSON error including:

- `intended_selection_mode` (`first_by_csv_order` or `last_by_csv_order`)
- `planned_row_count`
- `csv` path

It exits with code **1** and performs **no** database writes.

**Note:** The script still calls Supabase earlier in the flow (tenant resolution + DB-backed dry-run extension) before it can print the “missing confirm” error. If you see `TypeError: fetch failed`, fix connectivity to `NEXT_PUBLIC_SUPABASE_URL` first; `lib/supabaseAdmin` uses IPv4-first DNS and a retrying `fetch` to reduce flaky Windows failures.

Example (last 500):

```bash
FI_HUBSPOT_IMPORT_CONFIRM=1 npm run hubspot:import-last-500
```

Example (default “first N” from CSV):

```bash
FI_HUBSPOT_IMPORT_CONFIRM=1 npm run hubspot:import-next-500
```

## Do not pass `--last` through npm on Windows unless using baked scripts

On some Windows + npm versions, flags such as `--last` are mis-parsed as **npm** config (`npm warn Unknown cli config "--last"`), and the script may run **without** your intended arguments (wrong selection mode).

**Preferred:**

- `npm run hubspot:import-last-500-dry-run`
- `FI_HUBSPOT_IMPORT_CONFIRM=1 npm run hubspot:import-last-500`

**Alternative:** invoke `node` + `tsx` directly so flags reach the script:

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/hubspot-import-next-500.ts --last --dry-run
```

## Rollback: plan (read-only)

Produce a JSON audit for one `fi_import_batches.id`:

```bash
npm run hubspot:rollback-plan -- 79eb60cf-51fa-4e52-a7df-66dfb0a009f7
```

Or:

```bash
npx tsx scripts/hubspot-import-batch-rollback-plan.ts 79eb60cf-51fa-4e52-a7df-66dfb0a009f7
```

Output fields:

- `batch_id`, `batch_status`
- `counts` — rows keyed off `metadata.import_batch_id` (and related anchors)
- `blockers` — clinical / booking / imaging / prescribing / pathology / etc. links that **block** automated execute
- `proposed_delete_order` — intended delete sequence (execute script follows this)
- `safe_to_rollback` — `true` only when status is eligible and there are **no** blockers

Exit code **2** when `safe_to_rollback` is `false` (plan completed but rollback is not advised).

## Rollback: execute (destructive; manual only)

**Do not** run execute until the plan is reviewed and stakeholders agree.

1. Re-run the plan and confirm `safe_to_rollback: true`.
2. Set confirmation env to the **exact** batch UUID:

   ```bash
   FI_HUBSPOT_ROLLBACK_CONFIRM=79eb60cf-51fa-4e52-a7df-66dfb0a009f7 npx tsx scripts/hubspot-import-batch-rollback-execute.ts 79eb60cf-51fa-4e52-a7df-66dfb0a009f7
   ```

The execute script:

- **Refuses** if `FI_HUBSPOT_ROLLBACK_CONFIRM` ≠ argv batch id.
- **Refuses** for **protected** batch ids (see `PROTECTED_HUBSPOT_IMPORT_BATCH_IDS` in `scripts/hubspotImportBatchRollbackShared.ts`; includes the intended last-500 pilot).
- **Refuses** if the plan would report any clinical/booking blocker.
- Deletes only rows tied to that batch’s imported persons/leads/patients (reminder jobs, CRM leads + cascades, patients, persons), optional staging rows, then sets `fi_import_batches.status` to **`rolled_back`** and **`rolled_back_at`** (batch row is **not** deleted).

## Example batch ids (from June 2026 pilot incident)

| Role | Batch id |
|------|------------|
| **Mistaken** first-500 script import (wrong npm flags) | `79eb60cf-51fa-4e52-a7df-66dfb0a009f7` |
| **Intended** last-500 pilot | `c65ed118-f128-42b5-8278-c54d436797a2` |

The execute script will **never** roll back `c65ed118-f128-42b5-8278-c54d436797a2` (protected id).

## References

- Import script: `scripts/hubspot-import-next-500.ts`
- Shared audit helpers: `scripts/hubspotImportBatchRollbackShared.ts`
- Plan: `scripts/hubspot-import-batch-rollback-plan.ts`
- Execute: `scripts/hubspot-import-batch-rollback-execute.ts`
