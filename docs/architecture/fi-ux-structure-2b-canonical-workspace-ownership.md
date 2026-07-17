# FI-UX-STRUCTURE-2B — Canonical Workspace Ownership

Status: **FROZEN WITH AMBER EXCEPTIONS**

Date: 2026-07-17

Next milestone: `FI-UX-STRUCTURE-2C`

Machine-readable contract: [`../audits/evidence-fi-ux-structure-2b.json`](../audits/evidence-fi-ux-structure-2b.json)

## Executive verdict

**AMBER.** The canonical ownership model is coherent and frozen, but not every proposed redirect is
safe to implement yet.

The repository supports the intended architecture:

- Team owns people and person-specific operations.
- Settings owns policy, defaults, clinic configuration and non-staff administrative identities.
- Integrations owns provider connection and provider operational health.
- Deployment owns readiness, migration orchestration, cutover and evidence, and links to canonical
  editors.
- `FiOsAppShell` is the mounted tenant-level navigation authority.
- The universal rail remains **Today, Calendar, Patients, Front Desk, Team, More**.
- Pipeline remains canonical at `/fi-admin/[tenantId]/crm` and is promoted by role-aware More
  ordering, not by adding a seventh universal slot.

The verdict is not GREEN because repository evidence also establishes:

1. `/team/identity` and `/workforce-os/staff-access` render the same
   `StaffAccessCentreClient`, but use different route gates.
2. Admin Users deliberately creates a separate `fi_tenant_admin_users` record, may be used for
   operational staff, and does not enforce that clinic employees are represented only through
   Team.
3. `reception-os`, workforce/HR and several surgery routes are still live workspaces with
   unproven action, permission or deep-link parity.
4. A tenant `/academy` destination is present in the Team legacy catalog but has no tenant
   `page.tsx`.
5. Platform deployment routes exist, but there is no proven tenant Deployment route suitable for
   an active More destination.

These are Part 2C gates, not reasons to weaken the ownership model.

No production route, UI, database schema, integration, migration action or permission behaviour is
changed by this milestone.

## Governing principles

1. **Manage the individual in Team.**
2. **Manage what a type of person may do in Settings.**
3. A workflow that needs another workspace's function shows status and a link; it does not copy the
   editor.
4. Integrations owns authentication, provider settings and operational provider diagnostics.
5. Deployment owns cross-domain readiness, migration progress, cutover and evidence.
6. Deployment may summarise integration health but must link to Integrations for diagnostics.
7. Existing canonical routes are retained where practical. Labels may change without unnecessary
   route churn.
8. Entity routes remain valid deep links until a context-preserving replacement is proven.
9. Navigation visibility is not authorisation. Route guards and mutation gates remain
   authoritative.
10. A route is not retired merely because it is hidden from navigation.

## Team versus Settings boundary

### Team — person-level operations

Approved information architecture:

```text
Team
  People
  Access
  Roster
  Leave
  Onboarding
  Competencies
```

Existing routes are retained as the practical canonical routes:

- People: `/team/staff`
- Access: `/team/identity`
- Roster: `/team/roster`
- Onboarding: `/team/onboarding`
- Competencies: `/team/compliance`
- Training subsection: `/team/training`
- Person profile/lifecycle: `/workforce-os/staff/[staffId]` until a Team-prefixed entity route is
  justified
- Person role review: `/staff/role-review`
- HR import: `/hr/staff-import`

Team owns staff directory, person profiles, employment state, lifecycle, invitation state,
login/PIN readiness, user-to-staff linking, roster, leave, onboarding, competencies,
qualifications, certifications, training readiness and person-specific role assignment.

There is no dedicated Leave route in the current Team tabs. Ownership is frozen to Team, while its
route remains HOLD rather than inventing `/team/leave` in this milestone.

### Settings — policy and configuration

Approved information architecture:

```text
Settings
  Clinic
    General
    Branding
    Locations
    Services
    Rooms
    Calendar defaults
    Tax & localisation
  Roles & permissions
  Templates
  Integrations
  Billing
  Security
```

Existing routes remain valid:

