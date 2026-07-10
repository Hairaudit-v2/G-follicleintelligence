# Roster Command Centre — Change Log

**Last updated:** 2026-07-10  
**Branch:** `main`  
**Audience:** engineers extending WorkforceOS rostering, Team workspace roster, or HR leave flows  
**Primary surfaces:**

| Route | Notes |
|-------|--------|
| `/fi-admin/[tenantId]/workforce-os/roster` | Canonical Roster Command Centre |
| `/fi-admin/[tenantId]/team/roster` | Same UI under Team workspace (`useTeamRoute`) |
| `/fi-admin/[tenantId]/hr-os/roster` | **Redirect only** → workforce-os roster |

This log records shipped behaviour, regressions fixed, and **do-not-reintroduce** rules so future builds do not undo calendar add/cancel/sick-day work.

---

## Status (2026-07-10)

| Item | State |
|------|--------|
| Empty-cell **Add shift** drawer | Working (timezone-aware) |
| Existing shift **edit / cancel** | Working (audited reasons) |
| Full-day **sick / personal / unavailable** | Working from calendar drawer |
| Staff profile links from ineligible list | `/workforce-os/staff/[id]` (not broken `/hr-os/staff/…`) |
| Unused `RosterAvailabilityPanel` | **Removed** (timezone footgun) |
| Manage permission deny messaging | Centralised — never blank |

---

## Recent commits (coder-facing)

| Commit | Summary |
|--------|---------|
| _(pending)_ | **feat(roster):** chip quick-cancel + full-period Sick/Personal/Away on staff column |
| `bdfb9461` | **fix(roster):** remove unused import (Vercel ESLint) |
| `fa6804b0` | **fix(roster):** full-viewport drawer so add-shift click is visible |
| `0362a28a` | **refactor(roster):** centralise deny messages + day-away helpers; delete dead AvailabilityPanel; simplify drawer |
| `1565b010` | **fix(roster):** calendar add/cancel + mark-away (sick/personal); grid errors; datetime-local normalise; staff profile href |
| `0f6d6df2` | **fix(roster):** place manual shifts by clinic/staff timezone (`localDate` on grid) |
| `ef91421b` | **fix(roster):** restore cell/shift drawer (staff context from grid options, not `staffOptions` alone) |
| `433b6d16` / `679ee9c7` | **FI-ROSTER-OPERATIONAL-EDITING-1** — audited edit/cancel paths |
| `3062fd1b` (earlier) | Gate roster mutations + cancellation audit |
| `6ea7d088` (earlier) | Eligible staff only on grid |

---

## Product behaviour (what coders must preserve)

### Calendar grid (`RosterWeekGrid`)

1. **Empty cell** or **RDO cell** click → open shift drawer in `cell-actions` mode.  
2. Label copy: **+ Add shift / mark away** (empty) / **RDO · click to add shift or mark away**.  
3. **Shift chip** click → open drawer in `edit` mode (via `data-roster-shift-id` delegation — do **not** nest buttons that swallow clicks).  
4. Cells stay clickable even without manage permission so the parent can show an **explicit deny** message (no silent `return` / no `pointer-events-none` on the cell).

### Shift drawer (`RosterShiftDrawer`)

| Mode | Staff can… |
|------|------------|
| `cell-actions` | **Add shift** (manual form), optional generate-from-standard-hours, **Mark staff away** |
| `edit` | View shift, **Edit shift** (inline), **Cancel / remove shift** (reason required), **Mark staff away** |

**Mark staff away (full day):**

1. Creates `fi_staff_availability_blocks` (`sick_leave` | `leave` | `unavailable`).  
2. Cancels all **scheduled/confirmed** shifts for that staff+local day (union of `dayShifts` + selected shift).  
3. Cancel reasons: `staff_sick` for sick leave; `manual_adjustment` for personal/unavailable.  
4. Times converted with **staff timezone → tenant timezone** (never browser-local `new Date().toISOString()`).

### Permission

- Gate: `resolveStaffStandardHoursManageCapability` / `assertHrOsRosterManageAllowed` (`roster.manage` capability or HR-OS manage roles).  
- Deny copy: always `resolveRosterManageDeniedMessage()` → never empty string.  
- Banner: `data-testid="roster-manage-denied-banner"` + grid-adjacent `data-testid="roster-action-error"`.

---

## Architecture map (where to edit)

