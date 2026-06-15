# Supabase (Follicle Intelligence)

This directory holds **local Supabase config** and **SQL migrations** applied to Postgres (hosted Supabase or local `supabase start`).

## Migrations

- Files live in `supabase/migrations/`.
- Names use a timestamp prefix so they run in lexicographic order (oldest first).
- **Do not** edit applied migrations in place; add a new file for changes.

Recent foundation-layer batches (after `20260324000010_fi_events_global_foundation.sql`):

| Prefix | Purpose |
|--------|---------|
| `20260605140001`–`09` | Core foundation tables + `fi_cases` FK columns + RLS on new tables |
| `20260605140010`–`13` | `fi_global_cases`, `fi_event_links`, `fi_partners`, `fi_intakes` additive FKs |
| `20260605140014` | Compatibility views: `v_fi_patient_resolution`, `v_fi_case_foundation`, `v_fi_media_unified` |
| `20260606100001` | `fi_organisation_source_ids` (organisation ↔ producer id mapping for Stage 1E helpers) |
| `20260606120001` | `fi_tenant_settings`, `fi_organisation_settings`, `fi_clinic_settings` + RLS (Stage 1K branding / config foundation) |
| `20260606140001` | CRM foundation tables (`fi_crm_*`) — additive DDL only; **no** pipeline seed |
| `20260606150001` | CRM foundation RLS: tenant-member `SELECT` on all `fi_crm_*`; `service_role` INSERT/UPDATE/DELETE; **no** authenticated write policies (Stage 2B / checklist Phase 2) |
| `20260607130001` | CRM Stage 2F: `fi_crm_leads_shell_page` RPC for tenant-scoped lead index (filters, search, sort, pagination); **`service_role` execute only** |
| `20260621120001` | CRM: extend `fi_crm_leads_shell_page` with optional `p_updated_at_min` / `p_updated_at_max` on `fi_crm_leads.updated_at` (list + board filters) |

Design reference: `docs/design/07-foundation-migration-specification.md`. CRM tables: `docs/design/17-crm-foundation-architecture.md`, `docs/design/18-crm-foundation-implementation-checklist.md`.

## Prerequisites

Install the [Supabase CLI](https://supabase.com/docs/guides/cli). Either:

- Global: `npm install -g supabase`, or  
- Per-invocation: `npx supabase@latest …` (see npm scripts in the repo root `package.json`).

## Common commands

From the **repository root** (not inside `supabase/`):

```bash
# Local stack (Postgres + Studio + API)
npm run supabase:start

# Apply migrations to local DB (after start)
npm run supabase:migration:up

# Create a new empty migration file
npm run supabase:migration:new -- my_change_name

# Reset local DB (destructive): re-run all migrations + seed
npm run supabase:db:reset

# Stop local stack
npm run supabase:stop
```

For a **linked remote** project (dashboard-linked):

```bash
npx supabase db push
```

Use hosted project credentials from the Supabase dashboard; never commit secrets.

**Follicle Intelligence hosted project:** see [docs/runbooks/supabase-follicle-intelligence-migration-push.md](../docs/runbooks/supabase-follicle-intelligence-migration-push.md) for an exact remote-vs-local migration map, `db push --dry-run` steps, and notes on the `fi_imaging_os` version skew / `migration repair`.

## Troubleshooting

### `relation "fi_patients" does not exist` (SQLSTATE 42P01)

That almost always means a migration that **references** `fi_patients` ran **before** `20260605140005_fi_patients_and_fi_patient_source_ids.sql`. The `foundation_patient_id` column on `fi_global_cases` is created **inside** `20260605140005` (right after `fi_patients`) so a full `db reset` / linear `migration up` succeeds.

**Fix:** Apply migrations in timestamp order from `20260605140001` onward, or run `npm run supabase:db:reset` locally. Do not run `20260605140010` alone in the SQL editor unless `fi_patients` already exists.

### Older databases that applied `20260605140005` before the bridge was added

If `fi_patients` exists but `fi_global_cases.foundation_patient_id` is missing, `20260605140010` is still a valid idempotent migration to add that column.

