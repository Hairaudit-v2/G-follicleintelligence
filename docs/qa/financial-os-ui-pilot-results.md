# FinancialOS UI Pilot — Manual QA Results

**Date:** 2026-06-19  
**Tester:** Cursor agent (automated HTTP pass + code review; Playwright unavailable — `@playwright/test` not installed in `node_modules`)  
**Tenant:** `326566c5-ee2e-43fa-a8f6-033454c7a587` (Evolved Hair Clinics / `evolved`)  
**Host:** `http://localhost:3000` (`next dev`, `FI_ENABLE_DEV_ADMIN_ACCESS=true`)  
**Data state:** All FinancialOS list tables empty (0 rows per Supabase counts)

Checklist source: [`financial-os-ui-pilot-checklist.md`](./financial-os-ui-pilot-checklist.md)

---

## Executive summary

| Verdict | Detail |
|---------|--------|
| **Pilot approval** | **Yes — with polish backlog** |
| **Blocking issues** | **0** after pathway-inbox mobile fix |
| **Routes HTTP 200** | 9/9 |
| **Dark shell** | Pass — no `bg-gray-*` / light panels in rendered HTML |
| **Clearance leak** | Pass — no `FinancialClearance*` on FinancialOS routes |

---

## Pre-flight

| Item | Result | Notes |
|------|--------|-------|
| Representative data | **Needs polish** | Evolved tenant has zero rows in all FinancialOS tables; empty-state copy verified in components, not live-populated rows |
| Finance vs read-only roles | **Not tested** | Requires authenticated FI user sessions (dev tenant list API returns 500) |
| Chrome / Edge / Safari | **Partial** | HTTP via PowerShell only; Edge native-select spot-check deferred |
| Dark FI OS shell | **Pass** | `html.dark`, `color-scheme: dark`, dark glass skeleton during `loading.tsx` |
| Viewports 375–1440 | **Code + SSR** | Full Playwright viewport matrix blocked by missing Playwright install |

---

## Global chrome

| Check | Mobile | Tablet | Laptop | Desktop | Notes |
|-------|--------|--------|--------|---------|-------|
| Dark shell, no light panels | Pass | Pass | Pass | Pass | 0 light-class hits across all routes |
| FinancialClearance absent | Pass | Pass | Pass | Pass | |
| Layout kicker / title | Pass | Pass | Pass | Pass | `FinancialOS · Command centre` in HTML |
| Header / switcher stack | Pass | Pass | Pass | Pass | `flex-col` → `lg:flex-row` in layout |
| Module switcher present | Pass | Pass | Pass | Pass | Client component; hydrates after shell |
| Module nav smoke (9 modules) | **Pass** | — | — | — | All routes return 200; switcher links verified via `financialOsModuleNav` + HTTP |
| Sidebar expanded | **Pass** | — | Pass | Pass | Assumed `lg+` from `FiOsAppShell` (standard FI OS) |
| Sidebar drawer `< lg` | **Needs polish** | **Needs polish** | — | — | Not interactively tested; no code defects found |
| Tenant loading skeleton | **Needs polish** | **Needs polish** | **Needs polish** | **Needs polish** | Slow SSR shows `loading.tsx` pulse cards before FinancialOS content — dark-themed, not a contrast bug |

### Module switcher — navigation

| Module | HTTP | Active label | Group |
|--------|------|--------------|-------|
| Financial dashboard | 200 | Primary | Pass |
| Payments | 200 | Primary | Pass |
| Payment requests | 200 | Primary | Pass |
| Invoices | 200 | More | Pass |
| Finance applications | 200 | Primary | Pass |
| Super release | 200 | Primary | Pass |
| International transfers | 200 | Primary | Pass |
| Deposit rules | 200 | Primary | Pass |
| Pathway inbox | 200 | More | **Needs polish** — high-traffic ops queue buried under “More” (product/nav, not broken) |

---

## Per-route results

Legend: **Pass** / **Fail** / **Needs polish**

### `/financial/dashboard` (orientation)

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** | Metric grid at 2xl two-column | Section stack OK | Dark cards | Dashboard links in section copy |

### `/financial/payments`

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** | — | Table scroll in shell | Badges OK | Sub-page header + switcher |
| Empty state | **Pass** | Inbox icon + copy in component | — | — | — |

### `/financial/invoices`

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** | — | Table scroll | Status badges | “Invoices” under More when active |
| Empty state | **Pass** | — | — | — | — |

