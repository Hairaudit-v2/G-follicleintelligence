# Supabase migration naming policy

> **Canonical document:** [`docs/database/migration-policy.md`](../database/migration-policy.md) — use that path for governance reviews and onboarding. This runbook retains operational commands.

Operational runbook for new files under `supabase/migrations/`. Legacy filenames remain valid; **never rename migrations already applied to remote**.

## Format

```
YYYYMMDDMMMM_module_phase_description.sql
```

- **12-digit version prefix** — `YYYYMMDD` (date) + `MMMM` (module block + sequence).
- **Slug** — lowercase, underscores, `{module}_{phase}_{description}`.
- **Do not reuse version prefixes** — one file per prefix; duplicate prefixes break `db push` (`schema_migrations_pkey`).

### Module block (`MMMM` — digits 9–12)

| Block | Module |
|-------|--------|
| `10xx` | platform / core |
| `20xx` | calendar |
| `30xx` | leadflow |
| `40xx` | analytics |
| `50xx` | workforce |
| `60xx` | surgery |
| `70xx` | audit |
| `80xx` | academy |
| `90xx` | onboarding / integrations |

Increment the last two digits within the block for each migration that day (`2001`, `2002`, …).

**Calendar OS GC-8 (example):**

```
202610012001_calendar_gc8_scheduled_background_sync.sql
202610012002_calendar_gc8_sync_monitoring.sql
202610012003_calendar_gc8_failure_alerts.sql
```

**LeadFlow next:**

```
202610013001_leadflow_lf4_pipeline_engine.sql
```

**Analytics next:**

```
202610014001_analytics_phase_d_forecasting.sql
```

## Before creating a migration

1. List local files (sorted):
   ```bash
   ls supabase/migrations | sort
   ```
2. Check remote migration state:
   ```bash
   npx supabase migration list --linked
   ```
3. Pick the **next unused** version in the correct **module block**.
4. **Never rename** migrations already recorded on remote.

## Guard script

```bash
npm run check:migrations
```

Fails CI/local checks if two files share the same version prefix (`scripts/check-migration-versions.ts`).

## Collision avoidance

- Enforced locally by `npm run check:migrations` and `listLocalMigrationFiles()` in `scripts/lib/supabaseMigrationFiles.mjs`.
- Different modules must not share the same prefix even if slugs differ (remote stores version only, not slug).

## Legacy migrations

Many existing files use 14-digit `…120001`-style timestamps. Leave them as-is once applied. New work uses the 12-digit module blocks above.

## Reordered migrations (remote history preserved)

Four early migrations referenced tables created later in the chain. They were split for local `supabase db reset`:

| Original (no-op stub, remote applied) | Correct-order DDL file |
|---------------------------------------|---------------------------|
| `20260616204324_fi_financial_os_phase1` | `20260727120002_fi_financial_os_phase1` |
| `20260616204444_fi_crm_import_patch2` | `20260720120002_fi_crm_import_patch2` |
| `20260616204529_fi_financial_os_phase2_payment_pathways` | `20260728120002_fi_financial_os_phase2_payment_pathways` |
| `20260622120014_onboarding_os_phase_f5_staged_import_engine` | `20260922120014_onboarding_os_phase_f5_staged_import_engine` |

After pulling this change, run `npx supabase db push` on remote to record the four new version rows (DDL is idempotent).
