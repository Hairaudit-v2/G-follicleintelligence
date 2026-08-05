# WorkforceOS Cohesion Audit — August 2026

**Date:** 2026-08-05
**Scope:** WorkforceOS / Team / Staff / HR OS / Roster — full-stack cohesion review
**Companions:** [workforce-uix-cohesion-audit.md](../workforce-uix-cohesion-audit.md) (July 2026, UX-only), [workforce-uix-cohesion-plan.md](../workforce-uix-cohesion-plan.md), [workforceos-v2-interface-redesign.md](./workforceos-v2-interface-redesign.md)

---

## Executive summary

The July UX audit correctly diagnosed fragmentation across `/staff`, `/workforce-os`, and `/hr-os`. Since then the **Team workspace** (`/team/*`, FI-UX-REBUILD D6G-E) was added as the consolidated surface — but consolidation stopped at the route shell. Today the system has **five parallel route surfaces, all live simultaneously**, three overlapping `src/lib` directories (267 files), server actions organized by sprint number instead of domain, and a dual staff-identity model (`fi_staff` vs `fi_staff_members`) referenced raw from 176 lib files.

The result: every workforce page is reachable two or three ways, every domain concept lives in two or three places, and adding a feature requires knowing project delivery history ("which sprint built payroll?") rather than domain structure.

---

## Findings

### F1 — Route consolidation stopped halfway (highest UX impact)

`/team/*` tabs correctly re-mount the same clients (e.g. `team/staff/page.tsx` renders `StaffDirectoryClient`; `team/page.tsx` renders `WorkforceCommandCentreClient`). But:

- All legacy routes remain live: `/staff`, `/workforce-os` (17 routes), `/hr-os` (10 routes), `/hr/*` (legacy readiness/import).
- `teamWorkspaceCore.ts` deliberately keeps legacy routes in the sidebar as **"(direct)" duplicate links** (`FI_OS_TEAM_LEGACY_ROUTES` + `FI_OS_TEAM_ADMIN_LEGACY_ROUTES`) — the exact "competing entry points" problem the July audit rated Critical, now institutionalized in nav config.
- The roster alone is reachable at **three routes**: `/hr-os/roster`, `/workforce-os/roster`, `/team/roster`.
- Nav resolution in `fiOsShellPrimaryNav.ts` carries ~40 lines of special-case mapping to make five surfaces highlight one sidebar item.

### F2 — Three overlapping lib directories

| Directory | Files | Claims to own |
|-----------|-------|---------------|
| `src/lib/workforce-os` | 100 | Identity, readiness, roster generation/adjustments, mutation errors |
| `src/lib/workforce` | 127 | Command centre, cadence, variance, profile hub, compliance cron, HR gates |
| `src/lib/staff` | 40 | Directory loader, filters, **a second `workforceCommandCentre`** |

Concrete collisions:

- `workforceCommandCentre` exists in **both** `src/lib/staff/` (legacy, feeds orphaned view) and `src/lib/workforce/` (live V2).
- Roster logic is split across `workforce-os/` (rosterGeneration, rosterManualAdjustments, rosterTx, rosterEligibleStaff) and `workforce/` (rosterCadence, rosterActualVariance, rosterOperationalEditing) with no principle deciding which side a file lands on.
- Identity/readiness helpers (`workforceIdentity*`, `workforceReadiness*`) are 14+ small sibling files in `workforce-os/` with no barrel or module boundary.

### F3 — Server actions named by sprint, not domain

`src/lib/actions/` contains `workforce-phase-1c-sprint-2-actions.ts`, `-sprint-3-`, `-sprint-35-`, `workforce-phase-2-sprint-1/2/4/5-actions.ts`. Finding "the credential verification action" requires knowing it shipped in Phase 1C Sprint 3. This is organization by delivery history — the single clearest "disjointed" signal in the codebase.

### F4 — Dual staff identity leaks everywhere

`fi_staff` (scheduling/settings) vs `fi_staff_members` (lifecycle): 448 raw table references across 176 files in `src/lib` alone, spanning bookings, CRM, calendar, financial, clinic setup. `staffProfileHub.server.ts` exists and does the join for the profile page, but there is no single identity module other code is required to go through — each domain re-derives the join.

### F5 — God components

`WorkforceCommandCentreClient.tsx` (49 KB), `WorkforceOsPayrollClient.tsx` (49 KB), `StaffImportClient.tsx` (45 KB), `RosterCommandCentreView.tsx` (37 KB). Monolithic clients make the per-surface duplication sticky — sections can't be reused on the profile tabs or Team overview.

