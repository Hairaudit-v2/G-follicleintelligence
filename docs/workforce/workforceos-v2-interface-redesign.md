# WorkforceOS V2 Interface Redesign

## Why this redesign was needed

WorkforceOS Phase 1C and Phase 2 added substantial backend capability — recruitment, payroll, shift cost intelligence, procedure staffing, compliance, HR reconciliation, and workforce planning — but the primary `/workforce-os` route still rendered a basic staff members table.

V2 promotes **Workforce Command Centre** as the operational home: a premium dashboard that composes existing loaders into executive KPIs, health radar, attention queue, module tiles, forecasts, and planning recommendations.

Staff CRUD remains on `/staff` as a secondary directory view.

## Primary route

| Route | Purpose |
|-------|---------|
| `/fi-admin/[tenantId]/workforce-os` | **Workforce Command Centre** (V2 landing) |
| `/fi-admin/[tenantId]/workforce-os/directory` | Workforce members lifecycle table (former landing) |
| `/fi-admin/[tenantId]/staff` | FI staff directory + CRUD (de-emphasized) |

## Dashboard sections

1. **Hero / executive header** — title, subtitle, primary CTA (Workforce Planning), secondary CTAs
2. **Executive KPIs** — total staff, clinically eligible, credential risks, open recruitment, procedure gaps, weekly wage exposure
3. **Workforce Health Radar** — six progress metrics with score %, status, explanation, deep link
4. **Needs Attention** — top 8 ranked issues from planning + operational signals
5. **FI Workforce Intelligence** — ranked planning recommendations + refresh action
6. **Module tiles** — nine large cards (recruitment, payroll, shift cost, procedure staffing, planning, compliance, credentials, HR reconciliation, staff directory)
7. **Procedure staffing forecast** — 14-day horizon from planning snapshot
8. **Financial intelligence** — weekly exposure, daily roster, procedure labour, missing wage profiles

## Data sources (reused loaders)

| Section | Loader / source |
|---------|-----------------|
| KPIs, health, attention | `loadWorkforceCommandCentrePage` composes: |
| Planning signals | `loadWorkforcePlanningEngine` |
| Shift / wage costs | `loadShiftCostIntelligence` |
| HR operational metrics | `loadWorkforceOperationalMetrics` |
| Recruitment counts | `listRecruitmentCandidates`, `listWorkforceRoleRequirements` |
| Wage coverage | `listActiveStaffForWageProfiles` |
| Total staff | `loadWorkforceOsDirectoryPage` (non-archived members) |
| Staff directory page | `loadStaffDirectoryPage` (unchanged CRUD) |

Pure composition logic lives in `src/lib/workforce/workforceCommandCentreCore.ts` — no duplicated business rules from planning or payroll engines.

## Fallback states

- **Planning unavailable** — empty forecast panel, fallback message, attention queue uses operational items only
- **Shift cost unavailable** — financial panel shows “configure wage profiles” guidance; KPI wage exposure uses planning or zero
- **Operational metrics** — only loaded for HR-manage roles; health radar shows “No data” where scores cannot be computed
- **No attention items** — positive empty state (“No urgent workforce issues detected”)

No invented metrics: placeholders use em dash or explicit “unavailable” copy.

## Key files

| File | Role |
|------|------|
| `src/lib/workforce/workforceCommandCentreCore.ts` | Pure helpers (health, attention, tiles) |
| `src/lib/workforce/workforceCommandCentrePage.server.ts` | Page loader |
| `src/components/fi-admin/workforce/WorkforceCommandCentreClient.tsx` | V2 UI |
| `src/components/fi/staff/StaffDirectorySecondaryView.tsx` | De-emphasized staff list |
| `src/lib/workforce/workforceCommandCentre.test.ts` | Unit tests |

## Tests

```bash
pnpm exec tsx --test src/lib/workforce/workforceCommandCentre.test.ts
pnpm lint
pnpm check:migrations
```

## WorkforceOS sub-navigation

`WorkforceOsSubNav` is rendered in `app/(fi-admin)/fi-admin/[tenantId]/workforce-os/layout.tsx` on every WorkforceOS route:

- Command Centre · Planning · Procedure Staffing · Payroll · Shift Cost · Recruitment · HR Reconciliation · Members
- **FI Staff directory** link (right-aligned) → `/staff`

Active state: command centre is exact-match only; Members highlights `/directory` and `/staff/[staffId]`.

## Next UX refinements
- Sparkline trends for weekly wage exposure and procedure coverage
- Role-segment filter on staff directory (reintroduce without command-centre weight)
- E2E smoke test for command centre render + planning refresh
- Investor demo seed script with realistic planning snapshot data