- Clinic/general and branding: `/configuration`
- Clinic setup/locations: `/settings/clinic-setup` (Locations subsection remains unproven)
- Services: `/services`
- Rooms: `/rooms`
- Calendar defaults: `/settings/calendar`
- Tax and localisation: `/settings/tax-localisation`
- Templates: `/settings/templates`
- Billing configuration: `/settings/payments`
- Roles & permissions implementation: `/settings/staff-access`
- Security/non-staff admin identities: `/settings/admin-users`

`/settings/staff-access` is conceptually **Roles & permissions**, not person access. It retains
module and field grant policy. The phrase “Staff access” should be removed from Settings
navigation in Part 2C because it collides with Team → Access.

The Settings secondary strip must no longer contain a Staff directory entry after Part 2C.

## Admin Users classification

Approved classification:

- Clinic employees, including employees with elevated rights, are people in Team.
- Service accounts, platform support identities and genuinely non-staff tenant administrators are
  managed under Settings → Security.
- Platform-wide administrators remain in platform administration.
- The same clinic employee must not be independently managed as unrelated Team and Admin Users
  identities.

Current repository behaviour is broader than the approved architecture:

- `/settings/admin-users` loads `fi_tenant_admin_users`.
- The invite action creates or reuses a `fi_users` row, then inserts a
  `fi_tenant_admin_users` role.
- It does **not** create `fi_staff`.
- Revocation removes only the tenant-admin row, not `fi_users` or `fi_staff`.
- The page explicitly describes finance, owners, auditors, compliance officers and “operational
  staff” as candidates.
- The available tenant-admin roles include `operations_admin`.
- No guard in the invite action checks whether the identity is a clinic employee or already has a
  linked `fi_staff` record.

Therefore Admin Users remains KEEP under Settings → Security, but employee-overlap detection and a
classification/migration plan are mandatory before enforcing the approved boundary. No existing
identity is changed in 2B.

## Deployment versus Integrations boundary

### Integrations

Settings → Integrations owns:

- OAuth and credentials
- provider connection state
- webhook state
- sync direction and scope
- retry state
- provider availability and diagnostics
- connected objects
- provider-level settings
- last successful exchange
- backfill controls

Current canonical routes:

- Provider hub and Google Calendar: `/settings/integrations`
- HubSpot provider workspace: `/settings/integrations/hubspot`
- Timely: `/settings/integrations/timely`
- Timely payload discovery: `/settings/integrations/timely/discovery`
- Pathology inbound routing remains at `/configuration/pathology-email`, but its navigation owner
  is Integrations.

Only providers with real implemented support are approved as active. No placeholder provider is
approved as an operable connection.

### Deployment

Deployment owns:

- setup progress
- clinic, Team and integration readiness summaries
- migration progress and completeness
- identity reconciliation
- quarantine status
- cutover and go-live blockers
- deployment evidence and history

Current platform routes:

- `/fi-admin/platform/deployments`
- `/fi-admin/platform/onboarding`
- `/fi-admin/platform/onboarding/[sessionId]`

The proposed tenant structure is frozen conceptually:

```text
Deployment
  Overview
  Clinic readiness
  Team readiness
  Integrations
  Data migration
  Go-live
  Evidence
```

It must render summary states such as:

```text
Staff access: 8 of 10 ready
Manage in Team

Google Calendar: connected
Manage integration

HubSpot migration: 2 quarantined
Review migration
```

It must not render a second staff-access editor, clinic editor, provider connector or migration
review screen.

An active tenant More → Deployment link is **not approved yet** because no tenant route and
tenant-lifecycle/RBAC contract are currently proven. The future tenant surface must link to
canonical routes and may retain post-go-live history for authorised users.

### Integration health versus deployment health

| Integration health (Integrations) | Deployment health (Deployment)       |
| --------------------------------- | ------------------------------------ |
| Authentication and credentials    | Import completeness                  |
| Webhooks                          | Identity matching and reconciliation |
| Sync direction/scope/success      | Quarantine and migration exceptions  |
| Retry queue                       | Cutover readiness                    |
| Provider availability             | Go-live blockers                     |
| Last exchange and diagnostics     | Deployment evidence/history          |

Deployment may show a provider-health summary; provider diagnosis and repair link to Integrations.

## HubSpot ownership

The HubSpot provider workspace is already the shared implementation:

- Connection and provider health: Integrations → `/settings/integrations/hubspot`
- Migration review tools: the same provider workspace, including query-driven import and migration
  tabs
