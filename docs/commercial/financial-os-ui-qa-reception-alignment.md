# FinancialOS UI QA — ReceptionOS alignment

Short visual QA checklist for FinancialOS command-centre pages, aligned with ReceptionOS chrome conventions.

## Reference surfaces

| Area | ReceptionOS pattern | FinancialOS equivalent |
|------|---------------------|------------------------|
| Page shell | `max-w-[1920px] space-y-6 pb-10` | `financialOsClasses.pageShell` (+ `2xl` spacing / width) |
| Header | Kicker, title, control cluster | FinancialOS layout header + `FinancialOsModuleSwitcher` |
| Filters | `ReceptionOsOperatingModeTabs` pill tabs | `FinancialOsPillFilterBar` (horizontal scroll on mobile) |
| Empty states | Inbox icon + muted copy | `FinancialOsEmptyState` inside `FinancialOsTable` |
| Feedback | Icon + explicit success/error | `FinancialOsFeedbackText` with `tone` prop |
| Badges | `ReceptionOsSeverityBadge` dark tones | `financialOsStatusBadgeTones` + domain badges |

## Browser QA checklist

### All FinancialOS routes (`/fi-admin/{tenantId}/financial/*`)

- [ ] Dark FI OS shell — no light `bg-gray-*` panels leaking into pages
- [ ] Module switcher readable and tappable on mobile (full-width trigger, scrollable menu)
- [ ] Native `<select>` controls use dark `color-scheme` and readable option text on Windows
- [ ] Status badges meet contrast on `#0c1426` table shells
- [ ] Mutation feedback uses correct tone (success / error / warning) — not message heuristics

### Pathway inbox (`/financial/pathway-inbox`)

- [ ] Status + priority pill filters scroll horizontally on narrow viewports
- [ ] Assignee + pathway type selects align in a two-column grid from `sm`
- [ ] Filtered-empty copy differs from zero-data copy
- [ ] Filtered-empty hint suggests resetting filters when rows exist

### Dashboard (`/financial/dashboard`)

- [ ] Metric grids: 2 cols @ 640px, 3 cols @ 1024px, 4 cols @ 1280px
- [ ] Section spacing increases at `xl` / `2xl`
- [ ] Ultra-wide (`2xl+`): two-column section grid; automation + deposit span full width
- [ ] No horizontal overflow at 1280px, 1440px, or 1920px+

### Workflow tables (finance / super / intl / providers)

- [ ] Pill status filters match pathway inbox interaction model
- [ ] Empty table: icon + primary message + optional filter hint
- [ ] Expanded row panels stay on dark `formPanel` surfaces

## FinancialClearance components

`FinancialClearancePanel` / `FinancialClearanceBadge` are **not** rendered on FinancialOS pages.

| Surface | Variant | Notes |
|---------|---------|-------|
| Case detail (`CaseDetailPageView`) | `light` | Light case workspace — intentional |
| Surgery / clinic boards | `dark` | Compact clearance chip on dark boards |

Confirm FinancialOS routes never import these with default `variant="light"`.

## Feedback API (post-QA)

Prefer explicit tones when setting mutation feedback:

```tsx
setFeedback(financialOsActionFeedback(res.ok, "Task updated.", res.error));
// validation
setFeedback({ message: "Select a pathway.", tone: "warning" });

<FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
```

`FinancialOsFeedbackText` still accepts legacy `success?: boolean` and falls back to message heuristics when `tone` is omitted.

## Breakpoints to spot-check

| Width | Focus |
|-------|-------|
| 375px | Module switcher, pathway inbox filters, table horizontal scroll |
| 1280px | Dashboard metric grid (4-up), section card padding |
| 1440px | Dashboard two-column grid not yet active; spacing at `xl` |
| 1920px+ | `2xl` two-column dashboard grid, wider max width |

## Known intentional differences vs ReceptionOS

- FinancialOS uses a dropdown module switcher (more modules than fit horizontal tabs)
- No live refresh banner / operating-mode tabs (SSR dashboard)
- Pathway inbox remains table-first (ReceptionOS task inbox is card-first)

These are product choices, not QA blockers for this pass.
