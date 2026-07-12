# FI-UX-REBUILD-1 — S3.4: Live Route Switch, Two-Tab Navigation, Dual-Run & Legacy Redirects

**Date:** 2026-07-11
**Status:** Ticket-ready plan (read-only audit; no code changed)
**Depends on:** S3.3 Today workflow board (landed — commit `918e4204`; `FrontDeskTodayBoard` + `frontDeskTodayUi` + `buildFrontDeskTodayPresentation`), S3.2 contract, S3.1 model, S2 language pass.
**Scope:** Route, navigation, and release-safety only. No board/Tomorrow/payment/mutation redesign.

> **Cutover thesis.** The S3.3 board is complete and self-contained: `FrontDeskTodayBoard({ initialData: ReceptionBoardCommandCenterPayload, mutationMode })` owns its own polling (`useReceptionBoardRefresh`), clock, and flow mutations (`receptionBoardTransitionPatient`). S3.4 is therefore a **wiring + navigation + redirect** stage — swap the `/front-desk` page body, shrink the tab set to two, verify against live data, then redirect legacy routes. No new product surface.

---

## 1. Current live route and navigation map

| Route | Current page component | Current loader | Portal/PIN gate | Nav visibility | Intended S3.4 outcome |
|---|---|---|---|---|---|
| `/front-desk` | `ReceptionOsDashboard` (via `FiAdminFrontDeskHubPage`) | `loadReceptionOsCommandCentrePayload` + `resolveReceptionOsViewerContext` (redirects to `/calendar` if no access) | `assertFiTenantPortalAccessUnlessStaffPinSession` | Front desk group, tab "Reception operations" (default) | **Render `FrontDeskTodayBoard` (Today)** |
| `/front-desk/clinic-flow` | `ClinicOsOperationsCentre` | `loadTenantOperationalDashboard` | `…UnlessStaffPinSession` | Tab "Clinic flow" | **Redirect → `/front-desk`**; keep file |
| `/front-desk/reception-board` | `ReceptionBoardDashboard` | `loadTenantOperationalDashboard({includeReceptionBoard})` + `getClinicFloorSessionIfAllowed` | `…UnlessStaffPinSession` | Tab "Reception board" | **Redirect → `/front-desk`**; keep file |
| `/front-desk/tomorrow` | `TomorrowBoard` | `loadTomorrowBoardPayload` | `…UnlessStaffPinSession` | Tab "Tomorrow board" | **Keep — becomes "Tomorrow"** (label only) |
| `/reception` | `ReceptionBoardDashboard` | `loadTenantOperationalDashboard({includeReceptionBoard})` + clinic-floor session | `…UnlessStaffPinSession` | Legacy (hidden from staff More) | **Redirect → `/front-desk`** |
| `/reception-board` | `ReceptionBoardCommandCenter` | `loadReceptionBoardCommandCenterPayload(tier:"shell")` + clinic-floor + crm/bookings nav flags | `…UnlessStaffPinSession` | Legacy (hidden) | **Redirect → `/front-desk`** |
| `/reception-os` | `ReceptionOsDashboard` | `loadReceptionOsCommandCentrePayload` + `resolveReceptionOsViewerContext` | `…UnlessStaffPinSession`; then `canAccessReceptionOs` (**currently all staff**) | Legacy (hidden) | **Platform-admin-only technical route (Option A)** — 404 for staff |
| `/operations` | `ClinicOsOperationsCentre` | `loadTenantOperationalDashboard` | `assertFiTenantPortalAccess` (**no PIN**) | Legacy (hidden) | **Redirect → `/front-desk`** |
| `/tomorrow` | `TomorrowBoard` | `loadTomorrowBoardPayload` | `assertFiTenantPortalAccess` (**no PIN**) | Legacy (hidden) | **Redirect → `/front-desk/tomorrow`** |

**Supporting navigation surfaces audited:**