- Deployment migration readiness: Deployment summary linking to the relevant HubSpot tab
- Imported lead operations: Pipeline → `/crm`

Existing aliases:

- `/settings/imports/hubspot` redirects to
  `/settings/integrations/hubspot?tab=import-review`
- `/onboarding-os/import-review` redirects to the same provider tab
- both aliases forward `batch_id`

The aliases remain redirects. Deployment must not create a second HubSpot migration screen.

## Google Calendar ownership

- OAuth, connected calendars, sync scope, health, backfill and diagnostics: Integrations
- day-to-day scheduling and appointment use: Calendar → `/calendar`
- display defaults: Settings → `/settings/calendar`
- deployment readiness: Deployment summary linking to Integrations
- development delivery/UAT surfaces are not approved as clinic operating navigation

No Google Calendar sync behaviour changes in this milestone.

## Canonical navigation map

### Universal rail

The approved universal rail remains:

```text
Today
Calendar
Patients
Front Desk
Team
More
```

This exactly matches `FI_OS_D6G_PRIMARY_RAIL_SLOT_IDS` and `resolveFiOsMinimalNavItems`.

Pipeline is not a seventh universal destination. It remains canonical at `/crm`.

### Role-filtered More

Approved destination set, subject to real routes and existing permissions:

```text
Pipeline
Surgery
Doctor
Imaging
Pathology
Money
Reports
Settings
Deployment (only after a real tenant route and gate exist)
```

Academy is not approved as active. The legacy catalog points to `/academy`, but there is no tenant
page. Current training and competency work remains under Team.

The safest Pipeline prominence approach is the existing one:

- consultant profile: Pipeline workflow group first
- reception profile: Pipeline near the top after Front Desk
- doctor/surgeon profile: Surgery and Clinical first
- manager/director/platform profile: Reports and operational groups first
- destination remains filtered by feature and CRM shell access

Part 2B does not modify this ordering.

## Role visibility matrix

| Role           | Universal rail                       | More emphasis                          | Settings                 | Deployment                              |
| -------------- | ------------------------------------ | -------------------------------------- | ------------------------ | --------------------------------------- |
| Reception      | Six slots, permission-filtered       | Front Desk, Pipeline, Patients         | Only if granted          | Hidden                                  |
| Nurse          | Six slots, permission-filtered       | Patients, Clinical, Surgery, Pathology | Only if granted          | Hidden                                  |
| Consultant     | Six slots, permission-filtered       | Pipeline first, then Patients/Clinical | Only if granted          | Hidden                                  |
| Doctor         | Six slots, permission-filtered       | Surgery and Clinical first             | Only if granted          | Hidden                                  |
| Manager        | Six slots, permission-filtered       | Reports, operations, Pipeline, Team    | Configuration capability | Readiness only if explicitly granted    |
| Clinic owner   | Six slots, permission-filtered       | Reports, Team, Money, Settings         | Visible                  | Full tenant deployment when implemented |
| Finance        | Six slots with clinical blocks       | Money and Reports                      | Billing only if granted  | Hidden unless explicitly granted        |
| Platform admin | Tenant view remains permission-aware | Deployment, Reports, Settings, Team    | Visible                  | Full platform and tenant                |

Feature-route enforcement, adaptive staff entitlements, tenant-admin roles, staff PIN restrictions
and module mutation gates remain authoritative.

## Capability ownership table

There are **46** audited capabilities. Each has exactly one owner; HOLD applies to route or
implementation readiness, not ownership.

