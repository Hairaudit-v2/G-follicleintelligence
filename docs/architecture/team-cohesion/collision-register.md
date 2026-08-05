# Collision register

Each overlap has one disposition: `KEEP_CANONICAL` | `MERGE` | `RENAME` | `DELETE` | `NEEDS_BEHAVIOUR_REVIEW`.

---

## C1 — Command centre (three concepts, two colliding names)

| Implementation | Role | Disposition |
|----------------|------|-------------|
| `workforce/workforceCommandCentreCore.ts` + `workforceCommandCentrePage.server.ts` (+ test) | Live Team overview V2 (KPI / attention / tiles) | **KEEP_CANONICAL** → page delegates to `team/commandCentre/` (B1.7 GREEN); core helpers retained for planning tiles until B1.8 |
| `team/commandCentre/*` | Batch identity composition + attention/KPI pure helpers | **KEEP_CANONICAL** (B1.7) |
| `staff/workforceCommandCentre.ts` + `.server.ts` + `.test.ts` | Legacy per-staff intelligence; still imported by profile presentation supplements and directory | **DELETE** after those consumers switch to identity readiness + V2 composition APIs |
| `workforce-os/workforceRosterCommandCentre.server.ts` + `rosterCommandCentre*` | Roster ops command centre (different product) | **RENAME** on move to `team/roster/` (keep “Roster” in name to avoid future collision) |

---

## C2 — Roster logic split across trees

| Location | Responsibility | Disposition |
|----------|----------------|-------------|
| `workforce-os`: generation, `rosterTx`, manual adjustments, eligible staff, grid eligibility, standard hours, rostering engine, roster CC payload | Operational roster engine | **KEEP_CANONICAL** → `team/roster/` |
| `workforce`: cadence policy, actual vs plan variance, operational-editing tests | Planning cadence + variance | **MERGE** into `team/roster/` (same domain, different era folders) |

No competing engines — split is organizational, not semantic duplication of the same algorithm.

---

## C3 — Identity / readiness sibling helpers

| Cluster | Disposition |
|---------|-------------|
| `workforce-os/workforceIdentity*`, `workforceReadiness*`, `staffIdentityReadinessAudit*`, `staffCanonicalLifecycle`, `staffLifecycle*` | Pure modules **KEEP_CANONICAL** under `team/identity/` (B2.1a); servers still under `workforce-os` until B2.1b. Temporary basename shims in `workforce-os/`. |
| `workforce/workforceStaffMemberResolve.server.ts` | **MERGE** into identity resolve API |
| `workforce/identityReconciliation*`, `staffCanonicalDecision*`, duplicate/merge/repair | **MERGE** into identity reconciliation submodule |
| `staff/hrStaffReadinessMetadata.ts` | **MERGE** or thin adapter over readiness engine — **NEEDS_BEHAVIOUR_REVIEW** if scores diverge |
| `staff/staffFiUserLink*` | Link **plan** → identity; invite **execution** stays access — **MERGE** carefully across domains |

---

## C4 — Directory logic in `staff` vs OS loader

| File | Model | Disposition |
|------|-------|-------------|
| `staff/staffDirectoryLoader.server.ts` + filters | `fi_staff` + overlays | **KEEP_CANONICAL** → `team/directory/` |
| `workforce-os/workforceOsDirectoryLoader.server.ts` | `fi_staff_members` lifecycle rows | **MERGE** behind one directory loader that consumes identity projections |

---

## C5 — Clinical eligibility twins

| File set | Disposition |
|----------|-------------|
| `workforce/clinicalEligibility*.ts` | **NEEDS_BEHAVIOUR_REVIEW** vs OS procedure eligibility |
| `workforce-os/workforceProcedureClinicalEligibility.ts` + `workforceReadinessClinicalEligibility.ts` | Likely **KEEP_CANONICAL** for readiness-gated clinical checks; merge after golden tests prove equivalence |

---

## C6 — Lifecycle UX vs canonical lifecycle

| File set | Disposition |
|----------|-------------|
| `workforce-os/staffCanonicalLifecycle*` + `staffLifecycle*` | **KEEP_CANONICAL** status source |
| `workforce/staffLifecycleUxCore.ts`, `staffLifecycleCopy.ts` | **KEEP_CANONICAL** presentation → `team/shared/` or `team/identity/presentation/` |
| `workforce/staffOffboarding*`, `offboardingPage.server.ts` | **MERGE** into identity offboarding (not access) |

---

## C7 — Duplicated constants / status derivation

Suspects requiring golden tests before merge:

- Readiness bands / blocking issues (`workforceReadinessBands` vs staff CC intelligence fields)
- Source-id normalization (`staffSourceIdsNormalize` vs import pipelines)
- Active/eligible predicates (`staffCanonicalLifecycle` vs roster eligible cores — related but different questions)

Disposition pending tests: **NEEDS_BEHAVIOUR_REVIEW**, then **MERGE** into identity predicates roster may call.

---

## C8 — Sprint-named action files

All sprint action modules are delivery-history organization, not domain ownership. See [action-rename-map.md](./action-rename-map.md).

| File | Disposition |
|------|-------------|
| `workforce-phase-1c-sprint-2-actions.ts` | **SPLIT** (identity link/merge vs offboarding) |
| Other `workforce-phase-*` / domain-named workforce actions | **RENAME** to domain paths (behaviour-neutral) |

---

## C9 — Similar names, different semantics

| Names | Semantics | Disposition |
|-------|-----------|-------------|
| `workforceCommandCentre` vs `workforceRosterCommandCentre` | Team overview vs roster ops | **RENAME** roster side on move; never merge |
| `onboardingInvitation` vs `staffAccessInvite` | Hire invite vs login invite | Keep separate domains forever; **NEEDS_BEHAVIOUR_REVIEW** only if shared token helpers overlap |
| `staffCertification.server` vs `staffCertifications.server` | Singular mutation vs list helper naming | **RENAME** for clarity under compliance |
| `hrReconciliation*` (OS) vs `identityReconciliation*` / `staffReconciliation*` (workforce) | Related reconciliation surfaces | **MERGE** under identity with explicit API names |

---

## Outcome summary

| Disposition | Count (register items) |
|-------------|------------------------:|
| KEEP_CANONICAL | 6 primary clusters |
| MERGE | 7 |
| RENAME | 4 |
| DELETE | 1 cluster (3 files) |
| NEEDS_BEHAVIOUR_REVIEW | 3 |
| SPLIT | 1 action file |

Concrete per-file rows for the delete cluster are marked `proposedDomain: "delete"` in the inventory JSON.
