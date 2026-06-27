# Evolved Production Evidence — Financial Safety Audit

**Sprint:** FI-PH1 Task 4  
**Blockers:** BLK-FIN-01, BLK-FIN-02  
**Audit date:** 2026-06-27  
**Scope:** `fi_payment_records`, Stripe webhooks, FinancialOS clearance, surgery gates

---

## Executive summary

| Question | Answer |
|----------|--------|
| Can surgery proceed without verified payment clearance? | **Yes** — no hard server gate blocks procedure progression |
| Can staff mistake manual payments for live card capture? | **Yes, risk remains** — UI shows paid/clear labels from manual rows; copy exists in model layer but enforcement is advisory |
| Is Stripe required for Evolved go-live? | **No** for FI-PH1 if manual tracking + ops checklist used |
| Is FinancialOS clearance enforced? | **No** — explicitly advisory |

**Verdict:** BLK-FIN-01 **validated** (risk real, mitigations partial). BLK-FIN-02 **validated** (gate incomplete). Both **still blocking** without ops mitigations + optional P1 code hardening in Task 5.

---

## `fi_payment_records` — manual tracking only

### Code contract

`src/lib/payments/paymentRecordModel.ts`:

- Header comment: *"Manual payment / deposit tracking — pure helpers (not integrated billing)."*
- `summarizePaymentRecordsForOperations`: KPIs from **persisted rows only**; absence of row **not** counted as due/unpaid.
- Surgery labels: `no_tracking` → *"No manual surgery payment record yet."*

### Mutation access

- Roles: `fi_admin`, `admin`, `manager`, `finance`, `owner` (`PAYMENT_MUTATION_ROLES_LOWER`).
- Staff can set `status: paid` without Stripe confirmation — **by design** for manual ledger.

### UI surfaces

| Surface | Behaviour |
|---------|-----------|
| Surgery readiness board | `surgery_deposit_pending` issue only when **manual row exists** and needs collection |
| Procedure day pre-op | `depositOkOrUntracked: true` when **no row** OR row satisfied |
| Tomorrow board | Notes manual records explicitly |
| Financial clearance badge | Advisory badge — `FinancialPaymentPathwayBadge`: *"never blocks the surgery flow"* |

**BLK-FIN-01 finding:** Staff can mark paid manually OR interpret missing row as "no payment issue" (`depositOkOrUntracked`).

---

## Stripe webhook processing

| Component | Path |
|-----------|------|
| Webhook route | `app/api/fi-payments/stripe/webhook/route.ts` |
| Idempotency | `src/lib/payments/stripeWebhookIdempotency.ts` — unique on `(tenant_id, provider_payment_intent_id)` |
| Invoice linkage | `src/lib/revenueOs/revenueInvoiceMutations.server.ts` |

Stripe path writes **`fi_payments`** / invoice state — **separate** from `fi_payment_records`.

**Gap:** No automatic sync from Stripe success → `fi_payment_records.status = paid`. Two parallel payment truths possible.

**BLK-FIN-03 (related):** Webhook idempotency tested in unit tests; production push depends on migration state — defer unless Stripe enabled.

---

## FinancialOS clearance engine

`src/lib/financialOs/financialClearanceCore.ts` (line 5):

> *"Does not block surgery workflows — operational visibility only."*

### Signals unified (advisory)

- Deposit/balance invoice state
- Payment pathways (super release, international transfer, medical finance)
- Installments, failed payments, 14-day surgery window

### Cron support

- `vercel.json`: clearance snapshots daily `0 23 * * *` with `horizonDays=14`
- Handler: `app/api/cron/financial-os/clearance-snapshots/route.ts`
- Persists snapshots for dashboard/Tomorrow board — **does not block mutations**

### Blocking logic exists but is not wired to surgery mutations

`buildWorkflowBlockers` can emit *"Surgery within clearance window with unresolved funds"* — surfaced in UI counts (`financialClearanceAttention`) only.

---

## Surgery deposit enforcement (detailed)

### When manual record exists

`procedureDayBoardModel.ts`:

- `paymentRecordNeedsCollection` → action `surgery_deposit_pending`
- Escalates to **high_risk** within 7 days (`surgeryReadinessBoardModel.test.ts`)

### When manual record absent

- `depositOkOrUntracked = true`
- No `surgery_deposit_pending` issue
- Procedure day shows **Payment clear** via `depositOkOrUntracked` (`surgeryPresentation.ts`)

**Answer to BLK-FIN-02:** Deposit clearance is **not fully enforced**. Surgery can proceed with **zero payment tracking**.

### Invoice-level hint (partial)

`revenueInvoiceMutations.server.ts` can set `blocks_surgery_readiness_when_unpaid` on automation hints — depends on deposit rules configuration and invoice pipeline being in use.

---

## Payment risks (ranked)