|   # | Capability                                 | Canonical owner | Canonical route                  | Status                  |
| --: | ------------------------------------------ | --------------- | -------------------------------- | ----------------------- |
|   1 | Staff directory                            | Team            | `/team/staff`                    | Frozen                  |
|   2 | Staff profiles/employment/lifecycle        | Team            | `/workforce-os/staff/[staffId]`  | Existing route          |
|   3 | Invitation/login/PIN readiness             | Team            | `/team/identity`                 | Frozen                  |
|   4 | Role/module/field entitlement policy       | Settings        | `/settings/staff-access`         | Conceptual rename       |
|   5 | Non-staff tenant admin identities          | Settings        | `/settings/admin-users`          | Exception               |
|   6 | Staff onboarding                           | Team            | `/team/onboarding`               | Frozen                  |
|   7 | Roster and eligibility                     | Team            | `/team/roster`                   | Frozen                  |
|   8 | Leave and availability                     | Team            | `/team`                          | No dedicated route      |
|   9 | Competencies/qualifications/certifications | Team            | `/team/compliance`               | Frozen                  |
|  10 | Training readiness                         | Team            | `/team/training`                 | Frozen                  |
|  11 | HR import/reconciliation                   | Team            | `/hr/staff-import`               | Existing route          |
|  12 | Person role assignment/review              | Team            | `/staff/role-review`             | Existing route          |
|  13 | Clinic general configuration               | Settings        | `/configuration`                 | Frozen                  |
|  14 | Clinic branding                            | Settings        | `/configuration`                 | Frozen                  |
|  15 | Locations                                  | Settings        | `/settings/clinic-setup`         | Subsection HOLD         |
|  16 | Services                                   | Settings        | `/services`                      | Frozen                  |
|  17 | Rooms                                      | Settings        | `/rooms`                         | Frozen                  |
|  18 | Calendar defaults                          | Settings        | `/settings/calendar`             | Frozen                  |
|  19 | Tax/localisation                           | Settings        | `/settings/tax-localisation`     | Frozen                  |
|  20 | Templates                                  | Settings        | `/settings/templates`            | Frozen                  |
|  21 | Billing configuration                      | Settings        | `/settings/payments`             | Frozen                  |
|  22 | Tenant security policy                     | Settings        | `/settings/admin-users`          | Complete workspace HOLD |
|  23 | Provider connection catalogue              | Integrations    | `/settings/integrations`         | Frozen                  |
|  24 | Google Calendar connection                 | Integrations    | `/settings/integrations`         | Frozen                  |
|  25 | HubSpot connection/workspace               | Integrations    | `/settings/integrations/hubspot` | Frozen                  |
|  26 | HubSpot migration tools                    | Integrations    | HubSpot migration tab            | Frozen                  |
|  27 | Timely connection                          | Integrations    | `/settings/integrations/timely`  | Frozen                  |
|  28 | Provider operational health                | Integrations    | `/settings/integrations`         | Frozen                  |
|  29 | Calendar operations                        | Calendar        | `/calendar`                      | Frozen                  |
|  30 | Today overview                             | Today           | tenant root                      | Frozen                  |
|  31 | Front Desk operations                      | Front Desk      | `/front-desk`                    | Frozen                  |
|  32 | Patient directory/profile                  | Patients        | `/patients`                      | Frozen                  |
|  33 | Doctor workspace                           | Doctor          | `/doctor`                        | Frozen                  |
|  34 | Surgery operations                         | Surgery         | `/surgery`                       | Frozen                  |
|  35 | Imaging                                    | Imaging         | patient imaging route            | Frozen                  |
|  36 | Pathology                                  | Pathology       | `/pathology/inbox`               | Frozen                  |
|  37 | Longitudinal health record                 | Patients        | `/foundation-integrity`          | Link from Patients      |
|  38 | Enquiry pipeline                           | Pipeline        | `/crm`                           | Frozen                  |
|  39 | Clinical consultations                     | Clinical        | `/consultations`                 | Frozen                  |
|  40 | Imported lead operations                   | Pipeline        | `/crm`                           | Frozen                  |
|  41 | Analytics/reporting                        | Reports         | `/reports`                       | Frozen                  |
|  42 | Financial operations                       | Money           | `/financial-os`                  | Frozen                  |
|  43 | HairAudit/quality review                   | Reports         | `/reports/quality`               | Frozen                  |
|  44 | Deployment readiness                       | Deployment      | platform session today           | Tenant route planned    |
|  45 | Migration/cutover/evidence                 | Deployment      | platform session today           | Tenant route planned    |
|  46 | Standalone tenant Academy                  | Team training   | `/team/training`                 | Dead target HOLD        |

## Route disposition table

The JSON evidence contains the complete implementation schema for **58** route/location decisions:
current job, users, owner, canonical route, reason, permission risk, deep-link risk, context
preservation, Part 2C action and rollback.

Current totals:

| Decision | Count |
| -------- | ----: |
| KEEP     |    25 |
| MERGE    |     0 |
| REDIRECT |    16 |
| LINK     |     7 |
| RETIRE   |     2 |
| HOLD     |     8 |

