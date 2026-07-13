# FI-TRUST-MONEY-AND-READINESS-1

**Status:** Phase 2 — DEF-MONEY-01 live verified (M4 PASS); readiness live matrix still open  
**Date:** 2026-07-13  
**Depends on:** FI-TRUST-LANDING-AND-SPINE-1, FI-ROLE-JOURNEY-BAKE-1 (deferred gaps)  
**Plan:** [fi-trust-money-and-readiness-1-plan.md](./fi-trust-money-and-readiness-1-plan.md)

## Goal

Make **Money** and **surgery readiness** trustworthy for staff: clear payment truth, staff/room assignment discipline, and clearance language that points to Money (not architecture brands).

---

## Phase 1 audit-only findings (2026-07-13)

### Initial state summary

| Area | Code / unit state | Live state (prior bake) | Gap |
| ---- | ----------------- | ----------------------- | --- |
| Money hub copy | `moneyTrustCopy.ts` + tests **PASS** | **GREEN** — harsh@ finance_admin post-`4e08a911` | Re-verify after any deploy |
| `FI_PAYMENTS_ENABLED` off | Nav + `/payments` page **PASS** (unit) | **GREEN** — honest disabled + Money link | None |
| Payment row labels | `/financial/payments` — **Source** column + label map | **PASS** — M4 live bake 2026-07-13 (seeded rows) | None |
| Clearance guard | `moneyClearanceBlockedStaffMessage` → Money | Unit **PASS** | Live confirm on booking confirm |
| Clearance panel | `FinancialClearancePanel` renders `clearance_reason` | Not live-verified on boards | **DEF-READY-01** — unavailable reason cites "FinancialOS signals" |
| Readiness board model | Staff/room issues + escalation **PASS** (unit) | Not live-verified end-to-end | Live bake required |
| Tomorrow board | Manual payment copy in model **PASS** | Not live-verified | Live bake required |
| Procedure day | Flag off non-interference **mostly PASS** | Hidden (expected) | 1 pre-existing unit fail (nav subtest) |
| Staff mapping | — | **PASS** 10/10 (includes harsh@) | None |

### Code audit — payment source labelling

**`/financial/payments`** (`app/(fi-admin)/fi-admin/[tenantId]/financial/payments/page.tsx`):

- Header: *"Allocated payments on invoices (includes Stripe and manual)."*
- Table columns: Status, **Provider**, Total, Invoice, Created
- Loader (`loadFinancialOsPayments`) reads `fi_payments.provider` — raw provider string, no staff-facing **Manual tracking** vs **Provider confirmed (Stripe)** label
- **Gap:** No `Source` column; no mapping of `provider` values to trust copy aligned with Money banner

**Dual payment truth (documented, not fixed in Phase 1):**

- `fi_payment_records` — manual surgery deposit tracking (`paymentRecordModel.ts`)
- `fi_payments` — invoice allocations / Stripe path
- No automatic sync; row labels must not imply either is bank proof

### Code audit — clearance / Money copy

| Surface | Money-aligned? | Notes |
| ------- | -------------- | ----- |
| `moneyClearanceBlockedStaffMessage` | **Yes** | Booking confirmation guard uses this |
| `moneyPaymentTruthBanner` | **Yes** | Manual-only vs dual-path banner |
| `FINANCIAL_CLEARANCE_STATE_LABELS` | **Yes** | Neutral labels ("Not financially ready", etc.) |
| `buildFinancialClearance` unavailable `clearance_reason` | **No** | *"…no FinancialOS signals exist for this context."* — staff-visible via `FinancialClearancePanel` on case/readiness/tomorrow |
| `FinancialSurgeryPipelineInline` links | **Partial** | Links to `/financial/*` sub-routes, not Money hub headline |
| `SURGERY_READINESS_ISSUE_LABEL` payment issues | **Yes** | Explicit *"manual tracking — not bank/card proof"* |
| `SURGERY_DEPOSIT_BOARD_COPY` | **Yes** | *"No manual surgery payment record yet."* |

### Unit test baseline (Phase 1)

**Command:** Money + readiness bundle (10 files) — see plan doc §10.

