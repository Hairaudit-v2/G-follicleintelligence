# Follicle Intelligence — remote migration map and push runbook

This runbook compares **hosted Supabase** project **Follicle Intelligence** (`project_ref` / `id`: `iqqvzgxoimxchhcnbzxl`, region `ap-south-1`) with migration files in `supabase/migrations/` as of the last MCP `list_migrations` snapshot taken in-repo.

## Summary

| Item | Value |
|------|--------|
| Remote migrations recorded | **82** (through `20260719120001` / `fi_medication_os_v1`; Supabase MCP `list_migrations` on `iqqvzgxoimxchhcnbzxl`) |
| Local SQL migration files | **108** (duplicate `20260813120001` on stage 9c was split — see §3) |
| **In sync?** | **No** — **22** local migration files have **no matching row** in remote history (§2). There is also a **version skew** for `fi_imaging_os` between remote history and git (§1). |

## 1. Remote-only history row (no matching local filename)

The database records this migration; the repo does **not** contain a file with this exact version prefix:

| Remote `version` | Remote `name` | Notes |
|------------------|---------------|--------|
| `20260612140001` | `fi_imaging_os` | Repo carries the same logical migration as `20260624130001_fi_imaging_os.sql`. Treat as **renamed / re-timestamped** in git after the DB was already migrated. |

## 2. Local migrations not present in remote history

These `(version|slug)` pairs exist as files under `supabase/migrations/` but were **not** returned by Supabase migration history for `iqqvzgxoimxchhcnbzxl` at snapshot time.

### 2a. “Backfill” between clinical details and later applied work

| Local file prefix | Slug |
|-------------------|------|
| `20260612120002` | `fi_staff_staff_metadata` |
| `20260612130001` | `fi_staff_feature_access_audit_events` |
| `20260624130001` | `fi_imaging_os` |

**Imaging:** remote already applied `fi_imaging_os` under `20260612140001`. The file `20260624130001_fi_imaging_os.sql` is largely additive / `IF NOT EXISTS` style DDL, but a full `db push` may still hit errors (e.g. duplicate objects, policy names). If push fails on this file, use **`supabase migration repair`** (see §4) after validating the live schema matches what the migration would create.

### 2b. Tail not yet applied on remote (after `20260719120001`)

These files extend from CRM HubSpot import through intelligence replay:

| Version | Slug |
|---------|------|
| `20260720120001` | `fi_crm_hubspot_import_centre_stage1` |
| `20260721120001` | `fi_integration_webhook_events` |
| `20260722120001` | `fi_staff_feature_access` |
| `20260723120001` | `fi_os_stage35_organisational_intelligence` |
| `20260724120001` | `fi_staff_intelligence_stage375` |
| `20260725120001` | `fi_os_stage5_clinical_intelligence` |
| `20260726120001` | `fi_os_stage6_outcome_intelligence` |
| `20260727120001` | `fi_os_stage7_revenue_payments` |
| `20260728120001` | `fi_os_stage7f_clinic_payment_ops` |
| `20260729120001` | `fi_os_stage8a_hli_ai_image_classification` |
| `20260731120001` | `fi_os_stage8b_hli_photo_protocol` |
| `20260801120001` | `fi_os_stage8d_photo_protocol_alert_events` |
| `20260812120001` | `hie_stage9a_hair_loss_classification` |
| `20260813120001` | `hie_stage9b_hair_progression_intelligence` |
| `20260813120002` | `hie_stage9c_donor_intelligence` |
| `20260814120001` | `hie_stage9d_recipient_candidacy_review` |
| `20260815120001` | `hie_stage10_consultation_checklist_engine` |
| `20260816120001` | `fi_intelligence_event_logs` |
| `20260818120001` | `fi_intelligence_replay_runs` |

## 3. Repo hygiene fix (duplicate version)

Previously two files shared `20260813120001_*`, which breaks deterministic ordering.

- **Kept:** `20260813120001_hie_stage9b_hair_progression_intelligence.sql`
- **Renamed to:** `20260813120002_hie_stage9c_donor_intelligence.sql`

If you had already applied the old `20260813120001` stage9c filename on **any** database, reconcile with `migration repair` or a one-off SQL check on `supabase_migrations.schema_migrations` before pushing.

## 4. Get ready to push (CLI)

From the **repository root** on a machine with network access to Supabase:

1. **CLI** — repo already uses `npx supabase` (see `package.json`). Example: `npx supabase --version` (tested at **2.106.0**).

2. **Login** (if not already):

   ```bash
   npx supabase login
   ```

3. **Link** this repo to the Follicle Intelligence project:

   ```bash
   npx supabase link --project-ref iqqvzgxoimxchhcnbzxl
   ```

4. **Database password** — `migration list --linked` / `db push --linked` need Postgres access. Set the database password from the Supabase dashboard (**Project Settings → Database**) for the CLI user:

   ```bash
   # PowerShell example
   $env:SUPABASE_DB_PASSWORD = "<database password from dashboard>"
   ```

   If you see `403` / “login role” / privilege errors, confirm your Supabase account has access to that project and that the password is correct.

5. **Verify local vs remote**:

   ```bash
   npx supabase migration list --linked
   ```

6. **Dry run** (prints what would run; no DDL):

   ```bash
   npx supabase db push --linked --dry-run
   ```

   If the CLI reports migrations “out of order” or skips expected files, retry with **`--include-all`** (includes migrations missing from the remote history table even when timestamps interleave with existing history — use when you know what you are doing):

   ```bash
   npx supabase db push --linked --dry-run --include-all
   ```

7. **Apply** (after review):

   ```bash
   npx supabase db push --linked --yes
   ```

   Prefer a **maintenance window** and a **backup** / point-in-time recovery awareness for production.

### 4a. If `20260624130001_fi_imaging_os.sql` fails on push

1. Confirm which objects already exist from the earlier `20260612140001` `fi_imaging_os` apply.
2. If the live schema already matches the intent of `20260624130001`, you can mark it applied **without** re-running SQL:

   ```bash
   npx supabase migration repair 20260624130001 --status applied
   ```

   Consult current CLI help: `npx supabase migration repair --help` for exact flags (`--linked`, etc.).

3. Re-run `db push` / `migration list` until clean.

## 5. Re-verify after push

- `npx supabase migration list --linked` — every file in `supabase/migrations/` should show as applied on remote.
- Smoke test critical app paths (FI OS, CRM, bookings) per your release checklist.

## 6. How this document was produced

- **Remote:** Supabase MCP tool `list_migrations` for `project_id` `iqqvzgxoimxchhcnbzxl`.
- **Local:** filenames in `supabase/migrations/*.sql` parsed as `{version}_{slug}.sql`.

Refresh this runbook after adding migrations or if you repair/rename history on the server.
