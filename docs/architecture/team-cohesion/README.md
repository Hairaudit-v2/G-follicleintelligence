# FI-TEAM-COHESION — Architecture register

**Phase:** B1 CLOSED (B1.8A Payroll + B1.8B Planning GREEN) · prior slice proofs intact · B0 inventory operational  
**Date:** 2026-08-05  
**Predecessor:** [workforceos-cohesion-audit-2026-08.md](../../workforce/workforceos-cohesion-audit-2026-08.md)

B0 was discovery and architecture-lock only. **B1–B1.8** prove identity through directory, access, onboarding, roster, compliance, profile, command centre, payroll, and planning. Formal closure: [b1-identity-program-closure.md](./b1-identity-program-closure.md).

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
| Dual-table allowlist | **16** (from 20 at B1.6 start) |
| B1 program | **CLOSED** |

## Recommended next slice

**Phase B** — broader domain folder moves and sprint-action renames per [action-rename-map.md](./action-rename-map.md), keeping B1 identity contracts intact.