| Area | Path |
|------|------|
| Page (WorkforceOS) | `app/(fi-admin)/fi-admin/[tenantId]/workforce-os/roster/page.tsx` |
| Page (Team) | `app/(fi-admin)/fi-admin/[tenantId]/team/roster/page.tsx` |
| HR legacy redirect | `app/(fi-admin)/fi-admin/[tenantId]/hr-os/roster/page.tsx` |
| Command centre UI | `src/components/fi/workforce/RosterCommandCentreView.tsx` |
| Week grid | `src/components/fi/workforce/RosterWeekGrid.tsx` |
| Shift drawer | `src/components/fi/workforce/RosterShiftDrawer.tsx` |
| Right drawer chrome | `src/components/fi/workforce/RosterRightDrawer.tsx` |
| Pure UX helpers | `src/lib/workforce-os/rosterCommandCentreUxCore.ts` |
| Payload loader | `src/lib/workforce-os/rosterCommandCentrePageLoader.server.ts` |
| Domain load | `src/lib/workforce-os/workforceRosterCommandCentre.server.ts` |
| Mutations (server actions) | `src/lib/actions/workforce-roster-actions.ts` |
| Manual adjust / cancel domain | `src/lib/workforce-os/rosterManualAdjustments.server.ts` + `…Core.ts` |
| Eligibility | `src/lib/workforce-os/rosterEligibleStaffCore.ts` |
| Manage gate | `src/lib/workforce-os/staffStandardHoursManageGate.server.ts` |
| Staff profile href | `buildWorkforceStaffProfileHref` in `staffStandardHoursRoutes.ts` |
| Regression tests | `rosterCommandCentreUxCore.test.ts`, `rosterCommandCentreInteraction.test.ts`, `rosterCommandCentreDrawer.test.ts` |

---

## Regression history (read before changing click / time / staff resolve)

### 1. Silent drawer open (fixed `ef91421b`)

**Symptom:** Cell click set state but drawer never mounted.  
**Cause:** Drawer gated on `drawerStaff` resolved from **`staffOptions` only**; grid rows come from **`rosterGridStaffOptions`**.  
**Rule:** Always use `resolveRosterDrawerStaffContext({ staffOptions, rosterGridStaffOptions, selectedShift })`. Never resolve staff from a single list.

### 2. Shift “added” but missing on grid (fixed `0f6d6df2`)

**Symptom:** Create succeeded; shift appeared on wrong day or not at all (AU clinics).  
**Cause:** Browser-local `Date` parsing + matching cells on UTC `starts_at` date prefix.  
**Rule:** Convert with `rosterShiftDatetimeLocalToUtcIso`; store/match **`localDate`** via `shiftMatchesRosterCellDate`. Prefill times with `normaliseDatetimeLocalHm` for `<input type="datetime-local">`.

### 3. Add shift / cancel felt dead (fixed `1565b010`)

**Symptom:** Clicks did nothing useful; no sick/personal path on calendar.  
**Causes:** Weak empty-cell CTA; no day-away actions; deny errors only above filters (scrolled away); broken `/hr-os/staff/{id}` links; possible invalid datetime-local values.  
**Rule:** Surface `roster-action-error` **next to the grid**; mark-away + cancel in drawer; staff profile → `/workforce-os/staff/{id}`.

### 4. Dual implementations diverging (fixed `0362a28a`)

**Symptom:** One path fixed, another reintroduced browser-local dates or blank deny.  
**Cause:** Unused `RosterAvailabilityPanel` still used `new Date(startsAt).toISOString()`; deny reason passed as `""` from pages; duplicated mark-away shift-collection logic.  
**Rule:**

- Do **not** re-add a separate availability form that invents its own time conversion.  
- Use `resolveRosterManageDeniedMessage`, `collectCancellableRosterDayShifts`, `rosterDayAwayReasonLabel`, `rosterDayAwayShiftCancellationReason`.  
- Pages always pass `manageDeniedReason={ROSTER_MANAGE_DENIED_REASON}` (message used only when `canManage` is false).

---

## Pure helpers (prefer these over re-inlining)

```ts
// src/lib/workforce-os/rosterCommandCentreUxCore.ts
resolveRosterManageDeniedMessage(reason?)
collectCancellableRosterDayShifts({ dayShifts, selectedShift })
rosterDayAwayReasonLabel(kind)
rosterDayAwayShiftCancellationReason(kind)
normaliseDatetimeLocalHm(raw, fallback?)
buildRosterFullDayAbsenceLocalWindow(localDate)
buildRosterShiftDrawerDefaults(...)
rosterShiftDatetimeLocalToUtcIso(...)
shiftMatchesRosterCellDate(shift, staffId, localDate)
resolveRosterDrawerStaffContext(...)
resolveRosterCellClickOutcome({ staffId, eligibleStaffIds, canManage, manageDeniedReason })
```

---

## Server actions (mutations)

| Action | Purpose |
|--------|---------|
| `createRosterShiftAction` | Manual add shift |
| `updateRosterShiftAction` | Inline edit (reason when timing/type/clinic changes) |
| `cancelRosterShiftAction` | Cancel/remove one shift (drawer cancellation reasons) |
| `createAvailabilityBlockAction` | Leave / sick / unavailable block |
| `generateRosterFromStandardHoursAction` | Optional template fill |
| `copyPreviousRosterPeriodAction` / clear generated / apply default hours | Bulk period tools |

