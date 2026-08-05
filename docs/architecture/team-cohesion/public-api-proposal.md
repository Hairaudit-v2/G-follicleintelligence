# Public API proposal

External application domains (bookings, CRM, calendar, fiOs, components, etc.) should eventually import Team capabilities **only** from domain indexes:

```ts
import { resolveCanonicalStaffLifecycleStatus } from "@/src/lib/team/identity";
import { loadStaffDirectoryPage } from "@/src/lib/team/directory";
```

Not:

```ts
import { resolveCanonicalStaffLifecycleStatus } from "@/src/lib/team/identity/internal/staffCanonicalLifecycle";
```

## Proposed layout

```
src/lib/team/
├── identity/
│   ├── index.ts                 # public
│   ├── internal/                # optional; not for external import
│   └── *.ts                     # implementation (moved over time)
├── directory/index.ts
├── roster/index.ts
├── onboarding/index.ts
├── access/index.ts
├── compliance/index.ts
├── profile/index.ts             # B1.6 person-level composition
├── payroll/index.ts
├── planning/index.ts
├── commandCentre/index.ts
├── shared/index.ts              # sparse; prefer domain indexes
└── index.ts                     # optional umbrella — avoid dumping everything here
```

Root `team/index.ts` should re-export **only** the most stable cross-app symbols (identity resolve + a handful of DTOs), or stay empty and force domain imports.

## identity/index.ts (B1 target surface)

Public candidates (names may stabilize during B1):

| Symbol | Source today | Kind |
|--------|--------------|------|
| `resolveCanonicalStaffLifecycleStatus` | `staffCanonicalLifecycle.ts` | pure |
| `isCanonicalStaffLifecycleActive` | same | pure |
| `CanonicalStaffLifecycleStatus`, `StaffLifecycleSignal` | same | types |
| `calculateWorkforceReadinessScore` (+ result/input types) | `workforceReadinessEngine.ts` | pure |
| `buildWorkforceIdentitySummaryFromSourceRows` | `workforceIdentitySummary.ts` | pure |
| `resolveStaffMemberContext` | `workforceStaffMemberResolve.server.ts` | server |
| `loadStaffLifecycleForFiStaff` | `staffLifecycle.server.ts` | server |
| `FiStaffRow` / staff load helpers | `staff.server.ts` | server (shim late — 43 consumers) |

Server symbols must be exported from `identity/index.server.ts` **or** documented as server-only entry (`identity/server.ts`) so clients never pull them. Prefer:

- `@/src/lib/team/identity` — pure + types
- `@/src/lib/team/identity/server` — server resolve/loaders

## Other domain indexes (later slices)

| Domain | Example public exports | Must stay internal |
|--------|------------------------|--------------------|
| directory | directory page loader DTO types, filter helpers | raw table queries |
| roster | href builders, payload types, eligibility predicates | `rosterTx` implementation details, mutation servers |
| onboarding | invite URL builders, page model types | token hashing, invite row writes |
| access | centre DTO types, manage-gate result types | invite token generation, revoke mutations |
| compliance | expiry helpers, page DTO types | cron runners |
| profile | `StaffProfileHubModel`, attention aggregation, overview adapter | raw dual-table joins, domain policy engines |
| payroll | `PayrollStaffEntry`, pay-basis aliases, identity mutation gate, audit identity refs | wage writes, timesheet transitions, rate math |
| planning | `PlanningStaffEntry`, candidate/vacancy refs, procedure staffing identity bridge | planners’ write paths, optimizer ranking cores |
| commandCentre | KPI/attention DTO types, href builders, `TeamCommandCentreModel` | data assembly servers (`loadTeamCommandCentre.server`) |

## Current deep imports that will violate the boundary

B0 measured **252** outside→legacy deep imports. Highest leverage violations to fix when indexes exist:

1. Anything importing `@/src/lib/staff/staff.server` for `FiStaffRow` / loaders
2. ~~Anything importing `@/src/lib/staff/clinicalStaffPicker` for scheduling pickers~~ — **resolved in B2.2d** (`@/src/lib/team/directory` / `.../server`)
3. Components importing `@/src/lib/workforce-os/staffCanonicalLifecycle` or readiness engines directly
4. `staffProfileHub.server` importing `@/src/lib/staff/workforceCommandCentre.server` (delete path)
5. Bookings/CRM/calendar joining `fi_staff` without going through identity resolve

Full sample: `generated/b0-inventory.json` → `importGraph.deepImportViolationsSample`.

## Enforcement (B1+)

Progressive enforcement:

1. Document convention in this register (done)
2. **B1 delivered:** static test `staffIdentityArchitecture.static.test.ts` + frozen allowlist `staffIdentityDualTableAllowlist.ts` — fails on **new** dual `fi_staff` + `fi_staff_members` references under `src/lib` outside `team/identity` and the allowlist; forbids external `identity/internal` imports
3. Later: ESLint `no-restricted-imports` for legacy deep imports once more shims exist
4. Do **not** blanket-ban all raw `fi_staff` reads — single-table domain use remains legitimate
