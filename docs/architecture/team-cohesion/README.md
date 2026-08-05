# FI-TEAM-COHESION — Architecture register

**Phase:** B1.1 — Directory Identity Proof (GREEN) · B1 foundation intact · B0 inventory operational  
**Date:** 2026-08-05  
**Predecessor:** [workforceos-cohesion-audit-2026-08.md](../../workforce/workforceos-cohesion-audit-2026-08.md)

B0 was discovery and architecture-lock only. **B1** delivered `src/lib/team/identity`. **B1.1** proved the batch resolver in the staff directory — see [b1.1-directory-identity-proof.md](./b1.1-directory-identity-proof.md).

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

**FI-TEAM-COHESION-B1.1** is GREEN — see [b1.1-directory-identity-proof.md](./b1.1-directory-identity-proof.md).

Dual-table allowlist: **24** (was 25; directory loader removed).

**Next:** B1.2 — Access identity proof. Then onboarding (B1.3), roster (B1.4).