- **`FrontDeskSubNav`** (`src/components/fi-os/front-desk/`) — renders `FI_OS_FRONT_DESK_TABS` as pills; used by the `front-desk/layout.tsx`. Shrinks to two.
- **`FI_OS_FRONT_DESK_TABS`** (`frontDeskWorkspaceCore.ts`) — 4 tabs (`reception-operations`, `clinic-flow`, `reception-board`, `tomorrow`). Reduce to 2.
- **`FI_OS_FRONT_DESK_LEGACY_ROUTES`** (same file) — 5 legacy "(direct)" sub-links; already hidden from staff More via `filterSubItemsForMoreDrawer`. Keep in registry until S11.
- **Sidebar sub-items** — `buildFrontDeskSidebarSubItems` (tabs + legacy) feeds `resolveFiOsPrimarySidebarItems` `FI_OS_FRONT_DESK_NAV_ID` row. Sub-items shrink with the tab set.
- **More drawer filtering** — `buildFiOsSidebarWorkflowSections` → `filterSubItemsForMoreDrawer` / `filterSidebarItemSubLinksForStaff` already strip legacy directs for staff.
- **Active-route mapping** — `getFiOsShellActiveSidebarId`: `/front-desk*` → `FI_OS_FRONT_DESK_NAV_ID`; `/reception`, `/operations`, `/reception-os`, `/reception-board`, `/tomorrow` → distinct legacy ids. Front-desk group must stay highlighted for legacy staff routes during transition (§12).
- **Mobile / More navigation** — same registry (`fiOsMinimalNav` rail excludes Front desk; it lives in More). Two sub-items only after cutover.
- **Role permission preflight** — `fiOsRolePermissionPreflightAudit.ts` + `docs/workforce/fi-os-role-permission-preflight-matrix.md`. Must stay green (§10).
- **Nav drift / go-live audits** — `fiOsNavigationDriftAudit.ts`, `fiOsNavigationGoLiveAudit.ts` (+ tests). Must stay green.
- **Staff UAT screen guides** — `reception_board` screen key referenced in the old command center; the new board has no guide yet. Add/retarget in Commit 7 (non-blocking).

---

## 2. Exact target route behaviour

**Primary staff routes** — exactly two:

```
/front-desk            → Today      (FrontDeskTodayBoard)
/front-desk/tomorrow   → Tomorrow   (TomorrowBoard, unchanged)
```

**Staff-facing labels:** `Today`, `Tomorrow`. No other Front Desk peer tabs.

**Legacy outcomes:**

| Legacy route | Proposed target | Mechanism |
|---|---|---|
| `/reception` | `/front-desk` | Server-page `redirect()` (307) |
| `/reception-board` | `/front-desk` | Server-page `redirect()` (307) |
| `/operations` | `/front-desk` | Server-page `redirect()` (307) |
| `/tomorrow` | `/front-desk/tomorrow` | Server-page `redirect()` (307) |
| `/front-desk/clinic-flow` | `/front-desk` | Server-page `redirect()` (307) |
| `/front-desk/reception-board` | `/front-desk` | Server-page `redirect()` (307) |

**Special case — `/reception-os`:** **not** a redirect. It is a technical ReceptionOS command centre (pilot metrics, owner value, module health, demo mode) — moving it to `/front-desk` would dump manager/technical content onto reception. Current gate `resolveReceptionOsViewerContext.canAccessReceptionOs` returns true for **any** staff (platform admin, CRM-shell role, any active `fi_staff`, any tenant admin) — too broad. S3.4 tightens it to **platform admin only**; ordinary staff get `notFound()` (404), not a redirect, and it stays hidden from all staff navigation (§9).

---

## 3. Live route switch plan

Replace the body of `app/(fi-admin)/fi-admin/[tenantId]/front-desk/page.tsx` so `/front-desk` renders the S3.3 board.

| Concern | Decision |
|---|---|
| Server loader call | `loadReceptionBoardCommandCenterPayload(tid, new Date(), { tier: "shell" })` (fast first paint; the board hydrates full via its own poll) |
| Shell vs full tier | **Shell** on SSR; `FrontDeskTodayBoard` sets `hydrateFullOnMount` from `loadTier === "shell"` and pulls full via `useReceptionBoardRefresh` |
| Mutation-mode resolver | `getClinicFloorSessionIfAllowed(tid)` → `staff_pin` ⇒ `"pin_reception"`, supabase ⇒ `"full"`, null ⇒ `"none"` (identical to the current `/front-desk/reception-board` page) |
| Props into `FrontDeskTodayBoard` | `initialData={payload}`, `mutationMode={mode}` (that is the whole prop surface) |
| Toast/provider wrappers | Wrap in `<CalendarToastProvider>` (board calls `useCalendarToast`) |
| Polling API dependency | `useReceptionBoardRefresh` already polls `/api/tenants/.../reception-board` — **no page-level polling**; page is a pure server component |
| Error boundary / loading | Keep the existing `loading.tsx`; `try/catch` → `notFound()` on "Tenant not found", `InfoNotice` on missing Supabase env (mirror current pages) |
| Page metadata | `title: "Today"`, `robots: { index:false, follow:false }`, `dynamic = "force-dynamic"`, `noStore()` |
| Access gate | Keep `assertFiTenantPortalAccessUnlessStaffPinSession(tid)` (PIN-friendly) — **remove** the `resolveReceptionOsViewerContext` / `/calendar` redirect |
| Staff PIN sessions | Reach Today with `mutationMode: "pin_reception"` (flow actions minus Cancel) — the board already enforces this |

