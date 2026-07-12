# FI-UX-REBUILD-1 — S3.3: Front Desk Today UI Composition Plan

**Date:** 2026-07-11
**Status:** Ticket-ready plan (read-only audit; no code changed)
**Depends on:** S3.2 Canonical Front Desk Today Presentation (in flight — Cursor; builder + types already scaffolded at `src/lib/fiOs/frontDesk/frontDeskTodayPresentation.ts` / `.types.ts`), S3 plan, S2 language pass (landed).
**Objective:** Design the thinnest React implementation of `FrontDeskTodayBoard`, consuming **only** `FrontDeskTodayPresentation`. No child component may read, merge, dedupe, or derive business state from the raw reception command-centre payload. One receptionist workflow replaces the competing Front Desk day surfaces, reusing stable presentational primitives.

> **Contract binding.** This plan targets the in-flight S3.2 type surface: `FrontDeskTodayPresentation { generatedAt, operationalDay, loadTier, lanes[], exceptionCards{cancelled,noShow}, attentionItems[], attentionSummary{total,visible,hidden}, summary, actions[] }`, with `FrontDeskTodayCard`, `FrontDeskTodayLane`, `FrontDeskAttentionItem`, `FrontDeskCardActionId`, `FrontDeskMutationMode`. If S3.2 field names shift before merge, only the adapter and prop typings change — the component tree is stable.

---

## 1. Existing component inventory

| Component | Current purpose | Reusable as-is | Reusable with wrapper | Replace | Risk |
|---|---|---:|---:|---:|---|
| `ReceptionBoardCommandCenter` (`reception-board/`) | Full "cockpit": schedule, queue, metrics, alerts, tomorrow, live feed | No | No | **Yes** | Reads raw payload; embeds derivation + "FI OS · Reception Board / cockpit" language (S2 violation) |
| `ReceptionPatientFlowBoard` (`reception/`) | Lane board + flow-action buttons | No | Pattern only | **Yes** | Calls `buildReceptionFlowBoardItems` (its own lane derivation) — **hidden business logic** |
| `ReceptionBoardDashboard` (`reception/`) | Snapshot cards, priorities, flow board, handoff | No | No | **Yes** | Built entirely on `receptionBoardPresentation` derivation builders |
| `ReceptionOsDashboard` (`reception-os/`) | ReceptionOS command-centre widgets + pilot/demo | No | No | **Leave** (admin surface) | Out of scope; not consumed by Today |
| `ClinicOsOperationsCentre` (`operations/`) | Manager ops dashboard | No | No | **Leave** | Out of scope |
| `FrontDeskSubNav` (`fi-os/front-desk/`) | Hub tab pills | Yes (S3 shrinks to Today/Tomorrow) | — | Keep | Tab set changes in S3 nav commit, not here |
| **Lane containers** (inline `<section>` in flow board / command center) | Column shells | No | Extract into `FrontDeskLane` | Replace | Currently coupled to derived lane items |
| **Patient cards** (`AppointmentHeroCard`, `ReceptionFlowPatientCard`) | Booking cards | No | No | **Replace** with `FrontDeskPatientCard` | `AppointmentHeroCard` calls `deriveReceptionAppointmentPriority/NextAction` — **hidden derivation** |
| **Flow-action buttons** (inline in flow board / queue) | Advance patient | Pattern only | Wrap in `FrontDeskFlowActionButton` | Replace | Reuse the mutation-runner shape (`run(id, fn)`), not the component |
| **Status chips** (`statusBadgeClass`, `STAFF_UX_PRIORITY_STYLES`) | Colour by status/priority | Style tokens only | Re-map from `operationalState`/`severity` | Replace mapping | `deriveReceptionAppointmentPriority` is derivation — do not reuse; keep only the class tokens |
| **Alert lists** (Action alerts panel + `humanizeReceptionActionAlert`) | Blocker list | No | No | **Replace** with `FrontDeskAttentionPanel` | `humanizeReceptionActionAlert` re-derives titles from `kind`/`href` — presentation now owns copy |
| **Quick-action buttons** (`quickActions` grid) | Global links | Pattern only | Re-source from `presentation.actions` | Replace source | Current `quickActions` point at legacy routes / *OS copy |
| **Loading skeletons** (`ReceptionBoardSkeleton`) | First-paint skeleton | With trim | `FrontDeskTodaySkeleton` | Adapt | Sized to old 12-col cockpit; simplify to lanes |
| **Polling hooks** (`useReceptionBoardRefresh`) | 30s poll of `/reception-board` | **Yes** | — | Keep | Parses raw payload — must stay in the adapter only |
| **Mutation error handling** (`run()` + `useCalendarToast`) | Toast + refresh | Pattern + toast | `useFrontDeskFlowAction` | Adapt | Reuse toast + `router.refresh()` + `void refresh()` sequence |
| **Permission banners** (mutationMode notices in `ReceptionBoardDashboard`) | PIN / read-only copy | Copy + pattern | `FrontDeskSessionBanner` | Adapt | Keep the PIN/none messaging; re-home |
| **Empty states** (`FiOsEmptyState`) | Empty CTA block | **Yes** | — | Keep | Fully presentational |
| **Mobile/tablet wrappers** (inline `overflow-x-auto`, `flex min-w-max`) | Horizontal scroll | No | New responsive lane board | Replace | Nested horizontal scroll today; must be fixed (§10) |
| Shared: `DashboardCard`, `SectionHeader`, `StatCard`, `InfoNotice` (`dashboard-ui`) | Cards/headers/tiles | **Yes** | — | Keep | Neutral primitives |
| `ClinicOsGlobalSearch` (`search/`) | Patient search modal (`?q=`) | **Yes** | — | Keep (or link) | Already routes to `/patients?q=` |
| `receptionBoardTransitionPatient` → `receptionBoardFlowAction` | Flow mutation | **Yes** | — | Keep | The only mutation path; do not replace |
| `receptionBoardFlowActionLabel` / `RECEPTION_BOARD_FLOW_ACTION_LABELS` | Button labels | **Yes** | — | Keep | S2-safe labels |

