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
