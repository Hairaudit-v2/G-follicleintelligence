# FinancialOS — Visual Regression Checklist (Clinic Pilot)

Use this checklist before enabling FinancialOS for a clinic pilot. It is a **visual and interaction regression pass** only — confirm layout, contrast, navigation, and empty/populated states. Functional mutations and payment gateway behaviour are out of scope unless noted.

Complements [FinancialOS UI QA — ReceptionOS alignment](../commercial/financial-os-ui-qa-reception-alignment.md).

## Pre-flight

- [ ] Test tenant with representative data: at least one row each in payments, invoices, payment requests, finance applications, super release, international transfers, deposit rules, and pathway inbox (or confirm empty-state copy when zero rows)
- [ ] Test with **finance/manager** role (mutation controls visible) and **read-only** role (controls hidden, tables still readable)
- [ ] Browsers: **Chrome** (primary), **Edge** on Windows (native `<select>` dark dropdown), **Safari** on iPad if available
- [ ] FI OS shell in **dark mode** (default tenant surface — not light case-detail panels)
- [ ] Record viewport width, browser, OS, and sidebar state on each screenshot set

### Viewport matrix

| Profile | Target width | Device reference |
|---------|--------------|------------------|
| Mobile | 375px | iPhone SE / narrow Android |
| Tablet | 768px | iPad portrait |
| Laptop | 1280px | 13″ MacBook / common clinic laptop |
| Desktop | 1440px | External monitor, single window |
| Ultra-wide | 1920px+ | Reception/finance dual-monitor desk |

---

## Global — FI OS shell & chrome

Run once per viewport profile (mobile, tablet, laptop, desktop).

### Dark FI OS shell

- [ ] Tenant main surface uses deep navy glass (`#050a12` / `#081020`) — no white or light-gray page backgrounds
- [ ] Section cards use dark glass borders (`border-white/[0.06–0.08]`) — no `bg-gray-50` panels
- [ ] Body text is slate-toned and readable on dark surfaces
- [ ] Links use cyan accent (`text-cyan-400`) with visible hover state
- [ ] Code / UUID snippets use dark inline code styling, not light monospace blocks
- [ ] `FinancialClearancePanel` / `FinancialClearanceBadge` **do not** appear on FinancialOS routes (clearance lives on case detail and surgery boards only)

### Sidebar — collapsed vs expanded

| State | How to test | Pass criteria |
|-------|-------------|---------------|
| Expanded | `lg+` viewport, sidebar visible | FinancialOS content does not sit under the rail; horizontal scroll absent on dashboard |
| Collapsed / drawer | `< lg` or hamburger open | Drawer overlays content; module switcher and tables remain usable when drawer closed |
| Mobile drawer open | 375px, open nav | FinancialOS header and first table row still reachable; closing drawer restores full content width |

- [ ] **Expanded (desktop):** page content respects main column inset; no clipped module switcher
- [ ] **Collapsed (laptop narrow / tablet):** hamburger opens FI OS drawer; FinancialOS layout header wraps cleanly (title block above switcher)
- [ ] **Mobile:** sidebar drawer does not trap focus; content scrolls independently after drawer close

### FinancialOS layout header

Route: any `/fi-admin/{tenantId}/financial/*` page

- [ ] Kicker reads `FinancialOS · Command centre`
- [ ] Page title `Revenue & settlement` does not truncate awkwardly
- [ ] Description paragraph wraps without overlapping the module switcher
- [ ] Bottom border separates header from page content

### FinancialOS module switcher

- [ ] Trigger shows current module label with grid icon and chevron
- [ ] **Mobile:** full-width trigger (~44px tap height), label truncates with ellipsis
- [ ] **Desktop:** auto width, min ~15rem
- [ ] Dropdown lists **Primary** modules then **More** separator
- [ ] Active route shows cyan inset highlight and check icon
- [ ] Inactive items hover with subtle border/background
- [ ] Dropdown scrolls inside `max-height` without clipping last item
- [ ] Keyboard: trigger focusable; menu items reachable

**Module navigation smoke** (switcher → land on correct page, active state updates):

- [ ] Financial dashboard
- [ ] Payments
- [ ] Payment requests
- [ ] Invoices *(More)*
- [ ] Finance applications
- [ ] Super release
- [ ] International transfers
- [ ] Deposit rules
- [ ] Pathway inbox *(More)*

---

## Per-route visual regression

Base path: `/fi-admin/{tenantId}/financial/{segment}`

For each route below, check at **mobile (375)**, **tablet (768)**, **laptop (1280)**, and **desktop (1440)** unless marked optional.

### Payments — `/payments`

- [ ] Sub-page header: kicker, title, description visible
- [ ] Table shell: dark rounded border, horizontal scroll on narrow viewports without page-level overflow
- [ ] Column headers: uppercase micro-labels, slate-500
- [ ] Status badges: sufficient contrast on dark rows
- [ ] **Empty:** inbox icon + “No payments recorded.”
- [ ] **Populated:** mono columns align; row hover subtle
- [ ] No light-variant badges or panels

### Invoices — `/invoices`

- [ ] Same table chrome as payments
- [ ] Status badges readable for issued / partial / overdue / paid states
- [ ] Amount columns right-aligned or mono tabular
- [ ] **Empty:** “No invoices found.”
- [ ] **Populated:** long invoice IDs truncate or wrap without breaking layout
- [ ] Module switcher shows **Invoices** under More when active

### Payment requests — `/payment-requests`