**Components with hidden business derivation — must NOT be reused directly:** `ReceptionPatientFlowBoard` (`buildReceptionFlowBoardItems`), `AppointmentHeroCard` + `deriveReceptionAppointmentPriority`/`deriveReceptionAppointmentNextAction`, `humanizeReceptionActionAlert`, `ReceptionBoardDashboard` (`buildReceptionSnapshotCards`/`buildReceptionPriorities`/…), and the command-centre queue mapping. In S3.3 all of that logic already lives in the S3.2 builder; re-invoking it in the UI would create a second, divergent derivation path — exactly what S3.2 exists to prevent.

---

## 2. Proposed component tree

```text
FrontDeskTodayBoard                 (client adapter — the ONLY raw-payload holder)
├── FrontDeskTodayHeader            (client presentational)
├── FrontDeskSessionBanner          (client presentational)
├── FrontDeskTodaySummary           (client presentational)
├── FrontDeskAttentionPanel         (client presentational; emits onLocateCard)
├── FrontDeskLaneBoard              (client presentational)
│   ├── FrontDeskLane               (client presentational)
│   │   └── FrontDeskPatientCard    (client presentational; emits onAction)
│   └── FrontDeskTerminalSection    (client presentational; collapsed exceptions)
└── FrontDeskTodayActions           (client presentational; global links + search trigger)
```

| Component | Props (from presentation) | Responsibility | Server/Client | May invoke actions | Owns local UI state | May read raw payload |
|---|---|---|---|---|---|---|
| `FrontDeskTodayBoard` | `initialData: ReceptionBoardCommandCenterPayload`, `mutationMode`, `tenantId` (server props) | Hold polling + clock; run `buildFrontDeskTodayPresentation`; own the flow-action runner; pass presentation slices down | **Client** | **Yes** (owns runner) | Yes (`nowMs`, `busyBookingId`, `searchOpen`, expansion) | **Yes (only here)** |
| `FrontDeskTodayHeader` | `tenantName`, `operationalDay`, `loadTier`, `isRefreshing`, `lastRefreshedAt`, `onRefresh` | Title, date, live/updating indicator, manual refresh | Client | No | No | No |
| `FrontDeskSessionBanner` | `mutationMode` | PIN / read-only messaging | Client | No | No | No |
| `FrontDeskTodaySummary` | `summary: FrontDeskTodaySummary` | Count tiles (arriving, late, waiting, in consult/treatment, payment, blockers) | Client | No | No | No |
| `FrontDeskAttentionPanel` | `items: FrontDeskAttentionItem[]`, `attentionSummary`, `onLocateCard(bookingId)` | Blocker/action/info rows, `+N more`, locate keyed card | Client | No | Yes (expanded) | No |
| `FrontDeskLaneBoard` | `lanes: FrontDeskTodayLane[]`, `renderCard` | Layout of lanes (scroll/stack); order as given | Client | No | No | No |
| `FrontDeskLane` | `lane: FrontDeskTodayLane`, `renderCard`, `defaultCollapsed` | One lane: header, count, collapse, internal reveal | Client | No | Yes (collapsed/reveal) | No |
| `FrontDeskPatientCard` | `card: FrontDeskTodayCard`, `busy`, `onAction(action, bookingId)` | Render one booking + primary/overflow actions; `id` anchor for locate | Client | No (delegates via `onAction`) | Yes (overflow open) | No |
| `FrontDeskTerminalSection` | `exceptionCards`, `renderCard` | Collapsed cancelled/no-show | Client | No | Yes (collapsed) | No |
| `FrontDeskTodayActions` | `actions: FrontDeskTodayGlobalAction[]`, `onFindPatient` | Global Take payment / New booking / Calendar / Find patient | Client | No | No | No |