| Metric | Value |
| ------ | ----- |
| Tests | 97 |
| Pass | 96 |
| Fail | 1 |
| Failed test | `procedureDayNonInterference` → nav omits procedure day when flag off (pre-existing; `resolveClinicOsShellNavItems` assertion) |

**Staff mapping:**

```
operators_with_login: 10
missing_fi_staff: 0
PASS
```

### Gaps identified (no fixes in Phase 1)

| ID | Class | Finding | Recommended Phase 2 action |
| -- | ----- | ------- | -------------------------- |
| DEF-MONEY-01 | P2 | `/financial/payments` lacks row-level manual vs provider-confirmed staff labels | Add Source column + label map; live verify with seeded rows |
| DEF-READY-01 | P2 | Clearance unavailable reason + board links still reference FinancialOS / `/financial/*` not Money | Replace staff-facing unavailable copy; optional Money hub link on panels |
| READY-LIVE-01 | P2 | Surgery readiness board not live-verified post staff/room wiring | Doctor/manager live bake on `/surgery-readiness` |
| TMRW-LIVE-01 | P2 | Tomorrow board financial chips not live-verified | Nurse live bake on `/front-desk/tomorrow` |
| MONEY-LIVE-01 | P3 | Prior bake: empty payment list — row labels unproven | **CLOSED** — seed script + M4 PASS 2026-07-13 |
| TC-NAV-01 | P3 | Pre-existing procedure day nav unit fail | Hygiene — out of milestone unless blocking |

---

## Phase 2 fix notes (2026-07-13)

### DEF-MONEY-01 — payment row source labels — **FIXED (code)**

- New pure helper `moneyPaymentRowSourceLabel(provider)` in `src/lib/financialOs/moneyTrustCopy.ts`:
  - `null` / empty / `manual` → **Manual tracking**
  - `stripe` (case-insensitive) → **Provider confirmed (Stripe)**
  - other providers → **Provider confirmed (\<provider\>)**
- `/financial/payments` page: **Provider** column replaced with **Source** column rendering the label (amber for manual, emerald for provider-confirmed); header description now states manual rows are operational tracking, not bank/card proof.
- No new modules; label map lives in existing Money trust copy module.
- Live verification (M4) **PASS** — seeded `fi_payments` rows (see §M4 live bake below).

### M4 live bake — payment row source labels (2026-07-13T20:53 AEST)

**Seed:** `scripts/seed-evolved-smoketest-payments.ts` (`npm run seed:evolved-smoketest-payments -- --commit`)

| Row | Payment ID | Provider | Total | Source label (live) | Colour |
| --- | ---------- | -------- | ----- | ------------------- | ------ |
| SMOKETEST-PAYMENT-MANUAL | `230631c0-f850-45e6-bbff-30347fad61d7` | `null` | AUD 550.00 | **Manual tracking** | amber |
| SMOKETEST-PAYMENT-STRIPE | `2abda5f6-48c5-468d-8455-22917ee0f6ff` | `stripe` | AUD 825.00 | **Provider confirmed (Stripe)** | emerald |

**Session:** platform-admin impersonation of **`harsh@evolvedhair.com.au`** on Evolved tenant `c2615b95-b707-4485-aa5f-be8f78ec868a`. Tool: cursor-ide-browser MCP. Production: `follicleintelligence.ai`.

| Check | Result |
| ----- | ------ |
| M4 — `/financial/payments` Source column | **PASS** — manual amber + Stripe emerald labels |
| Money hub (`/financial-os`) spot-check | **PASS** — title, truth banner, Finance workspace |
| `FI_PAYMENTS_ENABLED` off (`/payments`) | **PASS** (prior bake) |

**M4 verdict:** **PASS** — DEF-MONEY-01 row labels proven live. MONEY-LIVE-01 closed.

### DEF-READY-01 — clearance unavailable copy — **FIXED (code)**

