# FI OS Sprint 9 — Staff UAT Hardening Findings

**Date:** 2026-07-02  
**Tenant:** `c2615b95-b707-4485-aa5f-be8f78ec868a` (Evolved Perth demo)  
**UAT script:** [fi-os-staff-uat-script.md](./fi-os-staff-uat-script.md)  
**Prior sprint:** [fi-os-sprint7-uat-findings.md](./fi-os-sprint7-uat-findings.md)

## Executive summary

Sprint 9 adds staff UAT infrastructure (screen guides, friction telemetry, clarity feedback) across all seven focus surfaces and fixes targeted UX blockers found in Sprint 7 smoke/UAT. No new architecture or schema migrations — events persist via existing `fi_platform_events` (`staff.uat.feedback`, `staff.uat.friction`).

**Enable UAT mode:** `FI_STAFF_UAT_MODE_ENABLED=1`

**Acceptance:** Receptionist, nurse, doctor, surgery coordinator, and admin can complete core workflows using in-app guidance without developer explanation. Remaining gaps are demo-data and performance items carried from Sprint 7.

## Deliverables

### UAT infrastructure

| Component | Purpose |
|-----------|---------|
| `FI_STAFF_UAT_MODE_ENABLED` | Env flag; registered in `schema.ts` + `.env.example` |
| `staffUatScreenGuide.ts` | Purpose / next action / common mistakes per screen |
| `StaffUatScreenGuide` | Collapsible in-app banner (UAT mode only) |
| `StaffUatClarityFeedback` | “Was this clear?” 1–5 + comment → API |
| `StaffUatContext` | Friction logging + auto module-bounce detection |
| `POST /api/tenants/[tenantId]/staff-uat/telemetry` | Feedback + friction ingest |

### Screen coverage

| Screen | Guide | Clarity feedback | Friction hooks |
|--------|-------|------------------|----------------|
| Reception Board | ✓ | ✓ | Alert link opens |
| CalendarOS | ✓ | ✓ | Module bounce (global) |
| Surgery Booking Wizard | ✓ | ✓ | Abandon, validation |
| Patient Profile | ✓ | ✓ | Module bounce |
| Patient Journey Ribbon | ✓ (journey guide) | via profile | — |
| Procedure Day Board | ✓ | ✓ | — |
| WorkforceOS | ✓ | ✓ | Module bounce |

### UX fixes (Sprint 9)

| Area | Fix |
|------|-----|
| Reception empty day | Dual CTAs: “Open calendar” + “Find or add patient” |
| Surgery wizard | Explicit “Cancel booking” with abandon friction log |
| Procedure Day | Removed duplicate Quick Create link (Sprint 8 carry); clarity feedback footer |
| FiOsEmptyState | Optional `secondaryAction` for two-button empty states |

## Smoke / verification results

| Command | Result |
|---------|--------|
| `pnpm typecheck` | **PASS** |
| `pnpm check:migrations` | **PASS** (Migration versions OK) |
| `pnpm test:unit` | **3829 pass / 22 fail** — new `staffUatFrictionCore` + `staffUatScreenGuide` suites pass; failures are pre-existing (CRM nav, Google Calendar GC-8, Nexus, workforce guard, etc.) |
| `pnpm smoke:operational-day` | **PASS** 7/7 — reception loader ~27s cold (over 15s budget, F4) |

## Friction & blockers (inherited + status)

| ID | Severity | Finding | Sprint 9 status |
|----|----------|---------|-----------------|
| F1 | Low | `pipeline_stage_id` missing on demo `fi_crm_leads` | **Open** — non-blocking loader warning |
| F2 | Medium | Demo surgeries lack staff/room on some rows | **Mitigated** — blockers visible; calendar drawer + readiness links |
| F3 | Low | Follow-up task `none` after procedure complete on demo | **Open** — journey still passes |
| F4 | Medium | Reception board cold load ~17–18s (>15s budget) | **Open** — acceptable for pilot; not architecture change |
| F5 | Resolved | Surgery staff overlap on repeat smoke | Sprint 7 fix |
| F6 | Resolved | Room eligibility / clinicId | Sprint 7 fix |
| F7 | Resolved | Reception empty day single CTA | Sprint 9 dual CTAs |
| F8 | Resolved | Wizard close without cancel affordance | Sprint 9 “Cancel booking” + abandon telemetry |

## UAT telemetry review

After staff walkthrough with `FI_STAFF_UAT_MODE_ENABLED=1`, query `fi_platform_events` for:

- `staff.uat.feedback` — clarity ratings by `screenKey` and `route`
- `staff.uat.friction` — top `frictionType` counts (`wizard_validation_error`, `navigation_module_bounce`, etc.)

## Manual sign-off

| Role | Name | Date | Result |
|------|--------|------|--------|
| Receptionist | | | Pending |
| Nurse | | | Pending |
| Doctor | | | Pending |
| Surgery coordinator | | | Pending |
| Finance / admin | | | Pending |
| Engineering | Automated harness | 2026-07-02 | **PASS** (smoke 7/7) |

## Commands reference

```bash
# Enable UAT helpers locally
FI_STAFF_UAT_MODE_ENABLED=1

pnpm typecheck
pnpm check:migrations
pnpm test:unit
pnpm smoke:operational-day
pnpm smoke:operational-day:execute
pnpm smoke:operational-day:execute:procedure-day
```