All require `assertHrOsRosterManageAllowed`. Actor ids must be **tenant FI users** (see prior leave mutation fixes).

---

## Test contracts (do not delete without replacement)

| File | Guards |
|------|--------|
| `rosterCommandCentreInteraction.test.ts` | No silent cell no-op; grid not `pointer-events-none`; deny messages explicit |
| `rosterCommandCentreDrawer.test.ts` | Manage wiring, cancel path, mark-away panel testids, availability create action |
| `rosterCommandCentreUxCore.test.ts` | Timezone conversion, localDate match, day-away helpers, deny message, datetime normalise |

Run (example):

```bash
pnpm exec tsx --test src/lib/workforce-os/rosterCommandCentreUxCore.test.ts src/components/fi/workforce/rosterCommandCentreInteraction.test.ts src/components/fi/workforce/rosterCommandCentreDrawer.test.ts
```

---

## How to extend safely

### Adding a new leave type

1. Extend `createBlockSchema` / DB check for block type if needed.  
2. Add to `RosterDayAwayKind` + labels/cancel-reason helpers in `rosterCommandCentreUxCore.ts`.  
3. Wire button in `MarkDayAwayPanel` only (single UI entry).  
4. Add unit tests for label + cancel reason.

### Adding a bulk “cancel all shifts this day” button

Reuse `collectCancellableRosterDayShifts` + `cancelRosterShiftAction` — do not invent a third shift list.

### Changing staff identity / HR links

Use `buildWorkforceStaffProfileHref(tenantId, staffId)` → `/fi-admin/{tenant}/workforce-os/staff/{id}`.  
There is **no** `/hr-os/staff/[staffId]` page.

### Changing manage roles

Edit `staffStandardHoursManageGate.server.ts` and keep UI deny copy via `resolveRosterManageDeniedMessage`. Do not pass empty strings from page.tsx.

---

## Related docs

| Doc | Topic |
|-----|--------|
| [FINOS_WORKFORCE_ENV_CHECKLIST.md](./FINOS_WORKFORCE_ENV_CHECKLIST.md) | Env / cron secrets (HR sync, workforce compliance) — no values |
| Workforce eligibility tests | `src/lib/workforce-os/rosterEligibleStaff.test.ts` |
| Manual adjustments tests | `src/lib/workforce-os/rosterManualAdjustments.test.ts` |

---

## Changelog entries (this document)

### 2026-07-10 — Calendar reliability + cleanup

- Restored add/cancel/mark-away from the roster calendar for sick and personal days.  
- Timezone-safe create/match; datetime-local normalisation.  
- Grid-adjacent action errors + staff profile link fix.  
- Removed dead `RosterAvailabilityPanel`; centralised deny + day-away helpers to prevent dual-path regressions.  
- Commits: `1565b010`, `0362a28a` (plus earlier `0f6d6df2`, `ef91421b`).

### 2026-07-10 — Drawer open “does nothing” (env not required)

**Not an `.env.local` issue.** Roster mutations use session auth + role/capability, not a feature flag env var.

**Root cause (UI):** `RosterRightDrawer` used chrome-offset CSS vars on a `document.body` portal. Measured shell offsets could collapse the overlay height to ~0px so clicks set drawer state but nothing was visible.

**Fixes:**

- Full-viewport portal only (`fixed inset-0 z-[400]`, explicit panel height).  
- Always open the drawer on grid cell/shift click (permission shown inside drawer + banner).  
- Clear “view-only” vs “editing enabled” banner so operators know if the account can mutate.  

**Env:** none required for Add shift. Need Supabase session + manage permission (`roster.manage` capability, HR-OS role, or clinic/ops tenant admin).

### 2026-07-10 — Quick cancel + full-period mark away

| Feature | How |
|---------|-----|
| **One-click cancel on chip** | `×` on each scheduled/confirmed shift → modal with reason (`ROSTER_QUICK_CANCEL_REASONS`) → `cancelRosterShiftAction` |
| **Mark week/fortnight away** | Staff column: **Sick / Personal / Away** → confirm → one leave block spanning displayed `weekDayDates` + cancel all that staff’s shifts in period |

**Helpers:** `collectCancellableStaffShiftsInPeriod`, `buildRosterPeriodAbsenceLocalWindow`, `ROSTER_QUICK_CANCEL_REASONS`.  
**Grid props:** `onQuickCancelShift`, `onMarkPeriodAway`, `periodLabel`.

---

**End of log.** When you ship further roster UX, append a dated section here and a row under **Recent commits**.