**Must NOT reintroduce:** the ReceptionOS command-centre loader (`loadReceptionOsCommandCentrePayload`), a second polling loop, raw-payload derivation in the page, manager metrics, diagnostics, Tomorrow content, or old reception-board derivation. All of that stays out because the page only loads a shell payload and hands it to the board.

**File-level replacement map for `front-desk/page.tsx`:**

| Remove | Add |
|---|---|
| `import { ReceptionOsDashboard }` | `import { FrontDeskTodayBoard }` from `@/src/components/fi-os/front-desk/FrontDeskTodayBoard` |
| `import { resolveReceptionOsViewerContext }` | `import { CalendarToastProvider }` from `@/components/calendar/CalendarToast` |
| `import { loadReceptionOsCommandCentrePayload }` | `import { loadReceptionBoardCommandCenterPayload }` from `@/src/lib/receptionBoard/receptionBoard.server` |
| viewer-context gate + `/calendar` redirect | `import { getClinicFloorSessionIfAllowed }` + resolve `mutationMode` |
| `<ReceptionOsDashboard data=… />` | `<CalendarToastProvider><FrontDeskTodayBoard initialData=… mutationMode=… /></CalendarToastProvider>` |
| `metadata.title = "Front desk"` | `metadata.title = "Today"` |

Keep: `assertFiTenantPortalAccessUnlessStaffPinSession`, `noStore()`, `dynamic`, Supabase-env `InfoNotice`, `notFound()` handling.

---

## 4. Two-tab navigation cutover

Current four-tab model (`FI_OS_FRONT_DESK_TABS`): `reception-operations` (""), `clinic-flow`, `reception-board`, `tomorrow`. Target:

```
Today      → segment ""          (id: "today")
Tomorrow   → segment "tomorrow"  (id: "tomorrow")
```

| Surface | Change |
|---|---|
| Tab constants (`FI_OS_FRONT_DESK_TABS`) | Reduce to two entries; `reception-operations` → `today` (label "Today", segment ""); drop `clinic-flow`, `reception-board` from the **visible** array |
| Active-tab helper (`resolveFrontDeskTabFromPath`, `isFrontDeskTabActive`) | Base "" still resolves to Today; `tomorrow` unchanged; `clinic-flow`/`reception-board` segments handled by redirects (§8), so they need no active mapping post-cutover |
| Href helper (`buildFiOsFrontDeskTabHref`) | Unchanged (segment-based) |
| Sidebar sub-items (`buildFrontDeskSidebarSubItems`) | Emits two consolidated sub-items (Today, Tomorrow) + legacy directs (still hidden from staff) |
| More-drawer sub-items | Already filtered; now only Today/Tomorrow visible to staff |
| Mobile navigation | Same registry → two sub-items |
| Breadcrumbs | "Front desk › Today" / "Front desk › Tomorrow" |
| aria labels | `FrontDeskSubNav` `aria-label="Front desk navigation"` unchanged; tab labels become Today/Tomorrow |
| Route-active logic (`getFiOsShellActiveSidebarId`) | `/front-desk*` already → `FI_OS_FRONT_DESK_NAV_ID`; unchanged |
| Navigation tests (`fiOsFrontDeskConsolidation.test.ts`) | Update expectations: two visible tabs; assert `clinic-flow`/`reception-board` no longer in visible tab labels; legacy still in catalog |
| Staff role filtering | Unchanged — Front desk visible to reception/clinic staff via `dashboard` feature key |

**Old tab identifiers:** keep `FI_OS_FRONT_DESK_LEGACY_ROUTES` and the `clinic-flow`/`reception-board` **route files** in an internal registry until **S11** (they back the redirects and bookmarks). Remove them only from the **visible** tab array now. The staff interface exposes exactly two choices; **no new rail item** is added (Front desk stays in More).

---

## 5. Dual-run verification design

Compare the **new** Today model against the **existing richest** reception source for the same tenant + operational day, at the data-model level (never screenshots).

- **Old source (richest):** `loadReceptionBoardCommandCenterPayload(tid, day, { tier: "full" })` → `receptionCards` (canonical bookings), `appointments` (payment/journey), `queue`, `actionAlerts`.
- **New source:** `buildFrontDeskTodayPresentation(oldPayload, { base, nowMs, mutationMode })` → lanes, exceptionCards, cards (payment/blocker), attentionItems.

Both derive from the **same** `receptionCards`, so booking-ID reconciliation must be exact; state differences are the intentional S3.1 remodel.

**Proposed report type** (pure; IDs/counts only — no PHI):

