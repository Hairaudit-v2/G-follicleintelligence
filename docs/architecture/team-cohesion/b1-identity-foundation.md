# FI-TEAM-COHESION-B1 — Identity Foundation

**Status:** GREEN (2026-08-05) — foundational slice delivered (focused scope).  
**Phase:** B1 after B0 register.

## What landed

Canonical module:

```
src/lib/team/identity/
├── types.ts                          # StaffIdentity + resolve input contracts
├── constants.ts
├── resolveStaffIdentity.server.ts    # single resolve
├── resolveStaffIdentities.server.ts  # batch resolve
├── staffIdentityIntegrity.ts
├── staffIdentityReadiness.ts
├── staffIdentityAudit.ts
├── staffIdentityKeys.ts
├── staffIdentityDualTableAllowlist.ts
├── adapters/
├── internal/                         # NOT for external import
├── index.ts                          # pure public API
└── server.ts                         # server public API
```

Public imports:

```ts
import { classifyStaffIdentityIntegrity, type StaffIdentity } from "@/src/lib/team/identity";
import { resolveStaffIdentity, resolveStaffIdentities } from "@/src/lib/team/identity/server";
```

## Behaviour-neutral boundary

| Legacy path | Disposition |
|-------------|-------------|
| `workforce/workforceStaffMemberResolve.server.ts` | Re-exports via canonical resolve + `toResolvedStaffMemberContext` (deprecated) |
| `workforce/staffProfileHub.server.ts` | Proof consumer — gates scheduling loads via `toStaffProfileHubIdentityGate` |
| External `workforceIdentityLinks.server.ts` | Unchanged (source_ids); adapter annotates capabilities only |

Pure lifecycle / readiness engines remain in `workforce-os/*` for a later move. B1 does **not** mass-migrate ~173 raw-table consumers.

## Integrity classifications

| Condition | `linkStatus` |
|-----------|--------------|
| Valid same-tenant `fi_staff` + `fi_staff_members` | `linked` |
| Scheduling row only | `scheduling_only` |
| Lifecycle row only | `lifecycle_only` |
| Multiple candidate links | `ambiguous` |
| Linked rows different tenants | `cross_tenant_mismatch` (hard-fail by default on single resolve) |
| Structural / broken FK | `invalid` |

Missing lifecycle or scheduling rows do not throw; callers inspect integrity.

## Enforcement (B1D)

- Allowlist: `staffIdentityDualTableAllowlist.ts` (frozen 25-file debt set)
- Static test: `staffIdentityArchitecture.static.test.ts`
  - Fails on **new** files under `src/lib` that reference both `fi_staff` and `fi_staff_members`
  - Fails on external imports of `team/identity/internal/**`
- Single-table domain reads remain allowed

## Do-not-break coverage

Protected by types + tests + profile gate:

- scheduling-only / lifecycle-only transitional states
- invitation flows without auth user (`no_login` / `lifecycle_only` → `watch`)
- suspended access vs terminated employment
- multi-clinic via primary clinic fields (full multi-clinic expansion later)
- tenant isolation (cross-tenant hard-fail / unusable identity)
- batch `.in(...)` loaders
- profile hub overview still driven by existing snapshot builders
- audit helper `buildStaffIdentityAuditEvent` for ambiguous / repaired links

## Cycles

Identity package avoids importing `staffLifecycleCore` (which participates in the documented `staffLifecycleCore` ↔ `hrReconciliationEligibleCore` cycle). Employment parse is local. Onboarding invite ↔ pin cycle untouched.

## Next

- B1.1 directory + B1.2 access consumer proofs — GREEN
- Later: onboarding + roster proofs; move pure lifecycle/readiness modules under `team/identity` with shims
- Consumer migration of dual-table allowlist entries opportunistic when files are touched
