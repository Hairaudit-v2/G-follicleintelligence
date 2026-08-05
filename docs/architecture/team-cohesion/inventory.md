# Complete file inventory

**Source of truth rows:** [generated/b0-inventory.csv](./generated/b0-inventory.csv) and [generated/b0-inventory.json](./generated/b0-inventory.json)  
**Generator:** `node scripts/team-cohesion/generate-b0-inventory.mjs`  
**Row shape:** `TeamDomainInventoryRow` as specified in FI-TEAM-COHESION-B0

## Scope count

| Tree | Audit (Aug 2026) | B0 regenerate (historical) | B2.2d regenerate |
|------|-----------------:|---------------------------:|-----------------:|
| `src/lib/workforce-os` | 100 | 103 | 77 |
| `src/lib/workforce` | 127 | 140 | 112 |
| `src/lib/staff` | 40 | 40 | 36 |
| **Legacy total** | **267** | **283** | **225** |

Canonical Team files are inventoried alongside legacy trees (see `generated/b0-summary.json`). After B2.2d, access / onboarding MUST-MOVE homes and the clinical staff picker live under `src/lib/team/{directory,access,onboarding}` with `cycleCount: 0`. Directory-core loaders remain under `src/lib/staff/` until B2.2a (see [b2.2-directory-access-onboarding.md](./b2.2-directory-access-onboarding.md)).

## Domain ownership distribution

| proposedDomain | Files |
|----------------|------:|
| identity | 84 |
| roster | 62 |
| directory | 25 |
| shared | 27 |
| payroll | 23 |
| access | 20 |
| planning | 14 |
| onboarding | 12 |
| compliance | 9 |
| commandCentre | 4 |
| delete | 3 |
| needsDecision | **0** |

Every file has one proposed owner or a documented deletion outcome.

## Migration risk

| Risk | Files | Guidance |
|------|------:|----------|
| low | ~112 | Leaves / pure cores / tests — migrate first inside a domain |
| medium | ~55 | Loaders with moderate fan-in |
| high | ~116 | Mutations, gates, tx, invites, payroll, wide consumers |

Highest fan-in runtime modules (move late or behind stable barrels):

| Consumers | Path | Domain |
|----------:|------|--------|
| 43 | `staff/staff.server.ts` | identity |
| — | `team/directory/clinicalStaffPicker.ts` (B2.2d; was 36 consumers under `staff/`) | directory |
| 19 | `workforce-os/staffLifecycleTypes.ts` | identity |
| 14 | `workforce-os/clinicalStaffingSummary.types.ts` | roster |
| 14 | `staff/staffHrNotificationSummary.ts` | directory |
| 12 | `staff/staffSourceIdsNormalize.ts` | identity |
| 11 | `workforce-os/staffStandardHoursCore.ts` | roster |
| 10 | `workforce-os/staffLifecycleCore.ts` | identity |
| 10 | `workforce/wageProfileCore.ts` | payroll |
| 10 | `workforce/workforceHrManageGate.server.ts` | access |

## How classifications were produced

1. Heuristic ownership from path/name (see generator `proposeDomain`)
2. Automatic signals: tables referenced, `serverOnly`, `mutationBearing`, consumer fan-in → `migrationRisk`
3. Manual locks for known collisions (command-centre delete disposition, leave → roster, offboarding → identity)
4. Review pass against [domain-ownership.md](./domain-ownership.md)

Proposed paths follow `src/lib/team/<domain>/<filename>` (onboarding keeps nested files under `team/onboarding/`). Colliding basenames across domains are resolved at move time with RENAME if required.

## Spot-check notes (manual review)

- **Roster command centre** (`workforce-os/workforceRosterCommandCentre*`, `rosterCommandCentre*`) → **roster**, not commandCentre. Different product surface from Team overview KPI composition.
- **Leave workflow** → **roster** (availability / eligibility impact). Employment status changes stay identity.
- **staffProfileHub*** → **identity** (composed person view; will become identity public API consumer/producer).
- **staff/workforceCommandCentre*** → **delete** after profile + directory stop importing it.
- **clinical eligibility** twins (`workforce/clinicalEligibility*` vs `workforce-os/workforceProcedureClinicalEligibility*`) → roster bridges; collision flagged for behaviour review.

For per-file `runtimeConsumers`, `testConsumers`, `tablesReferenced`, `duplicateOf`, and `deletionReason`, use the CSV/JSON — too large for inline markdown.