Only `FrontDeskTodayBoard` knows about polling and the raw payload. Every child receives typed slices of `FrontDeskTodayPresentation` (or plain callbacks) and is trivially fixture-testable.

---

## 3. Server/client boundary

| Concern | Where | How |
|---|---|---|
| Server-rendered shell | `front-desk/page.tsx` (SSR, unchanged route in S3.3) | Loads **shell-tier** raw payload via `loadReceptionBoardCommandCenterPayload(tid, now, { tier: "shell" })` + resolves `mutationMode` from `getClinicFloorSessionIfAllowed`; passes both as props to `FrontDeskTodayBoard`. No presentation types cross the server boundary as data — the client builds them. |
| `FrontDeskTodayBoard` component type | **Client** (`"use client"`) | It needs `nowMs`, polling, and action handlers. |
| Presentation builder on SSR first paint | Runs **client-side on mount** with `nowMs = Date.parse(initialData.loadedAt)` (the server clock already in the payload) | Using `loadedAt` for the very first render keeps SSR and first client render identical → **no hydration mismatch** on time-relative lanes. |
| Rerun after polling | In the adapter's `useMemo([rawData, nowMs, mutationMode])` | `useReceptionBoardRefresh` updates `rawData`; the memo re-derives the presentation. Single source. |
| Short clock tick (arriving-soon / running-late) | `setInterval` in the adapter updating `nowMs` every 30s (aligned to poll cadence); after mount switch from `loadedAt` to `Date.now()` | Re-derivation is a cheap pure `useMemo`; a 30s tick is ample given `RUNNING_LATE_GRACE = 0` and `ARRIVING_SOON_WINDOW = 60 min`. **Never per-second.** |
| Avoiding two polling loops | Reuse **only** `useReceptionBoardRefresh` | The clock tick is a lightweight `setInterval` over `nowMs` — **not** a data fetch. No second hook. |
| Mutation → refresh | Adapter runner: `receptionBoardTransitionPatient(...)` → on `ok`: `toast.success` + `router.refresh()` + `void refresh()` | Server-confirmed; no optimistic mutation in the MVP so an error simply leaves the card in its server lane (satisfies scenario 17). |
| Stale shell distinction during hydration | `loadTier === "shell"` and/or `isRefreshing` | Header shows "Updating…"; payment/blocker slots render `—` placeholders (not spinners); attention panel shows a subtle "loading enrichment" line until `loadTier === "full"`. |

---

## 4. Lane design

Render `presentation.lanes` **in the order the builder provides** (the S3.2 lane id order: `running_late → arriving_soon → waiting → in_consultation → in_treatment → completed`). The board must not re-sort or re-bucket — S3.1/S3.2 own that.

| Lane | Treatment | Default | Empty behaviour |
|---|---|---|---|
| Running late | Red accent, first, always expanded, count prominent | Expanded | Hidden when empty (no reason to show an empty urgent lane) |
| Waiting | Amber accent | Expanded | Hidden when empty |
| Arriving soon | Neutral/cyan | Expanded | Hidden when empty |
| In consultation | Cyan | Expanded | Hidden when empty |
| In treatment | Cyan | Expanded | Hidden when empty |
| Completed | Muted, `collapsedByDefault: true` (from contract) | Collapsed (header + count, expandable) | Hidden when empty |
| Cancelled / No-show | `FrontDeskTerminalSection`, muted, below lanes | Collapsed exception drawer | Hidden when both empty |

Specifics:

- **Lane order:** as provided by `presentation.lanes`; the recommended visual order matches the contract array. Urgent lanes (running late, waiting) lead.
- **Expanded/collapsed:** honour each lane's `collapsedByDefault`. Active lanes expanded; completed collapsed; terminal exceptions collapsed.
- **Empty lanes:** omit entirely (render nothing) rather than showing an empty column — keeps the board scannable. The summary tiles still convey zero counts.
- **Scroll vs stack:** **stack vertically** as full-width rows on tablet/phone; on wide desktop optionally lay active lanes as columns. Do **not** reproduce the current nested horizontal scroll (§10). If columns are used ≥`xl`, the whole board scrolls as one, never a lane-within-lane scroll.
- **Max visible cards before reveal:** cap each lane at ~8 visible with a "Show all (N)" internal reveal, so one busy lane can't push urgent lanes off-screen.
- **Urgent lanes on tablet:** running-late and waiting render first and stay above the fold; completed/terminal sit at the bottom, collapsed.
- **Completed accessible, not dominant:** collapsed lane with count; expand on demand. Terminal (cancelled/no-show) lives in a separate collapsed exception drawer so it never competes with active flow.