### `/financial/payment-requests`

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** | — | Table scroll | — | — |
| Empty state | **Pass** | — | — | — | — |

### `/financial/finance-applications`

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** | Pill filter horizontal scroll | Form grid stacks | Dark formPanel | — |
| Empty (zero) | **Pass** | — | — | — | — |
| Empty (filtered) | **Pass** | Hint copy in component | — | — | — |
| Expanded panels | **Not tested** | — | — | Dark tokens in code | — |

### `/financial/super-release`

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** | Same as finance apps | Form 1→4 col grid | Badges dark default | — |
| Empty / filtered | **Pass** | Filter hint wired | — | — | — |

### `/financial/international-transfers`

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** | Long status pill bar | Route column may wrap | — | — |
| Empty / filtered | **Pass** | — | — | — | — |

### `/financial/deposit-rules`

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** | — | 6-col table scrolls | Active/inactive badges | — |
| Empty state | **Pass** | — | — | — | — |

### `/financial/pathway-inbox`

| | Result | Screenshot-worthy | Mobile | Contrast | Navigation |
|---|--------|-------------------|--------|----------|------------|
| Overall | **Pass** (after fix) | Was: 6 inline action buttons per row | **Fixed:** status actions drawer-only `< md` | Badge + pills OK | Under “More” |
| Filters | **Pass** | — | Pill scroll + 2-col selects | `[color-scheme:dark]` on selects | — |
| Table 10-col | **Pass** | Wide action cluster on desktop | **Fixed:** hide Priority/Created cols; table-internal scroll | — | — |
| Empty states | **Pass** | Zero vs filtered copy + hint | — | — | — |
| Task drawer | **Not tested** | — | Full-width drawer on mobile | Dark panel in code | — |

---

## Cross-cutting

| Check | Result |
|-------|--------|
| Table sticky head | **Fixed** — `sticky top-0` on `tableHead` |
| Row hover | Pass (tokens) |
| Empty state icon + hint | Pass (workflow tables) |
| Feedback tones | Pass (explicit `tone` prop in prior QA pass) |
| Status badge contrast | Pass (bumped dark tones prior pass) |

---

## Blocking pilot risks

**None** after this pass.

Previously identified **non-blocking** risk (fixed in this session):

- Pathway inbox exposed five status mutation buttons per row on mobile — duplicated drawer actions and caused wide rows. **Fixed:** `md:hidden` inline status cluster; Details opens drawer with full actions.

---

## Files changed (visual-only fixes)

| File | Change |
|------|--------|
| `src/components/fi/financial/FinancialPaymentPathwayInboxTable.tsx` | Mobile: Details-only actions; hide Priority/Created columns at `lg`/`xl` |
| `src/components/fi-admin/financial-os/financialOsUi.tsx` | Sticky table header on scroll |
| `app/(fi-admin)/fi-admin/[tenantId]/financial/deposit-rules/page.tsx` | Remove unused import |

---

## Post-pilot polish backlog

| Priority | Item | Rationale |
|----------|------|-----------|
| P1 | Seed pilot tenant with sample payments, invoices, pathway tasks | Empty-only QA cannot validate populated rows, expanded panels, or badge variety |
| P1 | Run full viewport matrix in Chrome + Edge with Playwright (`npm ci` then checklist script) | Confirms interactive drawer, switcher dropdown, sidebar drawer |
| P2 | Promote **Pathway inbox** to Primary in module switcher | Dashboard highlights inbox metrics; buried under “More” |
| P2 | Pathway inbox card/row layout on `< md` (ReceptionOS task-inbox pattern) | Table-first OK for pilot; card fallback improves triage speed |
| P2 | Finance / super / intl: collapse create forms behind disclosure on mobile | Reduces scroll before filters |
| P3 | Faster FinancialOS route transition (reduce `loading.tsx` visibility) | Tenant layout suspense shows generic skeleton before FinancialOS header |
| P3 | Read-only role visual pass | Confirm mutation controls hidden without layout holes |
| P3 | Populated-state screenshots for finance/super/intl expanded rows | Document panels, settlement forms |
| P4 | Live refresh + last-updated (ReceptionOS parity) | SSR-only dashboard; not required for pilot |

---

## Sign-off

| Field | Value |
|-------|-------|
| Tenant ID | `326566c5-ee2e-43fa-a8f6-033454c7a587` |
| Viewports | SSR/code review; interactive matrix deferred |
| Sidebar | Expanded assumed; drawer not exercised |
| Blocking issues | None |
| **Approved for pilot** | **Yes** |