- [ ] Table layout consistent with payments/invoices
- [ ] Checkout / draft status badges distinct and legible
- [ ] **Empty:** “No payment requests found.”
- [ ] **Populated:** date and amount columns do not collide on tablet
- [ ] Link styling consistent with other FinancialOS tables

### Finance applications — `/finance-applications`

- [ ] “New finance application” form panel: dark `formPanel`, labels, inputs, selects
- [ ] Native `<select>` dropdown readable on **Windows + dark shell** (dark option background)
- [ ] Pill filter bar: status filters scroll horizontally on mobile; active pill cyan highlight
- [ ] `FinancialFinanceApplicationStatusBadge`: contrast on dark table rows
- [ ] **Empty (zero data):** “No finance applications yet.”
- [ ] **Empty (filtered):** “No finance applications match this status filter.” + hint to clear filter
- [ ] **Expanded row:** documents panel stays dark; no light document list styling
- [ ] Mutation feedback: success (emerald), error (rose), validation warning (amber)

### Super release — `/super-release`

- [ ] Create-application form grid: 1 col mobile → 2–4 cols laptop
- [ ] Pill status filter matches finance applications interaction model
- [ ] `FinancialSuperReleaseStatusBadge` contrast on all workflow states
- [ ] **Empty (zero / filtered):** correct empty copy + filter hint when applicable
- [ ] **Expanded row:** documents + clinical letter panels on dark surfaces
- [ ] Clinical letter sub-panel: select controls and list items readable

### International transfers — `/international-transfers`

- [ ] Create form: transfer method select, country/currency fields align on tablet+
- [ ] Pill status filter scroll/wrap behaviour matches other workflow tables
- [ ] `FinancialInternationalTransferStatusBadge` legible for reconciliation / variance states
- [ ] Route column (country/currency → settlement) does not overflow desktop; scrolls on mobile
- [ ] **Expanded row:** proofs + settlement panels dark-themed
- [ ] Settlement form numeric fields and date inputs aligned
- [ ] **Empty (zero / filtered):** correct messages and hints

### Deposit rules — `/deposit-rules`

- [ ] Sub-page header and table chrome consistent
- [ ] Rule type / scope columns readable
- [ ] Active/inactive or status badges use dark-surface tones
- [ ] **Empty:** “No deposit rules configured.”
- [ ] **Populated:** percentage/amount rules display without layout jump across breakpoints

### Pathway inbox — `/pathway-inbox`

- [ ] Sub-page header description wraps; code snippet styled for dark shell
- [ ] **Filters:**
  - [ ] Status + priority pill bars side-by-side on `lg+`, stacked on mobile
  - [ ] Pills scroll horizontally on narrow viewports without clipping tap targets
  - [ ] Assigned-to + pathway type selects in two-column grid from `sm`
  - [ ] Select dropdown readable on Windows dark mode
- [ ] **Table:** 10 columns scroll inside table shell on mobile/tablet (not whole page)
- [ ] `FinancialPaymentPathwayTaskBadge`: status + priority accent readable
- [ ] Action button cluster wraps without overlapping adjacent rows
- [ ] **Empty (zero data):** “No pathway tasks yet.”
- [ ] **Empty (filtered):** “No pathway tasks match these filters.” + reset hint
- [ ] **Task drawer:** opens from right; overlay dims background; close control visible
- [ ] Drawer selects and note textarea use dark styling
- [ ] Saving feedback + “Saving…” meta text visible below filters

---

## Cross-cutting component checks

Apply while testing any route above.

### Tables

- [ ] `FinancialOsTable` head row sticky appearance (background slightly elevated)
- [ ] Row borders subtle; hover state visible
- [ ] Empty state: centered inbox icon + primary message + optional hint

### Forms & feedback

- [ ] Inputs: dark background, visible focus ring (cyan)
- [ ] Primary buttons: toolbar glass surface, disabled opacity clear
- [ ] `FinancialOsFeedbackText` tones: success / error / warning — never wrong color for server errors
- [ ] No success-green text on validation warnings

### Status badges (all modules)

- [ ] Success states: emerald on dark
- [ ] Pending / review: amber / indigo distinguishable
- [ ] Danger / rejected: rose readable
- [ ] Cancelled / neutral: muted but still legible

### Dashboard entry (pilot orientation)

Optional but recommended — `/financial/dashboard`

- [ ] Metric grid: 2 → 3 → 4 columns across breakpoints
- [ ] Section spacing increases at `xl` / `2xl`
- [ ] Ultra-wide: two-column section grid; automation + deposit sections span full width
- [ ] Links to pathway inbox, finance applications, super release, international transfers work

---

## Regression sign-off

| Field | Value |
|-------|-------|
| Tenant ID | |
| Tester | |
| Date | |
| Browsers tested | |
| Viewports tested | |
| Sidebar states tested | |
| Blocking issues | |
| Approved for pilot | ☐ Yes ☐ No — see issues |

### Blocking issue examples

- Light panels or badges on dark FinancialOS pages
- Module switcher unreachable or clipped on mobile
- Table forces horizontal page scroll (not table-internal scroll)
- Unreadable native selects on Windows
- Wrong empty-state copy (filtered vs zero-data)
- Mutation feedback shows success tone on errors

---

## Related docs

- [FinancialOS UI QA — ReceptionOS alignment](../commercial/financial-os-ui-qa-reception-alignment.md)
- [FinancialOS Phase 4 — clearance engine](../architecture/financial-os-phase4-financial-clearance-engine.md) *(clearance is advisory; not rendered in FinancialOS shell)*