---

## 5. Patient card design

`FrontDeskPatientCard` renders only from `FrontDeskTodayCard`. Minimum visible content:

- **Patient name** (`patient.displayName`) — links to `links.patient` when present.
- **Appointment time** (`appointment.startTimeLabel`) + optional `durationMinutes`.
- **Appointment type** (`appointment.typeLabel`).
- **Clinician / resource** (`resource.clinicianLabel`, `resource.roomLabel` when set).
- **Operational state** — one chip from `operationalState` (S2 label; colour by state, plus a non-colour cue for running late).
- **Payment indicator** — `payment.label`, styled by `payment.state` (`due`/`overdue`/`paid`/`not_required`/`unknown`); `unknown` renders muted `—` during shell tier.
- **Strongest blocker** — `blocker.summary` with `blocker.highest` severity styling; shown only when present.
- **Secondary blocker count** — "+N more" from `blocker.items.length - 1` when > 1; expands inline.
- **Permitted primary action** — first applicable of `card.allowedActions` by the state hierarchy below.
- **Overflow actions** — remaining `allowedActions` in a menu (patient, calendar, no-show, cancel where allowed).
- **Patient link** (`links.patient`) and **calendar link** (`links.appointment` / `links.calendar`).

**Must NOT appear by default:** raw technical statuses (`booking_status`, `receptionColumn`, queue column ids); long clinical detail; full alert history (only strongest + count); analytics/utilisation/revenue; duplicated payment or readiness panels; system diagnostics; journey pipeline visualisations; "OS"/cockpit language.

**Primary-action hierarchy by operational state** (choose the first present in `allowedActions`; server still authoritative):

| State | Primary action | Fallback |
|---|---|---|
| `arriving_soon` / `expected` | `check_in` | `open_patient` |
| `running_late` | `check_in` (urgent styling) | `open_patient` |
| `waiting` | `start_consultation` | `start_treatment` |
| `in_consultation` | `start_treatment` | `complete` |
| `in_treatment` | `complete` | `open_patient` |
| `completed` | `open_patient` | `open_calendar` |
| any with `payment.state ∈ {due, overdue}` | surface `take_payment` as a secondary chip (not replacing the flow primary) | — |

The card never computes which action is "next" from status — it consumes `allowedActions` and applies this display ordering only.

---

## 6. Action wiring

All flow mutations go through the **existing** `receptionBoardTransitionPatient` → `receptionBoardFlowAction`. No new mutations.

| UI action | Existing handler / action | Optimistic? | Refresh behaviour | Error treatment |
|---|---|---|---|---|
| Check in | `receptionBoardTransitionPatient(tid, bookingId, { action: "mark_arrived" })` | No (MVP) | `router.refresh()` + `void refresh()` | Toast error; card stays in server lane |
| Start consultation | `…{ action: "start_consultation" }` | No | same | same |
| Start treatment | `…{ action: "start_treatment" }` | No | same | same |
| Complete | `…{ action: "complete" }` | No | same | same |
| No-show | `…{ action: "mark_no_show" }` | No | same | same |
| Cancel | `…{ action: "cancel" }` | No | same | Full-session only; hidden otherwise |
| Take payment | Navigation → `actions[take_payment].href` (Payments) | — | — | Link (no mutation) |
| Open patient | Navigation → `card.links.patient` | — | — | Link |
| Open booking / calendar | Navigation → `card.links.appointment` / `.calendar` | — | — | Link |
| New booking | Navigation → `actions[new_booking].href` (Calendar) | — | — | Link |
| Find patient | Opens `ClinicOsGlobalSearch` or navigates `/patients?q=` | — | — | Link/modal |

The adapter's runner mirrors the proven pattern: set `busyBookingId`, await the action, on `!ok` `toast.error(result.error)`, on `ok` `toast.success` + refresh, always clear busy. Buttons disable while `busyBookingId === card.bookingId`.

**Session visual differences** (driven by `mutationMode` prop; per-card options already reflected in `allowedActions`):

