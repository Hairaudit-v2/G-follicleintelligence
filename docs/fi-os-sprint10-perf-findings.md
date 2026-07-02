# FI OS Sprint 10 — Performance War Room Findings

**Date:** 2026-07-02  
**Plan:** [fi-os-sprint10-performance-war-room.md](./fi-os-sprint10-performance-war-room.md)

## Executive summary

Sprint 10 eliminated **triple duplicate loader work** in the Reception Board Command Center orchestrator. The command center now preloads `operational`, `surgeryPayload`, and `caseByBooking` into `loadReceptionOsBoardPayload`, cutting redundant Supabase round-trips without new architecture.

Smoke loader tier now reports **cold + warm** reception timings with budget WARN lines.

## Root cause (F4)

```
loadReceptionBoardCommandCenterPayload (before Sprint 10)
├── loadTenantOperationalDashboard          ─┐
├── loadReceptionOsBoardPayload             │
│   ├── loadTenantOperationalDashboard      │ DUPLICATE
│   ├── loadSurgeryReadinessBoardPayload    │ DUPLICATE
│   └── loadBookingCaseIds                  │ DUPLICATE
└── loadSurgeryReadinessBoardPayload        ─┘
    loadBookingCaseIds                      ─┘
```

## Fix delivered

```
loadReceptionBoardCommandCenterPayload (Sprint 10)
├── Promise.all: operational + surgeryPayload
├── Promise.all: caseByBooking + journey + receptionOs (preloaded slices)
└── receptionOs loads only: conversion, communications, pipeline, deposits, forms
```

## Verification

| Check | Result |
|-------|--------|
| `pnpm typecheck` | See run below |
| `receptionBoardLoaderOrchestration.test.ts` | Structural dedup guard |
| `loaderPerfSpans.test.ts` | Span drain API |
| `pnpm smoke:operational-day` | See run below |

### Expected smoke loader output (shape)

```json
{
  "receptionColdMs": <number>,
  "receptionWarmMs": <number>,
  "feedMs": <number>,
  "budgets": { "receptionColdMs": 15000, "receptionWarmMs": 5000, "feedMs": 3000 }
}
```

WARN lines are informational when remote Supabase latency exceeds budgets.

## Before / after (to measure locally)

Run twice on demo tenant:

```bash
node -r ./scripts/patch-server-only-for-scripts.cjs ./node_modules/tsx/dist/cli.mjs scripts/fi-operational-day-smoke-loaders.mjs <tenantUuid>
```

Record `receptionColdMs` and `receptionWarmMs` in the table below after local run.

| Metric | Sprint 9 baseline | Sprint 10 measured | Budget |
|--------|-------------------|--------------------|--------|
| Reception cold | ~27s | TBD | < 15s |
| Reception warm | — | TBD | < 5s |
| Calendar feed | ~2.4s | TBD | < 3s |

## Remaining gaps

| ID | Severity | Finding | Next step |
|----|----------|---------|-----------|
| P1 | Medium | Conversion board still heavy inside reception OS | Profile `loadConsultationConversionBoardPayload` |
| P2 | Low | Journey snapshots per patient on command center | Batch or lazy-load on tab expand |
| P3 | Low | Cold load may still WARN over WAN | Edge cache / react.cache on stable slices |

## Sign-off

| Role | Name | Date | Result |
|------|--------|------|--------|
| Engineering | Loader dedup + smoke telemetry | 2026-07-02 | Delivered |
| Clinical ops | Reception board feels faster | | Pending |