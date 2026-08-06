# Domain ownership rules (locked)

These rules are locked before any Phase B file moves. Changing them requires an explicit register update.

Target tree:

```
src/lib/team/
├── identity/
├── directory/
├── notifications/   # B2.3b — HR portal selection + notification composition
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
- `staff/staffFiUserLink.server.ts` (link **execution**; pure plan moved to `team/access` in B2.2b)

**B2.3b readiness contracts (canonical):** `team/identity/readiness/hrReadinessContracts.ts` — `STAFF_HR_SYNC_STALE_DAYS`, `StaffHrReadinessSummary`, neutral onboarding/stale predicates. Exposed via `@/src/lib/team/identity`. Must not import notifications or directory.

---

## directory

**Owns**

- Directory loading, search, filtering
- Directory projections and staff-list presentation DTOs
- Clinical / calendar picker list shaping that is presentation-only

**Consumes** identity. Must not re-derive identity joins.

**Seed modules**

- `team/directory/*` B1.1 projections + **clinical staff picker (B2.2d GREEN)** + **directory core (B2.2a GREEN)** + **staff role policy (B2.3a GREEN)** via `index` / `server`
- Remaining hot cluster: `staffRoleReview*` (mixed payroll/clinic/HR notification composition)

**Directory owns (B2.3a):** staff-role classification for directory visibility, clinical bookability role predicates (`needs_review`), picker/filter role policy.

**Directory does not own:** wage/payroll role review, contracted/roster hours, weekly availability templates, HR notification delivery, identity readiness thresholds.

---

## notifications

**Owns**

- HR notification composition (badge / variant / alert copy)
- HR portal URL allowlist and source-system priority selection
- Notification recipient / My HR portal page loaders
- Notification action eligibility at the notification layer

**Consumes** identity readiness contracts. Must not own staleness thresholds or neutral readiness summary types.

**Canonical home (B2.3b)**

- `src/lib/team/notifications` — pure portal selection + notification DTOs/builders
- `src/lib/team/notifications/server` — `loadHrNotificationByStaffId`, `loadMyHrPortalPage`

**Does not own:** identity readiness scoring engines, directory list loaders, payroll role-review workflows.

---

## roster

**Owns**

- Generation, eligibility, cadence, manual adjustments
- Operational editing, actual-versus-plan variance
- Transaction boundaries including `rosterTx`
- Roster command-centre payload / grid UX (ops surface, not Team overview)
- Standard hours used as roster inputs
- **Recurring weekly availability template** (`fi_staff.working_hours` parse/serialize/window predicates)
- **Effective UTC-range availability** (weekly OR `available_override`, blocked by leave/sick/unavailable/training/admin/maternity)

**Canonical availability (B2.4)**

- `src/lib/team/roster/availability` — weekly hours + `getStaffAvailabilityForRange`
- Exposed via `@/src/lib/team/roster` and `@/src/lib/team/roster/availability`
- Bookings compose this contract; bookings do not own weekly parsing or block precedence

**Seed modules**

- All `workforce-os/roster*`, `workforceRostering*` (engine re-exports availability), `workforceRoster*`
- `workforce/rosterCadence*`, `rosterActualVariance*`, leave workflow (availability effect)

**Does not own:** final appointment slot allow/deny (Bookings), contracted payroll hours (Payroll)

---

## onboarding

**Owns**

- Staff creation workflow
- Onboarding invitation (distinct from login invitation)
- Checklists and onboarding status progression
- Onboarding PIN setup that is part of the onboarding invite chain

**Must remain distinct** from access login invitations. Completing onboarding PIN does **not** activate login access.

**Canonical home (B2.2c)**

- `src/lib/team/onboarding` — pure types, centre helpers, invite status, invite URLs, staff-create plan
- `src/lib/team/onboarding/server` — page loader, invite send/load/accept, PIN setup/complete, checklist, staff create

**Cycle break:** `invitation → pinSetup`, `pinLayer → invitationAccept` (no mutual imports).

---

## access

**Owns**

- User linkage **plan** (`staffFiUserLinkPlan`) and login invite / PIN **execution**
- Login invitations (not hire/onboarding invitations)
- Access PIN setup / reset
- Suspend and revoke
- Entitlement and HR manage gates
- Access-centre loaders / projections and HR task-map composition

**Canonical home (B2.2b)**

- `src/lib/team/access` — pure cores, task map, fi-user link plan
- `src/lib/team/access/server` — centre loader, accept/PIN mutations, manage gate, audit helpers

**Does not own** employment termination (identity/offboarding).  
**Does not absorb** `staffTenantLinkRepair.server.ts` — access may call it; repair stays the explicit dual-table boundary.

**Deferred:** `staff/staffFiUserLink.server.ts` (execution still outside access until a later slice); B3 action file renames.

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
