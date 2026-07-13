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