| Priority | Risk | Impact |
|----------|------|--------|
| **P0** | Manual `paid` status trusted like bank confirmation | Revenue loss / wrong-day surgery |
| **P0** | No row = treated as financially OK on procedure day | Unpaid surgery |
| **P1** | Stripe + manual records diverge | Reconciliation errors |
| **P1** | Clearance engine advisory only | Ops bypass without audit |
| **P2** | `fi-payments/reminders` cron not in `vercel.json` | Missed revenue signals if invoices enabled |

---

## Missing safety gates

1. **Hard gate** on surgery booking status transition → `financially_cleared` or verified invoice paid
2. **Require** deposit rule + invoice OR manual record before confirming surgery booking
3. **Stripe → manual record** reconciliation job (or single SoR)
4. **Staff training** artifact signed (outside code)
5. **Procedure day lock** when `financialClearance.state === not_ready` within 14-day window

---

## Existing mitigations (FI-PH1 acceptable if enforced manually)

- Manual clearance checklist on procedure day (`evolved-production-blockers.md` BLK-FIN-02 mitigation)
- Dashboard `financialClearanceAttention` count
- Tomorrow board FinancialClearance badge
- Deposit rules UI (`/financial/deposit-rules`) — **if configured**

---

## Remediation priority

| ID | Action | Owner | Phase |
|----|--------|-------|-------|
| R1 | Staff training: manual records ≠ POS; Stripe separate | Evolved ops | **P0 go-live** |
| R2 | Mandate manual surgery payment record before booking confirm | Evolved ops SOP | **P0 go-live** |
| R3 | Vercel env: keep Stripe disabled until dedupe + webhook smoke | Platform | P1 |
| R4 | Add server guard on surgery status → clearance (minimal diff) | Engineering | **Task 5** candidate |
| R5 | Schedule `fi-payments/reminders` when invoices live | Platform | P1 |

---

## Safe analysis performed

- Static review of payment model, clearance core, procedure day model, webhook handler
- Unit test references verified in grep (no production DB queries)
- `pnpm run typecheck` — PASS

---

## BLK-FIN disposition

| Blocker | Validated | Auto-resolved | Still blocking |
|---------|-----------|---------------|----------------|
| BLK-FIN-01 | Yes | No | **Yes** (ops/training + dual-truth risk) |
| BLK-FIN-02 | Yes | Partial (guard) | **Yes** (SOP + guard; untracked payments remain ops risk) |
| Task 5 disposition | **Partial** — code guard implemented; SOP + training sign-off pending |

---

## Task 5 — Minimal code guard (implemented)

**Central mutation point:** `updateBooking` in `src/lib/bookings/bookings.ts` — all surgery booking status changes flow through this function (server actions, tenant PATCH API, reception board).

**Guard modules:**

| File | Role |
|------|------|
| `src/lib/bookings/bookingSurgeryFinancialClearanceGuardCore.ts` | Pure transition/window/block logic (unit tested) |
| `src/lib/bookings/bookingSurgeryFinancialClearanceGuard.server.ts` | Loads FinancialOS clearance via `resolveFinancialClearanceForBooking` |

**Behaviour:**

- Blocks only when transitioning **surgery** booking to **`confirmed`**
- Procedure within tenant **14-day** window (same window as surgery readiness board)
- FinancialOS clearance state is explicitly **`not_ready`**
- Does **not** block: `unavailable`, `attention_required`, other states, or surgeries outside 14 days
- Does **not** block when no payment record exists (clearance stays `unavailable` or non-blocking states)
- Error message: operational text directing staff to FinancialOS or finance admin sign-off

**Deferred (not in scope):** Hard gate on `arrived`/`completed`, Stripe→manual sync, require payment record before confirm.

---

## Evidence Closure Checklist

| # | Evidence item | Artifact placeholder | Owner | Target date | Status |
|---|---------------|----------------------|-------|-------------|--------|
| E1 | Financial SOP signed ([evolved-financial-clearance-sop.md](../evolved-financial-clearance-sop.md)) | SOP §6 sign-off table | Financial ops | | ☐ |
| E2 | Staff training ack: manual records ≠ Stripe proof | SOP §6 training table | Financial ops | | ☐ |
| E3 | Procedure-day checklist assigned (reception + finance) | SOP §5 + named contacts | Clinical ops | | ☐ |
| E4 | Guard behaviour verified in staging (confirm blocked when `not_ready` within 14d) | Test note / screenshot | Engineering | | ☐ |
| E5 | Finance admin acknowledges dual-truth if invoices enabled later | SOP or change log | Financial ops | | ☐ |

**Closure rule:**

- **BLK-FIN-01** → **Complete** when E1 + E2 signed
- **BLK-FIN-02** → **Complete** when E1 + E3 + E4; guard reduces but does not eliminate untracked-payment risk (accepted only with SOP)