`MERGE` is zero intentionally: Part 2B freezes ownership but does not merge screens. Discovery
merge candidates become REDIRECT where implementations are already equivalent, LINK where
specialised functions remain, or HOLD where parity is not proven.

### Team and access

| Current location                | Decision | Canonical destination / rationale                               |
| ------------------------------- | -------- | --------------------------------------------------------------- |
| `/team/staff`                   | KEEP     | Team People                                                     |
| `/staff`                        | REDIRECT | Same component, loader and workforce read gate; forward filters |
| Settings strip Staff            | RETIRE   | Directory is not Settings                                       |
| `/workforce-os/directory`       | HOLD     | Parity/gate proof required                                      |
| `/workforce-os/staff/[staffId]` | KEEP     | Entity route; Team-owned                                        |
| `/staff/[staffId]/twin`         | LINK     | Keep until unique content is assessed                           |
| `/team/identity`                | KEEP     | Team Access                                                     |
| `/workforce-os/staff-access`    | HOLD     | Same component, different route gate                            |
| `/staff/link-users`             | LINK     | Authorised repair tool from Team Access                         |
| `/settings/staff-access`        | KEEP     | Settings Roles & permissions                                    |
| `/settings/admin-users`         | KEEP     | Settings Security, with employee-overlap exception              |
| `/team/roster`                  | KEEP     | Team Roster                                                     |
| `/workforce-os/roster`          | HOLD     | Nested/date/action parity unproven                              |
| `/hr-os/roster`                 | REDIRECT | Existing redirect to workforce roster                           |
| `/team/onboarding`              | KEEP     | Team Onboarding                                                 |
| `/hr-os/onboarding`             | HOLD     | Parity/gate proof required                                      |
| `/team/compliance`              | KEEP     | Team Competencies                                               |
| `/hr-os/compliance`             | HOLD     | Parity/gate proof required                                      |
| `/hr-os/certifications`         | LINK     | Specialised deep links                                          |
| `/hr-os/credentials`            | LINK     | Specialised deep links                                          |
| `/team/training`                | KEEP     | Team training readiness                                         |
| configured `/academy`           | RETIRE   | No tenant page; reference scan first                            |

### Settings, Integrations and Deployment

| Current location                            | Decision | Canonical destination / rationale                         |
| ------------------------------------------- | -------- | --------------------------------------------------------- |
| `/configuration`                            | KEEP     | Settings Clinic; Deployment panels remain summaries/links |
| `/services`                                 | KEEP     | Settings Clinic, no route churn                           |
| `/rooms`                                    | KEEP     | Settings Clinic, no route churn                           |
| `/settings/reminders`                       | REDIRECT | Existing templates booking-tab redirect                   |
| `/settings/integrations`                    | KEEP     | Integrations hub                                          |
| `/settings/integrations/hubspot`            | KEEP     | One provider workspace                                    |
| `/settings/imports/hubspot`                 | REDIRECT | Existing import-review deep link; forwards `batch_id`     |
| `/onboarding-os/import-review`              | REDIRECT | Existing Deployment-to-provider deep link                 |
| `/configuration/pathology-email`            | KEEP     | Route retained; Integrations owns navigation              |
| `/fi-admin/platform/deployments`            | KEEP     | Platform deployment inventory                             |
| `/fi-admin/platform/onboarding/[sessionId]` | KEEP     | Platform deployment orchestration                         |
| tenant Configuration deployment panels      | LINK     | Keep until real tenant Deployment route/gate exists       |

### Front Desk

| Current location              | Decision | Notes                                            |
| ----------------------------- | -------- | ------------------------------------------------ |
| `/front-desk`                 | KEEP     | Canonical                                        |
| `/operations`                 | REDIRECT | Existing preserving helper                       |
| `/reception`                  | REDIRECT | Existing preserving helper                       |
| `/reception-board`            | REDIRECT | Existing preserving helper                       |
| `/front-desk/clinic-flow`     | REDIRECT | Existing preserving helper                       |
| `/front-desk/reception-board` | REDIRECT | Existing preserving helper                       |
| `/tomorrow`                   | REDIRECT | Existing redirect to `/front-desk/tomorrow`      |
| `/reception-os`               | HOLD     | Live workspace, parity/gates/references unproven |

