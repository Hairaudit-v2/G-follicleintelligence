# Import graph

Generated edge list: `generated/b0-inventory.json` → `importGraph`.

Alias resolution matches `tsconfig` (`@/*` → `./*`), so imports like `@/src/lib/workforce/...` resolve to `src/lib/workforce/...`.

## Inter-tree edges (97)

Coupling between the three legacy folders (edge counts):

| From → To | Edges |
|-----------|------:|
| `workforce` → `workforce-os` | 37 |
| `workforce-os` → `staff` | 32 |
| `workforce` → `staff` | 12 |
| `workforce-os` → `workforce` | 10 |
| `staff` → `workforce-os` | 6 |
| `staff` → `workforce` | 0 |

### Domain coupling that blocks clean moves

When edges are labelled by proposed domain (see regenerate), the dominant **cross-domain** couplings are:

| Coupling | Why it matters |
|----------|----------------|
| **roster ⇒ identity** (19) | Roster eligibility / generation / command centre payloads pull lifecycle types and readiness. Roster moves before identity will break or force temporary dual paths. |
| **roster ⇒ directory** (11) | Ops UI and candidate lists lean on staff presentation helpers. |
| **identity ⇒ directory** (5) | Profile/reconciliation touches directory DTOs. |
| **planning ⇒ roster** (5) | Procedure staffing / planning reads roster-shaped data. |
| **onboarding ⇒ identity** (4) | Staff create + invite depend on member/identity resolution. |
| **commandCentre / access ⇒ identity** | Composition and gates assume identity readiness. |
| **identity ⇒ delete (legacy CC)** (3) | `staffProfileHub` still imports `staff/workforceCommandCentre.server`. |

**Conclusion:** Identity is the hub. Roster is the largest dependent. B1 (identity foundation) unblocks every later domain move.

## Circular dependencies (1 remaining)

| Cycle | Domains | Disposition |
|-------|---------|-------------|
| ~~`staffLifecycleCore.ts` ↔ `hrReconciliationEligibleCore.ts`~~ | identity ↔ identity | **BROKEN in B2.1a** — leaf `team/identity/staffEmploymentStatusPredicates.ts`; HR eligible imports leaf; lifecycle core may import HR one-way. |
| `onboardingInvitation.server.ts` ↔ `onboardingPinLayer.server.ts` | onboarding ↔ onboarding | **Break in B2.2c** — one-way pin-setup / invitation-accept leaves. Login-access accept→PIN stays a one-way dynamic import (not this cycle). |

No multi-tree cycles were found (cycles stay inside a single tree). Inventory `cycleCount: 1` after B2.2b.

## External consumers into each tree

Unique outside→inside import edges (runtime + tests outside the three trees):

| Tree | External edges |
|------|---------------:|
| `staff` | 126 |
| `workforce-os` | 67 |
| `workforce` | 67 |

`staff` is the hottest external surface (picker, `staff.server`, assignee display). That reinforces: stabilize identity/directory public APIs early; do not rename `staff.server` without a shim.

## Deep imports that bypass future domain boundaries

**252** non-test imports from outside the three trees into deep legacy paths. After `src/lib/team/<domain>/index.ts` exists, these become boundary violations unless updated to the domain index.

Highest-pressure external areas (from inventory consumer lists and identity baseline):

- `src/components/fi/**`, `src/components/fi-admin/**`
- `src/lib/actions/**`
- `src/lib/fiOs/**`, `src/lib/fi-os/**`
- `src/lib/bookings/**`, `src/lib/calendar/**`, `src/lib/crm/**`
- `src/lib/staffAccess/**`, `src/lib/staffImport/**`

Full list sample (200 rows) lives under `importGraph.deepImportViolationsSample` in the JSON.

## Unofficial barrels

No `index.ts` barrels exist today. “Unofficial barrels” are high-export modules that act as de-facto APIs (12+ named exports). Notable:

- `rosterCommandCentreUxCore.ts` (59 exports) — roster
- `workforceRosteringEngine.ts`, `rosterManualAdjustmentsCore.ts`, `staffStandardHoursCore.ts` — roster
- `workforceCommandCentreCore.ts` — commandCentre
- `staffProfileHubCore.ts`, `staffLifecycleTypes.ts`, `staffCanonicalLifecycle.ts` — identity
- `staff.server.ts`, `clinicalStaffPicker.ts` — identity / directory

These should become the **contents** behind domain `index.ts` re-exports, not remain deep-import targets forever.

## Client components importing server-only modules (23)

Detected `use client` files importing `*.server.ts` from the legacy trees. Most are `import type` of loader/DTO types (Next strips types; still a boundary smell). Plan: move shared DTO/types to non-`.server` modules under the domain (already mostly true for `*Core.ts` / `*Types.ts`) and keep clients off `.server` paths.

Examples:

- `RosterCommandCentreView.tsx` → roster server payload types
- `StaffDirectoryClient.tsx` → `staffDirectoryLoader.server` / `staff.server` types
- HR clients → page.server DTO types
- `WorkforceCommandCentreClient.tsx` → command centre page.server types

## Tests tied to historical paths

Many `*.test.ts` files live beside implementation and import sibling deep paths. Sprint glue tests (`workforcePhase1cSprint*.test.ts`, `workforcePhase2Sprint*.test.ts`) lock behaviour to historical action modules. Action renames need shim re-exports or test path updates in the same PR as the rename.

E2E already uses Team routes (`e2e/helpers/teamCohesionRoutes.ts`); lib moves should not change those routes.
