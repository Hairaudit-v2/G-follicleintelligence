# FinOS Ops Card — Gamma one-pager prompt

**Purpose:** Paste the **Prompt for Gamma** block into [Gamma](https://gamma.app) to produce a **single-page (or double-sided A4/Letter) pocket ops card** for clinic finance staff.  
**Companion:** Full guide prompt → [FINOS_USER_GUIDE_GAMMA_PROMPT.md](./FINOS_USER_GUIDE_GAMMA_PROMPT.md)  
**Grounding:** Exact labels from the live FinOS build only. Do not invent alternate names.

**Print tip:** Generate as 1 page landscape or 2-page portrait “cheat sheet”; export PDF; laminate optional.

---

## Prompt for Gamma

Copy everything inside the fence:

```
Create a single-page (or tight 2-page double-sided) pocket operations card PDF.

Title: Finances · Ops Card
Subtitle: FinancialOS (FinOS) · FI Admin · Follicle Intelligence
Tone: ultra-scannable, bullet-first, clinic floor ready. No fluff. No developer jargon.
Layout: dense but readable — columns, numbered lists, small tables, yellow/amber WARNING callouts, teal/cyan TIP callouts.
Theme: dark navy clinical + cyan accents if available; otherwise clean black text on white with strong hierarchy.
Constraint: Use ONLY the exact UI labels listed below. Do not rename buttons or modules.

============================================================
PAGE / CARD CONTENT
============================================================

# Header strip
Finances (nav)  ·  Revenue & settlement (module shell)  ·  FinancialOS / FI OS (command centre)
Internal training · Expenses Stages 1–8

# Open Finances (30 seconds)
1. Sign in to FI Admin
2. Nav → Finances
3. Use section switcher for: Overview · Payments · Payment requests · Installments · Providers · Finance applications · Super release · International transfers · Deposit rules · Expenses
4. More: Invoices · Payment pathways · Pathway inbox
5. Command centre (FinancialOS): Financial health snapshot · What needs financial attention · Collection priorities · Procedure profitability snapshot · Consultation-to-revenue bridge
   Quick actions: Open Payments Inbox · Create payment request · Open LeadFlow

# Daily revenue pulse (Overview)
Check tiles when you open Overview:
- Outstanding revenue
- Upcoming (30d) — payment links · installment dates
- Failed gateway payments (60d)
- Deposit conversion (90d consultation quotes)
- Pathway attention · Open pathway tasks · Urgent pathway tasks
Act from Collection priorities: Open invoice · Send payment request · Payments Inbox

# Expenses — weekly opex flow (exact buttons)
Path: Finances → Expenses (kicker: Opex capture)
Page purpose: "Capture clinic costs, post to the ledger, multi-clinic P&L, bank recon confirm, and export to FI / QuickBooks / Xero for the selected period."

Numbered checklist:
1. Period: From / To → Apply range  OR  30d · 90d · YTD
2. Capture one of:
   • Manual expense → Save expense
     Fields: Date · Amount (AUD) · Vendor · Category · Payment method · Status (Reviewed|Draft) · Description
     Attribution links: Lead · Case · Campaign key
   • Bank / card CSV → Source Bank CSV or Card CSV → Parse & review → Commit selected / Commit all draft/accepted
   • Receipt / invoice upload → Type Receipt or Supplier invoice → New draft expense or attach existing
3. Recent expenses → Post (ledger) when ready · Void if wrong · Edit links as needed
   Statuses: draft · reviewed · posted · void
4. Review panels:
   • Operating snapshot (ledger): Collected revenue · Opex posted · Net opex · Net operating
   • Multi-clinic operating P&L
   • Cost per lead (CPL) · Spend by category · Cost per graft (actuals vs standard)
5. Reconciliation · Bank import ↔ expense match:
   Generate suggested matches → Confirm (or Reject) → or Confirm all suggested
6. Exports · QuickBooks · Xero:
   Safe default: FI CSV · QuickBooks CSV · QuickBooks JSON · Xero CSV
   Optional: QB push dry-run · Xero push dry-run · QB live push · Xero live push
   (Live push only when platform has connector + FI_ACCOUNTING_LIVE_PUSH=1 — staff: use CSV unless ops says live is on)

# Default expense categories (for coding speed)
Marketing — paid ads · Marketing — other · Clinical consumables · Medications & pharmacy · Staff & contractors · Facilities & rent · Software & SaaS · Equipment · Travel & accommodation · Professional services · Bank & merchant fees · Other

# Payment methods (Manual expense)
card · bank · cash · direct_debit · other  (UI shows with spaces: direct debit)

# Don’t mix these up
| Do this | Not that |
| Post to hit ledger + journals | Leave forever in draft/reviewed and expect full opex posted |
| Void to reverse | Expect delete / rewrite of history |
| Commit CSV on import review | Assume Parse & review alone created final expenses |
| Confirm bank matches carefully | Blind Confirm all suggested without scanning confidence |
| Export CSV for accountant | Force live push without ops approval |
| Link Campaign key for CPL | Marketing spend with no campaign → Unattributed spend |

# WARNING callouts (exact product sense)
- Posting writes ledger impact; void reverses. Operational booking status is unchanged by financial lifecycle.
- Live accounting API push is optional; CSV/JSON downloads always work.
- Reminder drafts in AR may say “no live message sent” until messaging is enabled.

# TIP callouts
- Marketing costs → category Marketing — paid ads (or other) + Campaign key for campaign-level CPL.
- Clinical consumables + Case link feed Cost per graft (actuals vs standard).
- Calm command centre message means you’re good: “Financial workflow is currently under control.”

# Who can do what
- Everyone with Finances read: view Overview, Expenses, exports (read paths)
- Finance mutate roles: Save expense · Post · Void · Commit import · Generate / Confirm recon · upload receipts
- No mutate: buttons disabled — ask clinic finance admin

# Escalation (one line)
Env, Stripe, QuickBooks connector, or live push issues → platform admin. Never paste secrets into chat/tickets.

# Footer
Full guide: Finances (FinancialOS / FinOS) — Staff User Guide · Routes: /financial-os · /financial/* · /financial/expenses
```

---

## How to use in Gamma

1. New doc → paste the **Prompt for Gamma** block.  
2. Prefer **1 page** (landscape often works best for pocket cards) or **2 pages** max.  
3. After generate: shrink font only if still one page; keep button names exact.  
4. Export PDF → print double-sided if 2 pages → optional laminate.

---

## Maintenance

Re-sync labels from the same sources as the full guide:

- `src/lib/financialOs/financialOsModuleNav.ts`
- `app/(fi-admin)/fi-admin/[tenantId]/financial/layout.tsx`
- `src/components/fi-admin/financial-os/expenses/*`
- `docs/architecture/FINOS_USER_GUIDE_GAMMA_PROMPT.md`
