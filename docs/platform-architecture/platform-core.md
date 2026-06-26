# Module: Platform Core

## Purpose

Shared multi-tenant foundation for FI OS: tenant identity, user membership, clinic/org structure, entitlements, OS-level identities, global event ingest, intelligence replay infrastructure, and cross-module RLS primitives. Every other module depends on Platform Core; it does not own clinical or revenue domain logic.

## Dependencies

None (root layer). Consumed by all OS modules.

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `tenant.provisioned` | Target FI Event Bus | Planned |
| `tenant.entitlement.changed` | Target FI Event Bus | Planned |
| `user.membership.created` | Target FI Event Bus | Planned |
| `integration.webhook.received` | `fi_integration_webhook_events` | Current |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `hli.*` / `hairaudit.*` | External producers via `POST /api/fi/events` | Canonical entity resolution, timeline, intelligence pipeline |
| Onboarding completion signals | OnboardingOS (`90xx`) | Tenant activation, entitlements |

## Database Tables

**Identity & tenancy**

- `fi_tenants`, `fi_users`, `fi_clinics`, `fi_organisations`
- `fi_os_identities`, `fi_platform_admin`
- `fi_tenant_admin_users`, `fi_tenant_org_clinic_settings`

**Entitlements & provisioning**

- `fi_platform_entitlements` (phase migrations)
- `fi_tenant_provisioning_*` (templates, sessions, steps, audit)

**Global intelligence**

- `fi_events`, `fi_global_*` mapping tables
- `fi_intelligence_event_logs`, `fi_intelligence_replay_runs`
- `fi_timeline_events`

**Integrations**

- `fi_integration_webhook_events`
- `fi_machine_ingest_hmac` (HMAC verification config)

**Migration block:** `10xx`

## External Integrations

- Supabase Auth (session / JWT)
- Vercel (hosting, cron)
- Legacy FI API consumers (`FI_LEGACY_FI_API_*` gated)

## Security Boundaries

- **RLS:** Tenant members (`fi_users.auth_user_id = auth.uid()`) SELECT on tenant-scoped tables; DML via service role or guarded server actions.
- **OS identities:** `fi_os_identities` for cross-tenant platform support roles with explicit allow-lists.
- **Service role:** Server actions, cron, webhooks only — never exposed to browser clients.
- **Legacy API:** Production requires `FI_LEGACY_FI_API_ENABLED` + long secret; see `src/lib/fiOs/legacyFiApiAuth.ts`.

## Ownership Rules

| Data | System of record |
|------|------------------|
| Tenant / user membership | Platform Core (FI Supabase) |
| Canonical global IDs | Platform Core (`fi_global_*`) |
| Operational patient/clinical data | PatientOS / ClinicOS (not intelligence-only FI design boundary for HLI/HairAudit — see `docs/design/01-platform-architecture.md`) |
| External producer payloads | Append-only in `fi_events`; FI derives, does not mutate source systems |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Duplicate migration version prefix | `db push` / deploy blocked | `npm run check:migrations` before merge |
| RLS regression on foundation tables | Cross-tenant data leak | Patch migrations + `patch_5_rls_regression_*` test functions |
| Legacy API secret misconfiguration | Producer ingest 401/403 in production | `fiEnv.server.ts` validation at boot |
| Intelligence replay failure | Stale derived insights | `fi_intelligence_replay_runs` + Stage 15 runbooks |
| Idempotency collision on `fi_events` | Duplicate side-effects | Unique `(tenant_id, source_system, source_event_id)` |
