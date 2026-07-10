# FinOS User Guide — Gamma PDF Prompt

**Purpose:** Paste the **Prompt for Gamma** section below into [Gamma](https://gamma.app) to generate a polished PDF user guide.  
**Pocket companion:** One-page ops card prompt → [FINOS_OPS_CARD_GAMMA_PROMPT.md](./FINOS_OPS_CARD_GAMMA_PROMPT.md)  
**Grounding:** Labels, kickers, buttons, and section titles are taken from the live FinOS build (`financialOsModuleNav`, page metadata, expense components, command centre). Do not invent alternate product names.  
**Product name in UI:** Primary nav label is **Finances**. Command centre hero also uses **FinancialOS** / **FI OS**. Staff often say **FinOS**.

**Routes (actual):**

| Surface | Path pattern |
|---------|----------------|
| Command centre | `/fi-admin/[tenantId]/financial-os` |
| Revenue & settlement module | `/fi-admin/[tenantId]/financial/*` |
| Expenses (opex) | `/fi-admin/[tenantId]/financial/expenses` |
| Executive finance | `/fi-admin/[tenantId]/financial-os/executive` |
| Accounts receivable | `/fi-admin/[tenantId]/financial-os/accounts-receivable` |
| Surgery cost models | `/fi-admin/[tenantId]/financial-os/cost-models` |

**Access:** Staff need FI Admin portal access and module permission `financial_os` (read). Mutations require payment/expense mutate capability (typically finance/admin roles).

---

## Prompt for Gamma

Copy everything inside the fence:

```
Create a professional clinic operations PDF user guide titled:

"Finances (FinancialOS / FinOS) — Staff User Guide"
Subtitle: "Follicle Intelligence · FI Admin"
Tone: clear, calm, operational. Clinic staff and clinic owners, not developers.
Style: dark clinical fintech aesthetic optional; clean headings; short paragraphs; numbered how-tos; callout boxes for warnings and tips.
Length: comprehensive but scannable — roughly 18–28 pages equivalent / long multi-section doc with TOC.
Do NOT invent UI labels. Use ONLY the product wording listed below (exact casing and phrasing).

============================================================
GLOSSARY (use consistently)
============================================================
- Finances — primary navigation label in FI Admin
- FinancialOS / FinOS — product name (hero on command centre says "FinancialOS"; eyebrow "FI OS")
- Revenue & settlement — page header title on the /financial/* module shell
- Opex capture — kicker on the Expenses page
- Post / Void — actions that write or reverse expense ledger impact
- Attribution links — Lead, Case, Campaign key on expenses
- Payment pathways — settlement intent records
- Pathway inbox — ops tasks for non-standard pathways

============================================================
DOCUMENT STRUCTURE
============================================================

# Cover
Title: Finances (FinancialOS / FinOS) — Staff User Guide
Subtitle: Capture revenue, settle payments, run expenses, and see clinic P&L inside FI Admin
Footer: Internal training · Stages 1–8 expenses shipped

# Table of contents

# 1. What Finances is for
Explain that Finances covers:
- Revenue, payments, deposits, profitability, and collection priorities across clinic operations (command centre blurb)
- Revenue, deposits, installments, and payment automation under the shell titled "Revenue & settlement"
- Clinic opex under Expenses: "Capture clinic costs, post to the ledger, multi-clinic P&L, bank recon confirm, and export to FI / QuickBooks / Xero for the selected period."

Note: Operational booking status is unchanged by financial lifecycle tracking.

# 2. How to open Finances
1. Sign in to FI Admin for your tenant.
2. In primary navigation, open **Finances**.
3. You may land on the command centre (**FinancialOS**) or the **Revenue & settlement** module depending on deep link.
4. Use in-module switcher (aria label pattern: "FinancialOS section: … Open section switcher.") to jump between sections.

# 3. Two related surfaces
## 3.1 Command centre (`/financial-os`)
Hero:
- Eyebrow: FI OS
- Title: FinancialOS
- Description: "Revenue, payments, deposits, profitability, and collection priorities across clinic operations."

Primary action buttons (exact):
- Open Payments Inbox
- Open LeadFlow
- Open SurgeryOS
- Open AnalyticsOS
- Create payment request

Sections (exact kickers + titles):
- Health · Financial health snapshot — "Clinic-facing signals for revenue, collection risk, and procedure profitability."
- Priorities · What needs financial attention — "Top collection and payment priorities ranked for clinic owners — act here first." Calm empty state: "Financial workflow is currently under control."
- Collection · Collection priorities — "Patients and invoices needing payment action — send reminders or open the payments inbox." Buttons: Open invoice, Open patient, Send payment request, Payments Inbox
- Profitability · Procedure profitability snapshot — metrics: Procedures with data, Average procedure revenue, Average margin, Missing cost data, Best margin, Lowest margin
- LeadFlow · Consultation-to-revenue bridge — link: Open LeadFlow
- Activity · Recent financial activity
- Tools · Reports and deeper finance tools

## 3.2 Revenue & settlement shell (`/financial/*`)
Header:
- Eyebrow: Finances
- Title: Revenue & settlement
- Description: "Revenue, deposits, installments, and payment automation. Operational booking status is unchanged; financial lifecycle is tracked on fi_bookings.financial_os_status when linked via consultation."

Module switcher labels (exact) — Primary:
- Overview
- Payments
- Payment requests
- Installments
- Providers
- Finance applications
- Super release
- International transfers
- Deposit rules
- Expenses

Under "More":
- Invoices
- Payment pathways
- Pathway inbox

# 4. Overview (Dashboard)
Page title metadata: Finances · Dashboard
Sections to document:
- Payment metrics (kicker Revenue): Outstanding revenue, Upcoming (30d), Failed gateway payments (60d), Deposit conversion (90d consultation quotes), Monthly revenue forecast
- Payment pathways (kicker Settlement): By type, By status, Patient-selected (30d), Expected settlement (next 30 days), Pathway attention — link to Payment Pathways
- Pathway operations inbox (kicker Operations): Open pathway tasks, Urgent pathway tasks, Waiting patient tasks, Overdue tasks
- Financing applications (kicker Finance): Applications submitted / approved; links Finance Applications + Providers
- Super release, International, Surgery readiness (advisory clearance for surgery bookings in next 14 days — does not block SurgeryOS), Deposits

# 5. Payments
Metadata: Finances · Payments
Kicker: Revenue
Description: "Allocated payments on invoices (includes Stripe and manual)."
How staff use: review allocated payments; investigate failed gateway payments from Overview metrics.

# 6. Payment requests
Metadata: Finances · Payment requests
Kicker: Deposits
Description: "Checkout links and manual collection rows."
How-to: create/send payment requests (also reachable via command centre "Create payment request").

# 7. Installments
Metadata: Finances · Installments
Kicker: Plans
Document as installment schedules linked to payment plans / deposits.

# 8. Providers & Finance applications
- Providers — Finances · Financing Providers (kicker Finance)
- Finance applications — Finances · Finance Applications (kicker Finance)
Workflow: provider-ready financing applications; track submitted vs approved from Overview.

# 9. Super release
Metadata: Finances · Super Release
Kicker: Super
Document as superannuation / super-release workflow surface for applicable pathways.

# 10. International transfers
Metadata: Finances · International Transfers
Kicker: International
Document as international transfer workflow tracking.

# 11. Deposit rules
Metadata: Finances · Deposit rules
Kicker: Deposits
Description (exact): "Procedure-scoped deposit policy — percent, due days, slot release, cancellation fee, and transfer rules."

# 12. Invoices (More)
Metadata: Finances · Invoices
Kicker: Revenue
Description: "Latest RevenueOS invoices for this tenant (read-only)."

# 13. Payment pathways & Pathway inbox (More)
- Payment pathways — Finances · Payment Pathways, kicker Settlement (settlement intent)
- Pathway inbox — Finances · Pathway inbox, kicker Operations (open operational tasks for non-standard payment pathways)

# 14. Expenses (Opex capture) — DETAILED HOW-TO
Metadata: Finances · Expenses
Kicker: Opex capture
Title: Expenses
Description (exact): "Capture clinic costs, post to the ledger, multi-clinic P&L, bank recon confirm, and export to FI / QuickBooks / Xero for the selected period."

## 14.1 Period filter
Labels: From, To, buttons Apply range, 30d, 90d, YTD
Explain that intelligence panels, P&L, exports, and recon use the selected period.

## 14.2 Manual expense
Panel title: Manual expense
Hint: "Capture a single clinic cost. Optionally link lead/case/campaign for CPL and case costing."
Fields (exact):
- Date
- Amount (AUD)
- Vendor
- Category (includes Uncategorized)
- Payment method: card, bank, cash, direct debit, other (display with spaces)
- Status: Reviewed | Draft
- Description
Section: Attribution links — Lead, Case, Campaign key (placeholder e.g. meta_q3_perth)
Button: Save expense (success toast: Expense saved.)

Default system categories (exact labels):
- Marketing — paid ads
- Marketing — other
- Clinical consumables
- Medications & pharmacy
- Staff & contractors
- Facilities & rent
- Software & SaaS
- Equipment
- Travel & accommodation
- Professional services
- Bank & merchant fees
- Other

## 14.3 Bank / card CSV
Panel title: Bank / card CSV
Hint: "Upload a statement export. Lines open in a review queue before becoming expenses. Headers like Date, Description, Amount (or Debit/Credit) are auto-detected."
Source: Bank CSV | Card CSV
File upload or Or paste CSV
Button: Parse & review → opens Expense import review

## 14.4 Expense import review
Metadata: Finances · Expense import review
Kicker: Opex capture
Buttons: Commit selected (N), Commit all draft/accepted
Columns: Date, Description, Amount, Category, Status, Actions
Line statuses: draft, accepted, rejected, duplicate, committed

## 14.5 Receipt / invoice upload
Panel title: Receipt / invoice upload
Hint: "Upload an image or PDF. Create a new draft expense or attach to an existing one, then run OCR."
Type: Receipt | Supplier invoice
Attach to: New draft expense | existing expense
Success message pattern: Uploaded. OCR … · draft expense created / attached to expense

## 14.6 Exports · QuickBooks · Xero
Panel title: Exports · QuickBooks · Xero
Hint: "CSV/JSON downloads always work. Live API push stays dry-run until a connector is configured and FI_ACCOUNTING_LIVE_PUSH=1."
Buttons (exact):
- FI CSV
- QuickBooks CSV
- QuickBooks JSON
- Xero CSV
- QB push dry-run
- Xero push dry-run
- QB live push
- Xero live push

## 14.7 Operating snapshot (ledger)
Kicker: Intelligence · Title: Operating snapshot (ledger)
Metrics: Collected revenue, Opex posted, Opex void reversals, Net opex, Net operating
Foot notes: "Collections exceed net opex" / "Net opex exceeds collections"

## 14.8 Multi-clinic operating P&L
Kicker: Chart of accounts · Title: Multi-clinic operating P&L
Metrics: Total collections, Total net opex, Net operating, Clinics with activity

## 14.9 Bank import ↔ expense match
Kicker: Reconciliation · Title: Bank import ↔ expense match
Metrics: Import lines, Expenses, Heuristic matches, Suggested (saved), Confirmed, Unmatched lines
Buttons: Generate suggested matches, Confirm all suggested
Row actions: Confirm / Reject
Statuses: suggested, confirmed (and rejected)
Empty: No persisted matches yet. Run "Generate suggested matches".

## 14.10 Intelligence panels
- Cost per lead (CPL) — Marketing spend, Leads, Overall CPL, Unattributed spend
- Spend by category
- Cost per graft (actuals vs standard) — Clinical spend, Grafts implanted, Overall actual CPG, Unlinked clinical spend

## 14.11 Recent expenses table
Heading: Recent expenses
Columns: Date, Vendor, Category, Amount, Status, Links, Actions
Actions: Edit links, Post, Void
Statuses: draft, reviewed, posted, void
Meta: "ledger linked" when posted to ledger
Empty: No expenses yet. Add a manual expense or import a bank CSV.
Success messages: Expense posted. / Expense voided. / Links updated.

## 14.12 Recent documents & imports
Headings: Recent documents, Recent imports
Import columns: Created, Source, File, Rows, Status, Open
Empty imports: No CSV imports yet.
Documents empty: No receipt or invoice documents yet.

## 14.13 Recommended daily / weekly ops flow
Numbered list:
1. Open Finances → Expenses
2. Set period (30d / 90d / YTD or custom From/To → Apply range)
3. Capture via Manual expense, Bank / card CSV, or Receipt / invoice upload
4. Link Lead / Case / Campaign under Attribution links where relevant
5. Post expenses (writes ledger + balanced journals)
6. Review CPL, Spend by category, Cost per graft, Operating snapshot, Multi-clinic operating P&L
7. Bank recon: Generate suggested matches → confirm one-by-one or Confirm all suggested
8. Export: FI CSV / QuickBooks CSV|JSON / Xero CSV
9. Optional live accounting push only when ops has configured connector + live push flag

# 15. Executive finance
Metadata: Finances · Executive finance
Sections: Executive finance pulse; Alert insights; Revenue performance (Gross revenue, Collected revenue, Surgery revenue, Treatment revenue, Paid invoices, Consults); Surgery profitability; Revenue attribution; Accounts receivable risk; Forecast; Period comparison; Snapshot history

# 16. Accounts receivable
Metadata: Finances · Accounts receivable
Kicker: Collections
Metrics examples: Total outstanding, Overdue revenue, Critical AR cases, Deposits at risk, Average days overdue
Work queue actions (examples): Owner updated, Next action scheduled, Call logged, Reminder draft queued — no live message sent, Case resolved, Case written off

# 17. Surgery cost models
Metadata: Finances · Surgery cost models
Document as standard cost models used by profitability / CPG comparisons.

# 18. Roles & permissions
- Read Finances: staff with financial_os module read
- Mutate payments/expenses: elevated finance capability (canMutate)
- Without mutate: forms show but Save / Post / Void / Commit / recon actions disabled

# 19. Tips & common mistakes
Callouts:
- Posting is what hits the ledger — draft/reviewed alone do not fully count as opex posted
- Void reverses; do not "delete" history
- CPL needs marketing category spend + leads and campaign keys for campaign-level CPL
- CSV imports must be committed on the import review page before they appear as expenses
- Live QuickBooks/Xero push is optional; CSV export is the default safe path
- Bank recon Confirm links expense → import line; reject wrong suggestions before Confirm all suggested

# 20. Quick reference card (last page)
Table of module switcher labels + one-line purpose each.
Table of Expenses buttons.
Support note: escalate connector / env issues to platform admin; do not paste secrets into tickets.

End of guide.
```

---

## How to use in Gamma

1. New generation → paste the full **Prompt for Gamma** block.  
2. Choose **Document** (or long-form PDF), not a short pitch deck.  
3. Theme: professional healthcare / dark navy + cyan accent if available (matches FI Admin chrome).  
4. After generation, spot-check that Gamma did not rename **Finances**, **Expenses**, **Post**, **Void**, **Revenue & settlement**, or export button labels.  
5. Export PDF for staff training.

---

## Maintenance

When FinOS UI labels change, update this prompt from:

| Source | What to re-check |
|--------|------------------|
| `src/lib/financialOs/financialOsModuleNav.ts` | Module switcher labels |
| `app/(fi-admin)/fi-admin/[tenantId]/financial/layout.tsx` | Shell header copy |
| `.../financial/expenses/page.tsx` + `src/components/fi-admin/financial-os/expenses/*` | Expenses wording |
| `FinancialOsCommandCentreDashboard.tsx` | Command centre sections |

Related architecture: [FINOS_EXPENSES_UPDATE_LOG.md](./FINOS_EXPENSES_UPDATE_LOG.md), [FINOS_WORKFORCE_ENV_CHECKLIST.md](./FINOS_WORKFORCE_ENV_CHECKLIST.md).
