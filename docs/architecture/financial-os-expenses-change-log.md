# FinancialOS — Expenses Expansion Change Log

**Module:** FinancialOS (FinOS)  
**Surface:** `/fi-admin/[tenantId]/financial/expenses`  
**Status:** Stages 1–4 shipped (additive; revenue payments paths unchanged)

This log tracks the **clinic opex / expenses capture** workstream under FinancialOS. It is separate from earlier FinOS phases (payment pathways, financing, clearance, surgery economics).

---

## Summary timeline

| Stage | Theme | Primary commit theme | Remote migrations |
|-------|--------|----------------------|-------------------|
| **1** | Manual + bank CSV capture | `feat(financial-os): add Phase 1 expenses capture` | `20261007120001_fi_financial_os_expenses_capture` |
| **2** | Receipt/invoice upload + OCR | `feat(financial-os): add expense receipt OCR and document upload` | `20261009120001_fi_financial_os_expense_documents_bucket` |
| **3** | Entity links + attach + preview | `feat(financial-os): link expenses to leads/cases and preview docs` | (no new migration) |
| **4** | Ledger bridge + CPL + read preview | `feat(financial-os): expense ledger bridge, CPL, read preview` | `20261010120001_fi_financial_os_expense_ledger_bridge` |

---

## Stage 1 — Data capture foundation

**Goal:** Get opex into the system without touching the revenue ledger.

### Schema
- `fi_expense_categories` — tenant category tree (system defaults seeded in app)
- `fi_expense_imports` / `fi_expense_import_lines` — CSV batch review queue
- `fi_expenses` — draft → reviewed → posted → void
- `fi_expense_documents` — document metadata + OCR status
- `fi_expense_audit_events` — append-only audit

### Product
- Manual expense form
- Bank/card CSV parse → review → commit
- Module nav: **Expenses** under `/financial/*`
- Write gate: same finance mutate capability as payment records

### Explicit non-goals
- No `fi_financial_transactions` writes
- No OCR / storage bucket yet

### Key paths
- `src/lib/financialOs/expenses/*`
- `lib/actions/financial-os-expense-actions.ts`
- `app/(fi-admin)/fi-admin/[tenantId]/financial/expenses/`

---

## Stage 2 — Receipt / invoice OCR

**Goal:** Capture supplier receipts/invoices with extraction and human review.

### Schema / storage
- Private bucket `fi-financial-documents` (images + PDF + CSV, 15MB)
- Tenant-prefixed paths: `{tenantId}/expenses|inbox|imports/...`

### OCR
- **Stub** (default): ASCII/PDF heuristics; images need manual review
- **OpenAI vision** (optional): `FI_EXPENSE_OCR_PROVIDER=openai_vision` + `OPENAI_API_KEY`
- Inline OCR on upload; cron reprocess for leftover `pending` jobs
- Cron: `/api/cron/financial-os/expense-ocr` every 15m (`vercel.json`)

### Product
- Receipt upload panel
- Documents table + Re-run OCR
- OCR fills empty draft fields only (does not overwrite posted/void)

### Key paths
- `expenseOcrCore.ts`, `expenseOcrProvider*.ts`, `expenseDocumentMutations.server.ts`
- `app/api/cron/financial-os/expense-ocr/`

---

## Stage 3 — Links, attach, preview

**Goal:** Connect opex to clinical/CRM entities and improve document UX.

### Entity linking
- API: `GET /api/tenants/[tenantId]/financial-os/expense-links?q=`
  - Leads via existing CRM consultation search
  - Cases via recent-case filter / UUID
  - Campaign key suggestions from past expenses
- UI pickers on manual entry + **Edit links** on expense rows
- Fields: `lead_id`, `case_id`, `campaign_key`

### Documents
- Attach upload to **new draft** or **existing expense**
- Signed URL preview modal (images/PDF) + open in new tab

### Key paths
- `expenseEntitySearch.server.ts`, `ExpenseLinkPickers.tsx`
- `app/api/tenants/[tenantId]/financial-os/expense-links/`

---

## Stage 4 — Ledger bridge + CPL + read preview

**Goal:** Post expenses into the append-only master ledger; surface marketing CPL; allow read-capable preview.

### Ledger (append-only)
| Event | `transaction_kind` | Direction | Idempotency key |
|-------|--------------------|-----------|-----------------|
| Post expense | `expense_posted` | debit | `tenant:{tid}:expense_posted:{expenseId}` |
| Void posted expense | `expense_void_reversal` | credit | `tenant:{tid}:expense_void_reversal:{expenseId}` |

- Expanded `fi_financial_transactions` kind CHECK
- App invariants: debit allowed for `refund_processed` **and** `expense_posted`
- Columns: `fi_expenses.ledger_post_transaction_id`, `ledger_void_transaction_id`
- Executive revenue aggregations ignore expense kinds (not collection / invoice_created)

### CPL (cost per lead)
- Panel on expenses page (rolling 30 days)
- Marketing spend = posted expenses with category `marketing_*` **or** non-empty `campaign_key`
- CPL = spend ÷ leads created in same window (campaign match case-insensitive)
- Shows overall CPL, unattributed spend, per-campaign table

### Preview access
- Signed URL requires portal + `financial_os` **read** (not write-only)
- Admin key path still supported for tooling

### Key paths
- `expenseLedgerBridge.server.ts`, `expenseCplCore.ts`, `expenseCpl.server.ts`
- `ExpenseCplPanel.tsx`
- Migration: `20261010120001_fi_financial_os_expense_ledger_bridge.sql`

### Env (optional)
```bash
FI_EXPENSE_OCR_PROVIDER=openai_vision   # default stub
OPENAI_API_KEY=...
OPENAI_EXPENSE_OCR_MODEL=gpt-4o-mini
FI_EXPENSE_OCR_MIN_CONFIDENCE=0.55
```

---

## Safety / non-regression notes

1. **Additive only** — no destructive changes to invoices, Stripe webhooks, or payment requests.
2. **PaymentsOS idempotency** preserved — expense ledger keys are namespaced separately.
3. **Tenant isolation** — every query scoped by `tenant_id`; storage paths tenant-prefixed.
4. **Audit** — expense lifecycle + ledger append audits retained.
5. **Revenue clearance / surgery booking** — unchanged; expense posts do not set `financial_os_status` on bookings.
6. **Surgery cost models** — still standard costs; expenses are actuals side-stream (CPL first).

---

## Suggested Stage 5+ (not started)

- Date-range filters on CPL UI
- Cost-per-graft actuals vs `fi_surgery_cost_models` / profitability snapshots
- Chart of accounts / simple P&amp;L by clinic
- Bank statement reconciliation against posted expenses
- Xero export of posted opex
- Soft-link lead picker labels resolved from CRM (display names)

---

## Related FinOS docs (pre-existing)

| Doc | Topic |
|-----|--------|
| `financial-os-phase1.md` | Early FinOS infrastructure |
| `financial-os-phase2-payment-pathway-engine.md` | Payment pathways |
| `financial-os-phase3-provider-ready-financing-framework.md` | Financing providers |
| `financial-os-phase4-financial-clearance-engine.md` | Surgery financial clearance |

This expenses change log is the living record for the **opex capture → ledger → CPL** track under FinOS.
