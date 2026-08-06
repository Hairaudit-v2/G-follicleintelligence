# FI-TEAM-COHESION — Architecture register

**Phase:** B2.6 GREEN · B2.5 GREEN · B2.4 GREEN · B2.3b GREEN · B2.3a GREEN · B2.2a–d GREEN · B2.1b GREEN · B1 CLOSED · B0 inventory operational  
**Date:** 2026-08-06  
**Predecessor:** [workforceos-cohesion-audit-2026-08.md](../../workforce/workforceos-cohesion-audit-2026-08.md)

B0 was discovery and architecture-lock only. **B1–B1.8** prove identity through directory, access, onboarding, roster, compliance, profile, command centre, payroll, and planning. Formal closure: [b1-identity-program-closure.md](./b1-identity-program-closure.md).

**B2.1a** moved pure lifecycle / readiness into `src/lib/team/identity`. **B2.1b** moved identity server loaders (links, audit, tenant overviews), deleted the 11 temporary shims, and exposed them via `team/identity/server` — see [b2.1b-identity-server-consolidation.md](./b2.1b-identity-server-consolidation.md).

**B2.2** physically homes directory / access / onboarding — see [b2.2-directory-access-onboarding.md](./b2.2-directory-access-onboarding.md).

| Slice | Status |
|-------|--------|
| B2.2b — Access | **GREEN** |
| B2.2c — Onboarding + cycle break | **GREEN** (`cycleCount: 0`, allowlist **12**) |
| B2.2d — Clinical staff picker | **GREEN** (`e3d5a55c`; deep imports 247 → **211**) |
| B2.2a — Directory core | **GREEN** (delivery record / recovery id B2.2a-R — [record](./b2.2a-r-directory-core-consolidation.md); earlier “already GREEN” wording was incorrect) |
| B2.3a — Staff role policy | **GREEN** — [plan](./b2.3a-staff-role-policy-plan.md) · [proof](./b2.3a-staff-role-policy-proof.md) |
| B2.3b — HR readiness + notifications | **GREEN** — [plan](./b2.3b-hr-readiness-notification-plan.md) · [proof](./b2.3b-hr-readiness-notification-proof.md) |
| B2.4 — Roster availability + booking slot gate | **GREEN** — [plan](./b2.4-roster-availability-booking-gate-plan.md) · [proof](./b2.4-roster-availability-booking-gate-proof.md) |
| B2.5 — Effective availability consumer audit + explanation UI | **GREEN** — [plan](./b2.5-effective-availability-consumer-audit-plan.md) · [proof](./b2.5-effective-availability-consumer-audit-proof.md) |
| B2.6 — Calendar availability parity | **GREEN** — [plan](./b2.6-calendar-availability-parity-plan.md) · [proof](./b2.6-calendar-availability-parity-proof.md) |

**History note:** An earlier draft claimed B2.2a GREEN before any directory-core `git mv`. That claim was stricken. Clinical picker (B2.2d) and directory-core (B2.2a) are distinct deliveries.

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
| [b2.1b-identity-server-consolidation.md](./b2.1b-identity-server-consolidation.md) | B2.1b identity server move + shim deletion |
| [b2.2-directory-access-onboarding.md](./b2.2-directory-access-onboarding.md) | B2.2 directory / access / onboarding physical consolidation (a–d GREEN) |
| [b2.2a-r-directory-core-consolidation.md](./b2.2a-r-directory-core-consolidation.md) | B2.2a directory-core delivery record (recovery id B2.2a-R) |
| [b2.3a-staff-role-policy-plan.md](./b2.3a-staff-role-policy-plan.md) | B2.3a must-move manifest |
| [b2.3a-staff-role-policy-proof.md](./b2.3a-staff-role-policy-proof.md) | B2.3a delivery proof |
| [b2.3b-hr-readiness-notification-plan.md](./b2.3b-hr-readiness-notification-plan.md) | B2.3b ownership audit + must-move manifest |
| [b2.3b-hr-readiness-notification-proof.md](./b2.3b-hr-readiness-notification-proof.md) | B2.3b delivery proof |
| [b2.4-roster-availability-booking-gate-plan.md](./b2.4-roster-availability-booking-gate-plan.md) | B2.4 ownership audit + must-move manifest |
| [b2.4-roster-availability-booking-gate-proof.md](./b2.4-roster-availability-booking-gate-proof.md) | B2.4 delivery proof |
| [b2.5-effective-availability-consumer-audit-plan.md](./b2.5-effective-availability-consumer-audit-plan.md) | B2.5 consumer audit + delivery plan |
| [b2.5-effective-availability-consumer-audit-proof.md](./b2.5-effective-availability-consumer-audit-proof.md) | B2.5 delivery proof |
| [b2.6-calendar-availability-parity-plan.md](./b2.6-calendar-availability-parity-plan.md) | B2.6 CalendarOS + assignment bridge parity plan |
| [b2.6-calendar-availability-parity-proof.md](./b2.6-calendar-availability-parity-proof.md) | B2.6 delivery proof |

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

## Headline numbers (2026-08-06)

| Metric | Value |
|--------|------:|
| Canonical Team domains delivered | identity, directory, notifications, access, onboarding, roster (+ availability), compliance, profile, commandCentre, payroll, planning |
| Dual-table allowlist | **12** — must not grow |
| B1 program | **CLOSED** |
| B2.1a temporary compatibility shims | **0** (deleted in B2.1b) |
| Documented cycles | **0** |

## B2 scorecard

| Metric | B2.5 | B2.6 now | Target |
|--------|-----:|---------:|-------:|
| Files in legacy lib trees | 207 | **207** | 0 |
| Deep legacy imports | 180 | **180** | 0 |
| Sprint-named action files | 7 | 7 | 0 |
| Documented dependency cycles | 0 | **0** | 0 |
| Temporary compatibility exports | 0 | **0** | 0 |
| Identity allowlist | 12 | **12** | No increase |

Refresh “Current” from `generated/b0-summary.json` after each inventory regenerate. Legacy tree count = `workforce-os` + `workforce` + `staff` file counts from summary.

## Recommended next slice

After B2.6:

1. Override creation UX (Roster / Calendar “mark available outside hours” — API already supports `available_override`)
2. Full roster / standard-hours physical home move
3. Deferred mixed composition: `staffRoleReview*` / sprint actions
4. Otherwise begin B3 sprint-action renames once domain homes feel stable
