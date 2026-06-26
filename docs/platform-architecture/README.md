# FI OS — Platform Architecture Registry

**Status:** Living registry. Update when modules gain new tables, integrations, or event contracts.

This directory documents each FI OS module at system scale: purpose, dependencies, event contracts, data ownership, security boundaries, and failure modes. It complements marketing architecture diagrams (`components/platform/PlatformArchitectureMap.tsx`) with engineering truth.

## Governance

| Concern | Document |
|---------|----------|
| Migration naming & module blocks | [`docs/database/migration-policy.md`](../database/migration-policy.md) |
| Event ingest (HLI / HairAudit producers) | [`docs/design/03-event-ingestion-design.md`](../design/03-event-ingestion-design.md) |
| CRM / workflow event audit | [`docs/audits/fi-workflow-events-audit.md`](../audits/fi-workflow-events-audit.md) |
| Future unified bus (Phase 2) | Planned: `src/lib/events/fiEventBus.ts` |

## Event naming

**Target standard (Phase 2+):** `{domain}.{entity}.{action}` — e.g. `patient.consultation.booked`, `calendar.sync.failed`.

**Current interim channels:**

- `fi_crm_activity_events.activity_kind` — CRM, bookings, pathology side-effects
- `fi_events` — external producer ingest (`hli.*`, `hairaudit.*`)
- `fi_analytics_events` — AnalyticsOS normalized module events
- `fi_intelligence_event_logs` — internal intelligence bus (Stage 12+)

Registry entries list **current** emissions plus **target** bus events where applicable.

## Module index

| Module | Registry file | Migration block |
|--------|---------------|-----------------|
| Platform Core | [platform-core.md](./platform-core.md) | `10xx` |
| CalendarOS | [calendar-os.md](./calendar-os.md) | `20xx` |
| LeadFlow | [leadflow.md](./leadflow.md) | `30xx` |
| AnalyticsOS | [analytics-os.md](./analytics-os.md) | `40xx` |
| WorkforceOS | [workforce-os.md](./workforce-os.md) | `50xx` |
| SurgeryOS | [surgery-os.md](./surgery-os.md) | `60xx` |
| AuditOS | [audit-os.md](./audit-os.md) | `70xx` |
| AcademyOS | [academy-os.md](./academy-os.md) | `80xx` |
| ClinicOS | [clinic-os.md](./clinic-os.md) | (cross-cutting; calendar `20xx`, services in core) |
| PatientOS | [patient-os.md](./patient-os.md) | (cross-cutting; core + clinical extensions) |
| FinancialOS | [financial-os.md](./financial-os.md) | (core `10xx` + financial phases) |
| Onboarding / integrations | See Platform Core + module integrations | `90xx` |

## Registry template

Each module file defines:

- **Purpose**
- **Dependencies**
- **Events Published**
- **Events Consumed**
- **Database Tables**
- **External Integrations**
- **Security Boundaries**
- **Ownership Rules**
- **Failure Conditions**
