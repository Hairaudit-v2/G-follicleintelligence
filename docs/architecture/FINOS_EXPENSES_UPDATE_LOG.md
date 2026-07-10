# FinancialOS (FinOS) — Expenses Expansion Update Log

**Last updated:** 2026-07-10  
**Branch:** `main`  
**Module surface:** `/fi-admin/[tenantId]/financial/expenses`  
**Canonical detail log:** [financial-os-expenses-change-log.md](./financial-os-expenses-change-log.md)

This document is the **executive / ops update log** for the FinOS **clinic opex (expenses)** workstream. It records what shipped, where it lives, and how to operate it. Clinical, payments, and Stripe paths were not rewritten.

---

## Status

| Item | State |
|------|--------|
| Stages **1–8** | Shipped on `main` |
| Hosted migrations | Applied through Stage 8 |
| Live QuickBooks API push | **Gated** (env + connector + token) |
| Live Xero API push | Not wired (CSV export available) |

---

## Commit history (expenses track)

| Commit | Summary |
|--------|---------|
| `be5e48d7` | Stage 1 — Phase 1 expenses capture |
| `f2e94858` | Stage 2 — Receipt OCR and document upload |
| `34b89103` | Stage 3 — Lead/case links and document preview |
| `5b244f33` | Stage 4 — Ledger bridge, CPL, FinOS change log |
| `02747283` | Stage 5 — Period filters, spend-by-category, CPG |
| `b12de273` | Stage 6 — P&L, bank recon metrics, QuickBooks export |
| `6619885c` | Stage 7 — COA, multi-clinic P&L, recon confirm, Xero |
| `34b60be7` | Stage 8 — Journals, bulk recon, full CPG, gated live push |

---

## Migrations (hosted)

| Version | Purpose |
|---------|---------|
| `20261007120001` | Expense tables (categories, imports, expenses, documents, audit) |
| `20261009120001` | Storage bucket `fi-financial-documents` |
| `20261010120001` | Ledger kinds `expense_posted` / `expense_void_reversal` + ledger FKs |
| `20261011120001` | GL accounts, bank recon matches, QB/Xero external ids, provider CHECK |
| `20261012120001` | Double-entry journals + accounting push runs |

---

## Stage summaries

### Stage 1 — Capture
Manual expense entry, bank/card CSV parse → review → commit, tenant categories, append-only expense audit. **No ledger writes.**

### Stage 2 — Documents & OCR
Private storage, receipt/invoice upload, stub + optional OpenAI OCR, cron `/api/cron/financial-os/expense-ocr`.

### Stage 3 — Links & preview
Lead/case/campaign linking, attach document to existing expense, signed document preview.

### Stage 4 — Ledger + CPL
Post → master ledger **debit** (`expense_posted`); void → **credit** reverse. Marketing CPL panel. Read-capable preview.

### Stage 5 — Intelligence
Period filter (`?from=&to=`), spend by category, cost-per-graft actuals vs cost models, resolved lead/case labels.

### Stage 6 — P&L & exports
Operating ledger snapshot, bank match **metrics**, FI/QuickBooks CSV + JSON drafts, QuickBooks connector catalog entry.

### Stage 7 — COA & recon workflow
Light chart of accounts, multi-clinic P&L, persisted bank recon suggest/confirm/reject, Xero CSV, dry-run push gates.

### Stage 8 — Journals & live push gate
Balanced double-entry journals on post/void, **Confirm all suggested** recon, full surgery-economics standard CPG, gated QB live Purchase API + push-run audit.

---

## How to use (ops)

1. Open **Finances → Expenses**.
2. Set period (**30d / 90d / YTD** or custom).
3. Capture via **manual**, **CSV**, or **receipt upload**; link lead/case/campaign as needed.
4. **Post** expenses (writes ledger debit + journal Dr/Cr).
5. Review **CPL**, **spend**, **CPG**, **operating P&L**, **multi-clinic P&L**.
6. Bank recon: **Generate suggested matches** → confirm one-by-one or **Confirm all suggested**.
7. Export: FI CSV, QuickBooks CSV/JSON, Xero CSV.
8. Optional live QB push: configure connector + env (below).

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FI_EXPENSE_OCR_PROVIDER` | `stub` (default) or `openai_vision` |
| `OPENAI_API_KEY` | OCR when provider is OpenAI vision |
| `OPENAI_EXPENSE_OCR_MODEL` | Optional model override |
| `FI_EXPENSE_OCR_MIN_CONFIDENCE` | OCR confidence threshold (default ~0.55) |
| `FI_ACCOUNTING_LIVE_PUSH` | Set to `1` to allow live accounting API attempts |
| `FI_QUICKBOOKS_ACCESS_TOKEN` | Bearer token for QBO Purchase API (or connector config `api_key`) |

QuickBooks connector config (OnboardingOS external integrations): `realm_id`, `environment` (`sandbox` \| `production`).

---

## Key paths

| Area | Path |
|------|------|
| UI | `app/(fi-admin)/fi-admin/[tenantId]/financial/expenses/` |
| Components | `src/components/fi-admin/financial-os/expenses/` |
| Domain | `src/lib/financialOs/expenses/` |
| Actions | `lib/actions/financial-os-expense-actions.ts` |
| OCR cron | `app/api/cron/financial-os/expense-ocr/` |
| Entity search API | `app/api/tenants/[tenantId]/financial-os/expense-links/` |
| Detail change log | `docs/architecture/financial-os-expenses-change-log.md` |

---

## Safety notes

1. Additive schema and features only.
2. PaymentsOS / Stripe webhooks / invoice lifecycle not reworked.
3. Master ledger remains append-only; expense debits use new kinds only.
4. Journals require balanced debit = credit.
5. Live accounting push is opt-in and audited in `fi_expense_accounting_push_runs`.
6. Tenant isolation: all expense/journal/recon tables scoped by `tenant_id` + RLS select.

---

## Stage 9+ (backlog)

- OAuth token refresh from encrypted connector credentials  
- Xero live bank-transaction POST  
- Multi-currency journals  
- Period lock / close for journals  
- Full GL trial balance / period reports  

---

## Related FinOS architecture docs

| Doc | Topic |
|-----|--------|
| `financial-os-phase1.md` | Early FinOS infrastructure |
| `financial-os-phase2-payment-pathway-engine.md` | Payment pathways |
| `financial-os-phase3-provider-ready-financing-framework.md` | Financing |
| `financial-os-phase4-financial-clearance-engine.md` | Surgery clearance |
| `financial-os-expenses-change-log.md` | Stage-by-stage technical detail |

---

*Generated as the FinOS expenses expansion update log for Stages 1–8.*
