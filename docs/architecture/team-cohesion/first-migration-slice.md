# First safe migration slice — FI-TEAM-COHESION-B1

## Identity Foundation

Move and consolidate **only** the canonical identity / readiness helpers into:

```
src/lib/team/identity/
```

Prove the public API with existing **profile** and **directory** consumers. Add architectural guidance (and optionally lint allowlists) preventing new ad hoc `fi_staff` ↔ `fi_staff_members` joins.

**Do not** migrate all ~352–595 raw table references in B1.

## Why this is first

From [import-graph.md](./import-graph.md):

- Roster → identity is the dominant cross-domain coupling
- Onboarding, access, command centre, and planning all depend on identity/readiness
- `staff.server.ts` and lifecycle types are the hottest fan-in modules

Without a stable identity package, every later domain move re-homes fragmentation.

## In scope (B1)

### Pure / types (low risk — move first)

| Current | Notes |
|---------|-------|
| `workforce-os/staffCanonicalLifecycle.ts` (+ test) | Canonical status source |
| `workforce-os/staffLifecycleTypes.ts` | Employment enums / row types |
| `workforce-os/staffLifecycleCore.ts` (+ tests) | Pure lifecycle helpers; **break cycle** with `hrReconciliationEligibleCore` first or during move |
| `workforce-os/staffLifecyclePresentation.ts` (+ test) | Presentation mapping |
| `workforce-os/workforceIdentityMetadata.ts` (+ test) | |
| `workforce-os/workforceIdentitySources.ts` (+ test) | |
| `workforce-os/workforceIdentitySummary.ts` (+ test) | |
| `workforce-os/workforceIdentityReadinessSignals.ts` (+ test) | |
| `workforce-os/workforceReadinessBands.ts` (+ test) | |
| `workforce-os/workforceReadinessEngine.ts` (+ test) | |
| `workforce-os/workforceReadinessClinicalEligibility.ts` | Keep beside engine |

### Server (medium/high — after pure layer + indexes)

| Current | Notes |
|---------|-------|
| `workforce/workforceStaffMemberResolve.server.ts` | Batch/id resolve API |
| `workforce-os/workforceIdentityLinks.server.ts` | |
| `workforce-os/staffIdentityReadinessAudit.server.ts` (+ test) | |
| `workforce-os/staffIdentityAuditAccess.server.ts` | |
| `workforce-os/workforceIdentityTenantOverview.server.ts` | |
| `workforce-os/workforceReadinessTenantOverview.server.ts` | |

### Consumers to re-point as proof (not full tree)

1. `workforce/staffProfileHub.server.ts` (+ core) — stop using legacy `staff/workforceCommandCentre.server` for readiness intelligence where V2/identity already covers it (**or** temporarily import readiness from `team/identity` while leaving CC delete for B1.1)
2. `staff/staffDirectoryLoader.server.ts` — derive active/lifecycle via canonical resolver
3. At least one bookings or CRM caller that only needs display/lifecycle — optional stretch

### Public API deliverable

- `src/lib/team/identity/index.ts` (pure + types)
- `src/lib/team/identity/server.ts` (server resolves)
- Temporary re-exports from old paths so remaining deep imports keep working

### Cycle break (same PR or immediate follow-up)

- `staffLifecycleCore` ↔ `hrReconciliationEligibleCore` → extract shared eligibility predicate leaf under identity

## Out of scope (B1)

- Roster generation / `rosterTx` / manual adjustments
- Onboarding / access invite token flows
- Payroll / compliance / planning moves
- Deleting `staff/workforceCommandCentre*` before profile + directory consumers are proven on identity APIs (track as **B1.1** or early B2)
- Mass rewrite of HubSpot / bookings / calendar raw `fi_staff` reads
- Sprint action renames (can ship as parallel behaviour-neutral PRs)

## Acceptance for B1

Focused delivery (see [b1-identity-foundation.md](./b1-identity-foundation.md)) — full pure-module relocation deferred:

- [x] `src/lib/team/identity` exists with documented public exports (`index.ts` + `server.ts`)
- [ ] Canonical lifecycle + readiness pure modules live only under `team/identity` (deferred — still under `workforce-os` with later shim plan)
- [x] Profile hub imports identity server API
- [x] Directory loader imports identity batch API (B1.1 — see b1.1-directory-identity-proof.md)
- [x] Identity unit + architecture tests green
- [x] No invite/token/roster tx behaviour change in this slice
- [x] Inventory generator classifies `src/lib/team/**`; baseline method unchanged
- [x] Enforcement: frozen dual-table allowlist + static architecture test (not eslint ban yet)

## Suggested PR sequence inside B1

1. **B1a** — Create `team/identity` + move pure lifecycle/readiness + shim re-exports  
2. **B1b** — Move resolve/audit servers + break eligibility cycle  
3. **B1c** — Repoint profile hub + directory; add eslint/docs enforcement for new joins  
4. **B1.1** — Retire legacy staff command-centre once consumers clear ([collision C1](./collision-register.md))

## Risk call

High-risk mutation servers (`staffLifecycle.server` employment changes, merge/repair) wait for B1c+ or a dedicated identity-mutations slice after the pure API is proven.