- **Full:** all actions incl. Cancel.
- **PIN (`pin_reception`):** flow actions shown; **Cancel absent** (never in `allowedActions`); `FrontDeskSessionBanner` explains PIN scope.
- **Read-only (`none`):** no mutation buttons at all; cards show links only; banner invites clinic sign-in.

---

## 7. Attention panel UX

`FrontDeskAttentionPanel` consumes `attentionItems` (already sorted + capped by the builder) and `attentionSummary`.

- **Severity presentation:** `blocker` (red, top), `action_needed` (amber), `information` (neutral). Non-colour cue (icon/label) per level.
- **Max visible rows:** the builder already caps `visible` (target 12); the panel renders exactly `attentionItems` and shows **"+N more"** from `attentionSummary.hidden`. "+N more" expands inline (or links to a filtered view later) — it never silently hides.
- **Click behaviour:** an item with a `bookingId` calls `onLocateCard(bookingId)` → the board scrolls to and briefly highlights `FrontDeskPatientCard[data-booking-id]` (focus ring, `aria-live` note). Items with only `href` (panel-only) open the link.
- **Panel-only alerts:** `bookingId == null && patientId == null` → rendered as normal rows, actionable via `href`; they never create cards.
- **Deduplication:** trusted from the builder (`(bookingId ?? patientId, kind)`); the panel does no dedup.
- **Card badge vs panel row:** if an issue is already a per-card badge (e.g. `payment due`), the builder decides whether it also warrants a panel row; the panel just renders what it's given. The UI must not add its own alerts.
- **Not-a-dashboard guard:** fixed small height with internal scroll, no metrics, no charts, no per-kind expansions beyond blocker detail. It is a triage list, not a reporting surface.

---

## 8. Search and payment entry points

### Find patient — one entry point

- **Route/query:** `/fi-admin/${tenantId}/patients?q=${encodeURIComponent(term)}` (the patients route parses `sp.q` via `parsePatientDirectoryQuery`; `ClinicOsGlobalSearch` already builds this exact `q=` contract).
- **Type-ahead vs submit:** reuse `ClinicOsGlobalSearch` (debounced type-ahead modal) triggered from `FrontDeskTodayActions` and the header. A plain submit that routes to `/patients?q=` is an acceptable lighter fallback, but the modal already exists and is S2-clean.
- **Tablet keyboard:** open modal focuses the input (on-screen keyboard appears); `enterkeyhint="search"`; Escape/backdrop closes and returns focus to the trigger.
- **Recent patients:** unnecessary for S3.3 — adds state and payload with little day-of value. Omit.

### Take payment — one link target

- **Single target:** `/fi-admin/${tenantId}/payments` (Payments inbox) — the one approved Front Desk payment door for S3 (Money consolidation is S5; do not redesign here).
- **Placement:** **both** — a **global** action in `FrontDeskTodayActions` and a **card-level** secondary chip on cards with `payment.state ∈ {due, overdue}`. Both point at the same route (card-level may append `?patientId=` when available for context, not a new API).
- **Feature-flagged:** gated by `FI_PAYMENTS_ENABLED` — the builder should omit the `take_payment` action when payments are disabled; the UI simply renders whatever `actions`/`allowedActions` contain.
- **Permission-gated:** visible to all Front Desk sessions as navigation (recording is gated downstream); not restricted by `mutationMode`.

---

## 9. Loading, empty and error states

| State | Treatment |
|---|---|
| Shell-tier loading (SSR first paint) | `FrontDeskTodaySkeleton` only before hydration; once `initialData` (shell) is present, render **real lanes** immediately with payment/blocker as `—` placeholders |
| Full-tier hydration | Payment badges, blocker summaries, and attention panel fill in when `loadTier` flips to `full`; a subtle "loading details" line on the attention panel until then |
| Polling refresh | Header shows "Updating…" / spinner on the refresh control; board stays interactive; **no full-screen spinner after first paint** |
| Empty operational day | `FiOsEmptyState` inside the lane board ("No patients booked today") **plus** persistent `FrontDeskTodayActions` (Find patient, Open calendar, New booking) — never a dead end |
| Partial enrichment failure | Board still shows lanes from shell data; a non-blocking notice ("Some details couldn't load — retrying") from `refreshError`; payment/blocker stay `—` |
| Mutation in progress | Target card action shows busy/disabled; rest of board stays usable |
| Mutation failure | `toast.error(result.error)`; card remains in its server-confirmed lane (no optimistic rollback needed) |
| Lost connection | `useReceptionBoardRefresh` `refreshError` surfaces a quiet banner; last good board remains visible; auto-recovers on next poll |
| Read-only access | `FrontDeskSessionBanner` (none mode); cards render links only |
| PIN restrictions | `FrontDeskSessionBanner` (PIN scope); Cancel absent |