```ts
type FrontDeskDualRunComparison = {
  tenantId: string;
  operationalDay: string;          // todayYmd
  generatedAt: string;
  oldBookingIds: string[];         // from receptionCards
  newBookingIds: string[];         // lanes + exceptionCards
  missingFromNew: string[];        // in old, absent in new  → BLOCK
  extraInNew: string[];            // in new, absent in old  → BLOCK
  duplicateBookingIds: string[];   // any id in >1 lane/section → BLOCK
  counts: {
    total: { old: number; new: number };
    expectedArriving: { old: number; new: number };  // old expected → new arriving_soon+expected+running_late
    arrivedWaiting: { old: number; new: number };     // old arrived → new waiting
    inConsultation: { old: number; new: number };
    inTreatment: { old: number; new: number };
    completed: { old: number; new: number };
    cancelledNoShow: { old: number; new: number };
  };
  stateMismatches: Array<{ bookingId: string; previousState: string; newState: string; expected: boolean }>;
  paymentDue: { old: string[]; new: string[]; unreconciled: string[] };
  blockerLinked: { old: string[]; new: string[]; unreconciled: string[] };
  unmatchedAlerts: Array<{ alertId: string; reason: "panel_only" | "no_entity_key" | "manager_only" | "pipeline" }>;
  pass: boolean;
};
```

**Documented acceptable (intentional) differences — never failures:**

- **Explicit `waiting`** state (old bucketed arrived-without-phase differently).
- **Running-late grace / arriving-soon window** (S3.1 `RUNNING_LATE_GRACE_MINUTES`, `ARRIVING_SOON_WINDOW_MINUTES`) reclassifying some old "expected" rows as `running_late`/`arriving_soon`. *(Note: S3.1 currently ships grace = 0; if product wants a 10-minute grace, that is an S3.1 change, not an S3.4 failure — the verifier reads the threshold from the model, it does not hard-code it.)*
- **Old queue columns mapping several states together** (e.g. one "arrived" column vs waiting/in_consultation/in_treatment split).
- **Removal of manager-only alerts** (utilisation, conversion, revenue) from `attentionItems`.
- **Removal of pipeline alerts** (`no_follow_up_after_consultation`, stale enquiry, CRM tasks).

These are recorded in `stateMismatches[].expected = true` and `unmatchedAlerts[].reason`, and do **not** flip `pass`. Only booking-ID divergence, duplicates, and unexplained terminal-count drift do.

---

## 6. Dual-run execution options

| Option | Verdict |
|---|---|
| 1. Pure test-fixture comparison | **Yes — required** (Commit 1). Deterministic `nowMs`, synthetic + captured fixtures. |
| 2. Server-side audit helper over live loader output | **Yes — the helper is loader-agnostic**; runs on live payloads when invoked from (3)/(4). |
| 3. Platform-admin-only diagnostic route | **Optional** (Commit 4). If added, gate with `isFiOsPlatformAdminFullSessionBypass`, IDs/counts only, no staff surface, temporary. |
| 4. CLI/script against a selected tenant | **Preferred live entry** — a Node script calling the helper for a chosen tenant/day; no product surface, easy to delete. |
| 5. Temporary structured logging during live use | **Only if needed**, platform-admin sessions, counts + `pass` + mismatch IDs, time-boxed, removed before S11. |

**Minimum safe combination:** **(1) pure helper + unit tests**, plus **(4) a script** (or optionally (3) a platform-admin route) for one controlled live run. No ordinary staff-facing debug UI; no permanent surface.

**PHI:** log/emit **booking IDs and counts only** — never patient names, phone, email, or clinical detail. Booking IDs are opaque UUIDs, acceptable in platform-admin telemetry.

---

## 7. Cutover gates

**Required green (go):**

- [ ] No booking IDs missing from new (`missingFromNew: []`).
- [ ] No duplicate booking IDs (`duplicateBookingIds: []`).
- [ ] Terminal counts reconcile (`completed`, `cancelledNoShow` old = new).
- [ ] Active-state differences all `expected: true` and documented.
- [ ] Staff PIN: check-in / start consult / start treatment / complete / no-show succeed; Cancel absent.
- [ ] Read-only (`none`): no flow mutations rendered or callable.
- [ ] Payment links resolve to `/payments`.
- [ ] Tomorrow board output unchanged (loader diff empty).
- [ ] Tablet 768×1024: no page-level horizontal overflow.
- [ ] Front Desk navigation shows exactly Today + Tomorrow.
- [ ] All six legacy URLs resolve (redirect, no 404).
- [ ] Production build passes; nav drift / go-live / preflight audits green.

**Block cutover (no-go):**

- [ ] Any booking appears twice on the board.
- [ ] Any live booking disappears.
- [ ] Staff PIN loses a permitted action.
- [ ] Read-only gains a mutation.
- [ ] A legacy link 404s.
- [ ] `/reception-os` becomes visible/accessible to staff.
- [ ] Two pollers run on one page.
- [ ] Old and new boards mutate through different server paths (both must use `receptionBoardTransitionPatient`).
- [ ] Page-level horizontal overflow returns.

