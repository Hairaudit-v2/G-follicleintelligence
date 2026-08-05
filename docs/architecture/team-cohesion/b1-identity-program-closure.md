# FI-TEAM-COHESION-B1 — Identity Program Closure

**Status:** CLOSED (2026-08-05)  
**Slices:** B1 → B1.1 → B1.2 → B1.3 → B1.4 → B1.5 → B1.6 → B1.7 → B1.8A → B1.8B

## Migrated canonical surfaces

| Surface | Package | Slice |
|---------|---------|-------|
| Identity resolve | `src/lib/team/identity` | B1 |
| Directory | `src/lib/team/directory` | B1.1 |
| Access | `src/lib/team/access` | B1.2 |
| Onboarding | `src/lib/team/onboarding` | B1.3 |
| Roster | `src/lib/team/roster` | B1.4 |
| Compliance | `src/lib/team/compliance` | B1.5 |
| Staff profile (one person) | `src/lib/team/profile` | B1.6 |
| Command Centre (many people) | `src/lib/team/commandCentre` | B1.7 |
| Payroll | `src/lib/team/payroll` | B1.8A |
| Planning | `src/lib/team/planning` | B1.8B |

## Allowlist reduction

| Checkpoint | Count |
|------------|------:|
| Post-B1 baseline (pre-profile cleanups) | 20 |
| After B1.6 | 19 |
| After B1.7 | 17 |
| After B1.8A | **16** |

Remaining entries are legitimate mutation / repair / CRM / FI OS dual-table needs — not new uncontrolled joins.

## Explicit repair boundaries

- Ambiguous / invalid / cross-tenant identities: read-only; no destructive domain mutations
- Scheduling-only: no invented onboarding / compliance / payroll-profile subjects
- Lifecycle-only: no invented roster / procedure-schedulable resources
- Candidates / vacancies: never coerced into `StaffIdentity`
- Identity repair must not auto-create wage profiles or rewrite historical payroll transactions

## Remaining raw dual-table references

Scheduled for opportunistic migration in Phase B+ (domain moves / action renames):

- CRM assignable owners / lead details
- FI OS hydration / workspace access
- Staff access / import departure / offboarding / tenant link repair
- Workforce-OS reconciliation / projection health / readiness audit / lifecycle

## Enforcement

- Static test: `staffIdentityArchitecture.static.test.ts`
- Frozen allowlist: `staffIdentityDualTableAllowlist.ts`
- Public consumers must not import `team/identity/internal`

## Phase B preview

Begin broader domain folder moves and sprint-action renames per `action-rename-map.md` and `inventory.md`, keeping B1 identity contracts intact.