---

## 10. Tablet and mobile behaviour

Audit of current surfaces: `ReceptionBoardCommandCenter` uses `overflow-x-auto` + `flex min-w-max` queues **inside** a vertically scrolling page — nested horizontal scroll, and metric tiles + 12-col grid crowd a 768px tablet. S3.3 fixes this.

Recommendations (clinic tablet 768×1024, no browser zoom):

- **Lane stacking vs scrolling:** **stack lanes vertically** as full-width rows at `< xl`; optional column layout only at `≥ xl` (desktop). Never nested horizontal scroll.
- **Card minimum width:** cards are full-width within a stacked lane (no fixed `min-w` forcing overflow); at column layout, lane min-width ~18rem with the whole board scrolling as one unit.
- **Touch targets:** primary action buttons ≥ 44×44px; overflow menu trigger ≥ 44px; generous card padding.
- **Sticky header/sub-nav:** `FrontDeskTodayHeader` + Today/Tomorrow sub-nav sticky at top so date, refresh, and Find patient stay reachable while scrolling lanes.
- **Attention panel placement:** above lanes on tablet/phone (triage first); a side rail only at `≥ xl`.
- **Primary action visibility:** the per-card primary action is always visible (not hidden behind overflow); only secondary/rare actions collapse into overflow.
- **Overflow menus:** simple popover with large touch rows; closes on select/outside tap; keyboard accessible.
- **No nested horizontal scroll:** enforce `max-w-full` on the board; only opt-in column mode introduces a single board-level scroll.
- **Phone fallback:** same stacked layout; summary tiles wrap 2-up; attention panel and lanes are single column.

---

## 11. Accessibility

- **Lane headings:** each `FrontDeskLane` header is an `<h2>`/`<h3>` with an `id`; lane `<section aria-labelledby>` references it; count announced in the accessible name ("Running late, 3 patients").
- **Live status changes:** an `aria-live="polite"` region announces poll-driven and mutation-driven changes ("Ada Lovelace checked in — moved to Waiting"); throttle to avoid spam.
- **Mutation feedback:** toast text mirrored to the live region; busy buttons set `aria-busy`.
- **Focus return after actions:** after a flow action completes and the board refreshes, return focus to the moved card (by `data-booking-id`) or its lane heading, not to the document top.
- **Keyboard operation:** all actions are real `<button>`/`<a>`; overflow menu arrow-key navigable; attention "+N more" and lane collapse are buttons with `aria-expanded`.
- **Screen-reader labels:** action buttons use full S2 labels ("Check in patient", not an icon alone); payment/blocker chips have text, not colour-only meaning.
- **Non-colour severity cues:** blocker/action/info and running-late carry an icon and/or text label in addition to colour.
- **Collapsed terminal sections:** `FrontDeskTerminalSection` and completed lane use `aria-expanded` toggles with counts in the label ("Cancelled and no-show, 2, collapsed").
- **Touch/keyboard parity:** every touch action is keyboard-reachable and vice versa; focus-visible rings preserved.
- **S2 terminology in a11y labels:** accessible names use the approved terms (Front desk, Today, Check in, Waiting, Running late) — never "reception board", "cockpit", "OS", or queue-column ids.

---

## 12. Analytics and telemetry

Operational-only signals to validate S3 (no business KPIs, no owner-value, no CRM/metrics widgets on Front Desk):

- **Today first meaningful render** — timestamp when shell lanes first paint.
- **Shell→full hydration duration** — `loadTier` shell→full elapsed.
- **Polling failure** — count/rate of `refreshError`.
- **Mutation success/failure** — per flow action kind (reuse existing toast/log seam, e.g. the `useStaffUat`/`logFriction` pattern or a light event).
- **Duplicate-card invariant violation** — dev/QA assertion: unique `bookingId` across all lanes + exceptions; log if violated (guards the S3.2 contract).
- **Hidden attention count** — emit `attentionSummary.hidden` when > 0 (are we over-capping?).
- **Legacy route usage after redirects** — hits on `/reception`, `/reception-board`, `/operations`, `/tomorrow` post-S3 (owned by the redirect commit, surfaced here for completeness).

Explicitly **not** added: utilisation, conversion, revenue, pilot metrics, owner value, module health, diagnostics.

---

## 13. Acceptance scenarios