### F6 — Dead code the July plan already sentenced

`src/components/fi/staff/WorkforceCommandCentreView.tsx` (18 KB, "Add staff"/"Assign training" dead buttons) — flagged for removal in Phase 1.7 of the July plan, still present, referenced only by `workforceOsSubNav.test.ts`.

### F7 — July plan scorecard

| Phase | Status |
|-------|--------|
| 0 — Directory CTA fixes, `staffLifecycleUxCore`, `StaffStatusCard` | ✅ Done |
| 1 — Nav & labelling | ⚠️ Superseded by Team workspace, but 1.7 (orphan removal) not done; "(direct)" links reintroduce the duplication |
| 2 — Unified profile | ⚠️ Partial: `staffProfileHub.server.ts` + `StaffProfileOverviewPanel` exist; `StaffStatusCard` adopted in only one panel |
| 3 — StaffActionMenu everywhere | ⚠️ `StaffProfileActionMenu.tsx` exists, not wired to directory/access/onboarding queues |
| 4 — Command centre as lifecycle hub | ⚠️ V2 dashboard shipped; attention-queue deep links per staff not verified complete |
| 5 — Person-centric compliance/training/SOP | ❌ Not started |

---

## Recommended plan

Ordered by user-facing impact per unit of risk. Each phase is independently shippable on trunk.

### Phase A1 — Canonical navigation ✅ delivered 2026-08-05

Navigation-only pass. All legacy routes stay live but stop being advertised, and we instrument them to find real consumers before anything is redirected.

**What shipped:**

| Change | Files |
|--------|-------|
| `buildTeamSidebarSubItems` emits only `/team` tabs; `FI_OS_TEAM_HIDDEN_MORE_SUB_ITEM_IDS` deleted | `src/lib/fiOs/team/teamWorkspaceCore.ts`, `fiOsNavigationRegroupingCore.ts` |
| Legacy route catalogs retained (active-nav, deep-link smoke, telemetry, A2 redirect map) but never rendered | `teamWorkspaceCore.ts` |
| Go-live audit inverted: now asserts Team legacy links are *absent* from staff **and** admin More | `fiOsNavigationGoLiveAudit.ts` |
| Dashboard cards repointed to `/team` and `/team/staff` | `DashboardModuleNavigation.tsx`, `DashboardQuickStats.tsx`, `DashboardStaffIntelligenceSummary.tsx` |
| Legacy-use telemetry (`workforce_legacy_route_access`: surface, tenant, pathname, viewer role) | `src/lib/workforce/legacyRouteTelemetry.server.ts` + layouts for `workforce-os`, `hr-os`, `staff`, `hr` |
| **Bug fix:** token accept / PIN-setup routes were gated by the `workforce-os` layout | `workforce-os/layout.tsx` |

**Bug found during token-flow validation (pre-existing, now fixed):** `/workforce-os/staff-access/accept/[token]` and `/pin-setup/[setupToken]` are token-public and correctly exempted by the tenant layout, but the nested `workforce-os` layout still ran `assertFiTenantPortalAccessUnlessStaffPinSession`. In production a logged-out invitee was redirected to login instead of the accept page. The layout now short-circuits for `isFiAdminTokenPublicRoute` paths (and skips telemetry for them, since these routes are never redirected).

**A2 constraint proven by test:** legacy prefixes *contain* token routes (`/workforce-os` ⊃ `/workforce-os/staff-access/accept/…`), so a prefix-based redirect would capture live invite links. `fiOsTeamConsolidation.test.ts` now asserts the token-public exemption covers every such overlap.

**Verification:** 132 nav/team/staff-access unit tests pass; `tsc --noEmit` introduces no new errors (6 pre-existing failures in trichoscopy/pilot-control/calendar files are unchanged from `main`). Lint could not be run — `next lint` was removed in Next 16 and the eslintrc config fails to load; tracked separately.