### Surgery

| Current location     | Decision | Notes                                       |
| -------------------- | -------- | ------------------------------------------- |
| `/surgery`           | KEEP     | Canonical overview                          |
| `/cases`             | REDIRECT | Existing redirect preserving query/page     |
| `/cases/[caseId]`    | KEEP     | Entity deep link                            |
| `/procedure-day`     | HOLD     | Feature/action parity required              |
| `/surgery-readiness` | LINK     | Specialised board                           |
| `/surgery-os`        | HOLD     | Conditional availability/Calendar behaviour |

### Pipeline, Reports and Money

| Current location           | Decision | Notes                                         |
| -------------------------- | -------- | --------------------------------------------- |
| `/crm`                     | KEEP     | Canonical Pipeline                            |
| `/leadflow`                | REDIRECT | Existing redirect                             |
| `/consultation-conversion` | REDIRECT | Existing redirect                             |
| `/reports/analytics`       | KEEP     | Canonical Reports tab                         |
| `/analytics`               | REDIRECT | Same component/loaders/gate; preserve filters |
| `/reports/quality`         | KEEP     | Canonical Reports tab                         |
| exact `/audit`             | REDIRECT | Same component; do not catch entity route     |
| `/audit/[reportId]`        | KEEP     | Entity deep link                              |
| `/financial-os`            | KEEP     | Canonical Money                               |
| `/financial/*`             | LINK     | Detailed workflows, not blanket duplicates    |

## Navigation-system ownership

| System                                          | Repository status                                                                      | Ownership decision          | Part 2C prerequisite                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| `FiOsAppShell`                                  | Mounted by tenant layout for normal tenant routes                                      | Canonical                   | None                                                      |
| FI OS minimal rail + More                       | Mounted by `FiOsAppShell` behind collapse rollout                                      | Canonical target            | Preserve full-sidebar fallback until rollout is universal |
| Full FI OS sidebar                              | Mounted fallback/expanded navigation                                                   | Transitional companion      | Feature/RBAC parity before simplifying                    |
| `FiOsClinicSettingsNav`                         | Mounted by `FiOsAppShell`                                                              | Transitional; consolidate   | Every allowed role can reach Settings destinations        |
| `ClinicOsShell` / `CLINIC_OS_SHELL_NAV_MODULES` | No JSX production mount found; config still imported for active-id compatibility/tests | HOLD then retire            | Replace compatibility imports and migrate tests           |
| `FiAdminTenantNav`                              | No JSX production mount found; referenced by tests/source audit                        | HOLD then retire            | Repeat mount search, migrate tests, production build      |
| `WorkspaceShellMount`                           | Tenant-layout context provider behind rollout; does not render competing nav           | Keep, not a nav authority   | Out of scope                                              |
| Platform/System shells                          | Mounted for platform administration                                                    | Canonical in platform scope | Never merge into tenant Settings                          |

`FiOsAppShell` is the sole approved tenant-level navigation authority. “Unmounted” does not by
itself authorise deletion: source imports, tests, active-route compatibility and production build
must be resolved in Part 2C.

## Repository evidence

Key evidence:

- `app/(fi-admin)/fi-admin/[tenantId]/layout.tsx` mounts `FiOsAppShell`, resolves role/profile,
  feature access, adaptive staff entitlement overrides, Team tab access and shell rollouts.
- `src/lib/fiOs/navigation/fiOsNavigationRegroupingCore.ts` defines the six-slot rail, workflow
  groups and role-specific More ordering.
- `src/lib/fiAdmin/fiOsMinimalNav.ts` materialises the six universal slots.
- `src/lib/fiAdmin/fiOsShellPrimaryNav.ts` supplies permission-aware tenant destinations.
- `src/components/fi-os/FiOsClinicSettingsNav.tsx` still contains Staff, Admin Users, Staff
  entitlements and provider links.
- `src/lib/fiOs/team/teamWorkspaceCore.ts` defines Team tabs and the dead `academy` legacy target.
- `/team/staff` and `/staff` both render `StaffDirectoryClient` with
  `loadStaffDirectoryPage` and `assertStaffModuleAccess(..., "workforce_os", "read")`.
- `/team/identity` and `/workforce-os/staff-access` both render
  `StaffAccessCentreClient`, but their gates differ.
