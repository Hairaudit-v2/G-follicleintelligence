# FI OS — Outcome intelligence network (foundation)

**Foundation** = typed registry, four Supabase tables, pure aggregation helpers, service-role write helpers, tenant-scoped loaders, and FI Admin UI (dashboard, case, Patient Twin). **Not** predictive AI, cross-tenant patient data, or public clinician benchmarking.

## Authoritative runbook

- **[Stage 6 runbook](../runbooks/fi-os-stage6-outcome-intelligence-network.md)** — tables, RLS, anonymisation, measurable vs TODO, UI map, migration filename, Stage 7 roadmap.

## Apply schema

Run migration:

`supabase/migrations/20260726120001_fi_os_stage6_outcome_intelligence.sql`

## Key code paths

| Layer | Path |
|-------|------|
| Registry | `src/config/fiOutcomeIntelligenceRegistry.ts` |
| Signals / normalisation | `src/lib/fi-os/outcomeIntelligenceSignals.ts` |
| Aggregation + anonymisation gate | `src/lib/fi-os/outcomeAggregation.ts` |
| Draft aggregates (no `server-only`) | `src/lib/fi-os/outcomeIntelligenceDrafts.ts` |
| Loaders + case view builder | `src/lib/fi-os/outcomeIntelligence.server.ts` |
| Record helpers + re-exports | `src/lib/fi-os/outcomeIntelligenceEvents.server.ts`, `outcomeIntelligenceEventsSchema.ts` |
| Widget | `src/components/fi-admin/dashboard/DashboardOutcomeIntelligenceSummary.tsx` |
| Tests | `src/lib/fi-os/outcomeIntelligence.stage6.test.ts` |

## Relationship to Stage 5

Stage 5 (**[clinical intelligence runbook](../runbooks/fi-os-stage5-clinical-intelligence.md)**) covers journey **signals** and optional snapshots. Stage 6 adds **structured** checkpoints, metrics, protocols, and aggregate rows for explainable tenant reporting and future governed network stats.
