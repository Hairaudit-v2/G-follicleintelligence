# System status & readiness (Stage 3D)

## Purpose

The **System Status** page (`/fi-admin/[tenantId]/system-status`) is an internal FI administrator dashboard. It answers, for a single tenant:

- Which **modules** exist at the database layer.
- Which **features** are ready, partially ready, or only planned (via the central registry).
- **Row volumes** for CRM, bookings, patients, cases, activity, and users.
- **Migration metadata** (best-effort: latest SQL filename from `supabase/migrations` on the host running the app).
- A single **System Readiness Score** for rollout planning conversations.

Access matches other CRM admin surfaces: **`fi_admin`** or **`crm_operator`** (`assertCrmShellPageAccess`). The **System Status** nav link is shown only when CRM shell nav is allowed.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `systemStatusChecks.ts` | Service-role Supabase probes + tenant-scoped counts (`runSystemStatusDbQueries`). |
| `systemStatusLoader.ts` | Composes DB snapshot with migration directory read + calendar loader probe; calls `assembleSystemStatusPayload`. |
| `systemStatusSummary.ts` | Pure shaping, summary strip traffic, readiness score (`calculateSystemReadinessScore`), `assembleSystemStatusPayload`. |
| `systemFeatureRegistry.ts` | Static feature matrix + `resolveFeatureInventoryStatuses(payload)`. |
| `systemStatusTypes.ts` | Shared TypeScript models. |
| `src/components/fi/system-status/*` | Presentational UI (cards, metrics, badges, page layout). |

Missing tables are detected from PostgREST errors (schema cache / relation messages) without failing the whole page.

## Scoring

`calculateSystemReadinessScore()` is **pure** and documented in source. Weights:

1. **Database core (60%)** — `present / |SYSTEM_STATUS_CORE_TABLES|` × 60.
2. **Module strip (25%)** — Average of CRM, Bookings, Calendar, Patients, Cases traffic lights: green = 1.0, amber = 0.55, red = 0.0; scaled to 25 points.
3. **Calendar stack (15%)** — Full points when Supabase is configured, `fi_bookings` exists, and calendar server loaders are present in the build.

The headline string bands the score into operator-friendly language (90+, 70+, 45+, below). This is **not** a security or clinical certification — it is an **operational** signal for development and rollout.

## Feature registry

`SYSTEM_FEATURE_REGISTRY` lists product-facing rows grouped under **CRM**, **Bookings**, **Patients**, **HairAudit**, and **IIOHR**. `resolveFeatureInventoryStatuses()` maps the live `SystemStatusPayload` to **Ready**, **Partial**, or **Planned**:

- **Ready** — prerequisites met and (where relevant) tenant usage observed.
- **Partial** — schema or shell exists but data or dependencies are incomplete.
- **Planned** — not yet implemented as first-class UI in this codebase (e.g. HLI, HairAudit, IIOHR).

## Related routes

- CRM shell: `/fi-admin/[tenantId]/crm`
- Bookings operator: `/fi-admin/[tenantId]/bookings`
- Calendar: `/fi-admin/[tenantId]/calendar`
