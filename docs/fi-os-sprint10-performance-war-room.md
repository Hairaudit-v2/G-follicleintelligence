# FI OS Sprint 10 — Performance War Room

**Date:** 2026-07-02  
**Focus:** Reception Board cold load (F4), loader deduplication, smoke budget telemetry  
**Prior findings:** [fi-os-sprint9-uat-findings.md](./fi-os-sprint9-uat-findings.md)

## Problem statement

Reception Board Command Center exceeded the **15s cold / 5s warm** budget (measured **17–27s** cold on demo tenant). Root cause: the orchestrator loaded the same heavy slices **twice**:

1. `loadTenantOperationalDashboard` — called by command center **and** `loadReceptionOsBoardPayload`
2. `loadSurgeryReadinessBoardPayload` — called by command center **and** reception OS board
3. `loadBookingCaseIds` — called by command center **and** reception OS board

Calendar operational feed (~2s) and surgery booking mutation (~2.5s) were within budget.

## War room actions

### 1. Loader deduplication (Sprint 10)

`loadReceptionBoardCommandCenterPayload` now:

1. Loads `operational` + `surgeryPayload` in parallel
2. Shares `caseByBooking` via a single promise
3. Passes preloaded slices into `loadReceptionOsBoardPayload` via `LoadReceptionOsBoardPreloaded`

`loadReceptionOsBoardPayload` accepts optional `operational`, `surgeryPayload`, and `caseByBooking` to skip redundant Supabase round-trips.

### 2. Smoke budget telemetry

`fi-operational-day-smoke-loaders.mjs` now reports:

- `receptionColdMs` — first load
- `receptionWarmMs` — immediate second load
- `feedMs` — calendar operational feed
- WARN lines when budgets exceeded (non-failing — remote Supabase latency varies)

Budgets align with [fi-os-real-clinic-uat-checklist.md](./fi-os-real-clinic-uat-checklist.md):

| Surface | Cold | Warm |
|---------|------|------|
| Reception board | < 15s | < 5s |
| Calendar feed | < 3s | — |

### 3. Loader perf spans (optional)

Set `FI_LOADER_PERF_SPANS=1` to record sub-loader timings via `loaderPerfSpans.server.ts` (dev/smoke only).

### 4. Audit script

`scripts/audit-fi-loader-perf.mjs` now includes `reception.boardCommandCenter` cold + warm timings.

## Commands

```bash
# Operational smoke (HTTP + loader budgets)
pnpm smoke:operational-day

# Deep loader audit (requires .env.local + tenant UUID)
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/audit-fi-loader-perf.mjs <tenantUuid>

# Loader-only tier
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/fi-operational-day-smoke-loaders.mjs <tenantUuid>
```

## Remaining perf backlog (not Sprint 10 scope)

| ID | Item | Notes |
|----|------|-------|
| P1 | `loadConsultationConversionBoardPayload` weight | Largest remaining slice inside reception OS |
| P2 | `loadPatientJourneySnapshotsForPatients` N+1 | Per-patient journey on command center |
| P3 | Reception cold load vs remote Supabase RTT | Demo tenant over WAN may still WARN on 15s |
| P4 | Procedure day stage aggregate ~12s | Acceptable; per-step ~1.6s avg |

## Acceptance

- Reception orchestrator does **not** double-load operational dashboard, surgery readiness, or booking case IDs
- Smoke loader reports cold + warm reception timings with budget WARNs
- Calendar feed remains under 3s on demo tenant
- No new architecture (composition-only dedup)