1. **Shell-first render** — Given a shell-tier payload, Today renders lanes, counts, and cards with payment/blocker as `—` before enrichment.
2. **Full hydration, no duplication** — When `loadTier` flips to `full`, payment and blocker states populate and card count per `bookingId` is unchanged (no new cards).
3. **Running-late crossing** — With a fixed then-advanced `nowMs` past `startAt + grace`, an expected card moves into the Running late lane on the next clock tick.
4. **Check-in** — Clicking Check in on an arriving/late card moves it into Waiting after refresh.
5. **Start consultation** — Clicking the waiting card's primary action moves it into In consultation.
6. **PIN hides Cancel** — In `pin_reception`, no card exposes Cancel; banner shows PIN scope.
7. **Read-only** — In `none`, no mutation buttons render anywhere; links still work.
8. **Payment route** — Take payment (global and card chip) navigates to `/patients`… → **`/fi-admin/{tid}/payments`** only.
9. **Patient search** — Find patient routes to `/fi-admin/{tid}/patients?q=<term>`.
10. **Attention cap** — With 20 issues, panel shows 12 rows and "+8 more" matching `attentionSummary.hidden`.
11. **Locate from panel** — Clicking a keyed attention item scrolls to and highlights the matching card.
12. **Panel-only alerts** — An item with null `bookingId`/`patientId` renders and is actionable via `href`, creating no card.
13. **Completed collapsed** — Completed lane is collapsed by default and expandable.
14. **Terminal tidy** — Cancelled/no-show live only in the collapsed exception section, absent from active lanes.
15. **Empty day** — Empty state still exposes Find patient, Open calendar, and New booking.
16. **Poll preserves expansion** — A background poll refresh keeps user-expanded lanes/overflow open where appropriate.
17. **Mutation error** — On action failure, the card stays in its server-confirmed lane and a toast explains the error.
18. **No page overflow (tablet)** — At 768×1024 there is no page-level horizontal scroll and no nested horizontal lane scroll.
19. **Keyboard + SR complete** — Full keyboard operation; lane/card/action labels and live updates announced.
20. **No technical language** — No "OS", "command centre", "cockpit", "reception board", or queue-column ids appear in visible or accessible text.

---

## 14. File-level implementation plan

**Add (all under `src/components/fi-os/front-desk/`, all `"use client"` presentational except where noted):**

- `FrontDeskTodayBoard.tsx` (adapter; polling + clock + runner; only raw-payload holder)
- `FrontDeskTodayHeader.tsx`, `FrontDeskSessionBanner.tsx`, `FrontDeskTodaySummary.tsx`
- `FrontDeskAttentionPanel.tsx`
- `FrontDeskLaneBoard.tsx`, `FrontDeskLane.tsx`, `FrontDeskPatientCard.tsx`, `FrontDeskTerminalSection.tsx`
- `FrontDeskTodayActions.tsx`
- `FrontDeskTodaySkeleton.tsx`
- `useFrontDeskFlowAction.ts` (thin runner wrapping `receptionBoardTransitionPatient` + toast + refresh)

**Reuse (import, do not fork):** `useReceptionBoardRefresh`; `receptionBoardTransitionPatient` / `receptionBoardFlowAction`; `receptionBoardFlowActionLabel`; `FiOsEmptyState`; `DashboardCard`, `SectionHeader`, `StatCard`, `InfoNotice`; `ClinicOsGlobalSearch`; `useCalendarToast` + `CalendarToastProvider`; the S3.2 builder `buildFrontDeskTodayPresentation` and its types.

**Reuse style tokens only (not their derivation):** colour class maps analogous to `STAFF_UX_PRIORITY_STYLES` / `statusBadgeClass`, re-keyed off `operationalState` / `FrontDeskSeverity`.

**Retire later (S3.4+, not now):** `ReceptionBoardCommandCenter`, `AppointmentHeroCard`, `ReceptionPatientFlowBoard` staff usage, `ReceptionBoardDashboard`, `ReceptionBoardSkeleton` (replaced by `FrontDeskTodaySkeleton`), and staff use of `deriveReceptionAppointment*` / `humanizeReceptionActionAlert`.

**Tests to add:** fixture tests per presentational component (lanes, card, attention panel, terminal section, summary, actions) using synthetic `FrontDeskTodayPresentation`; an adapter test for shell→full transition, clock-tick lane movement, and the flow-action runner (mocked action); the duplicate-`bookingId` invariant assertion; a tablet/overflow layout check in `e2e/fi-ux-tablet-layout.spec.ts` (extend); a11y checks (roles, `aria-expanded`, live region).

**Must NOT be modified (Cursor / contract / route):** `src/lib/fiOs/frontDesk/frontDeskTodayPresentation.ts` and `.types.ts`; `src/lib/fiOs/receptionBoardModel.ts` (+ test); `src/lib/receptionBoard/*` (server, core, types, schema); alert types; `receptionBoardFlowPolicy.ts`; navigation/route files; the S3.2 doc; Tomorrow board; ReceptionOS admin components. The `front-desk/page.tsx` route body changes only in **S3.4** (route switch), not in S3.3.

