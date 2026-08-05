# FI-TEAM-COHESION — Architecture register

**Phase:** B0 — Domain Ownership and Import Inventory (GREEN)  
**Date:** 2026-08-05  
**Predecessor:** [workforceos-cohesion-audit-2026-08.md](../../workforce/workforceos-cohesion-audit-2026-08.md) (Phases A1/A2 delivered; Phase B begins here)

This register is **discovery and architecture-lock only**. No mass file moves. Runtime behaviour is unchanged.

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
| [first-migration-slice.md](./first-migration-slice.md) | B1 Identity Foundation — first safe move |

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
| Raw identity refs (`src`+`scripts`+`supabase`) | 595 |
| Raw identity refs (`src/lib` only) | 352 across 173 files |

## Recommended next slice

**FI-TEAM-COHESION-B1 — Identity Foundation** — see [first-migration-slice.md](./first-migration-slice.md).

Do not migrate all raw table references in B1. Establish `src/lib/team/identity` public API first.
