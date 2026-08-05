# FI-TEAM-COHESION — Architecture register

**Phase:** B1.4 — Roster Identity Proof (GREEN) · B1.3 onboarding proof intact · B1.2 access proof intact · B1.1 directory proof intact · B1 foundation intact · B0 inventory operational  
**Date:** 2026-08-05  
**Predecessor:** [workforceos-cohesion-audit-2026-08.md](../../workforce/workforceos-cohesion-audit-2026-08.md)

B0 was discovery and architecture-lock only. **B1** delivered `src/lib/team/identity`. **B1.1–B1.3** proved directory, access, and onboarding. **B1.4** proved roster — see [b1.4-roster-identity-proof.md](./b1.4-roster-identity-proof.md).

## Documents

| Doc | Purpose |
|-----|---------|
| [domain-ownership.md](./domain-ownership.md) | Locked ownership rules for `src/lib/team/*` |
| [inventory.md](./inventory.md) | Complete file inventory + risk summary |
| [import-graph.md](./import-graph.md) | Cross-tree imports, cycles, deep imports, client→server |
| [collision-register.md](./collision-register.md) | Duplicate implementations and dispositions |
| [identity-access-baseline.md](./identity-access-baseline.md) | Raw `fi_staff` / `fi_staff_members` reference baseline |
| [action-rename-map.md](./action-rename-map.md) | Sprint action → domain action rename/split plan |
| [public-api-proposal.md](./public-api-proposal.md) | Allowed external import surface |
| [first-migration-slice.md](./first-migration-slice.md) | B1 Identity Foundation — plan |
| [b1-identity-foundation.md](./b1-identity-foundation.md) | B1 delivery record + enforcement |
| [b1.1-directory-identity-proof.md](./b1.1-directory-identity-proof.md) | B1.1 directory batch-resolver proof |
| [b1.2-access-identity-proof.md](./b1.2-access-identity-proof.md) | B1.2 access batch-resolver proof |
| [b1.3-onboarding-identity-proof.md](./b1.3-onboarding-identity-proof.md) | B1.3 onboarding batch-resolver proof |
| [b1.4-roster-identity-proof.md](./b1.4-roster-identity-proof.md) | B1.4 roster batch-resolver proof |

## Generated artifacts

Regenerate:

```bash
node scripts/team-cohesion/generate-b0-inventory.mjs
```

| Artifact | Contents |
|----------|----------|
| [generated/b0-inventory.json](./generated/b0-inventory.json) | Full `TeamDomainInventoryRow[]` + graphs |
| [generated/b0-inventory.csv](./generated/b0-inventory.csv) | Spreadsheet review of every file |
| [generated/b0-summary.json](./generated/b0-summary.json) | Counts only |

## Headline numbers (2026-08-05 regenerate)

| Metric | Value |
|--------|------:|
| Files in three legacy trees | **283** (audit cited 267; +16 since) |
| Classified with proposed owner or delete | **283 / 283** |
| `needsDecision` | **0** |
| Inter-tree import edges | 97 |
| Import cycles (legacy trees) | 2 |
| External deep imports into trees | 252 |
| Client components importing `.server` modules | 23 (mostly `import type`) |
| Raw identity refs (`src`+`scripts`+`supabase`) | 615 (was 595 pre-B1; +canonical module refs) |
| Raw identity refs (`src/lib` only) | see regenerate `identityBaseline.srcLibOnly` |
| Canonical identity package | `src/lib/team/identity` (B1 GREEN) |

## Recommended next slice

**FI-TEAM-COHESION-B1.4** is GREEN — see [b1.4-roster-identity-proof.md](./b1.4-roster-identity-proof.md).

Dual-table allowlist: **21** (was 22; roster-linked lifecycle classifier removed).

**Next:** Compliance / credentials identity proof, then staff profile hub consolidation, command centre, payroll/planning. Keep B1.1.1 deferred.