- `/analytics` and `/reports/analytics` use the same dashboard, loaders and module gate.
- `/audit` and `/reports/quality` both render `AuditOsDashboard`; `/audit/[reportId]` is a distinct
  entity route.
- Front Desk redirect routes use a shared preserving redirect helper.
- HubSpot import aliases construct the canonical query-tabbed provider URL and forward `batch_id`.
- `lib/actions/fi-tenant-admin-actions.ts` creates/reuses `fi_users`, manages
  `fi_tenant_admin_users`, and does not enforce `fi_staff` overlap classification.

## Known exceptions, risks and blockers

### Blocking Part 2C redirects

1. **Person access gate drift:** Team Access and legacy Staff Access Centre cannot be redirected
   until access equivalence is explicit.
2. **Admin identity overlap:** employee/non-staff classification is not enforced.
3. **Live legacy workspaces:** reception, workforce/HR and surgery parity is incomplete.
4. **Tenant Deployment destination:** role and lifecycle-aware tenant route is not implemented.

### Non-blocking ownership exceptions

- Leave is Team-owned without a dedicated route.
- Security policy is Settings-owned without a complete standalone policy workspace.
- Locations is Settings-owned, but the actual subsection coverage requires validation.
- Existing Team-owned entity/admin tools retain non-Team-prefixed routes to avoid churn.
- Pipeline redirect aliases do not currently prove arbitrary query forwarding.

## Part 2C implementation sequence

1. **Add contract checks to CI.** Keep the evidence test and route-existence checks green.
2. **Navigation-only cleanup with no route removal.**
   - remove Staff from `FiOsClinicSettingsNav`
   - rename Settings “Staff entitlements” to “Roles & permissions”
   - remove Academy from approved active navigation after a reference scan
3. **Retain universal rail.** Do not add Pipeline globally. Use existing profile-based More order
   and permission filtering.
4. **Implement proven redirects only.**
   - `/staff` → `/team/staff`, forwarding filters
   - `/analytics` → `/reports/analytics`, forwarding filters
   - exact `/audit` → `/reports/quality`, excluding `/audit/[reportId]`
   - retain existing Front Desk, Pipeline, reminder and HubSpot aliases
5. **Run permission/deep-link parity work before gated redirects.**
   - Team Access vs workforce Staff Access
   - workforce roster/onboarding/compliance
   - `reception-os`
   - procedure-day/surgery-os
6. **Expose specialised routes by links.** Keep entity and specialist tools under their canonical
   workspace owner without duplicating them.
7. **Retire unmounted nav code only after dependency proof.** Replace
   `clinicOsShellConfig` active-id compatibility and migrate tests before deletion.
8. **Do not activate tenant Deployment yet.** The unified Deployment/Integration rebuild defines a
   real tenant route, role/lifecycle gate and post-go-live history behaviour.
9. **Validate every role.** Reception, Nurse, Consultant, Doctor, Manager, Clinic owner, Finance and
   Platform admin must locate each permitted function once.

## Rollback principles

- One focused commit per navigation family or redirect cluster.
- Never combine route deletion with the first redirect.
- Keep legacy implementations for at least one validated release when permission or mutation
  parity is material.
- Redirects must preserve tenant, entity, query and return context.
- Retain server-side route/mutation gates; navigation changes never substitute for authorisation.
- A failed redirect rolls back to the live legacy page, not to a disabled placeholder.
- A failed nav cleanup restores only the nav entry; canonical ownership remains unchanged.
- Deployment summaries can roll back to Configuration panels because no editor is moved in 2B.
- No database or provider rollback is needed for this documentation-only milestone.

## Approval gate

The ownership contract is approved and frozen for implementation planning:

- every audited capability has exactly one canonical owner
- Team versus Settings is frozen
- Deployment versus Integrations is frozen
- the universal rail is frozen at six slots
- Pipeline remains role-promoted through More
- Academy is not active
- `FiOsAppShell` is the canonical tenant navigation authority

The milestone verdict remains **AMBER**, not GREEN. Part 2C may proceed only with the safe sequence
above. HOLD routes require explicit parity evidence before redirect or retirement. The unified
Deployment and Integration rebuild must follow, not precede, these ownership and route-safety
constraints.