**Sign-off checklist (completion report):** tenant + day verified · `FrontDeskDualRunComparison.pass = true` · intentional-diff list attached · PIN/read-only matrix attached · redirect table verified · `/reception-os` 404-for-staff verified · audits + build green · reviewer + date.

---

## 8. Legacy redirect implementation

**Mechanism:** local **server-page `redirect()`** (`next/navigation`) inside each legacy page — the pattern already used in `reception-os/page.tsx`. **No middleware** (unnecessary for local consolidation; middleware adds a global matcher and obscures tenant scoping).

| Route | Target | Redirect type | Preserve query? | Access check before redirect? | Telemetry |
|---|---|---|---|---|---|
| `/reception` | `/front-desk` | 307 (temp, S3.4) → 308 (S11) | Yes (whitelist: `bookingId`, `patientId`, `date`, `demo`) | No — target gates (PIN-safe) | `legacy_route_hit{route}` |
| `/reception-board` | `/front-desk` | 307 → 308 | Yes | No | `legacy_route_hit` |
| `/operations` | `/front-desk` | 307 → 308 | Yes | No | `legacy_route_hit` |
| `/tomorrow` | `/front-desk/tomorrow` | 307 → 308 | Yes | No | `legacy_route_hit` |
| `/front-desk/clinic-flow` | `/front-desk` | 307 → 308 | Yes | No | `legacy_route_hit` |
| `/front-desk/reception-board` | `/front-desk` | 307 → 308 | Yes | No | `legacy_route_hit` |

- **Query params:** forward a **safe whitelist** (`bookingId`, `patientId`, `date`, `demo`) via the redirect URL; drop unknown params (privacy). Never place patient identity in the URL.
- **Fragments:** `#queue` etc. are client-only and dropped by server redirects; acceptable — the Today board has no fragment contract. Do not rely on fragments.
- **Tenant scoping:** build the target from the same `[tenantId]` param (`/fi-admin/${tid}/front-desk`).
- **Unauthorized sessions:** redirect **before** the portal gate so unauth users land on `/front-desk`, which runs `assertFiTenantPortalAccessUnlessStaffPinSession` and sends them to login/`notFound` as usual. (Avoids double-gating and PIN lockout.)
- **Staff PIN sessions:** `/operations` and `/tomorrow` currently use the stricter `assertFiTenantPortalAccess` (no PIN); redirecting *before* any gate means PIN users now reach `/front-desk` / `/front-desk/tomorrow` (PIN-friendly) — a deliberate improvement, not a regression.
- **Redirect loops:** targets are real pages that never redirect back → no loop. Verify `/front-desk` and `/front-desk/tomorrow` contain no redirect.
- **Browser history:** 307/308 replace-in-place; back button returns to the pre-legacy page. Acceptable.
- **Temp vs permanent:** **307 during S3.4** (reversible if dual-run finds an issue), promote to **308 in S11** once telemetry shows legacy traffic has drained.

---

## 9. `/reception-os` platform-admin handling

**Decision: Option A — keep `/reception-os` as a platform-admin-only technical route.** (Option B — relocating panels into a platform-admin area — is out of scope for S3.4 and risks touching ReceptionOS internals.)

Audit findings:
- **Current gate:** `assertFiTenantPortalAccessUnlessStaffPinSession` then `resolveReceptionOsViewerContext.canAccessReceptionOs` = `platformAdmin || isCrmShellNavRole || any staffRole || any tenantAdminRole` → effectively **all staff**. Non-access → redirect `/calendar`.
- **Platform-admin detection:** `isFiOsPlatformAdminFullSessionBypass(authUserId)` (in `crmGate`).
- **Demo mode:** `?demo=1` → `resolveReceptionOsDemoModeForViewer` (role-gated); preserved for platform admins.
- **Pilot metrics / owner-value / diagnostics / module-health:** all inside `ReceptionOsCommandCentrePayload`, role-gated in the loader; remain platform-admin-only.
- **Nav visibility:** `reception-os` is a legacy "(direct)" sub-item, already hidden from staff More by `filterSubItemsForMoreDrawer`.

**Recommendation:**

| Aspect | Target |
|---|---|
| Exact access gate | Keep portal gate, then require `isFiOsPlatformAdminFullSessionBypass(authUserId) === true`; otherwise `notFound()` (404, not redirect — technical tool, nothing "moved") |
| Ordinary staff outcome | `notFound()` — hidden and blocked |
| Tenant admin qualifies? | **No** — it is platform-level tooling |
| Staff PIN qualifies? | **No** |
| Nav hidden | Already hidden; add a test asserting it never appears in staff More |
| Tests | Platform admin 200; receptionist/tenant-admin/PIN → 404; nav-absence test |

