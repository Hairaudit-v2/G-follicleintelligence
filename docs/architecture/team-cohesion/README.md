# FI-TEAM-COHESION — Architecture register

**Phase:** B2.1a IN PROGRESS (identity pure-layer move) · B1 CLOSED · B0 inventory operational  
**Date:** 2026-08-05  
**Predecessor:** [workforceos-cohesion-audit-2026-08.md](../../workforce/workforceos-cohesion-audit-2026-08.md)

B0 was discovery and architecture-lock only. **B1–B1.8** prove identity through directory, access, onboarding, roster, compliance, profile, command centre, payroll, and planning. Formal closure: [b1-identity-program-closure.md](./b1-identity-program-closure.md).

**B2.1a** physically consolidates pure lifecycle / readiness modules under `src/lib/team/identity` with temporary `workforce-os` shims — see [b2.1a-identity-pure-consolidation.md](./b2.1a-identity-pure-consolidation.md).

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
| [b1.5-compliance-identity-proof.md](./b1.5-compliance-identity-proof.md) | B1.5 compliance/credentials batch-resolver proof |
| [b1.6-staff-profile-hub-proof.md](./b1.6-staff-profile-hub-proof.md) | B1.6 staff profile composition proof |
| [b1.7-command-centre-identity-proof.md](./b1.7-command-centre-identity-proof.md) | B1.7 Command Centre batch composition proof |
| [b1.8a-payroll-identity-proof.md](./b1.8a-payroll-identity-proof.md) | B1.8A payroll identity proof |
| [b1.8b-planning-identity-proof.md](./b1.8b-planning-identity-proof.md) | B1.8B planning identity proof |
| [b1-identity-program-closure.md](./b1-identity-program-closure.md) | B1 program closure evidence |
| [b2.1a-identity-pure-consolidation.md](./b2.1a-identity-pure-consolidation.md) | B2.1a pure lifecycle/readiness move |

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

## Headline numbers (2026-08-05)

| Metric | Value |
|--------|------:|
| Canonical Team domains delivered | identity, directory, access, onboarding, roster, compliance, profile, commandCentre, payroll, planning |
| Dual-table allowlist | **16** (from 20 at B1.6 start) — must not grow |
| B1 program | **CLOSED** |
| B2.1a temporary compatibility shims | **11** (`workforce-os` basename re-exports) |

## B2 scorecard

| Metric | B2 start | Current | Target |
|--------|---------:|--------:|-------:|
| Files in legacy lib trees | 283 | **278** | 0 |
| Deep legacy imports | 252 | **253** | 0 |
| Sprint-named action files | 7 | 7 | 0 |
| Documented dependency cycles | 2 | **1** | 0 |
| Duplicate implementations | 3 delete rows | 3 | 0 |
| Temporary compatibility exports | 0 | **11** | 0 |
| Identity allowlist | 16 | **16** | No increase |

Refresh “Current” from `generated/b0-summary.json` after each inventory regenerate. Cycle count: lifecycle↔HR eligibility broke in B2.1a; remaining onboarding invite↔pin cycle tracked in [import-graph.md](./import-graph.md).

## Recommended next slice

**B2.1b** — Move identity server modules (links, readiness audit, tenant overview) behind the same public `team/identity/server` surface; delete shims as consumers re-point. Then Directory and Access physical consolidation. Do not start B3 sprint-action renames until identity pure + server homes are stable, unless imports already permit a parallel PR.
