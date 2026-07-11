# FI-UX-REBUILD-1 — S3 Front Desk v2: Read-Only Audit & Implementation Plan

**Date:** 2026-07-11
**Status:** Ticket-ready plan (read-only audit; no code changed)
**Depends on:** S1 structural audit (`fi-ux-rebuild-1-stage1-structural-audit.md`), S2 staff language pass (in progress — Cursor; see `src/lib/fiOs/ux/fiOsStaffTerminology.ts`)
**Objective:** Reduce Front Desk from four competing tabs + five legacy products into **two human views: Today and Tomorrow**, on top of one canonical operational feed.

---

## 1. Current route map

All routes are tenant-scoped under `/fi-admin/[tenantId]`. "Portal gate" = `assertFiTenantPortalAccessUnlessStaffPinSession` (Supabase session **or** staff-PIN clinic session); "portal gate (no PIN)" = `assertFiTenantPortalAccess`.

### 1.1 Front Desk hub (consolidated, D6G-C)

Hub layout: `app/(fi-admin)/fi-admin/[tenantId]/front-desk/layout.tsx` → renders `FrontDeskSubNav` (4 pill tabs from `FI_OS_FRONT_DESK_TABS` in `src/lib/fiOs/frontDesk/frontDeskWorkspaceCore.ts`).

| Visible name | Route | Primary component | Loader / data source | Role access | Current purpose |
|---|---|---|---|---|---|
| Reception operations (hub default) | `/front-desk` | `ReceptionOsDashboard` | `loadReceptionOsCommandCentrePayload` (ReceptionOS board + tasks + daily brief + conversion + revenue intelligence + closeout + pilot metrics + demo mode); polls `/api/tenants/[tid]/reception-os` every 30s | Portal gate + `resolveReceptionOsViewerContext.canAccessReceptionOs` (else redirect to `/calendar`); widgets filtered per persona (receptionist / consultant / clinic_manager / admin) | ReceptionOS "command centre": today's patients, comms timeline, deposits, alerts, tasks, pilot KPIs |
| Clinic flow | `/front-desk/clinic-flow` | `ClinicOsOperationsCentre` | `loadTenantOperationalDashboard` (no reception cards); flags: `getCrmShellNavAllowed`, `canViewDashboardSystemDiagnostics`, `readFiProcedureDayEnabled` | Portal gate | Manager-flavoured ops dashboard: agenda buckets (consult/surgery/follow-up/other), CRM snapshot, action centre counts, diagnostics |
| Reception board | `/front-desk/reception-board` | `ReceptionBoardDashboard` (wraps `ReceptionPatientFlowBoard`) | `loadTenantOperationalDashboard({ includeReceptionBoard: true })` + `getClinicFloorSessionIfAllowed` → mutation mode `full` / `pin_reception` / `none`; SSR-only (no client poll) | Portal gate; mutations need clinic-floor session (Supabase bookings-operator or staff PIN) | Day board: lanes expected → arrived → in consultation → in treatment → complete / no-show / cancelled; check-in and flow actions |
| Tomorrow board | `/front-desk/tomorrow` | `TomorrowBoard` | `loadTomorrowBoardPayload` (bookings + surgery readiness + payments + reminders + staffing + contact flags); SSR-only | Portal gate | Next-day prep: schedule, unconfirmed, checklist flags, action items (call unconfirmed, chase pathology/deposit, link case, review bloods) |

### 1.2 Legacy parallel routes (live, hidden from staff More; catalogued in `FI_OS_FRONT_DESK_LEGACY_ROUTES`)