Demo/pilot use is preserved because platform admins retain full access (incl. `?demo=1`).

---

## 10. Permission and role regression matrix

| Role / session | `/front-desk` (Today) | `/front-desk/tomorrow` | Legacy staff URLs | `/reception-os` |
|---|---|---|---|---|
| Receptionist (full) | ✅ view + full flow actions | ✅ view | ↪ redirect to new | 🚫 404 |
| Receptionist (PIN) | ✅ view + flow minus Cancel | ✅ view | ↪ redirect | 🚫 404 |
| Clinic manager | ✅ full | ✅ | ↪ redirect | 🚫 404 |
| Nurse | ✅ (per clinic-floor access) | ✅ | ↪ redirect | 🚫 404 |
| Surgeon | ✅ (if bookings-operator/clinic-floor) | ✅ | ↪ redirect | 🚫 404 |
| Consultant | ✅ (per access) | ✅ | ↪ redirect | 🚫 404 |
| Finance | ✅ view; flow per session mode | ✅ | ↪ redirect | 🚫 404 |
| Tenant admin | ✅ | ✅ | ↪ redirect | 🚫 404 |
| Platform admin | ✅ | ✅ | ↪ redirect | ✅ full technical |
| Read-only portal user | ✅ view; **no** mutations | ✅ view | ↪ redirect | 🚫 404 |

- Access continues to flow through the **existing Front Desk portal + clinic-floor model** (`assertFiTenantPortalAccessUnlessStaffPinSession` + `getClinicFloorSessionIfAllowed` → `mutationMode`). Capability overrides (e.g. receptionist + roster) are preserved because they ride the same staff-signal resolution — **not** replaced by capability grants.
- `mutationMode` is the single authority for what actions render/run; the board honours it and the server re-checks every mutation.

---

## 11. Tomorrow protection audit

Tomorrow already matches the target. **Unchanged in S3.4:**

- **Loader:** `loadTomorrowBoardPayload` — no change.
- **Actions / checklist / surgery-readiness enrichment / payment-deposit issues:** `TomorrowBoard` component + model — no change.
- **Route:** `/front-desk/tomorrow` — no change.
- **Portal gate:** `assertFiTenantPortalAccessUnlessStaffPinSession` — no change.
- **Tablet behaviour:** no change.

**Changes limited to:** the visible tab **label** ("Tomorrow board" → "Tomorrow") and the legacy **`/tomorrow` → `/front-desk/tomorrow` redirect**.

**Four-tab dependency check:** `TomorrowBoard` renders inside `front-desk/layout.tsx`, which renders `FrontDeskSubNav`. Shrinking the tab set does not change Tomorrow's content — only which pills render above it. The Tomorrow page does not import `FI_OS_FRONT_DESK_TABS` directly, so no code dependency on the four-tab model exists beyond the shared sub-nav. Verify the layout still renders correctly with two tabs.

---

## 12. Active-route and deep-link behaviour

| Scenario | Expected highlight |
|---|---|
| `/front-desk` | Front desk group active; Today sub-item active |
| `/front-desk/tomorrow` | Front desk group active; Tomorrow sub-item active |
| Legacy staff route **before** redirect | Front desk group stays highlighted (`getFiOsShellActiveSidebarId` maps `/reception`, `/operations`, `/reception-board`, `/tomorrow` to their legacy ids → keep mapping them into the Front desk **group** during transition) |
| Legacy staff route **after** redirect | Resolves to `/front-desk*` → Front desk group active |
| `/reception-os` as platform admin | Not in staff nav; no active staff highlight (platform-admin context) |
| Bookmarked URL with query string | Redirect preserves whitelisted params; target highlights Front desk |
| Refresh after redirect | Lands on target (307), Front desk active |
| Browser back | Returns to pre-legacy page (307 replace semantics) |

**Compatibility rule until S11:** keep legacy route → Front-desk-group active mapping so the sidebar never goes "dark" while both old and new resolve. Remove legacy active mappings only when the routes are retired in S11.

---

## 13. Telemetry and redirect monitoring

Minimal, operational, **no PHI, no business KPIs**:

- `legacy_route_hit{route}` — count legacy hits per route (drives S11 retirement).
- `legacy_redirect{route, outcome}` — redirect success/failure.
- `frontdesk_dualrun_mismatch{kind}` — count comparison mismatches (missing/extra/duplicate/state).
- `frontdesk_duplicate_invariant_fail` — hard alarm if a booking ID appears twice.
- `frontdesk_today_first_render_ms` — Today first meaningful render.
- `frontdesk_poll_failure` — polling failures after cutover.
- `session_type{full|pin|read_only|platform_admin}` — role/session shape **without** patient identity.
- `reception_os_staff_attempt` — count staff attempts to reach `/reception-os` (should trend to zero).

