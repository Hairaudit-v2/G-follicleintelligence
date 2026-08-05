# Domain ownership rules (locked)

These rules are locked before any Phase B file moves. Changing them requires an explicit register update.

Target tree:

```
src/lib/team/
├── identity/
├── directory/
├── roster/
├── onboarding/
├── access/
├── compliance/
├── payroll/
├── planning/
├── commandCentre/
├── shared/          # cross-cutting types, mutation errors, telemetry, clinical maps
└── index.ts         # optional re-exports of stable public symbols only
```

Action modules live beside their domain (see [action-rename-map.md](./action-rename-map.md)), not under a parallel `src/lib/actions/workforce-phase-*` naming scheme long-term. Temporary re-export shims from old action paths are allowed during migration.

---

## identity

**Owns**

- Linking `fi_staff` ↔ `fi_staff_members`
- Canonical IDs and batch staff resolution
- Employment / access / readiness *composition* for a person
- Identity audit and reconciliation (including duplicate merge decisions)
- Cross-tenant integrity checks for staff identity
- Offboarding / employment termination mutations (not login revoke)

**Does not own**

- Directory filtering or list DTOs
- Roster eligibility or generation
- Payroll calculations
- Login invitations / PIN setup (those are **access**)

**Seed modules (B1 → B2.1b home)**

- `team/identity/staffCanonicalLifecycle*` (**canonical**, B2.1a)
- `team/identity/workforceIdentity*` pure modules (**canonical**, B2.1a)
- `team/identity/workforceReadiness*` pure modules (**canonical**, B2.1a)
- `team/identity/staffLifecycle*` types/core/presentation (**canonical**, B2.1a)
- `team/identity/staffEmploymentStatusPredicates.ts` (cycle-break leaf)
- `team/identity/workforceIdentityLinks.server.ts` (**canonical**, B2.1b)
- `team/identity/staffIdentityReadinessAudit.server.ts` (+ access gate) (**canonical**, B2.1b)
- `team/identity/workforceIdentityTenantOverview.server.ts` (**canonical**, B2.1b)
- `team/identity/workforceReadinessTenantOverview.server.ts` (**canonical**, B2.1b)
- Still legacy: `workforce-os/staffLifecycle.server.ts`, HR reconciliation / projection health mutations
- `workforce/workforceStaffMemberResolve.server.ts` (already adapt/shim to identity resolve)
- `workforce/identityReconciliation*`, `staffCanonicalDecision*`
- `workforce/staffTenantLinkRepair.server.ts` — explicit dual-table repair boundary (allowlisted)
- `staff/staff.server.ts` (fi_staff CRUD — eventually)
- `staff/staffFiUserLink*` (link plan; invite execution remains access)

---

## directory

**Owns**

- Directory loading, search, filtering
- Directory projections and staff-list presentation DTOs
- Clinical / calendar picker list shaping that is presentation-only

**Consumes** identity. Must not re-derive identity joins.

**Seed modules**

- `staff/staffDirectoryLoader.server.ts`, `staffDirectoryFilters.ts`
- `workforce-os/workforceOsDirectoryLoader.server.ts`
- `staff/clinicalStaffPicker*`, `calendarVisibleStaff*`, `staffAssigneeDisplay.ts`

---

## roster

**Owns**

- Generation, eligibility, cadence, manual adjustments
- Operational editing, actual-versus-plan variance
- Transaction boundaries including `rosterTx`
- Roster command-centre payload / grid UX (ops surface, not Team overview)
- Standard hours used as roster inputs

**Seed modules**

- All `workforce-os/roster*`, `workforceRostering*`, `workforceRoster*`
- `workforce/rosterCadence*`, `rosterActualVariance*`, leave workflow (availability effect)

---

## onboarding

**Owns**

- Staff creation workflow
- Onboarding invitation (distinct from login invitation)
- Checklists and onboarding status progression
- Onboarding PIN setup that is part of the onboarding invite chain

**Must remain distinct** from access login invitations.

---

## access

**Owns**

- User linkage execution for login
- Login invitations
- Access PIN setup / reset
- Suspend and revoke
- Entitlement and HR manage gates

**Does not own** employment termination (identity/offboarding).

---

## compliance

**Owns**

- Credentials, certifications, expiry, verification
- Compliance audits and scheduled compliance checks/crons

---

## payroll

**Owns**

- Wage calculations, shift costing, timesheets
- Payroll projections and exports
- Time clock policy / punch sync / auto-close cron

**Canonical identity:** `src/lib/team/payroll` (B1.8A) — financial engines remain under `workforce/wageProfile*` / shift-cost until Phase B moves.

---

## planning

**Owns**

- Procedure staffing optimizers
- Workforce demand / planning engines
- Recruitment pipeline
- Capacity and workforce modelling / surgical workforce intelligence

**Canonical identity:** `src/lib/team/planning` (B1.8B) — candidates/vacancies stay non-staff; engines remain under `workforce/*` until Phase B moves.

---

## commandCentre

**Owns composition only**

- KPI aggregation
- Attention queues
- Workforce-health summaries
- Module tiles

Consumes other domains. Contains minimal underlying business logic.

**Canonical:** `src/lib/team/commandCentre` (B1.7) — page loader shim remains at `workforce/workforceCommandCentrePage.server.ts`  
**Compat composition helpers:** `workforce/workforceCommandCentreCore.ts` (tiles / health; payroll/planning identity owned by B1.8 packages)  
**Delete after consumer migration:** `staff/workforceCommandCentre*`

---

## shared

Cross-cutting code that multiple domains need without owning a business capability:

- Mutation error mapping
- Legacy route telemetry
- Clinical integration map / shared clinical types
- Tenant/actor resolution helpers used by several domains
- Sprint-era glue tests retained until domain tests absorb them
- Lifecycle UX copy used across directory/profile/access surfaces

---

## delete

Only for confirmed dead or superseded implementations with a recorded replacement. See [collision-register.md](./collision-register.md).

---

## Risk classification (auto + review)

Mark **high** when any of:

- Mutations / Supabase transactions / `rosterTx`
- Invitation or token generation
- Authentication or entitlement logic
- Direct writes to both staff tables
- Payroll calculations
- Cross-tenant resolution
- Cron / scheduled compliance operations
- Widespread imports across unrelated modules (≥8 runtime consumers)

High-risk files migrate only after lower-risk leaf modules establish the new structure.