| Visible name | Route | Primary component | Loader / data source | Role access | Current purpose |
|---|---|---|---|---|---|
| Reception Board (legacy) | `/reception` | `ReceptionBoardDashboard` | Identical to `/front-desk/reception-board` | Portal gate | Duplicate of the reception-board tab |
| Reception Board command centre | `/reception-board` | `ReceptionBoardCommandCenter` | `loadReceptionBoardCommandCenterPayload` — **shell tier** SSR (~today's schedule + queue), then client hydrates **full tier** via `/api/tenants/[tid]/reception-board` and polls every 30s (`useReceptionBoardRefresh`). Full tier composes: operational dashboard (+reception cards) + surgery readiness board + ReceptionOS board + patient-journey snapshots + case ids | Portal gate; mutations via clinic-floor session; nav flags `getCrmShellNavAllowed`, `getBookingsBoardNavAllowed` | The richest surface: appointments with payment status, queue board, 40-cap alert stack, tomorrow surgeries, intelligence metrics, live activity feed, quick actions |
| Front desk (ReceptionOS legacy) | `/reception-os` | `ReceptionOsDashboard` | Identical to `/front-desk` hub default (incl. `?demo=1` demo mode) | Portal gate + ReceptionOS viewer gate | Duplicate of hub default |
| Clinic flow (legacy) | `/operations` | `ClinicOsOperationsCentre` | Identical to `/front-desk/clinic-flow` | **Portal gate (no PIN)** — stricter than the hub tab | Duplicate of clinic-flow tab |
| Tomorrow board (legacy) | `/tomorrow` | `TomorrowBoard` | Identical to `/front-desk/tomorrow` | **Portal gate (no PIN)** | Duplicate of tomorrow tab |

### 1.3 Adjacent surfaces that overlap Front Desk jobs

| Visible name | Route | Primary component | Loader / data source | Role access | Overlap |
|---|---|---|---|---|---|
| Today | `/` | `FiOsTodaySurface` / `FiTenantOperationalHome` | Today feed + `loadTenantOperationalDashboard` (no reception cards); rollout-gated (`todaySurfaceRollout`) | Portal gate | Arrivals/attention signals duplicate day-of awareness |
| Payments inbox | `/payments` | Payments inbox page | `loadPaymentsInboxSnapshot`; flag `FI_PAYMENTS_ENABLED` (`readFiPaymentsEnabled`) | Portal gate (no PIN) | "Take payment" job |
| Financial dashboard | `/financial/dashboard` | FinancialOS | FinancialOS loaders | Finance/manager | Target of reception "Collect payment" quick action |
| Surgery readiness | `/surgery-readiness` | Readiness board | `loadSurgeryReadinessBoardPayload` | Surgery/coord | Feeds reception alerts + tomorrow readiness |
| Surgery day (procedure day) | `/procedure-day` | Procedure day board | flag `readFiProcedureDayEnabled` | Day team | Quick action appended to reception boards when enabled |
| Staff PIN kiosk | `/staff-pin-login`, `/staff-time-clock` | Kiosk | Staff-PIN session (`staffPinSession.server`) | PIN | Grants the `pin_reception` mutation mode used by boards |

### 1.4 Navigation, flags, and tests involved

- **Nav catalog:** `src/lib/fiAdmin/fiOsShellPrimaryNav.ts` — `front-desk` item (label "Front desk", 4 tab sub-items + 5 legacy "(direct)" sub-items); active-id mapping for `/operations`, `/reception-os`, `/reception`, `/reception-board`, `/tomorrow`.
- **More drawer:** `src/lib/fiOs/navigation/fiOsNavigationRegroupingCore.ts` — `FRONT_DESK` group (member order `["front-desk"]`); `FI_OS_LEGACY_MORE_SUB_ITEM_IDS` hides legacy sub-items from staff.
- **Rail:** `src/lib/fiAdmin/fiOsMinimalNav.ts` — six slots (today · calendar · patients · team · reports · more); Front desk lives in More.
- **Core:** `src/lib/fiOs/frontDesk/frontDeskWorkspaceCore.ts` (tabs, legacy route list, href/active helpers, sidebar sub-items).
- **Feature flags / env:** `FI_PAYMENTS_ENABLED`, procedure-day flag (`procedureDayEnv.server`), ReceptionOS demo mode (`?demo=1`, role-gated), Today-surface rollout, nav-collapse rollout.
- **Permission gates:** `fiOsPortalGate.server`, `receptionOsAccess.server`, `clinicFloorAccess` (+ `staffPinPermissions`), `crmShellAccess` (`getCrmShellNavAllowed`, `getBookingsBoardNavAllowed`), `dashboardSystemDiagnosticsAccess.server`, staff capability grants (`src/lib/staffAccess/*`, D6G-G0B).
- **Mutations:** server action `receptionBoardTransitionPatient` → `receptionBoardFlowAction` (`lib/actions/reception-board-flow-action`), policy in `src/lib/fiOs/receptionBoardFlowPolicy.ts` (PIN may run every flow action except `cancel`); reception tasks API (`/api/tenants/[tid]/reception-tasks`).
- **Unit tests:** `fiOsFrontDeskConsolidation.test.ts`, `fiOsShellPrimaryNav.test.ts`, `fiOsMinimalNav.test.ts`, `fiOsNavigationRegrouping.test.ts`, `fiOsNavigationDriftAudit.test.ts`, `fiOsNavigationGoLiveAudit.test.ts`, `fiOsRolePermissionPreflightAudit.test.ts`, `receptionBoardModel.test.ts`, `receptionBoardFlowPolicy.test.ts`, `receptionBoardPresentation.test.ts`, `receptionBoardCore.test.ts`, `receptionBoard.server.test.ts`, `receptionBoardLoaderOrchestration.test.ts`, `tomorrowBoardModel.test.ts`, `operationsCentrePresentation.test.ts`, ReceptionOS suite (`receptionOs*.test.ts`), `staffUatScreenGuide.test.ts`, `staffUxPresentation.test.ts`, S2's `fiOsStaffTerminologyAudit.test.ts`.
- **E2E:** `e2e/fi-ux-nav-collapse.spec.ts`, `fi-ux-tablet-layout.spec.ts`, `fi-operational-day.spec.ts`, `fi-ux-audit-labels.spec.ts`, `fi-ux-today-surface.spec.ts`.

---

## 2. Duplicate-function map

| Task | Current doors | Single future home |
|---|---|---|
| See today's appointments | ① `/front-desk` (ReceptionOS `todays_patients` widget) ② `/front-desk/clinic-flow` agenda buckets ③ `/front-desk/reception-board` lanes ④ `/reception` ⑤ `/reception-board` appointments list ⑥ Calendar ⑦ Today surface signals | **Front desk → Today** (lanes + chronological list). Calendar stays the *scheduling* home; Today surface keeps cross-role signals only, not a schedule. |
| Check a patient in | ① `/front-desk/reception-board` flow actions ② `/reception` ③ `/reception-board` queue ④ (PIN sessions on any of these) | **Front desk → Today** check-in action on the patient card (existing `mark_arrived` flow action). |
| View arrivals & waiting patients | Same three boards, each with a different presentation (lanes vs queue vs widget) | **Front desk → Today** lanes (Arriving soon · Arrived/Waiting · In consultation · In treatment). |
| Detect delays / running late | **No explicit model anywhere.** Approximated visually (expected lane + past start time); `/reception-board` has calendar-conflict alerts only | **Front desk → Today** "Running late" chip from one new pure helper (see §5.3). |
| Find a patient | ① `/patients` list ② board card deep links ③ shell search | **Patients list stays the search home**; Today gets a quick-search input that routes into `/patients?q=…` — no new search product. |
| Take payment | ① Quick action "Collect payment" → `/financial/dashboard` ② `/payments` inbox ③ FinancialOS AR tree | **Today → "Take payment" action** deep-linking to the Payments inbox (`/payments`). Full Money consolidation is S5 — S3 only guarantees exactly one door *from* Front Desk. |
| See missing preparation (day-of) | ① `/reception-board` 40-cap alert stack (OS alerts + surgery + journey blockers + conflicts) ② ReceptionOS `action_alerts` widget ③ clinic-flow action centre counts | **Front desk → Today** "Needs attention" panel (one deduped alert stack). |
| Review tomorrow's appointments | ① `/front-desk/tomorrow` ② `/tomorrow` ③ `/reception-board` tomorrow-surgeries panel ④ Calendar day view | **Front desk → Tomorrow.** |
| Confirm tomorrow's patients | ① Tomorrow board `call_unconfirmed` actions ② reminder jobs list on clinic-flow ③ ReceptionOS comms composer | **Front desk → Tomorrow** contact actions (reuse ReceptionOS communication composer where already wired). |

**Verdict:** every reception job currently has 2–4 doors; the merged product needs exactly one per job, and both remaining views live under `/front-desk`.

---

## 3. Proposed Front Desk v2 information architecture

One hub, two views, **routes beneath one hub** (not client-side tabs):

```
/front-desk              → TODAY      (default)
/front-desk/tomorrow     → TOMORROW
```

**Recommendation: keep them as sub-routes rendered as a two-pill segmented sub-nav** (the existing `FrontDeskSubNav` pattern). Reasons: URL-addressable state (bookmarks, tablet home screens), server-rendered payloads per view, reload persistence for free, and the legacy-redirect story maps 1:1 onto real routes. No additional peer tabs.

### Today (`/front-desk`)

| Zone | Content | Source (reused) |
|---|---|---|
| Flow lanes | Arriving soon → Arrived → Waiting → In consultation / In treatment → Complete (+ collapsed No-show/Cancelled) | `receptionBoardColumnForBooking` lanes; "Arriving soon" = `expected` with start within N minutes; "Waiting" = `arrived` with no phase |
| Running late | Chip/lane filter over `expected` cards past `startAt` + grace | **New pure helper** (§5.3) |
| Payment required | Cards flagged due/overdue | `outstandingDeposits` from ReceptionOS board payload (already merged into command-center payload) |
| Immediate blockers | "Needs attention" stack (deduped, capped) | `actionAlerts` composition in `receptionBoard.server.ts` |
| Quick patient search | Input → `/patients?q=` | Existing patients list search |
| Actions | Check in · Start consult/treatment · Complete · No-show (+ Cancel for full sessions); Take payment → `/payments`; New booking → `/calendar` | `receptionBoardTransitionPatient` + `receptionBoardFlowPolicy`; existing quick actions |

### Tomorrow (`/front-desk/tomorrow`)

| Zone | Content | Source (reused) |
|---|---|---|
| Tomorrow's schedule | All agenda bookings, grouped by type | `loadTomorrowBoardPayload` |
| Unconfirmed | `call_unconfirmed` action items | `deriveTomorrowActionItems` |
| Missing forms / preparation | Checklist flags (`confirmation_incomplete`, `missing_contact`, `consent_pending`, …) | `buildTomorrowFrontDeskChecklist` |
| Payment / deposit issues | `chase_deposit`, `manual_payment_pending` | Tomorrow model + payment records |
| Clinical readiness relevant to reception | `chase_pathology`, `review_abnormal_bloods`, `link_case` | `buildTomorrowSurgeryReadinessRows` |
| Contact-patient actions | Call/email prompts using person contact flags | Tomorrow loader `loadPersonContactFlags` (+ ReceptionOS comms composer if in reach) |

Manager/analytics content currently inside these tabs (ReceptionOS pilot metrics, owner value, conversion/revenue intelligence, ops KPIs, diagnostics) moves **out of staff Front Desk** — to Reports or platform-admin surfaces — instead of becoming a third tab.

---

## 4. Keep / merge / redirect / retire table

| Surface | Classification | Notes |
|---|---|---|
| `/front-desk` hub route + `FrontDeskSubNav` | **Keep as primary** | Becomes Today by default; sub-nav shrinks to 2 pills |
| `/front-desk/tomorrow` (Tomorrow board) | **Keep as primary** (Tomorrow) | Content already matches target |
| `/front-desk/reception-board` content (lanes + flow actions) | **Merge into Today** | Lane model + mutation modes are the core of Today; route later redirects to `/front-desk` |
| `/front-desk/clinic-flow` (ClinicOsOperationsCentre) | **Merge into Today** (staff parts) + **Retire from staff navigation** (manager KPIs → Reports) | Agenda counts fold into Today header; CRM snapshot/diagnostics are not reception jobs |
| ReceptionOsDashboard on `/front-desk` (command-centre presentation) | **Merge into Today** (todays_patients, action_alerts, outstanding_deposits, tasks) | Pilot metrics / owner value / system status / demo mode → **Platform-admin only** |
| `/reception-board` (ReceptionBoardCommandCenter) | **Merge into Today** — this payload/loader is the canonical Today feed | UI shell is replaced by Today; loader survives |
| `/reception` | **Redirect legacy route** → `/front-desk` | |
| `/reception-os` | **Redirect legacy route** → `/front-desk` | Preserve `?demo=1` handling for admins or drop demo to platform admin |
| `/operations` | **Redirect legacy route** → `/front-desk` | Note: today it uses the stricter no-PIN gate; redirect target allows PIN — acceptable (PIN users already see identical content via hub tab) but call out in review |
| `/tomorrow` | **Redirect legacy route** → `/front-desk/tomorrow` | |
| ReceptionOS pilot metrics / pilot review / owner value / module health / demo mode | **Platform-admin only** | Loader modules stay; staff payload should stop paying for them |
| Ops diagnostics (`OperationsSystemDiagnostics`, `ReceptionSystemDiagnostics`) | **Platform-admin only** (existing `canViewDashboardSystemDiagnostics` gate) | |
| Reception tasks (`fi_reception_tasks`, task inbox) | **Merge into Today** (small "Desk tasks" panel) or defer | Keep API; do not build a new tasks product |
| `/payments`, `/financial/*` | **Keep (out of scope)** — Today links once | S5 Money milestone |
| `/surgery-readiness`, `/procedure-day` | **Keep (out of scope)** — feeds Tomorrow/Today alerts | S6 |
| Staff PIN kiosk routes | **Keep as primary** (separate kiosk) | Mutation-mode source for Today |
| Nav sub-items: 4 tab entries + 5 "(direct)" legacy entries | **Retire from staff navigation** (replace with 2 entries) | Catalog may keep legacy ids for admin visibility until S11 |

No data or backend capability is deleted anywhere in this plan.

---

## 5. Data-loader reuse plan

### 5.1 Canonical Today feed

**Reuse `loadReceptionBoardCommandCenterPayload` (`src/lib/receptionBoard/receptionBoard.server.ts`) as the single Today feed.** It is already the composition point:

- `shell` tier → fast first paint (`loadReceptionShellBootstrapCached` + shell-enriched `loadReceptionBoardCards`), then
- `full` tier → `loadTenantOperationalDashboard({ includeReceptionBoard: true })` + `loadSurgeryReadinessBoardPayload` + `loadReceptionOsBoardPayload` (injected, no re-query) + patient-journey snapshots + case ids,
- served by the existing `/api/tenants/[tid]/reception-board` JSON API with 30s polling (`useReceptionBoardRefresh`), perf spans, and zod payload schema.

Today's UI should consume this payload only. Tomorrow keeps `loadTomorrowBoardPayload` (SSR, no polling) unchanged.

### 5.2 Duplicate derivation to eliminate

| Problem | Evidence | Resolution |
|---|---|---|
| `loadTenantOperationalDashboard` executed independently per tab | clinic-flow page, reception-board page, `/reception`, and inside the command-center full tier all call it | Only the canonical feed calls it (full tier); redirected pages stop loading anything |
| Two parallel "today's patients" models | ReceptionOS board payload (`todays_patients` widget rows) vs `receptionBoard.cards` | Cards are canonical; ReceptionOS board keeps feeding deposits/comms/alerts *into* the command-center payload (already injected) |
| Payment status derived three ways | `paymentCommercialKpis` (operational dashboard), `outstandingDeposits` (ReceptionOS board), `revenueCollections` (invoices) | Today shows card-level `paymentStatus` from `outstandingDeposits` mapping (already in `buildAppointmentCard`); KPI counters drop from staff view |
| Two 30s polling loops + two JSON APIs | `useReceptionOsRefresh` → `/api/…/reception-os`; `useReceptionBoardRefresh` → `/api/…/reception-board` | Staff surface polls **only** `/api/…/reception-board`. `/api/…/reception-os` remains for platform-admin/pilot tooling |
| ReceptionOS phase 3–8 modules loaded for every staff view | closeout, pilot metrics, pilot review, owner value, demo sanitisation in `receptionOsCommandCentreLoader` | Staff Today never invokes the command-centre loader; those modules load only on the admin surface |

### 5.3 Conflicting status models

- **Arrived** is consistent: `fi_bookings.booking_status === "arrived"`. Keep.
- **Waiting** exists only implicitly (`arrived` with no `fi_reception_flow_phase` metadata). Make it an explicit derived label on the `arrived` column — no schema change.
- **Delayed / running late has no definition anywhere.** Add one pure helper in `src/lib/fiOs/receptionBoardModel.ts` (e.g. `isBookingRunningLate(card, nowIso, graceMinutes)`) applied to `expected` cards past `startAt` + grace, and reuse it for both the lane filter and any counter. This must land **before** UI merge so every surface that mentions lateness shares one definition.
- **Agenda buckets** (`consult/surgery/follow_up/other`, statuses scheduled/confirmed/arrived) are a *categorisation* model, not a flow model — they stay for Today-surface/Reports but must not appear as a second patient list inside Front Desk.
- Flow transitions remain exclusively `receptionBoardFlowAction` (status + `fi_reception_flow_phase` metadata + PIN audit). No new mutation path.

### 5.4 Performance risks

- Full-tier command-center load fans out into the heaviest loaders in the codebase (operational dashboard alone runs ~14 parallel loads incl. CRM, reminders, financial attention counts). Mitigated today by shell-tier SSR; keep that pattern. Follow-up (not S3-blocking): a `scope: "frontDesk"` option on `loadTenantOperationalDashboard` to skip CRM/stale-lead/reminder work Today doesn't render.
- 30s polling of the full tier × N reception tablets is the standing load; unchanged from current `/reception-board` behaviour, but S3 makes it the *only* poller (net reduction — ReceptionOS polling stops for staff).
- Tomorrow loader caps at 480 bookings and is SSR-only — fine.

### 5.5 Source-of-truth call-outs

- Board membership: booking `start_at` within `computeOperationalLocalDayUtcWindow` (tenant IANA day). Both feeds already share it via `bookingStartFallsOnOperationalWindow`. Keep.
- Tomorrow window: `computeTomorrowOperationalWindow` — already shared between Tomorrow board and command-center tomorrow-surgeries panel.
- De-dup guarantee: one card per `fi_bookings.id` — the canonical feed builds cards once, so merged Today cannot show duplicates *if* the UI never concatenates `appointments` + `queue` + ReceptionOS widget rows as separate patient lists (they are views over the same `receptionCards`).

---

## 6. Permission and capability review

Expected access in Front Desk v2 (no role definitions change):

| Role (workspace profile) | Today | Tomorrow | Flow mutations (check-in etc.) | Take payment | Notes |
|---|---|---|---|---|---|
| Receptionist (`reception`) | Full | Full | Yes via clinic-floor session; **PIN session: all flow actions except Cancel** (`staffPinMayRunReceptionFlowAction`) | Link to `/payments` when `FI_PAYMENTS_ENABLED`; recording payments follows existing payments gates | Default landing tab = Today |
| Clinic manager (`clinic_manager`) | Full | Full | Yes | Yes | Also sees Reports for KPIs that leave Front Desk |
| Nurse (`nurse`) | View (lanes, blockers) | View | Start consult/treatment, complete — same clinic-floor session rules; no special reception widgets | No | Nurses primarily live in Surgery/Today |
| Surgeon (`surgeon`) | View if opened (not in their nav) | View | No (read-only unless clinic-floor session) | No | Surgery hub is their home |
| Consultant (`consultant`) | View — persona keeps consultation-pipeline context out of Front Desk (moves to Pipeline/Reports) | View | No | No | ReceptionOS `consultant` persona widgets retire from staff Front Desk |
| Finance | View payment-required panel | View deposit issues | No | Yes (Payments/Money surfaces) | Finance home remains Money (S5) |
| Platform admin | Full + diagnostics + pilot metrics/demo mode (admin-only panels or `/reception-os` admin surface) | Full | Yes | Yes | Only role that still sees ReceptionOS phase 3–8 modules |

**Capability overrides are preserved and untouched.** The D6G-G0B mechanism (`fi_staff_access_grants` tab rows → `staffCapabilityRegistry` / `staffEffectivePermissionsCore`) is orthogonal to Front Desk: a receptionist with `roster.manage` keeps Team → Roster without any role inflation, and S3 must not gate Front Desk views on capability grants (portal gate + clinic-floor session remain the model). The existing `resolveReceptionOsViewerContext` role-mapping survives only to gate the admin-only panels; staff access to Today must not become *narrower* than the current portal gate (today, any active staff/tenant-admin passes `canAccessReceptionOs`; keep that behaviour for Today or drop the extra gate entirely and rely on the portal gate, which is the simpler recommendation).

**Gate inconsistency to fix in passing:** legacy `/operations` and `/tomorrow` use the no-PIN portal gate while their hub twins allow PIN sessions. Redirecting them to the hub resolves the inconsistency in the permissive direction — flag it in the PR description so reviewers confirm intent.

---

## 7. Legacy-route strategy (recommendation only — not implemented here)

Current policy (`FI_OS_FRONT_DESK_LEGACY_ROUTES`: "must remain live, not redirected") was correct for dual-run; S3 is the stage where redirects land.

| Legacy URL | Target | Mechanism |
|---|---|---|
| `/reception` | `/front-desk` | Server `redirect()` in the page (permanent redirect once stable) |
| `/reception-board` | `/front-desk` | Same |
| `/reception-os` | `/front-desk` (admins with `?demo=1` → keep demo on an admin surface) | Same |
| `/operations` | `/front-desk` | Same |
| `/tomorrow` | `/front-desk/tomorrow` | Same |
| `/front-desk/clinic-flow` | `/front-desk` | Same (second commit stage — see §9 boundaries) |
| `/front-desk/reception-board` | `/front-desk` | Same |

Rules:

1. **Two-step cutover:** ship Today first with legacy pages still rendering (dual-run release), then flip legacy pages to redirects in a separate commit. Never strand bookmarks mid-release.
2. Redirects are **server-side page-level `redirect()`** (not middleware, not route renames) — keeps the change local, testable, and reversible.
3. Nav active-id mappings in `fiOsShellPrimaryNav` stay so any residual deep link highlights Front desk correctly.
4. Keep the legacy entries in the nav *catalog* (admin visibility) until S11 redirect-freeze; staff More already hides them.
5. Monitor: redirects should log/count (existing perf-span or telemetry pattern) so S11 can retire routes with evidence.

---

## 8. Acceptance tests (ticket-ready)

1. **Two views only** — Given a signed-in receptionist, when they open Front desk from the More drawer, then the sub-nav shows exactly two options, "Today" and "Tomorrow", and no staff-visible link to Reception operations, Clinic flow, Reception board, or any *OS / command-centre surface exists anywhere in staff navigation.
2. **Check in** — Given a booking with status `scheduled` starting today, when the receptionist selects "Check in patient" on its card in Today, then the booking becomes `arrived`, the card moves to the Arrived/Waiting lane without a page reload, and the change is visible to another session within one poll interval (≤30s).
3. **Find a patient** — Given the receptionist is on Today, when they type a name in the quick search and submit, then they land on the Patients list filtered to that query in one step.
4. **Take a simple payment** — Given `FI_PAYMENTS_ENABLED` is on, when the receptionist uses "Take payment" from Today (globally or from a card flagged payment-due), then they arrive at the Payments inbox scoped to act, and no second payment door exists inside Front Desk.
5. **Waiting and running late** — Given one patient checked in 20 minutes ago with no consultation started, and one patient 15 minutes past their expected start and not arrived, when the receptionist views Today, then the first appears as Waiting and the second is flagged Running late, using the shared derivation (same result after reload).
6. **Prepare for tomorrow** — Given tomorrow has an unconfirmed surgery missing a deposit, when the receptionist opens Tomorrow, then the booking appears in the schedule, in Unconfirmed with a "Call patient" action, and in payment issues with "Chase surgery deposit"; contact details (or a missing-contact flag) are shown.
7. **Read-only staff cannot mutate** — Given a session with portal access but no clinic-floor session (`mutationMode === "none"`), when they view Today, then flow actions and payment actions are not actionable, and direct invocation of the flow server action is rejected server-side.
8. **PIN limits** — Given a staff-PIN session, when they operate Today, then check-in / start consult / start treatment / complete / no-show succeed and Cancel is unavailable and rejected server-side (`staffPinMayRunReceptionFlowAction`), with PIN audit rows written.
9. **Capability overrides intact** — Given a receptionist with a `roster.manage` grant, when S3 ships, then their Team → Roster access is unchanged, their Front Desk experience is identical to a receptionist without the grant, and the D6G-G0 preflight matrix still passes.
10. **Legacy URLs resolve** — Given saved bookmarks to `/reception`, `/reception-board`, `/reception-os`, `/operations`, `/tomorrow`, `/front-desk/clinic-flow`, `/front-desk/reception-board`, when opened (any authorized session), then each lands on the correct Front Desk view (Today or Tomorrow) with no 404 and the Front desk nav item active.
11. **No duplicate patient cards** — Given a patient with a booking that is simultaneously arrived, payment-due, and blocker-flagged, when Today renders, then exactly one card for that booking id appears across all lanes/lists, with payment and blocker states shown on that single card.
12. **Reload preserves server state** — Given a patient checked in and a payment recorded, when the browser reloads (or a second device opens Today), then lanes and payment flags reflect server state exactly; nothing depends on client-only state.
13. **Tablet layout** — Given a 768×1024 viewport (existing `fi-ux-tablet-layout.spec.ts` harness), when Today and Tomorrow render, then lanes stack/scroll without horizontal page overflow and primary actions remain tappable.

---

## 9. File-level PR plan

One milestone, five commits, each independently green and shippable.

### Commit 1 — Canonical model groundwork (pure logic + tests, no UI change)

| Change | Files |
|---|---|
| Add running-late + waiting derivation helpers (pure) | `src/lib/fiOs/receptionBoardModel.ts` (modify), `src/lib/fiOs/receptionBoardModel.test.ts` (extend) |
| Add "Arriving soon" window helper (expected within N min) | same files |
| Add Today/Tomorrow tab model alongside existing tabs (new exported const; do **not** delete 4-tab const yet) | `src/lib/fiOs/frontDesk/frontDeskWorkspaceCore.ts` (modify), `src/lib/fiOs/frontDesk/fiOsFrontDeskConsolidation.test.ts` (extend) |

### Commit 2 — Front Desk Today view on the canonical feed (dual-run: old tabs still live)

| Change | Files |
|---|---|
| New Today component composing lanes, running-late, payment-required, blockers, quick search, actions — built from existing pieces (`ReceptionPatientFlowBoard`, alert list, quick actions, `useReceptionBoardRefresh`) | **Add** `src/components/fi-os/front-desk/FrontDeskTodayBoard.tsx` (thin composition; reuse `receptionBoardCore` builders — no new derivation in the component) |
| `/front-desk` page switches from `ReceptionOsDashboard` + command-centre loader to shell-tier `loadReceptionBoardCommandCenterPayload` + `FrontDeskTodayBoard` + `getClinicFloorSessionIfAllowed` | `app/(fi-admin)/fi-admin/[tenantId]/front-desk/page.tsx` (modify) |
| Sub-nav renders Today/Tomorrow pills (from new tab const) | `src/components/fi-os/front-desk/FrontDeskSubNav.tsx` (modify) |
| Presentation-builder tests for Today composition (incl. no-duplicate-card guarantee) | **Add** `src/components/fi-os/front-desk/frontDeskTodayPresentation.test.ts` (or extend `receptionBoardPresentation.test.ts`) |
| S2 dependency: all new strings from `FI_OS_STAFF_TERMS`; extend terminology audit expectations if needed | `src/lib/fiOs/ux/fiOsStaffTerminologyAudit.test.ts` (extend, coordinate with Cursor's S2 branch) |

### Commit 3 — Redirect the merged hub tabs + legacy routes

| Change | Files |
|---|---|
| `/front-desk/clinic-flow`, `/front-desk/reception-board` → `redirect()` to `/front-desk` | both `page.tsx` files (modify → shrink to redirect) |
| `/reception`, `/reception-board`, `/reception-os`, `/operations` → `redirect()` to `/front-desk`; `/tomorrow` → `/front-desk/tomorrow` | five legacy `page.tsx` files (modify) |
| Update legacy-route policy const (now "redirected") + consolidation tests (tabs = 2; legacy ids resolve; active-id mapping unchanged) | `frontDeskWorkspaceCore.ts`, `fiOsFrontDeskConsolidation.test.ts` |
| Nav catalog: Front desk sub-items become Today/Tomorrow (+ legacy entries retained for admin catalog); hint copy updated | `src/lib/fiAdmin/fiOsShellPrimaryNav.ts` (modify), `fiOsShellPrimaryNav.test.ts`, `fiOsNavigationRegrouping.test.ts`, drift/go-live audit tests (update fixtures) |

### Commit 4 — Admin-only relocation of non-staff content

| Change | Files |
|---|---|
| ReceptionOS command-centre surface (pilot metrics, owner value, module health, demo mode) reachable only by platform-admin (either keep `/reception-os` as admin-gated instead of redirect, or move panels under the platform intelligence area — decide in review; default: admin-gated `/reception-os`, still hidden from staff nav) | `app/…/reception-os/page.tsx` (modify gate), `receptionOsAccess.server.ts` (tighten to admin for this surface only) |
| Diagnostics panels stay behind `canViewDashboardSystemDiagnostics` inside Today (already gated) | no new files; verify in Today component |
| Preflight matrix + role audit updates | `src/lib/fiOs/navigation/fiOsRolePermissionPreflightAudit.ts` + test, `docs/workforce/fi-os-role-permission-preflight-matrix.md` |

### Commit 5 — E2E + docs

| Change | Files |
|---|---|
| E2E: Front Desk v2 journey (check-in, running late, tomorrow prep, legacy redirects, PIN limits, tablet) | **Add** `e2e/fi-ux-s3-front-desk-v2.spec.ts`; update `fi-ux-nav-collapse.spec.ts`, `fi-ux-tablet-layout.spec.ts`, `fi-operational-day.spec.ts` selectors if they touch old tabs |
| Tracker doc update | `docs/fi-ux-rebuild/` (this file → mark shipped; stage table in S1 audit untouched) |

### Migrations, flags, cleanup

- **DB migrations: none.** Everything rides on existing `fi_bookings.booking_status` + `fi_reception_flow_phase` metadata.
- **Feature flags:** no new flag needed if commits 2 and 3 ship as separate releases (dual-run happens between them). If product wants a same-release kill switch, a short-lived env flag choosing old/new `/front-desk` page body is acceptable — but prefer the two-release path; do **not** introduce a persistent flag.
- Existing flags unaffected: `FI_PAYMENTS_ENABLED`, procedure-day, today-surface rollout.
- **Deferred deletions (post-S11, not this milestone):** `ReceptionOsDashboard` staff paths, `ClinicOsOperationsCentre`, `ReceptionBoardCommandCenter` UI shell, `useReceptionOsRefresh` staff usage, `/api/…/reception-os` staff polling. Loaders and APIs stay live throughout S3.

---

## 10. Final recommendation

**Recommended S3 shape:** *Compose, don't rebuild.* Make `loadReceptionBoardCommandCenterPayload` (shell → full tier + `/api/…/reception-board` polling) the single Front Desk feed; render a new thin `FrontDeskTodayBoard` from existing lane, alert, and quick-action builders; keep the Tomorrow board exactly as-is; then convert all seven overlapping routes (two hub tabs + five legacy URLs) into server redirects onto `/front-desk` and `/front-desk/tomorrow` in a second release. Manager analytics and ReceptionOS pilot machinery leave the staff surface rather than becoming a third tab. Net result: two views, one feed, one poller, zero schema changes, and every existing mutation path (`receptionBoardFlowAction`, PIN rules, capability overrides) untouched.

**Highest-risk technical issue to resolve first:** the **absence of a shared status-derivation layer for "waiting" and "running late", combined with three parallel "today's patients" models** (reception cards vs ReceptionOS widget rows vs agenda buckets). If the Today UI is assembled before those derivations are unified in `receptionBoardModel` (Commit 1), the merged view will show conflicting or duplicated patient states — the exact failure S3 exists to eliminate — and every later commit inherits the ambiguity. Land the pure-model commit, get it reviewed against real booking data (statuses like `confirmed` vs `scheduled`, phase metadata drift), and only then build UI on top. Secondary risk worth explicit review sign-off: redirecting `/operations` and `/tomorrow` onto PIN-permitted hub routes slightly widens staff-PIN reach (view-only widening; mutation policy unchanged).