**Never log:** patient names, phone, email, clinical detail. Use booking IDs / counts only.

**Feeds S11:** when `legacy_route_hit` for a route stays at/near zero across a full clinic cycle and `dualrun_mismatch` is clean, promote that route's redirect to 308 and schedule file retirement.

---

## 14. Test plan

1. `/front-desk` renders `FrontDeskTodayBoard`.
2. `/front-desk` no longer loads ReceptionOS command-centre staff content (`ReceptionOsDashboard` absent).
3. Front Desk sub-nav contains exactly Today and Tomorrow.
4. Today active on `/front-desk`.
5. Tomorrow active on `/front-desk/tomorrow`.
6. Old tab labels ("Reception operations", "Clinic flow", "Reception board", "Tomorrow board") absent from visible + accessible nav.
7. `/reception` → `/front-desk`.
8. `/reception-board` → `/front-desk`.
9. `/operations` → `/front-desk`.
10. `/tomorrow` → `/front-desk/tomorrow`.
11. `/front-desk/clinic-flow` → `/front-desk`.
12. `/front-desk/reception-board` → `/front-desk`.
13. Redirects preserve whitelisted query params.
14. No redirect loop (target renders 200).
15. Ordinary staff cannot access `/reception-os` (404).
16. Platform admin can access `/reception-os` (200).
17. Staff PIN reaches Today and Tomorrow.
18. PIN mutation behaviour unchanged (flow minus Cancel).
19. Read-only exposes no flow mutations.
20. Tenant-admin vs platform-admin behaviour distinct (tenant admin 404 on `/reception-os`).
21. Dual-run detects a missing booking.
22. Dual-run detects a duplicate booking.
23. Dual-run accepts documented intentional state differences (`expected: true`).
24. Payment-due IDs reconcile.
25. Blocker-linked IDs reconcile or produce documented exclusions.
26. Tomorrow loader output unchanged (snapshot).
27. Active navigation correct after redirect.
28. Mobile/More nav shows only Today + Tomorrow.
29. Tablet layout free of horizontal overflow.
30. Terminology audit green (no "OS"/"cockpit"/"command centre"/"reception board" in staff chrome).
31. Nav drift / go-live audits green.
32. Role permission preflight green.
33. Production build passes.

---

## 15. File-level implementation plan

**Commit 1 — Dual-run audit helper (no route change)**
- Add `src/lib/fiOs/frontDesk/frontDeskDualRunComparison.ts` (pure; `FrontDeskDualRunComparison` + `compareFrontDeskDualRun(oldPayload, presentation, opts)`).
- Add `src/lib/fiOs/frontDesk/frontDeskDualRunComparison.test.ts` (missing / duplicate / intentional-diff / payment / blocker cases).
- Must not touch: S3.1/S3.2/S3.3 files.

**Commit 2 — Live Today route switch**
- Edit `app/(fi-admin)/fi-admin/[tenantId]/front-desk/page.tsx` per §3 map.
- No tab or legacy change yet (tabs still four; legacy still live).
- Tests: `/front-desk` renders board (1, 2), PIN/read-only mode resolution.

**Commit 3 — Two-tab navigation**
- Edit `src/lib/fiOs/frontDesk/frontDeskWorkspaceCore.ts`: shrink visible `FI_OS_FRONT_DESK_TABS` to Today + Tomorrow; keep `FI_OS_FRONT_DESK_LEGACY_ROUTES`.
- `FrontDeskSubNav` unchanged (data-driven).
- Update `src/lib/fiOs/frontDesk/fiOsFrontDeskConsolidation.test.ts` expectations (3, 4, 5, 6).
- Verify `resolveFiOsPrimarySidebarItems` Front-desk sub-items now two + hidden legacy.

**Commit 4 — Dual-run validation & sign-off**
- Optional: `app/(fi-admin)/fi-admin/[tenantId]/reception-os/dual-run` platform-admin diagnostic **or** a `scripts/frontdesk-dualrun.ts` CLI (preferred).
- Run against a controlled tenant/day; attach `FrontDeskDualRunComparison` + intentional-diff list to the sign-off (§7).

**Commit 5 — Staff legacy redirects**
- Edit legacy pages to thin `redirect()` (preserve whitelisted query): `reception/page.tsx`, `reception-board/page.tsx`, `operations/page.tsx`, `tomorrow/page.tsx`, `front-desk/clinic-flow/page.tsx`, `front-desk/reception-board/page.tsx`.
- Do **not** delete files. Tests 7–14, 27.

