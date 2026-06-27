# Evolved — Financial Clearance & Surgery Deposit SOP

**Sprint:** FI-PH1 Task 5  
**Production tenant:** Evolved Hair Restoration (Perth)  
**Scope:** Manual payment tracking, FinancialOS clearance, surgery day gates  
**Status:** Operator SOP — must be signed before go-live

**Related**

- [Financial safety audit](./evidence/financial-safety-audit.md)
- [P0 operator checklist](./evolved-p0-operator-execution-checklist.md)
- [Evolved production blockers — BLK-FIN-01/02](./evolved-production-blockers.md)

---

## 1. Source of truth — what counts as “paid”

### Manual `fi_payment_records`

- Rows in **`fi_payment_records`** are **operational tracking records** entered by authorised staff (`fi_admin`, `finance`, `manager`, `owner`).
- They are **not** proof of card capture, bank settlement, or Stripe payment success.
- Staff must **never** treat `status: paid` on a manual record as equivalent to POS/bank confirmation without independent verification (receipt, bank deposit, finance admin ack).

### Stripe / RevenueOS (`fi_payments`, invoices)

- Live card payments flow through **Stripe webhooks** into `fi_payments` and invoice state — **separate** from manual records.
- There is **no automatic sync** from Stripe success → `fi_payment_records` in FI-PH1 scope.
- If both systems are in use, finance admin must reconcile discrepancies; clinical staff must not override clinical/surgery state based on manual rows alone.

### FinancialOS clearance badge

- Dashboard clearance (`financialClearanceCore`) is **advisory** for most workflows.
- A **narrow server guard** (FI-PH1 Task 5) blocks **surgery booking confirmation** only when:
  - `booking_type = surgery`
  - Status changes to **confirmed**
  - Procedure is within the **14-day** tenant window
  - FinancialOS clearance state is explicitly **`not_ready`**
- The guard does **not** block when clearance is `unavailable` (insufficient financial signal) or when no manual payment record exists.

---

## 2. Surgery cannot proceed without staff-verified clearance

**Rule:** A patient must **not** enter the procedure room on surgery day unless deposit/clearance has been **verified by named staff** using this SOP — not inferred from UI badges alone.

| Verification | Acceptable evidence |
|--------------|---------------------|
| Deposit collected | Finance admin or reception lead confirms bank/POS/pathway settlement **or** manual record matches verified receipt |
| Balance / pathway | FinancialOS shows `financially_cleared`, `deposit_ready`, or `paid_in_full` **and** finance admin has no open dispute |
| Manual-only tracking | Signed procedure-day row on checklist (§5) with finance contact initial |

**Escalation:** If clearance is disputed on procedure day, **clinical lead + finance admin** must agree in writing (email/ticket) before proceeding.

---

## 3. Manual fallback procedure

Use when FinancialOS data is incomplete, Stripe is disabled, or clearance shows `unavailable`:

1. **Before confirming surgery booking (calendar):**
   - Create a **manual surgery payment record** for the case/booking with expected deposit amount and due date.
   - Record deposit collection method (EFTPOS, transfer, pathway reference) in record notes.
   - Do **not** set `paid` until finance/reception verifies funds.

2. **When confirming booking in FI Admin:**
   - If system blocks confirmation (guard message: *“Surgery confirmation blocked: financial clearance is not ready”*), resolve FinancialOS setup (deposit invoice, pathway, deposit record) **or** obtain **finance admin override** documented in CRM activity.

3. **When no payment record exists:**
   - Treat as **not financially verified** — complete manual record before confirmation regardless of UI “Payment clear” on procedure day boards.

4. **Procedure day:**
   - Reception runs §5 checklist; any “No” → hold patient; notify consultant + finance.

---

## 4. Who signs off

| Role | Responsibility | Sign-off required |
|------|----------------|-------------------|
| **Finance admin** | Deposit truth, manual record accuracy, pathway settlement | Training ack §6; disputed clearance |
| **Reception lead** | Procedure-day checklist execution | Daily surgery list |
| **Clinical ops / consultant lead** | Final go/no-go on procedure day after finance ack | High-risk clearance exceptions |
| **Evolved clinic lead** | SOP adoption for go-live | This document §6 |

---

## 5. Procedure-day checklist

Complete **morning of surgery** for each patient on the OR list. Retain copy (paper or ticket) for 7 years per clinic records policy.

| # | Check | Y / N | Initials |
|---|-------|-------|----------|
| 1 | Surgery booking status = **confirmed** (or arrived per clinic policy) | | |
| 2 | Manual surgery payment record exists **or** finance admin documented why N/A | | |
| 3 | Deposit verified by finance/reception (not UI badge alone) | | |
| 4 | FinancialOS clearance ≠ `not_ready` / `attention_required` **or** finance admin override on file | | |
| 5 | No open finance dispute on case (refund, chargeback, pathway rejection) | | |
| 6 | Patient identity and consent proxy verified (separate clinical checklist) | | |

**If any of 2–5 is No:** Do **not** start procedure until finance admin + clinical lead sign exception or issue resolved.

---

## 6. Sign-off table

| Party | Name | Role | Date | Signature / ticket ref |
|-------|------|------|------|------------------------|
| Finance admin | | | | |
| Reception lead | | | | |
| Clinical ops | | | | |
| Evolved clinic lead | | | | |

**Training acknowledgement (BLK-FIN-01):** I understand manual `fi_payment_records` are not Stripe/bank proof and surgery requires staff-verified clearance per this SOP.

| Staff name | Role | Date | Initials |
|------------|------|------|----------|
| | | | |
| | | | |

---

## 7. Revision history

| Date | Change | Author |
|------|--------|--------|
| 2026-06-27 | FI-PH1 Task 5 initial SOP + guard documentation | FI-PH1 execution |
