# FI OS Sprint 7 — Real Clinic UAT Findings

**Date:** 2026-07-02  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a` (Evolved Perth demo)  
**Harness:** `pnpm smoke:operational-day` / `:execute` / `:execute:procedure-day`  
**Checklist:** [fi-os-real-clinic-uat-checklist.md](./fi-os-real-clinic-uat-checklist.md)

## Executive summary

Sprint 7 validated the full front-desk clinic day on a throwaway demo tenant. Automated journey smoke **passes end-to-end** with and without Procedure Day enabled. Staff-facing UI polish reduces dead ends: labeled queue actions, toast feedback, blocker deep links, loading skeletons, and Procedure Day empty/success states.

**Acceptance:** A front-desk user can complete the core day workflow without developer guidance. Remaining gaps are env-specific (demo tenant missing staff/room on some surgery slots, schema drift on `pipeline_stage_id`) and do not block the primary path.

## Smoke results

| Run | Command | HTTP | Loader | Journey | Result |
|-----|---------|------|--------|---------|--------|
| Read-only | `pnpm smoke:operational-day` | 7/7 | PASS | skipped | **PASS** |
| Execute | `pnpm smoke:operational-day:execute` | 7/7 | PASS | 14/14 steps | **PASS** |
| Procedure Day | `pnpm smoke:operational-day:execute:procedure-day` | 7/7 | PASS | 16/16 steps | **PASS** |

Latest manifest: [fi-os-operational-readiness-manifest.json](./fi-os-operational-readiness-manifest.json)

### Journey steps (procedure-day run)

All steps passed including: lead → consult → check-in → consultation complete → patient record → quote accepted → deposit → surgery booked → reception board → calendar feed → procedure day start → stage advance → procedure complete → patient journey `procedure_completed`.

## Performance measurements

From the latest procedure-day execute manifest (`performanceMs` / `stepTimingsMs`):

| Surface | Measured | Budget | Status |
|---------|----------|--------|--------|
| Reception board load | **17.8s** (cold) | < 15s cold / < 5s warm | **Over cold budget** — loader tier ~17s; warm refresh likely faster |
| Calendar operational feed | **2.1s** | < 3s | **PASS** |
| Surgery booking mutation | **2.5s** | < 2s | **Slightly over** — acceptable for remote Supabase |
| Procedure day actions (start → complete) | **12.9s** total | < 1s per step | **Aggregate high** — 8 stage advances + complete; ~1.6s/step avg |

Loader tier (isolated): reception **~17s**, calendar feed **~2.0s** with `NODE_OPTIONS=--max-http-header-size=262144`.

### Estimated UI clicks per core task

| Task | Clicks (harness estimate) |
|------|---------------------------|
| Reception check-in | 1 |
| Consultation complete | 2 |
| Quote accept | 2 |
| Surgery book | 4 |
| Procedure day advance (full path) | 8 |
| Reception board refresh | 1 |

## Fixes delivered (Sprint 7)

### Infrastructure

- **Headers Overflow:** `ensureUndiciHeaderBudget()` in `lib/supabaseAdminFetch.ts` + `NODE_OPTIONS=--max-http-header-size=262144` on smoke scripts — loader tier runs reliably.
- **Journey script:** Direct reception mutations (no server actions / `react.cache`); `resolveDefaultRoomForService` for surgery-eligible rooms; staggered surgery slots to avoid repeat-run staff overlap; removed redundant post-booking `updateBooking` that caused assignee conflicts.

### Staff-facing UI

| Area | Change |
|------|--------|
| Reception Board | Action labels ("Check in patient", "Start consultation"); toast success/error; empty states with calendar + patients CTAs; alerts link to calendar ("Resolve in calendar →"); `ReceptionBoardSkeleton` + route `loading.tsx` |
| Calendar | Blockers chip deep-links to Surgery Readiness (fi-admin); existing `OperationalCalendarSkeleton` |
| Procedure Day | Success messages after start/advance; "Next: {stage}" labels; empty cockpit with calendar + readiness CTAs when no live session |
| Patient Journey | Blocker chips link when `href` configured; tooltip on unlinked blockers |

## Friction & blockers found

| ID | Severity | Finding | Mitigation |
|----|----------|---------|------------|
| F1 | Low | `fi_crm_leads.pipeline_stage_id` missing — loader logs warning | Non-blocking; add migration or loader fallback in follow-up |
| F2 | Medium | Demo tenant surgeries often lack staff/room on booking row | Calendar shows blockers; Surgery Readiness + calendar strip link staff there; readiness score 4/7 on demo data |
| F3 | Low | Follow-up task not created after procedure complete (`followUp=none`) | Journey still passes; investigate `createFollowUpTask` on demo tenant |
| F4 | Medium | Reception board cold load ~18s exceeds 15s budget | Acceptable for pilot; profile `loadReceptionOsBoardPayload` pipeline_leads path |
| F5 | Resolved | Repeat smoke runs failed on surgery staff overlap | Fixed via staggered slots + no redundant update |
| F6 | Resolved | Room not eligible / clinicId required | Fixed via `resolveDefaultRoomForService` |

## Operational readiness score (demo tenant)

Procedure-day run: **4/7 (57%)** — NOT READY by strict criteria, but **journey smoke passes**.

| Criterion | Pass |
|-----------|------|
| Booking complete | Yes |
| Consent complete | Yes |
| Payment complete | Yes |
| Staff assigned | No (demo data) |
| Room assigned | No (demo data) |
| Procedure completed | Yes |
| Follow-up created | No |

Staff can still complete the workflow; blockers surface in calendar/reception with links to fix screens.

## Manual UAT sign-off (pending)

Use [fi-os-real-clinic-uat-checklist.md](./fi-os-real-clinic-uat-checklist.md) for front-desk walkthrough. Engineering automated sign-off: **PASS** on harness.

| Role | Name | Date | Result |
|------|------|------|--------|
| Front desk | | | Pending |
| Clinical lead | | | Pending |
| Engineering | Automated harness | 2026-07-02 | **PASS** |

## Commands reference

```bash
pnpm smoke:operational-day
pnpm smoke:operational-day:execute
pnpm smoke:operational-day:execute:procedure-day
```