**Commit 6 — `/reception-os` admin-only enforcement**
- Edit `reception-os/page.tsx` gate to `isFiOsPlatformAdminFullSessionBypass` → else `notFound()`; optionally tighten `resolveReceptionOsViewerContext` consumers.
- Tests 15, 16, 20 + nav-absence.

**Commit 7 — E2E, tablet, role, docs closure**
- E2E route + redirect specs; tablet overflow spec (29); role preflight (32); terminology audit (30); nav drift/go-live (31).
- Retarget/add staff UAT screen guide for the new Today board.
- Update `docs/fi-ux-rebuild/*` completion notes and the preflight matrix doc.

**Must NOT be modified:** S3.3 component files (`FrontDeskTodayBoard.tsx`, `frontDeskTodayUi.tsx`, helpers); S3.2 contract (`frontDeskTodayPresentation.ts` / `.types.ts`); S3.1 model (`receptionBoardModel.ts`); Tomorrow board/loader; reception mutation path. No DB migrations. No new top-level nav item.

**Never combine** the route switch (Commit 2) and all redirects (Commit 5) into one commit — keep each reversible.

---

## Conclusion

**1. Recommended cutover sequence**
Dual-run helper (1) → Today route switch (2) → two-tab nav (3) → live dual-run sign-off (4) → staff legacy redirects (5) → `/reception-os` admin-only (6) → E2E/tablet/role/docs (7). Redirects come **after** the switch + a green dual-run, so the new board is proven against live data before any bookmark is repointed.

**2. Exact two-tab navigation contract**
```
Front desk (More group; not a rail item)
  ├── Today      → /fi-admin/{tid}/front-desk
  └── Tomorrow   → /fi-admin/{tid}/front-desk/tomorrow
```
Visible `FI_OS_FRONT_DESK_TABS` = `[{ id:"today", label:"Today", segment:"" }, { id:"tomorrow", label:"Tomorrow", segment:"tomorrow" }]`. Legacy tab ids + routes stay in the internal registry until S11. No new rail item.

**3. Recommended dual-run verification mechanism**
Pure `compareFrontDeskDualRun` helper + unit tests (Commit 1), executed live once via a `scripts/frontdesk-dualrun.ts` CLI (or a platform-admin-only diagnostic route) against a controlled tenant/day. Compares booking IDs, terminal counts, payment-due IDs, blocker-linked IDs; classifies S3.1 remodel differences as `expected`. Booking IDs and counts only — no PHI.

**4. Exact legacy redirect table**
`/reception → /front-desk`; `/reception-board → /front-desk`; `/operations → /front-desk`; `/tomorrow → /front-desk/tomorrow`; `/front-desk/clinic-flow → /front-desk`; `/front-desk/reception-board → /front-desk`. Local server-page `redirect()`, whitelisted query preserved, tenant-scoped, **307 in S3.4 → 308 in S11**. No middleware.

**5. `/reception-os` access decision**
**Option A** — platform-admin-only technical route. Gate = portal + `isFiOsPlatformAdminFullSessionBypass`; ordinary staff, tenant admins, and PIN sessions → `notFound()`. Not redirected (nothing moved); stays hidden from staff nav; demo/pilot preserved for platform admins.

**6. Go/no-go criteria**
Go only when: `missingFromNew`/`extraInNew`/`duplicateBookingIds` empty, terminal counts reconcile, all active-state diffs documented-intentional, PIN/read-only matrix correct, payment links → `/payments`, Tomorrow unchanged, tablet overflow-free, exactly two tabs, all six legacy URLs resolve, and build + nav/preflight/terminology audits green. Any duplicate/vanished booking, PIN action loss, read-only mutation, legacy 404, `/reception-os` staff exposure, double poller, split mutation path, or returned horizontal overflow **blocks**.

**7. Highest-risk cutover issue**
**Silent booking divergence between the old and new models on live data.** Old and new both derive from `receptionCards`, but the S3.1 state remodel (waiting split, running-late/arriving-soon windows, dropped manager/pipeline alerts) makes it easy to mistake an intentional reclassification for a lost or duplicated booking — or to miss a genuine drop hidden among expected diffs. Mitigation: the dual-run verifier reconciles by **booking ID** (exact, must be empty diff) separately from **state** (differences allowed, must be flagged `expected`), gates cutover on the ID reconciliation, and runs on a real tenant/day before any redirect is armed.

**8. Minimum reversible S3.4 implementation slice**
Commit 2 alone: point `front-desk/page.tsx` at `FrontDeskTodayBoard` (shell loader + `mutationMode` + `CalendarToastProvider`), leaving all four tabs and every legacy route live and unredirected. This makes Today the live default with **zero** navigation or redirect changes — fully reversible by reverting one file — and lets the dual-run run against the real route before the two-tab and redirect commits land.
