# Follicle Intelligence — Design Docs

Design for FI as a **shared intelligence and analytics platform** alongside Hair Longevity Institute (HLI) and HairAudit, without FI becoming the operational database for either.

## Documents

| Doc | Content |
|-----|--------|
| [01-platform-architecture](./01-platform-architecture.md) | System context, data flow, FI-as-intelligence-layer rule. |
| [02-canonical-entity-model](./02-canonical-entity-model.md) | Global IDs: global_person_id, global_case_id, global_provider_id, global_clinic_id, global_document_id. |
| [03-event-ingestion-design](./03-event-ingestion-design.md) | Event schema, naming (e.g. hli.intake.submitted), ingest API, idempotency. |
| [04-signal-normalization-model](./04-signal-normalization-model.md) | Shared signal vocabulary and normalized signal storage. |
| [05-ai-integration-strategy](./05-ai-integration-strategy.md) | AI analysis, benchmarking, aggregation, white-label. |
| [06-foundation-layer-architecture](./06-foundation-layer-architecture.md) | Unified foundation entities (organisations, clinics, persons, roles, patients, cases, timeline, media), ERD, migration plan, security, risks, conflicts with existing FI/HairAudit/HLI. |
| [07-foundation-migration-specification](./07-foundation-migration-specification.md) | Stage 1B: ordered migration filenames, table definitions, compatibility, decisions, canonical IDs, RLS intent, views, dual-write, rollback, open questions. |
| [08-foundation-resolution-helpers](./08-foundation-resolution-helpers.md) | Stage 1E: server-side `src/lib/fi/foundation` find-or-create helpers, idempotency, matching order, dual-write prep. |
| [09-foundation-dual-write-event-ingest](./09-foundation-dual-write-event-ingest.md) | Stage 1F: dual-write from FI event ingest into foundation tables; wiring, mapping, idempotency, rollback. |
| [10-foundation-integrity-dashboard](./10-foundation-integrity-dashboard.md) | Stage 1G: admin integrity metrics, views, optional manual backfill, duplicate-risk heuristics. |
| [11-universal-patient-record](./11-universal-patient-record.md) | Stage 1H: read-only universal patient aggregate in FI Admin. |
| [12-universal-case-record](./12-universal-case-record.md) | Stage 1I: read-only universal case aggregate in FI Admin. |
| [13-foundation-search-directory](./13-foundation-search-directory.md) | Stage 1J: tenant-scoped read-only foundation search and directory. |
| [14-tenant-configuration-branding](./14-tenant-configuration-branding.md) | Stage 1K: tenant / organisation / clinic settings and branding cascade for white-label and future CRM. |
| [15-configuration-admin-editing](./15-configuration-admin-editing.md) | Stage 1L: FI Admin–gated editing of tenant/org/clinic settings. |
| [16-effective-branding-application](./16-effective-branding-application.md) | Stage 1M: apply effective branding in FI Admin layout and configuration preview. |
| [17-crm-foundation-architecture](./17-crm-foundation-architecture.md) | Stage 1N: CRM foundation tables, ERD, timeline/HubSpot strategy, RLS, migration order (design only). |
| [18-crm-foundation-implementation-checklist](./18-crm-foundation-implementation-checklist.md) | Stage 1O: locked decisions, phased implementation checklist, acceptance criteria (no code). |
| [19-fi-os-current-state-and-dashboard-roadmap](./19-fi-os-current-state-and-dashboard-roadmap.md) | Audit of FI Admin routes, tables, server actions, UX; safety rules; phased home dashboard and first-patient workflow (design only). |

## Local development

| Doc | Content |
|-----|--------|
| [FI Admin without login](../dev-local-fi-admin.md) | `FI_ENABLE_DEV_ADMIN_ACCESS` — optional `fi_tenants` listing when no Supabase session (non-production only). |

## FI OS implementation runbooks

| Runbook | Scope |
|---------|--------|
| [Outcome intelligence network (foundation)](../fi-os-outcome-intelligence-network-foundation.md) | Entry index: Stage 6 schema + code map + link to full runbook. |
| [Stage 6 — Outcome intelligence network](../runbooks/fi-os-stage6-outcome-intelligence-network.md) | Tables, RLS, anonymisation, UI, TODO, Stage 7. |
| [Stage 5 — Clinical intelligence](../runbooks/fi-os-stage5-clinical-intelligence.md) | Signals, events, snapshots, UI. |
| [Stage 7 — Revenue & payments](../runbooks/fi-os-stage7-revenue-payments.md) | Payment/revenue ops (separate track). |

## FI OS access & launch

| Doc | Content |
|-----|--------|
| [FI OS production access](../fi-os-access-production.md) | `NODE_ENV` gates, tenant portal, cross-tenant OS roles, `/api/tenants`, Clinic OS shell rollout, global search API, validation checklist. |
| [Stage 6F smoke test & release checklist](../fi-os-smoke-test-stage-6f.md) | Official pre-launch matrix, personas, pass/fail table, blockers, rollback. |

## Design rule

**Follicle Intelligence must not become the operational database for HLI or HairAudit.** It consumes normalized signals, computes risk models and insights, and exposes analytics and recommendations back via read-only APIs.

## Code reference

- Event types and signal vocabulary are defined in `src/lib/fi/vocabulary.ts` for use in ingestion, validation, and pipelines.
