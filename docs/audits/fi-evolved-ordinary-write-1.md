# FI-EVOLVED-ORDINARY-WRITE-1 — Findings

**Milestone:** `FI-EVOLVED-ORDINARY-WRITE-1`  
**Status:** **GREEN (complete)**  
**Date:** 2026-07-14  
**Tenant:** Evolved Hair Restoration `c2615b95-b707-4485-aa5f-be8f78ec868a` (`evolved-hair`)  
**Plan:** [fi-evolved-ordinary-write-1-plan.md](./fi-evolved-ordinary-write-1-plan.md)  
**Prior:** `FI-EVOLVED-OPERATIONAL-PILOT-1` GREEN (scoped) · `FI-EVOLVED-MUTATION-DEPTH-1` GREEN (scoped)  
**Fix SHA:** `8432111a` (live on production for re-bake)

---

## Executive summary

Ordinary raw-password Consultant write parity restored. Pre-fix: `manager@evolvedhair.com.au` (no Exit impersonation) saw Pipeline Read-only while impersonation/platform-admin proxy could mutate. Root cause: CRM shell granted via `fi_staff.staff_role`, but `canUseClinicFeatures` ignored those staff roles. Fix `8432111a` grants ClinicOS mutate for CRM-operational staff roles. Prod re-bake: stage-move + hard reload **PASS**; golden lead reverted.

**OW-06 (impersonation):** Reception (Jesika) + Nurse (Evie) Front desk Start treatment + hard reload **PASS**; soft-nav Front desk→Calendar **PASS** on Reception. No Read-only banners. Revert unavailable via UI (no undo to Waiting) — SMOKETEST left In treatment (safe).

---

## Session roster

| ID | Role | Identity | Mutation target | Status |
| -- | ---- | -------- | --------------- | ------ |
| OW-01 | Consultant purity | `manager@` raw | Session / claims | **PASS** |
| OW-02 | Consultant write gate | `manager@` raw | Pipeline writable | **PASS** (post-fix) |
| OW-03 | Consultant stage-move + reload | `manager@` raw | Golden SMOKETEST | **PASS** |
| OW-06 | Reception/Nurse (optional) | Impersonation (Jesika → Evie) | Front desk Start treatment + reload | **PASS** |

---

## Evidence log

| ID | Check | Result | Notes |
| -- | ------ | ------ | ----- |
| OW-01 | Raw Consultant purity | **PASS** | Consultant workspace; `manager@…`; profile = Switch workspace / Sign out only — **no Exit impersonation** |
| OW-02 | Pipeline writable (raw) | **PASS** | Pre-fix: banner `Read-only: you can browse Pipeline and open leads, but changes are unavailable.` + lead “not change CRM data”. Post-`8432111a`: banner gone; **New enquiry**; Change stage combobox present |
| OW-03 | Stage-move + reload (raw) | **PASS** | Golden `c9a58f3d-…` SMOKETEST-OPDAY-20260702: Treatment planning → Quote sent (`fi_admin_lead_slideover`); hard reload held Quote sent; reverted → Treatment planning |
| OW-04 | No impersonation required | **PASS** | Entire Consultant bake under ordinary raw session |
| OW-05 | True read-only preserved | **PASS** | Unit: `member` alone, `nurse`, `doctor`, `dashboard_viewer` still denied |
| OW-06 | Optional ordinary write via impersonation | **PASS** | Platform admin → Jesika Reception then Evie Nurse; both Front desk Start treatment + hard reload held; soft-nav FD→Calendar PASS (Reception); ImagingOS reachable (Nurse). See matrix below. |
| OW-07 | No P0 | **PASS** | SMOKETEST-only; no undo-to-Waiting in UI — left In treatment |

---

## OW-06 per-role matrix (2026-07-14)

| Check | Reception (Jesika) | Nurse (Evie) |
| ----- | ------------------ | ------------ |
| Identity | Impersonating `jesika.watt11` · **Reception workspace** · Exit impersonation | Impersonating `evieshackleton1` · **Nurse workspace** · Exit impersonation |
| Read-only on write paths | **None** — New booking / Start consultation / More actions present | **None** — writable More actions present |
| Mutation | **Start treatment** on 08:00 SMOKETEST-TMRW Unavailable: Waiting 2→1, In care 0→1 | **Start treatment** on 10:00 SMOKETEST-TMRW Deposit due: Waiting 1→0, In care 1→2 |
| Hard reload | **PASS** — Waiting=1, In care=1, 08:00 remains In treatment | **PASS** — Waiting=0, In care=2, both SMOKETEST In treatment |
| Soft-nav FD→Calendar | **PASS** — sidebar Calendar soft-click settled `/calendar` week + 2 appts | Not required (Reception already verified) |
| Imaging | N/A | **PASS** — ImagingOS on golden `287348d5-…` (no capture) |
| Revert | No undo-to-Waiting in More actions — left In treatment on SMOKETEST | Same — left both In treatment |

**Order:** Reception first → Exit impersonation → platform admin → Act as Evie → Nurse.

---

## Root cause

| Layer | Behaviour |
| ----- | --------- |
| Shell access | Granted via `isCrmShellNavStaffRole(fi_staff.staff_role)` when `fi_users.role` is `member` |
| Mutation flag | `canUseClinicFeatures` ← `resolveDevelopmentClinicAccessForTenant` |
| Pre-fix gap | Dev clinic access omitted CRM-operational staff roles → shell yes / mutate no |
| Impersonation path | `validPlatformAdminTenantProxy` ORs into Pipeline `canMutate` — MD-01 wrote, MD-05 read-only |
| Fix | Align development clinic gate with CRM shell staff personas (+ `consultant`/`manager` fi_users roles) |

---

## Fix

| Item | Detail |
| ---- | ------ |
| SHA | **`8432111a`** |
| Files | `src/lib/fiOs/developmentClinicAccess.ts`, `.server.ts`, `.test.ts` |
| Change | `DEVELOPMENT_CLINIC_STAFF_ROLES_LOWER` + load active `fi_staff.staff_role`; add `consultant`/`manager` to fi-user clinic roles |

---

## Defects

| ID | Severity | Status | Summary |
| -- | -------- | ------ | ------- |
| OW-P1-01 | **P1** | **Fixed** (`8432111a`) | Raw Consultant Pipeline Read-only vs impersonation write |

---

## Exit checklist

| # | Criterion | Result |
| - | --------- | ------ |
| 1 | OW-01 raw Consultant purity | **PASS** |
| 2 | OW-02 Pipeline writable (raw) | **PASS** |
| 3 | OW-03 stage-move + reload (raw) | **PASS** |
| 4 | OW-04 no impersonation required | **PASS** |
| 5 | OW-05 true read-only preserved | **PASS** |
| 6 | OW-07 no P0 | **PASS** |
| 7 | OW-06 optional PASS or SKIP | **PASS** (Reception + Nurse impersonation write + reload) |

**Overall verdict:** **GREEN (complete)** — Consultant ordinary-write + OW-06 impersonation Reception/Nurse write paths closed.

---

## Related

- [fi-evolved-ordinary-write-1-plan.md](./fi-evolved-ordinary-write-1-plan.md)
- [fi-evolved-mutation-depth-1.md](./fi-evolved-mutation-depth-1.md)
- [fi-evolved-operational-pilot-1.md](./fi-evolved-operational-pilot-1.md)
