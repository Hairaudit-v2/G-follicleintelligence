# FI OS — Database Migration Policy

**Status:** Mandatory for all new migrations. **No exceptions going forward.**

This document is the canonical governance standard for files under `supabase/migrations/`. Legacy filenames remain valid once applied; **never rename migrations already recorded on remote**.

Related: [Supabase migration runbook](../runbooks/supabase-migration-naming-policy.md) · Cursor rule `.cursor/rules/supabase-migrations.mdc` · `npm run check:migrations`

---

## Format

```
YYYYMMDDMMMM_module_phase_description.sql
```

| Segment | Meaning |
|---------|---------|
| `YYYYMMDD` | Migration date (UTC calendar day when authored) |
| `MMMM` | Module block + sequence (see below) |
| `module_phase_description` | Lowercase slug with underscores |

### Examples

```
202610012001_calendar_gc9_webhook_subscriptions.sql
202610013001_leadflow_lf4_pipeline_engine.sql
202610014001_analytics_event_bus.sql
202610011001_platform_core_tenant_entitlements_v2.sql
```

---

## Module allocation (digits 9–12)

The last four digits of the version prefix are reserved by module. Increment the sequence (`01`, `02`, `03`, …) within the block for each migration that day.

| Block | Module | Scope |
|-------|--------|-------|
| `10xx` | **Platform core** | Tenants, users, RLS primitives, entitlements, provisioning contracts, shared infrastructure |
| `20xx` | **CalendarOS** | Operational calendar, Google sync, staff calendar links, sync health |
| `30xx` | **LeadFlow** | Lead ingestion, scoring, HubSpot/Meta pipelines, conversion |
| `40xx` | **AnalyticsOS** | `fi_analytics_events`, forecasting, executive intelligence |
| `50xx` | **WorkforceOS** | Staff rostering, shifts, availability, clinical assignments |
| `60xx` | **SurgeryOS** | Procedure day, graft intelligence, surgical safety |
| `70xx` | **AuditOS** | HairAudit alignment, outcome audits, quality intelligence |
| `80xx` | **AcademyOS** | Competency projections, procedure privileges, certification |
| `90xx` | **Onboarding / integrations** | Tenant provisioning, connector auth, staged imports, external webhooks |

### Sequence rules

- Pick the **next unused prefix** in the correct module block.
- One file per prefix — duplicate prefixes break `schema_migrations_pkey` and fail `npm run check:migrations`.
- Different modules **must not** share the same prefix even if slugs differ (remote stores version only).
- Same-day migrations in one module: `2001`, `2002`, `2003`, …

---

## Before creating a migration

1. List local files (sorted):
   ```bash
   ls supabase/migrations | sort
   ```
2. Check remote migration state:
   ```bash
   npx supabase migration list --linked
   ```
3. Pick the next unused version in the correct **module block**.
4. Author the SQL file with the governed name.
5. Run the guard script:
   ```bash
   npm run check:migrations
   ```
6. **Never rename** migrations already applied to remote.

---

## Legacy migrations

Many existing files use 14-digit timestamps (e.g. `20260712120001_fi_services.sql`) or pre-block naming (e.g. `20260926120001_calendar_os_phase_gc1_…`). Leave them as-is once applied. **All new work** uses the 12-digit module blocks above.

When extending an existing phase (e.g. Calendar GC-8), continue in the same module block:

```
202610012001_calendar_gc8_scheduled_background_sync.sql
202610012002_calendar_gc8_sync_monitoring.sql
202610012003_calendar_gc8_failure_alerts.sql
```

---

## Slug conventions

- Lowercase, underscores only.
- Start with module identifier: `calendar_`, `leadflow_`, `platform_core_`, etc.
- Include phase or milestone when applicable: `gc9`, `lf4`, `phase3`.
- Be descriptive: `webhook_subscriptions`, not `patch` or `fix`.

---

## Enforcement

| Layer | Mechanism |
|-------|-----------|
| Local / CI | `scripts/check-migration-versions.ts` via `npm run check:migrations` |
| Code review | Reject PRs that reuse prefixes or use wrong module blocks |
| Cursor | `.cursor/rules/supabase-migrations.mdc` applies to `supabase/migrations/**` |

---

## Architecture registry cross-reference

Each module block maps to a registry entry under [`docs/platform-architecture/`](../platform-architecture/). When adding schema for a module, update that module's **Database Tables** section in the same PR or immediately after merge.