1. Remove all "(direct)" links: drop `FI_OS_TEAM_LEGACY_ROUTES` / `FI_OS_TEAM_ADMIN_LEGACY_ROUTES` from sidebar output (and delete the now-pointless `FI_OS_TEAM_HIDDEN_MORE_SUB_ITEM_IDS` hiding set).
2. Advertise **only** `/team/*` in primary nav and dashboard cards; fold `/workforce-os` intelligence modules (planning, payroll, shift-cost, recruitment, procedure-staffing) into `/team` tabs or a "Planning & pay" tab group.
3. Preserve every legacy route **unchanged and reachable by URL** — hidden, not retired.
4. Verify every Team tab resolves correct active-nav state, including when arriving via a legacy URL (existing `fiOsShellPrimaryNav.ts` mapping stays for now).
5. Add structured logging (or analytics event) on legacy route page loads — route, tenant, viewer role — to identify real legacy consumers: bookmarks, emails, cross-module links, external docs.
6. Validate token, invitation, PIN, and deep-link flows end-to-end (onboarding invite accept, staff-access accept, pin-setup, identity-audit deep links).

**Acceptance:** sidebar shows one Team entry with ≤8 sub-items and zero "(direct)" duplicates; all legacy URLs still render; legacy-use telemetry visible in logs; token-flow e2e green.

### Phase A2 — Redirect and retire ✅ delivered 2026-08-05

