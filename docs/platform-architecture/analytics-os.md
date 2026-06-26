# Module: AnalyticsOS

## Purpose

Operational and executive intelligence layer: normalized event pipeline from every FI OS module, clinic performance dashboards, revenue attribution, and forecasting foundation. AnalyticsOS turns cross-module signals into measurable clinic performance.

## Dependencies

- **All OS modules** — event producers
- **Platform Core** — tenancy, `fi_analytics_events` infrastructure
- **FinancialOS** — revenue and AR metrics
- **LeadFlow** — funnel conversion
- **AuditOS** — outcome benchmarks

## Events Published

| Event | Channel | Status |
|-------|---------|--------|
| `analytics.snapshot.generated` | Target FI Event Bus | Planned |
| `analytics.alert.triggered` | Target FI Event Bus | Planned |
| Derived aggregates | Materialized views / snapshot tables | Partial |

## Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| Module events (all) | LeadFlow, CalendarOS, FinancialOS, SurgeryOS, etc. | Ingest to `fi_analytics_events` |
| `fi_intelligence_event_logs` | Platform Core bus | Replay / dispatch observability |
| Executive finance snapshots | FinancialOS | Dashboard composition |

## Database Tables

- `fi_analytics_events` — unified append-only intelligence events
- `fi_financial_executive_snapshots` (cross-module with FinancialOS)
- Analytics presentation loaders (application layer, no separate schema yet)

**Migration block:** `40xx`

**Allowed `module_name` values in `fi_analytics_events`:**

`workforce_os`, `surgery_os`, `financial_os`, `consultation_os`, `patient_os`, `clinic_os`, `leadflow`, `imaging_os`, `audit_os`

## External Integrations

- Future: BI export (warehouse sync)
- Internal: `packages/intelligence-core` event envelope types

## Security Boundaries

- Append-only ingest via service role; tenant members SELECT own tenant only.
- No PII in `event_metadata` without explicit governance review.
- Cross-tenant aggregates: platform OS identities only.

## Ownership Rules

| Data | System of record |
|------|------------------|
| Raw operational facts | Source module (LeadFlow, CalendarOS, etc.) |
| Normalized analytics events | AnalyticsOS (`fi_analytics_events`) |
| Executive snapshots | AnalyticsOS / FinancialOS (joint) |

## Failure Conditions

| Condition | Impact | Mitigation |
|-----------|--------|------------|
| Missing module ingest | Incomplete dashboards | Module registry checklist; bus Phase 2 |
| Duplicate analytics event | Inflated metrics | Idempotency keys at publish layer (Phase 2) |
| Stale snapshot | Wrong executive view | Scheduled snapshot regeneration |
| Invalid `module_name` | Insert rejected | DB check constraint on `fi_analytics_events` |
