# FI-EVOLVED-ORDINARY-WRITE-1 — Findings

**Milestone:** `FI-EVOLVED-ORDINARY-WRITE-1`  
**Status:** **IN PROGRESS — FIX LANDED, AWAITING PROD RE-BAKE**  
**Date:** 2026-07-14  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Plan:** [fi-evolved-ordinary-write-1-plan.md](./fi-evolved-ordinary-write-1-plan.md)  
**Prior:** `FI-EVOLVED-OPERATIONAL-PILOT-1` GREEN (scoped) · `FI-EVOLVED-MUTATION-DEPTH-1` GREEN (scoped)

---

## Executive summary

**P1 confirmed under raw-password Consultant.** Ordinary `manager@evolvedhair.com.au` (Consultant workspace, no Exit impersonation) can open Pipeline and leads but is gated Read-only. Impersonation/platform-admin tenant proxy still writes because `validPlatformAdminTenantProxy` ORs into `canMutate`.

**Root cause:** CRM shell is granted via active `fi_staff.staff_role` (`consultant` / reception / manager), but ClinicOS mutation (`canUseClinicFeatures` → Pipeline `permissions.canMutate`) only looked at `fi_users.role` admin/operator roles, elevated OS roles, and tenant-admin ops roles — not ordinary CRM staff. Same identity under platform-admin proxy bypasses that gap.

**Fix (code):** Grant development ClinicOS mutations for CRM-operational `fi_users.role` (`consultant`, `manager`) and active `fi_staff.staff_role` values aligned with shell staff nav. Nurse/doctor/`member` without those staff roles stay denied.

---

## Kickoff readiness

| Item | Result |
| ---- | ------ |
| Plan read | **Done** |
| Findings status | **IN PROGRESS** |
| Browser login | Raw `manager@evolvedhair.com.au` — Consultant workspace; profile menu = Switch workspace / Sign out only (no Exit impersonation) |
| First action | Capture Complete (OW-01 / OW-02) |

---

## Session roster

| ID | Role | Identity | Mutation target | Status |
| -- | ---- | -------- | --------------- | ------ |
| OW-01 | Consultant purity | `manager@` raw | Session / claims | **PASS** |
| OW-02 | Consultant write gate | `manager@` raw | Pipeline Read-only vs writable | **FAIL** (pre-fix; fix pending prod) |
| OW-03 | Consultant stage-move + reload | `manager@` raw | Golden SMOKETEST stage-move | **BLOCKED** pending prod deploy |
| OW-06 | Reception/Nurse (optional) | TBD raw | One safe write path | **SKIP** (pending Consultant GREEN) |

---

## Evidence log

| ID | Check | Result | Notes |
| -- | ------ | ------ | ----- |
| OW-01 | Raw Consultant purity | **PASS** | `/front-desk` + `/crm`; Consultant workspace; `manager@evolvedh…`; profile menu has Sign out / Switch workspace only — **no Exit impersonation** |
| OW-02 | Pipeline writable (raw) | **FAIL** (pre-fix) | Exact banner: `Read-only: you can browse Pipeline and open leads, but changes are unavailable.` Lead preview: `Your role can view this lead but not change CRM data here.` Golden lead `c9a58f3d-…` (SMOKETEST-OPDAY-20260702) opens; stage-move unavailable. Stage shown as Treatment planning / Status open. |
| OW-03 | Stage-move + reload (raw) | — | Awaiting production deploy of write-gate fix |
| OW-04 | No impersonation required | — | Will score after ordinary write succeeds |
| OW-05 | True read-only preserved | **PASS** (unit) | Tests: `member` alone, `nurse`, `doctor`, `dashboard_viewer` still denied |
| OW-06 | Optional ordinary write | **SKIP** | Consultant path not GREEN yet |
| OW-07 | No P0 | **PASS** | Identity correct; read-only is over-gate, not identity breach |

---

## Root cause

| Layer | Behaviour |
| ----- | --------- |
| Shell access | `getCrmShellPageSession` allows via `isCrmShellNavStaffRole(fi_staff.staff_role)` when `fi_users.role` is `member` |
| Mutation UI | `resolvePipelinePermissionsFromSession` → `canMutateClinicFromOperatorContext({ canUseClinicFeatures })` |
| Mutation flag | `CrmShellSession.canUseClinicFeatures` ← `resolveDevelopmentClinicAccessForTenant` |
| Pre-fix gap | Dev clinic access ignored CRM-operational staff roles; `member` + `staff_role=consultant` → shell yes, mutate no |
| Impersonation path | Platform-admin full session / `validPlatformAdminTenantProxy` grants `canMutate` even when operator clinic-features false — explains MD-01 PASS vs MD-05 Read-only |
| Server API | `assertCrmTenantMutationAllowed` also calls `resolveDevelopmentClinicAccessForTenant` — same gate (UI + API) |

---

## Fix

| Item | Detail |
| ---- | ------ |
| Files | `src/lib/fiOs/developmentClinicAccess.ts`, `.server.ts`, `.test.ts` |
| Change | Add `consultant`/`manager` to fi-user clinic roles; grant via `DEVELOPMENT_CLINIC_STAFF_ROLES_LOWER` (consultant, reception, receptionist, manager, owner) when loading active `fi_staff.staff_role` |
| Tests | OW parity unit tests for ordinary staff grant + nurse/doctor/`member` denial |
| Deploy | Pending push → production before OW-02/OW-03 re-bake |

---

## Defects

| ID | Severity | Status | Summary |
| -- | -------- | ------ | ------- |
| OW-P1-01 | **P1** | **Fix landed (awaiting prod bake)** | Raw Consultant Pipeline Read-only vs impersonation write — ordinary CRM staff excluded from `canUseClinicFeatures` |

---

## Exit checklist

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | OW-01 raw Consultant purity | **PASS** |
| 2 | OW-02 Pipeline writable (raw) | FAIL pre-fix → re-bake after deploy |
| 3 | OW-03 stage-move + reload (raw) | — |
| 4 | OW-04 no impersonation required | — |
| 5 | OW-05 true read-only preserved | **PASS** (unit) |
| 6 | OW-07 no P0 | **PASS** |
| 7 | OW-06 optional PASS or SKIP | **SKIP** |

**Overall verdict:** AMBER until production re-bake scores OW-02/OW-03.

---

## Related

- [fi-evolved-ordinary-write-1-plan.md](./fi-evolved-ordinary-write-1-plan.md)
- [fi-evolved-mutation-depth-1.md](./fi-evolved-mutation-depth-1.md)
- [fi-evolved-operational-pilot-1.md](./fi-evolved-operational-pilot-1.md)