**Caveat on sequencing:** A1 and A2 shipped in the same session, so the legacy-use telemetry had no release cycle to collect data. The redirect map was therefore derived by **verifying page equivalence in code** (comparing each legacy page's client + loader against its candidate `/team` tab) rather than from observed traffic. Telemetry remains in place and still identifies stragglers after deploy.

**Redirect map** — a route was only retired where the canonical target renders equivalent content:

| Retired | Canonical | Basis |
|---------|-----------|-------|
| `/staff` | `/team/staff` | Same `StaffDirectoryClient` + `loadStaffDirectoryPage` |
| `/workforce-os` | `/team` | Same `WorkforceCommandCentreClient` + loader |
| `/workforce-os/roster` | `/team/roster` | Same view; `/team` applies the canonical capability gate |
| `/hr-os/roster` | `/team/roster` | Previously chained via `/workforce-os/roster` |
| `/hr-os/onboarding` | `/team/onboarding` | Byte-identical page |
| `/hr-os/compliance` | `/team/compliance` | Byte-identical page |
| `/hr-os/certifications` | `/team/training` | Same `StaffCertificationClient` + loader |
| `/workforce-os/staff-access` | `/team/identity` | Same `StaffAccessCentreClient` + loader |
| `/workforce-os/staff-identity-audit` | `/team/admin/identity-audit` | Moved verbatim |
| `/workforce-os/hr-task-map` | `/team/admin/access-task-map` | Moved verbatim |
| `/hr-os/sync-health` | `/team/admin/sync-health` | Moved verbatim |

**Deliberately NOT redirected** (documented in `TEAM_PRESERVED_LEGACY_ROUTES` with reasons): the `/hr-os` index (unique identity/readiness/clinical-rostering dashboard with no `/team` equivalent), `/hr-os/credentials`, `/hr-os/offboarding`, `/hr-os/duplicates`, `/hr-os/staff-reconciliation`, the `/workforce-os` intelligence modules, and the `/staff/*` sub-routes. Retiring these needs product work, not a redirect.

**Key implementation points:**

- `src/lib/fiOs/team/teamLegacyRedirects.ts` is the single source of truth — pure, testable, with the equivalence basis recorded per entry.
- Matching is **exact on the path suffix, never prefix-based**. `/staff` retires while `/staff/link-users` keeps rendering; `/workforce-os/staff-access` retires while its `accept/[token]` and `pin-setup/[setupToken]` children do not.
- Query strings are preserved (directory filters, roster period/clinic/event deep links, task-map `staffId`/`category`/`task`).
- Internal links were **retargeted at the canonical paths** rather than left to bounce through redirects: roster href builder, standard-hours return link, lifecycle copy builders, command-centre tiles and attention-queue items, both sub-navs, and the dashboard cards.
- `revalidatePath` calls in the roster, onboarding, credentials and staff-access actions now invalidate the `/team` tabs. Previously they only invalidated retired paths, so the canonical pages could serve a stale router-cache payload after a mutation.
- Nav special-casing removed: `getFiOsShellActiveSidebarId` collapsed ~40 lines of legacy branches into "every workforce surface highlights Team", which also fixes still-live pages (`/hr-os/credentials`, `/workforce-os/payroll`) that would otherwise have highlighted nothing after A1.
- Deleted the orphaned `WorkforceCommandCentreView.tsx` (491 lines) and its test reference.

**Bug found during A2:** `staffHrTaskMapCore.ts` built the task-map href by concatenating onto the command-centre href (`${buildWorkforceCommandCentreHref(tid)}/hr-task-map`). When that builder moved to `/team`, it silently produced `/team/hr-task-map` — a 404. Now uses the dedicated `buildStaffHrTaskMapHref`.

**Verification:** 1,407 unit tests across the workforce, nav, staff and staffAccess trees; 4 failures, all confirmed pre-existing on clean `main` by stashing (3 roster permission-gating source assertions, 1 Pipeline nav test). `tsc --noEmit` adds no new errors. 8 new redirect contract tests assert the full map, query preservation, exact-match boundaries, token-route exemption, and that no target is itself retired.

---

### Phase A2 — original plan (for reference)

1. Redirect normal legacy pages to their `/team` tab: `/staff` → `/team/staff`, `/hr-os/onboarding` → `/team/onboarding`, `/hr-os/roster` + `/workforce-os/roster` → `/team/roster`, `/hr-os` + `/workforce-os` → `/team`, etc. Use A1 telemetry to sequence and to catch consumers the audit missed.
2. **Preserve callback/token routes** at their current URLs (`staff-access/accept/[token]`, `staff-access/pin-setup/[setupToken]`, `onboarding/invite/[token]`) — invites in flight must not break.
3. Preserve admin diagnostics (identity audit, sync health, task map) under a deliberate admin namespace rather than leaving them stranded on retired prefixes.
4. Remove the special-case navigation mapping in `fiOsShellPrimaryNav.ts` once redirects make it unnecessary.
5. Delete `WorkforceCommandCentreView.tsx` and its test reference.
6. Add **redirect contract tests**: every retired route asserts its redirect target (including query/param preservation where filters are carried, e.g. staff directory filters); every preserved token route asserts it still renders.

**Acceptance:** one live route per intent; contract tests enumerate the full legacy → canonical map; token flows untouched; nav special-casing gone.

### Phase B — Domain reorganization of the lib layer (1–2 sprints, mechanical)

Merge `src/lib/workforce-os`, `src/lib/workforce`, `src/lib/staff` into one tree organized by domain, not by era:

```
src/lib/team/
├── identity/      (fi_staff ↔ fi_staff_members resolution, readiness, audit)
├── directory/     (loaders, filters)
├── roster/        (generation, adjustments, cadence, variance, eligibility, tx)
├── onboarding/    (invites, checklist, staff creation)
├── access/        (login invites, PIN, suspend/revoke, entitlement gates)
├── compliance/    (credentials, certifications, audits, cron)
├── payroll/       (wage engine, shift cost, timesheets)
├── planning/      (planning engine, procedure staffing, recruitment)
└── commandCentre/ (KPI composition — delete the legacy staff/ copy)
```

Rename sprint action files by domain: `credentials-actions.ts`, `payroll-actions.ts`, `recruitment-actions.ts`, `planning-actions.ts`… Pure renames + import updates; behavior-neutral, verified by typecheck/lint/tests.

### Phase C — Single staff identity module (1 sprint)

Promote `staffProfileHub` / `workforceIdentityLinks` into `src/lib/team/identity/` as **the** API for resolving a person (one `StaffIdentity` type carrying both ids, employment, access, readiness). Add a lint rule or convention doc: no new raw `fi_staff_members` joins outside `team/identity/`. Migrate the worst offenders opportunistically as files are touched.

### Phase D — Decompose god components + adopt shared primitives (1–2 sprints)

- Split the 49 KB clients into section components (KPIs, health radar, attention queue, module tiles are already logically distinct in `WorkforceCommandCentreClient`).
- Wire `StaffStatusCard` (compact) into directory rows and command-centre attention queue; wire `StaffProfileActionMenu` into directory, access centre, and onboarding queues — completing July Phases 3–4 so every surface shows the same state with the same actions.

### Phase E — Finish the unified profile (July Phase 5)

Documents / Training / SOP tabs on the staff profile, fed by the identity module.

---

## Do-not-break register (unchanged from July)

Token accept/PIN-setup routes, invite type separation (onboarding vs login), suspend/revoke logic, RBAC `canManage` gating, `FiOsPendingActionButton` pending-state pattern, roster atomic tx (`rosterTx`).

---

## Quick wins available immediately

1. Rename the seven sprint-named action files by domain (imports only, no logic).
2. Delete the legacy `src/lib/staff/workforceCommandCentre*` pair if only the orphaned view consumes it (the view itself is deleted in A2).

(Orphan-view deletion and "(direct)"-link removal are scheduled inside A2 and A1 respectively rather than done ad-hoc, so each ships with its validation pass.)