- `buildFinancialClearance` unavailable `clearance_reason` no longer cites "FinancialOS signals"; now: *"Financial data could not be loaded or no payment or invoice records exist for this booking yet. Check deposits and invoices in Money."*
- Unavailable `next_required_action` (both emit sites in `financialClearanceCore.ts`) now: *"Check deposits and invoices in Money, or reload financial data"*.
- Board links portion of DEF-READY-01 (`FinancialSurgeryPipelineInline` `/financial/*` sub-links) unchanged — panel links are functional routes, not brand copy; out of contained scope.

### Unit tests

- `moneyTrustCopy.test.ts` — new case: source label map (stripe, Stripe, manual, null, whitespace, unknown provider).
- `financialClearanceCore.test.ts` — new case: unavailable staff copy matches `/Money/`, does not match `/FinancialOS/` (reason + next action).
- Bundle re-run (10 files): **98/99 pass** — only failure remains pre-existing `procedureDayNonInterference` nav subtest (TC-NAV-01).

---

## Prior implementation + bake history (reference)

The following was delivered and live-baked during the bake-1 overlap window. Phase 1 audit treats Money hub **copy + finance_admin landing** as established; **row labels + readiness live matrix** remain open.

### Delivered (code)

| Item | Change |
| ---- | ------ |
| Money hub title + banner | Page title **Money**; amber truth banner (manual vs Stripe) |
| Money CTAs | Take payment / payment records path by `FI_PAYMENTS_ENABLED`; Pipeline/Surgery/Reports links |
| Clearance guard copy | Blocks message says **Money**, not FinancialOS |
| Readiness issues | `missing_staff_assignment`, `missing_room_assignment` with 7-day high-risk escalation |
| Wired loaders | Surgery readiness board, tomorrow board, procedure day |

### Key files

- `src/lib/financialOs/moneyTrustCopy.ts`
- `src/components/fi-admin/financial-os/FinancialOsCommandCentreDashboard.tsx`
- `app/(fi-admin)/fi-admin/[tenantId]/financial-os/page.tsx`
- `src/lib/surgery/surgeryReadinessBoardModel.ts`
- `src/lib/bookings/bookingSurgeryFinancialClearanceGuardCore.ts`
- `app/(fi-admin)/fi-admin/[tenantId]/financial/payments/page.tsx`

### Explicit non-goals

- Full `/financial/*` tree merge  
- Hard-block procedure day start (SOP still owns OR-day hold)  
- Stripe auto-sync to manual payment records  

### Finance live bake (2026-07-13T20:39 AEST — post `4e08a911` deploy)

**Session:** platform-admin impersonation of **`harsh@evolvedhair.com.au`** on Evolved tenant `c2615b95-b707-4485-aa5f-be8f78ec868a`. Tool: cursor-ide-browser MCP.

| Check | Result |
| ----- | ------ |
| Money hub (`/financial-os`) | **PASS** |
| Manual payment truth banner | **PASS** |
| `FI_PAYMENTS_ENABLED` off (`/payments`) | **PASS** (prior bake) |
| Deposit / clearance language (hub tiles) | **PASS** |
| Finance-admin landing redirect | **PASS** |
| Workspace badge | **PASS** — Finance workspace |
| Payment row source labels | **PASS** — M4 live bake with seeded SMOKETEST rows |
| Readiness / tomorrow live matrix | **NOT RUN** — deferred to this milestone |

**Verdict (Money hub subset):** **GREEN** for finance_admin Money landing + truth copy. **Full milestone GREEN** requires readiness live matrix + payment row labelling.

Full matrix: [fi-role-journey-bake-1.md §1h](./fi-role-journey-bake-1.md#1h-live-browser-bake-harsh--admin-harsh-session).

---

## Release decision (current)

**AMBER — Money hub + payment row labels GREEN; readiness live matrix incomplete**

- Money hub subset: **GREEN** (prior + spot-check evidence)
- Payment row labels: **GREEN** — DEF-MONEY-01 code + M4 live PASS
- Readiness/tomorrow end-to-end: **open** (READY-LIVE-01, TMRW-LIVE-01)
- Clearance copy consistency: **code fixed** (DEF-READY-01) — live confirm pending

Remaining for **Phase 2**: live bake sequence per plan doc §9 (readiness/tomorrow matrix).
