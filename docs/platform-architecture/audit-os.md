# Module: AuditOS

## Purpose

Outcome and quality intelligence layer aligned with HairAudit: surgical audit workflows, outcome measurement, concern detection, and report generation. AuditOS measures procedure quality and feeds AnalyticsOS, AcademyOS, and the Clinical Intelligence Network.

## Dependencies

- **PatientOS** — cases, images, timeline
- **SurgeryOS** — procedure evidence, graft data
- **ImagingOS** — standardized photography, comparison contracts
- **Platform Core** — `fi_events` ingest, intelligence pipeline
- **AcademyOS** — competency feedback from audit findings

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `audit.started` | Target FI Event Bus | Planned |
| `audit.completed` | Internal bus / `hairaudit.audit.completed` shadow | Partial (Stage 11) |
| `audit.concern.detected` | Target FI Event Bus | Planned |
| `outcome.report.generated` | Target FI Event Bus | Planned |
| `hairaudit.case.submitted` | `fi_events` ingest | Current |
| `hairaudit.images.uploaded` | `fi_events` ingest | Current |
| `hairaudit.report.released` | `fi_events` (design) | Partial |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `hairaudit.*` producer events | HairAudit | Ingest, global resolve, scoring pipeline |
| `surgery.completed` | SurgeryOS | Audit eligibility |
| `imaging.session.completed` | ImagingOS | Evidence completeness |
| Intelligence replay dispatch | Platform Core | Reprocess audit-derived signals |

## Database Tables

- `fi_audits`, `fi_jobs` (legacy audit job tracking)
- `fi_scorecards`, `fi_reports`, `fi_model_runs`
- `fi_signals_*` — normalized signal store
- `fi_intelligence_event_logs` — bus observability
- HIE outcome measurement tables (cross-module)
- `fi_network_subjects` — anonymized network intelligence (foundation)

**Migration block:** `70xx`

## External Integrations

- **HairAudit** — primary producer via `POST /api/fi/events`
- **Internal intelligence bus** — `@follicle/intelligence-core`, Stage 12–15 replay

## Security Boundaries

- HairAudit ingest: legacy API auth + allow-listed event types in `lib/fi/events/schema.ts`.
- Auditor OS role: `fi_auditor` identity for cross-tenant audit surfaces (see `fi-os-access-production.md`).
- Scorecards/reports: tenant-scoped reads; derived artifacts not written back to HairAudit DB.

## Ownership Rules

| Data | System of record |
|------|------------------|
| HairAudit case & report | HairAudit |
| FI scorecard / derived insight | AuditOS / Platform intelligence layer |
| Audit timeline entries | PatientOS timeline (`fi_timeline_events`) |
| Anonymized network aggregates | Clinical Intelligence Network (FI) |

**Design rule:** FI must not become the operational database for HairAudit (`docs/design/01-platform-architecture.md`).

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Ingest schema drift | Rejected HairAudit events | Keep `schema.ts` and vocabulary in sync |
| Scoring pipeline stall | Missing scorecard | `fi_jobs` + pipeline retry; intelligence replay |
| Shadow audit event misfire | False `audit.completed` | `FI_INTERNAL_BUS_SHADOW_AUDIT` env gate (Stage 11) |
| Cross-tenant auditor access | Data leak | `fi_os_identities` role checks |