**Safe commit boundaries (stages):**

1. **Presentational components + fixture tests** — pure, no data; render from synthetic presentation. Green independently.
2. **Shell/full adapter + polling integration** — `FrontDeskTodayBoard` wires `useReceptionBoardRefresh` + clock + builder; still rendered on a scratch/preview harness, not the live route.
3. **Flow-action wiring** — `useFrontDeskFlowAction` + card actions against the existing mutation; PIN/read-only gating.
4. **Tablet + accessibility pass** — responsive lane board, sticky header, a11y labels/live region, overflow menus.
5. **Route switch — S3.4 (out of scope here):** point `front-desk/page.tsx` at `FrontDeskTodayBoard`, retire the old command-centre body, land redirects.

---

## Conclusion

**1. Recommended component tree**

```text
FrontDeskTodayBoard  (client adapter — sole raw-payload + polling + clock owner)
├── FrontDeskTodayHeader
├── FrontDeskSessionBanner
├── FrontDeskTodaySummary
├── FrontDeskAttentionPanel        → onLocateCard(bookingId)
├── FrontDeskLaneBoard
│   ├── FrontDeskLane  → FrontDeskPatientCard  (onAction → adapter runner)
│   └── FrontDeskTerminalSection   (collapsed cancelled/no-show)
└── FrontDeskTodayActions          (Take payment · New booking · Calendar · Find patient)
```

**2. Recommended server/client boundary**

SSR (`front-desk/page.tsx`) loads the **shell-tier raw payload** + `mutationMode` and passes them to the **client** `FrontDeskTodayBoard`. The board runs `buildFrontDeskTodayPresentation` in a `useMemo([rawData, nowMs, mutationMode])`, seeding `nowMs` from `loadedAt` for a hydration-safe first paint, then ticking `nowMs` every 30s and re-fetching via the single `useReceptionBoardRefresh` loop. Children receive only typed presentation slices; mutations run through the adapter and refresh via `router.refresh()` + `void refresh()`.

**3. Existing components safe to reuse**

`useReceptionBoardRefresh` (single poll loop), `receptionBoardTransitionPatient` / `receptionBoardFlowAction`, `receptionBoardFlowActionLabel`, `FiOsEmptyState`, `DashboardCard` / `SectionHeader` / `StatCard` / `InfoNotice`, `ClinicOsGlobalSearch` (`/patients?q=`), `useCalendarToast`, and the S3.2 builder + types. Colour tokens (not the derivation) from the existing style maps.

**4. Existing components that must NOT be reused (they derive business state)**

`ReceptionPatientFlowBoard` (`buildReceptionFlowBoardItems`), `AppointmentHeroCard` with `deriveReceptionAppointmentPriority` / `deriveReceptionAppointmentNextAction`, `humanizeReceptionActionAlert`, `ReceptionBoardDashboard` (`buildReceptionSnapshotCards` / `buildReceptionPriorities` / `buildReceptionReadinessBlockers` / …), and the `ReceptionBoardCommandCenter` queue/intelligence mapping. Re-invoking any of these would fork derivation away from the S3.2 builder.

**5. Highest-risk UI integration issue**

**Time-relative lane drift vs hydration + double-derivation.** `running_late` / `arriving_soon` depend on `nowMs`, but the payload is up to 30s stale and SSR must match first client render. If the board seeds `nowMs` with `Date.now()` at render it will hydration-mismatch and can double-derive (server payload state vs client clock), reopening the exact multi-model bug S3.2 closes. Mitigation is mandatory: seed `nowMs` from `payload.loadedAt` for the first render, switch to `Date.now()` only after mount, keep **all** derivation inside the single `buildFrontDeskTodayPresentation` memo, and never let a child recompute state from raw data.

**6. Minimum viable S3.3 implementation slice**

Stage 1 + a read-only Stage 2: `FrontDeskLaneBoard` + `FrontDeskLane` + `FrontDeskPatientCard` + `FrontDeskTodaySummary` + `FrontDeskAttentionPanel` + `FrontDeskTodayActions`, driven by a `FrontDeskTodayBoard` adapter that consumes an already-loaded payload, runs the S3.2 builder once, renders lanes/attention/summary, and exposes Find patient (`/patients?q=`) and Take payment (`/payments`) links — **no mutations, no polling yet**. This proves the one-model, one-workflow board end-to-end on real presentation data behind a preview harness; flow actions (Stage 3), live polling/clock, and the route switch (S3.4) layer on afterward without reshaping the tree.
