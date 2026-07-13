# FI-TRUST-MONEY-AND-READINESS-1

**Status:** Implemented  
**Date:** 2026-07-13  
**Depends on:** FI-TRUST-LANDING-AND-SPINE-1  

## Goal

Make **Money** and **surgery readiness** trustworthy for staff: clear payment truth, staff/room assignment discipline, and clearance language that points to Money (not architecture brands).

## Delivered

| Item | Change |
| ---- | ------ |
| Money hub title + banner | Page title **Money**; amber truth banner (manual vs Stripe) |
| Money CTAs | Take payment / payment records path by `FI_PAYMENTS_ENABLED`; Pipeline/Surgery/Reports links |
| Clearance guard copy | Blocks message says **Money**, not FinancialOS |
| Readiness issues | `missing_staff_assignment`, `missing_room_assignment` with 7-day high-risk escalation |
| Wired loaders | Surgery readiness board, tomorrow board, procedure day |

## Key files

- `src/lib/financialOs/moneyTrustCopy.ts`
- `src/components/fi-admin/financial-os/FinancialOsCommandCentreDashboard.tsx`
- `app/(fi-admin)/fi-admin/[tenantId]/financial-os/page.tsx`
- `src/lib/surgery/surgeryReadinessBoardModel.ts`
- `src/lib/bookings/bookingSurgeryFinancialClearanceGuardCore.ts`

## Explicit non-goals

- Full `/financial/*` tree merge  
- Hard-block procedure day start (SOP still owns OR-day hold)  
- Stripe auto-sync to manual payment records  

## Live production bake (2026-07-13 — harsh session)

**Session:** platform-admin impersonation of **`harsh@evolvedhair.com.au`** on Evolved tenant `c2615b95-b707-4485-aa5f-be8f78ec868a`. Full matrix: [fi-role-journey-bake-1.md §1h](./fi-role-journey-bake-1.md#1h-live-browser-bake-harsh--admin-harsh-session).

| Check | Result |
| ----- | ------ |
| Money hub (`/financial-os`) | **PASS** — title Money, health snapshot, finance CTAs |
| Manual payment truth banner | **PASS** — amber banner; not POS/bank proof |
| `FI_PAYMENTS_ENABLED` off (`/payments`) | **PASS** — honest disabled state + Money link |
| Deposit / clearance language | **PASS** — Deposits due tile + surgery-day verify copy |
| Payment row source labels | **PARTIAL** — `/financial/payments` empty; header cites Stripe + manual |
| Finance-admin landing redirect | **PARTIAL (P2)** — bare tenant home stays Today, not `/financial-os` |

**Verdict:** Money trust copy and disabled-payments honesty **PASS** on production. Finance-admin **landing** and **row-level payment-source labelling** remain open until role is confirmed and payment data exists.

### Harsh role fix (2026-07-13)

Reclassified **`harsh@evolvedhair.com.au`** from CFO staff label to **`clinic_admin`** (not `finance_admin`). Auth `fi_tenant_id` was wrongly set to ihrg-global; now Evolved. Expected post-login landing: **Today** (`/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a`), not `/financial-os`. Script: `scripts/reclassify-evolved-harsh-cfo-to-clinic-admin.ts`.

**Re-bake (2026-07-13T19:14 AEST, post `34143d64`/`1f0106e1`):** Production now shows **Clinic manager workspace** (not Director). Landing **Today PASS**; CRM Pipeline **PASS** at `/fi-admin/…/crm` (no `/cases` ejection). Money hub still accessible via More → Finance. Harsh is **not** a `finance_admin` persona — finance-admin landing sign-off remains deferred to a dedicated finance session. Full matrix: [fi-role-journey-bake-1.md §1h](./fi-role-journey-bake-1.md#1h-live-browser-bake-harsh--admin-harsh-session).

### Harsh finance_admin reclassification (2026-07-13 — final Money bake)

Reclassified **`harsh@evolvedhair.com.au`** from **`clinic_admin`** → **`finance_admin`** for the deferred finance-admin live bake. Script: `scripts/reclassify-evolved-harsh-clinic-admin-to-finance-admin.ts` (`--commit`).

| Field | Before | After |
| ----- | ------ | ----- |
| `fi_tenant_admin_users.admin_role` | `clinic_admin` | **`finance_admin`** |
| `fi_staff.staff_role` | `Clinic admin` | **`CFO`** |
| `fi_staff.position_type_id` | `CLINIC_MANAGER` | **`FINANCE_ADMIN`** |
| Derived workspace | `clinic_manager` | **`finance`** |
| Expected landing | Today | **`/fi-admin/c2615b95-b707-4485-aa5f-be8f78ec868a/financial-os`** |

**CRM access:** `finance_admin` does **not** grant CRM shell nav (`tenantAdminRoleAllowsCrmShellNav` = false) — unlike `clinic_admin`. Pipeline access may be limited; finance persona focuses on Money hub.

### Finance live bake (2026-07-13T19:31 AEST — post `eaee3da3`)

**Session:** platform-admin impersonation of **`harsh@evolvedhair.com.au`** on Evolved tenant `c2615b95-b707-4485-aa5f-be8f78ec868a` after `finance_admin` reclassify (`e8fab6d2`) + finance workspace profile fix (`eaee3da3`; Supabase `workspace_profile=finance`). Tool: cursor-ide-browser MCP.

| Check | Result |
| ----- | ------ |
| Money hub (`/financial-os`) | **PASS** — title Money, health snapshot, finance CTAs |
| Manual payment truth banner | **PASS** — amber banner; not POS/bank proof |
| `FI_PAYMENTS_ENABLED` off (`/payments`) | **PASS** — honest disabled state + Money link |
| Deposit / clearance language | **PASS** — Deposits due tile + consultation-to-revenue bridge |
| Finance-admin landing redirect | **PASS** — bare tenant home → **`/financial-os`** (brief Home flash) |
| Workspace badge | **FAIL (P1)** — shell shows **Director workspace**, not **Finance** |
| CRM gate (`/crm`) | **PASS** (expected) — Pipeline flash → **`/cases`** |
| Primary rail + More drawer | **PASS** — 4-slot rail (Today · Front desk · Team · More); More has Finance → Money, Reports, Pipeline |

**Verdict:** Money trust copy, disabled-payments honesty, and **`finance_admin` landing redirect PASS** on production. **Workspace badge still resolves to Director** — `eaee3da3` code/migration may not be deployed to production yet, or impersonation session cache stale; re-bake after deploy + hard refresh required for persona sign-off.

Full matrix: [fi-role-journey-bake-1.md §1h](./fi-role-journey-bake-1.md#1h-live-browser-bake-harsh--admin-harsh-session).
