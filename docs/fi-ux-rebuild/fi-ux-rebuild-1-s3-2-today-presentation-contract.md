# FI-UX-REBUILD-1 — S3.2: Front Desk Today Presentation Contract

**Date:** 2026-07-11
**Status:** Ticket-ready design (read-only audit; no code changed)
**Depends on:** S3.1 Operational Status Foundation (in flight — Cursor, `src/lib/fiOs/receptionBoardModel.ts`), S3 plan (`fi-ux-rebuild-1-s3-front-desk-v2-plan.md`), S2 language pass (landed, commit `f3b09f56`)
**Objective:** Define the pure presentation layer that sits between `loadReceptionBoardCommandCenterPayload` and the future `FrontDeskTodayBoard`, producing **one deterministic, deduplicated operational model**. The UI must never interpret the raw command-centre payload directly.

> **S3.1 coupling note.** This contract consumes the S3.1 canonical states verbatim — `RECEPTION_OPERATIONAL_STATES`, `deriveReceptionOperationalState`, `isReceptionOperationalTerminalState`, `compareReceptionLaneItems`, `sortReceptionLaneItems`, `RECEPTION_ARRIVING_SOON_WINDOW_MINUTES`, `RECEPTION_RUNNING_LATE_GRACE_MINUTES`. It does **not** redefine any state logic. If S3.1's exported names shift before merge, only the imports in §11 change.

---

## 1. Raw payload inventory

Every section of `ReceptionBoardCommandCenterPayload` (`src/lib/receptionBoard/receptionBoardTypes.ts`), as produced by `loadReceptionBoardCommandCenterPayload` (full tier) / `loadReceptionBoardShellPayload` (shell tier) and validated by `receptionBoardPayloadSchema.ts` on client refresh.

| Payload field | Source loader | Entity key | Staff value | Duplicate risk | Keep for Today? |
|---|---|---|---|---|---|
| `tenantId`, `tenantName`, `loadedAt` | bootstrap / operational | tenant | Header, tenant-scope guard, `generatedAt` | — | **Yes** (metadata) |
| `operationalDay` | `computeOperationalLocalDayUtcWindow` | day window | Date header, tz for time labels, running-late math bounds | — | **Yes** |
| `receptionCards` | `loadReceptionBoardCards` (via operational dashboard) | **`id` = bookingId** | **Canonical booking rows** — the single source of truth for cards | Low (built once per booking) | **Yes — canonical source** |
| `appointments` | `buildAppointmentCard(receptionCards)` | `id` = bookingId | Alternate view of the same bookings; carries derived `paymentStatus`, `journeyState`, `confirmationStatus`, `hrefs` | **High** — same bookings as `receptionCards`/`queue` | **Merge-only** (read payment/journey by bookingId; never a second list) |
| `queue` | `buildQueueBoard(receptionCards)` | `bookingId` | Alternate lane view of the same bookings | **High** — same bookings again | **Drop** (S3.2 lanes come from S3.1 states, not this) |
| `actionAlerts` | OS alerts + surgery cards + journey blockers + calendar conflicts, `sortActionAlerts`, capped 40 | **none first-class** (bookingId/patientId only embedded in composite `id` / `href`) | Attention panel + card blocker badges | Medium (multiple alerts per booking/patient) | **Yes** (attention panel; card badge only via explicit key — see §2, §4) |
| `quickActions` | `buildQuickActions(base)` | none | Global desk actions | — | **Partly** (curate; several point at legacy `/reception-board#queue`, `/financial/dashboard`, `/surgery-booking` and *OS copy) |
| `tomorrowSurgeries` | `mapTomorrowSurgeryCard` | bookingId (tomorrow) | Tomorrow prep | — | **No** — belongs to Tomorrow view, not Today |
| `intelligence` | `buildIntelligenceMetrics` | none | Manager KPIs (utilisation, conversion, revenue) | — | **No** — metrics, not an operational day tool |
| `liveEvents` | `buildLiveActivityFeed` | mixed | Activity ticker | Medium (re-derives check-in/complete from cards) | **No** for S3.2 (optional later; not required for the day board) |
| `_surgerySource` | surgery readiness payload | — | Server-only; **stripped** by `serializeReceptionBoardCommandCenterPayload` | — | **No** (never on client) |
| `loadTier` | orchestrator | — | Tells UI whether payment/alerts are hydrated yet | — | **Yes** (drives skeleton vs full) |

**Section categorisation:**

- **Actual bookings:** `receptionCards` (canonical).
- **Alternate views of the same bookings:** `appointments`, `queue`, and each `actionAlerts` entry that is really a per-booking issue.
- **Alerts:** `actionAlerts`.
- **Payments:** carried on `appointments[].paymentStatus` / `paymentStatusLabel` (derived server-side from ReceptionOS `outstandingDeposits`, which is **not** itself in the client payload).
- **Journey blockers:** encoded into `actionAlerts` (ids `journey-<patientId>-<kind>`) and summarised on `appointments[].journeyState`.
- **Tomorrow data:** `tomorrowSurgeries`.
- **Metrics:** `intelligence`.
- **Diagnostics / admin-only intelligence:** none in this payload — they live in the separate ReceptionOS command-centre payload (`/api/…/reception-os`), which S3 already keeps off the staff surface. Reinforce: Front Desk Today polls **only** `/api/…/reception-board`.

---

## 2. Canonical entity key

**Primary deduplication key = `bookingId`** (`receptionCards[].id`, `appointments[].id`, `queue[*][].bookingId`, all `uuid`). One booking → at most one Today card.

Handling rules:

| Situation | Rule |
|---|---|
| **Row without a booking ID** | Impossible for `receptionCards` (schema `id: uuid`). Any alert/source lacking a bookingId is **not** turned into a card; it may only appear in the global attention panel. |
| **Multiple alerts on one booking** | Attach all to that booking's card blocker list keyed by bookingId; the card shows the **strongest** (§4/§6) and retains the rest as secondary. Panel dedupes by `(bookingId, kind)`. |
| **Patient-level alert spanning several bookings** | Attribute to `patientId` once. Show **one** entry in the attention panel (keyed by `(patientId, kind)`). It may badge each of that patient's cards but must never create a second patient row or duplicate the panel entry. |
| **Duplicate booking rows from ReceptionOS widgets** (`todaysPatients`, etc.) | ReceptionOS widget rows are **not** consumed as a patient list. Cards derive exclusively from `receptionCards`; ReceptionOS data reaches Today only as already-merged fields on `appointments` (payment) or as `actionAlerts`. |
| **Agenda rows representing an already-present booking** | The operational-dashboard agenda buckets are not consumed by the Today builder at all. Cards come only from `receptionCards`, so an agenda row cannot mint a duplicate. |
| **Surgery-readiness rows linked by case ID, not booking ID** | Surgery-readiness issues already carry `bookingId` in the source card (`SurgeryReadinessBoardCard.bookingId`) and in the composite alert id `surgery-issue-<bookingId>-<kind>`. Attribute by that bookingId when it matches a today booking; otherwise the item stays **panel-only** (it is a readiness signal, not a day-of card). Never attribute by caseId to a card. |

**Safe fallback (no new persistent identifiers).** The builder must not mint synthetic keys. Two tiers:

1. **Preferred:** attribute an alert to a card only when the alert exposes an explicit `bookingId` / `patientId`. Those ids already exist at the composition seam (`buildExtendedAlertsFromSurgeryCards` has `card.bookingId`; `buildCalendarSchedulingConflictAlerts` has `card.id`; journey alerts have `snap.patientId`). **Recommendation (additive, no migration, no new API):** surface them as optional `bookingId?: string \| null` / `patientId?: string \| null` on `ReceptionBoardActionAlert` at the seam. Coordinate the field addition with S3.1 since it touches the shared types; until it lands, use tier 2.
2. **Fallback:** if no explicit key is present, the alert is **panel-only** and is never string-parsed out of the composite `id` to fake attribution. Card-level blocker state then derives solely from entity-keyed data already on the canonical path (payment status from `appointments[bookingId]`, journey state, missing room/staff computable from the card itself).

---

## 3. Proposed presentation types

Pure, client-safe, small, explicit. No `server-only`, no React, no loader imports.

```ts
// src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types.ts
import type { ReceptionOperationalState } from "@/src/lib/fiOs/receptionBoardModel"; // S3.1

export type FrontDeskTodayLaneId =
  | "running_late"
  | "arriving_soon"
  | "waiting"
  | "in_consultation"
  | "in_treatment"
  | "completed";

export type FrontDeskSeverity = "blocker" | "action_needed" | "information";

export type FrontDeskPaymentState =
  | "paid" | "due" | "overdue" | "not_required" | "unknown";

export type FrontDeskCardActionId =
  | "check_in"          // mark_arrived
  | "start_consultation"
  | "start_treatment"
  | "complete"
  | "no_show"           // mark_no_show
  | "cancel"
  | "take_payment"      // navigation
  | "find_patient"      // navigation
  | "open_calendar";    // navigation

export type FrontDeskCardBlocker = {
  /** Stable within a card: `${severity}:${kind}:${sourceId}`. */
  id: string;
  kind: string;                 // e.g. "missing_deposit", "missing_consent", "staff_not_assigned"
  label: string;
  severity: FrontDeskSeverity;
  href: string | null;
};

export type FrontDeskTodayCard = {
  bookingId: string;                       // canonical dedup key
  patient: { displayName: string; patientId: string | null; leadId: string | null };
  appointment: {
    startAtIso: string;
    endAtIso: string;
    startTimeLabel: string;                // tz-formatted
    durationMinutes: number | null;
    typeLabel: string;                     // service / appointment type
  };
  resource: {
    clinicianLabel: string;
    roomLabel: string | null;
    clinicLabel: string | null;
  };
  operationalState: ReceptionOperationalState; // from S3.1 derive (single-valued)
  laneId: FrontDeskTodayLaneId;
  runningLate: boolean;                    // operationalState === "running_late"
  /** Minutes since arrival; null unless an arrival instant is recorded (see §caveat). */
  waitingMinutes: number | null;
  payment: { state: FrontDeskPaymentState; label: string };
  blocker: {
    highest: FrontDeskSeverity | null;     // strongest across merged sources
    summary: string | null;                // strongest blocker label
    items: FrontDeskCardBlocker[];         // all, strongest first (secondary retained)
  };
  contact: { hasEmail: boolean; hasPhone: boolean } | null; // null when unknown on Today tier
  allowedActions: FrontDeskCardActionId[]; // advisory; server re-checks every mutation
  links: { patient: string | null; appointment: string; calendar: string };
  /** Dev-only; omitted in production builds. */
  debug?: { bookingStatus: string; receptionColumn: string };
};

export type FrontDeskTodayLane = {
  id: FrontDeskTodayLaneId;
  label: string;
  cards: FrontDeskTodayCard[];
  count: number;
  /** True for the terminal/collapsed lane rendered behind a toggle. */
  collapsedByDefault: boolean;
};

export type FrontDeskAttentionItem = {
  id: string;                              // stable; dedupe key (bookingId|patientId, kind)
  kind: string;
  title: string;
  detail: string;
  severity: FrontDeskSeverity;
  href: string | null;
  bookingId: string | null;               // when attributable
  patientId: string | null;
};

export type FrontDeskTodaySummary = {
  total: number;
  arrivingSoon: number;
  runningLate: number;
  waiting: number;
  inConsultation: number;
  inTreatment: number;
  completed: number;
  cancelledOrNoShow: number;              // count only; collapsed out of lanes
  paymentAttention: number;               // cards with due|overdue
  blockers: number;                       // cards with a `blocker`-severity item
};

export type FrontDeskTodayGlobalAction = {
  id: "take_payment" | "find_patient" | "new_booking" | "open_calendar";
  label: string;
  href: string;
};

export type FrontDeskTodayPresentation = {
  generatedAt: string;                     // payload.loadedAt
  operationalDay: { calendarTimezone: string; todayYmd: string };
  loadTier: "shell" | "full";
  lanes: FrontDeskTodayLane[];
  attentionItems: FrontDeskAttentionItem[];
  summary: FrontDeskTodaySummary;
  actions: FrontDeskTodayGlobalAction[];
};
```

**`waitingMinutes` caveat.** The client payload carries no arrival timestamp (`receptionCards.metadata` may not include one). `waitingMinutes` must be `null` unless a real arrival instant is present; **never** derive it from `startAt` (start time ≠ arrival time). Treat it as forward-compatible: populated only if S3.1/metadata later exposes an arrival instant.

**Terminal cards** (`cancelled`, `no_show`) are excluded from `lanes` except an optional single collapsed lane; their count lives in `summary.cancelledOrNoShow`.

---

## 4. Deduplication rules

1. **One card per bookingId.** Build a `Map<bookingId, FrontDeskTodayCard>` from `receptionCards`. `appointments`, `queue`, and alerts only *enrich* existing entries — they never insert.
2. **Payment merge.** Read `appointments[bookingId].paymentStatus` / `paymentStatusLabel` and copy onto the card. If `loadTier === "shell"` (payment not yet derived) → `unknown`. One payment state per card; last-writer is deterministic because there is exactly one `appointments` row per bookingId.
3. **Blocker severity merge.** Collect all card-attributable blockers (payment overdue, journey blocker for that patient's booking, surgery-readiness issue with matching bookingId, missing room/staff). Map each source severity to the §6 scale. `blocker.highest` = max; `blocker.summary` = label of the highest (ties broken by a fixed `kind` priority order, then `kind` alphabetical for total determinism).
4. **Strongest blocker selection is deterministic.** Order: `blocker` > `action_needed` > `information`; within a level, use the existing `EXTENDED_ALERT_PRIORITY` ranking (reused, read-only) then `kind` ascending. No reliance on array order.
5. **Secondary blockers retained.** `blocker.items` keeps every merged blocker (strongest first) so the card can expand; only `summary`/`highest` collapse.
6. **Multiple alerts, one patient, no duplication.** Panel keyed by `(bookingId ?? patientId, kind)`; a patient with three bookings and one patient-level blocker yields one panel row and (optionally) a badge on each of their cards — never three panel rows.
7. **ReceptionOS widget rows cannot become a second list.** The builder ignores any ReceptionOS `todaysPatients`/pipeline arrays entirely; ReceptionOS influence arrives pre-merged (payment on `appointments`, issues as `actionAlerts`).
8. **Agenda buckets cannot become a second list.** The builder never reads operational-dashboard agenda arrays; cards are `receptionCards`-only, so agenda categorisation cannot duplicate a patient.
9. **Conflict resolution for operational state.** Exactly one state per booking comes from `deriveReceptionOperationalState` (S3.1 is single-valued), so lane membership is a clean partition — no card appears in two lanes, and no cross-lane dedup is required.

---

## 5. Attention-panel rules

Front Desk stays an **operational day tool**, not a general alerts dashboard. Placement of each signal:

| Signal | On card | Global panel | Both | Outside Front Desk |
|---|---|---|---|---|
| Payment due | ✓ (badge) | — | — | — |
| Deposit overdue | ✓ (badge) | ✓ (blocker) | **Both**, deduped by `(bookingId, kind)` | — |
| Missing consent (today booking) | ✓ | ✓ | Both if tied to a today booking | — |
| Missing pathology (today surgery) | ✓ | ✓ | Both | — |
| Abnormal bloods (today surgery) | — | ✓ (blocker) | — | Clinical review owns depth |
| No contact details | ✓ (badge, if `contact` known) | ✓ (action_needed) | Both | — |
| Calendar conflict (room/staff) | ✓ (missing room/staff on card) | ✓ | Both | Full re-scheduling lives in Calendar |
| Staffing issue (surgery unassigned) | ✓ if bookingId matches today | ✓ | Both | Roster owns resolution |
| Surgery-readiness blocker | only if bookingId is today | ✓ | Sometimes | Deep readiness lives in Surgery |
| System diagnostic | — | — | — | **Platform admin only** (gated `canViewDashboardSystemDiagnostics`) |
| Stale enquiry | — | — | — | **Pipeline** (S4) |
| Marketing / CRM task | — | — | — | **Pipeline** (S4) |
| No-follow-up-after-consultation | — | — | — | **Pipeline / Reports** (drop from Today panel) |

Rule of thumb: an item earns a **card badge** only if it is actionable *for this booking today*; it earns a **panel row** only if it is a day-of blocker reception can act on. Anything about pipeline, conversion, marketing, metrics, or system health is excluded from the Today model entirely.

---

## 6. Severity model

Three levels, reception-legible, distinct from the raw four-level system scale:

| Front Desk severity | Meaning | Maps from payload severities |
|---|---|---|
| `blocker` | Hard stop before clinical care today | `blocked`, `critical`; journey `critical`; surgery `high_risk` |
| `action_needed` | Should be resolved today, not a hard stop | `warning`; journey `warning` |
| `information` | Awareness only | `info` |

**Collapse rule.** A card with several merged issues shows a single severity = the maximum over its blocker items (`blocker` > `action_needed` > `information`). `summary` names the highest item. Panel items keep their own severity and sort by it. Do **not** surface the raw `info/warning/critical/blocked` scale in staff copy — translate at the builder boundary so reception sees one consistent 3-level model.

---

## 7. Sorting and lane output

Using S3.1 canonical states (each booking is exactly one state):

**Lane order (default; reception urgency, left→right):**

1. `running_late`
2. `waiting`
3. `arriving_soon`
4. `in_consultation`
5. `in_treatment`
6. `completed` (collapsed by default: header + count, expandable)

`cancelled` and `no_show` are **collapsed out** — count in `summary.cancelledOrNoShow`, reachable via an optional "Show cancelled / no-show (n)" toggle, never a default lane. (Final lane ordering is a design call; this is the definite default — do not re-derive the state logic behind it.)

**Running late** is its **own lane**, not also a badge inside `arriving_soon` — since state is single-valued, a booking is either `running_late` or `arriving_soon`, never both. A card may still carry a `runningLate: true` convenience flag equal to `operationalState === "running_late"`.

**Card order within each lane:** `compareReceptionLaneItems` (S3.1) → appointment start ascending, invalid/missing start sorts last, `bookingId` ascending as the stable tie-break. For `running_late`, earliest start = most overdue first, which this ordering already yields.

**Attention panel order:** severity descending (`blocker` → `action_needed` → `information`), then reuse `sortActionAlerts`/`EXTENDED_ALERT_PRIORITY` priority descending, then `id` ascending for stability. **Cap at 12** with a `+N more` affordance; the cap is applied *after* sorting so the most severe always survive. Log/telemetry the dropped count (do not silently truncate).

---

## 8. Permissions and actions

Maps to existing `receptionBoardFlowPolicy` + `ReceptionMutationMode` (`full` / `pin_reception` / `none`). The builder's `allowedActions` is **advisory only** — every mutation is re-checked server-side by `receptionBoardFlowAction` (`staffPinMayRunReceptionFlowAction`, portal + clinic-floor gates).

| Action | Existing mutation | Full session | PIN session | Read-only |
|---|---|---|---|---|
| Check in | `mark_arrived` | ✓ | ✓ | ✗ |
| Start consultation | `start_consultation` | ✓ | ✓ | ✗ |
| Start treatment | `start_treatment` | ✓ | ✓ | ✗ |
| Complete | `complete` | ✓ | ✓ | ✗ |
| No-show | `mark_no_show` | ✓ | ✓ | ✗ |
| Cancel | `cancel` | ✓ | **✗** (`staffPinMayRunReceptionFlowAction` returns false) | ✗ |
| Take payment | none (navigation → `/payments`) | ✓ (link) | ✓ (link) | ✓ (link) |
| Find patient | none (navigation → `/patients?q=`) | ✓ | ✓ | ✓ |
| Open calendar booking | none (navigation → `/calendar?bookingId=`) | ✓ | ✓ | ✓ |

Builder rule: `allowedActions` = flow actions permitted by `mutationMode` (all except `cancel` for PIN; none for read-only) **plus** the always-available navigation actions. Which flow action is *offered* on a card is additionally shaped by its `operationalState` (e.g. `check_in` only for `arriving_soon`/`running_late`/`expected`; `start_consultation` only for `waiting`) — mirror the existing `nextFlowActionForQueueColumn` intent, but never widen server permissions.

---

## 9. Performance contract

The builder is **pure over `(payload, nowMs)`** and cheap; performance is about *what the payload carries per tier*.

| Tier | Contains | Today model result |
|---|---|---|
| **Shell (SSR first paint)** | `receptionCards` (shell enrichment: patient label, type/status labels, provider from metadata; **no** clinic/room/user enrichment), `operationalDay`, `tenantId/name`, `quickActions`, `loadTier: "shell"` | Lanes + counts + basic cards render immediately; `payment: "unknown"`, `attentionItems: []`, `blocker: none`, `contact: null` |
| **Full (client hydrate + 30s poll)** | Above + `appointments` (payment, journey), `actionAlerts` (blockers) | Payment badges, attention panel, card blockers fill in |
| **30s polling payload** | Full payload minus `_surgerySource` (already stripped) | Re-derive lanes; **re-run running-late/arriving-soon against fresh `nowMs`** even when data is unchanged (these states drift with wall-clock; the component should re-run the builder on a short client tick, not only on poll) |
| **Static / rarely changing** | `quickActions`, `operationalDay` window, tenant branding | Compute once; not per tick |

**Must NOT be fetched for ordinary Front Desk staff** (none are in the `/reception-board` payload today — keep it that way; they live only in the `/reception-os` command-centre payload):

- pilot metrics, owner-value analytics, conversion/revenue reporting, module health, broad CRM metrics, platform diagnostics.

Additionally **drop from the Today model** even though present in the payload: `intelligence` (manager KPIs), `tomorrowSurgeries` (Tomorrow view owns it), `liveEvents` (not required for the day board). This keeps the staff surface an operational tool and shrinks the poll footprint.

---

## 10. Test matrix

Ticket-ready cases for `frontDeskTodayPresentation.test.ts` (pure; fixed `nowMs`, synthetic payloads):

1. **Duplicate booking across two source arrays → one card.** Same bookingId in `receptionCards` and `appointments` yields exactly one card.
2. **Payment due merges onto existing card.** `appointments[bookingId].paymentStatus = "due"` sets `card.payment.state = "due"` without adding a card.
3. **Multiple blockers merge without card duplication.** Two alerts for one bookingId → one card, `blocker.items.length === 2`.
4. **Strongest blocker sets card severity.** `critical` + `warning` → `blocker.highest === "blocker"`, `summary` = the critical item's label.
5. **Secondary blockers remain available.** The `warning` item is still present in `blocker.items` after collapse.
6. **Patient-level alert without bookingId appears once.** A `patientId`-only alert spanning two bookings → one `attentionItems` entry; no duplicate card, no duplicate panel row.
7. **Agenda row cannot create a duplicate card.** Builder ignores agenda input entirely; N `receptionCards` → N cards regardless of agenda arrays.
8. **ReceptionOS Today widget row cannot create a duplicate card.** ReceptionOS `todaysPatients` present but not consumed; card count unchanged.
9. **Terminal booking → one terminal lane only.** `cancelled` booking is absent from active lanes and counted once in `summary.cancelledOrNoShow`.
10. **Running-late comes from S3.1 helpers.** With a fixed `nowMs` past `startAt + grace` and status `scheduled`, `operationalState === "running_late"` and the card lands in the `running_late` lane (assert delegation to `deriveReceptionOperationalState`).
11. **Read-only session exposes no mutation actions.** `mutationMode: "none"` → `allowedActions` contains only navigation ids (no `check_in`/`start_*`/`complete`/`no_show`/`cancel`).
12. **PIN session excludes Cancel.** `mutationMode: "pin_reception"` → `allowedActions` includes flow actions but not `cancel`.
13. **Stable sort for equal appointment times.** Two cards, identical `startAt`, different bookingId → deterministic order by bookingId ascending, stable across runs.
14. **Empty payload → safe empty presentation.** No cards, all lanes empty with `count: 0`, `attentionItems: []`, summary all zeros, `actions` still populated.
15. **Invalid optional source data fails safely.** A malformed alert (missing `severity`) or an `appointments` row with an unknown bookingId is skipped without dropping any valid booking card.

Add: **16.** `waitingMinutes` is `null` when no arrival instant is present (guards against deriving it from `startAt`). **17.** Attention panel caps at 12 with the most-severe retained and dropped count reported.

---

## 11. File-level implementation plan

| Concern | File | Notes |
|---|---|---|
| Presentation builder | **Add** `src/lib/fiOs/frontDesk/frontDeskTodayPresentation.ts` | Pure. No `server-only`, no React, no loader import. Signature in conclusion. |
| Types | **Add** `src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types.ts` (or co-locate) | The interfaces in §3. |
| Tests | **Add** `src/lib/fiOs/frontDesk/frontDeskTodayPresentation.test.ts` | §10 matrix. |
| Future consumer | `src/components/fi-os/front-desk/FrontDeskTodayBoard.tsx` (S3.3) | Consumes `FrontDeskTodayPresentation` only; re-runs builder on a client tick for live running-late. |
| Reuse (read-only) | `receptionBoardModel.ts` (S3.1): `deriveReceptionOperationalState`, `isReceptionOperationalTerminalState`, `compareReceptionLaneItems`, `sortReceptionLaneItems`, thresholds | Do not modify — Cursor owns it. |
| Reuse (read-only) | `receptionBoardCore.ts`: `sortActionAlerts`, `EXTENDED_ALERT_PRIORITY`, payment labels | Import for panel ordering / label parity. |
| Keep separate | `buildAppointmentCard`, `buildQueueBoard`, `buildIntelligenceMetrics`, `mapTomorrowSurgeryCard`, `buildLiveActivityFeed` | Legacy/other-surface builders; do not extend for Today. |
| Keep separate | `src/lib/fiAdmin/receptionBoardPresentation.ts` | Legacy `ReceptionBoardDashboard` builders; Today does not reuse them. |
| Do **not** touch | `receptionBoardModel.ts`, `receptionBoardModel.test.ts` (S3.1 in flight); `receptionBoard.server.ts`; `receptionBoardTypes.ts` / `receptionBoardPayloadSchema.ts` **except** the additive optional alert `bookingId?`/`patientId?` (coordinate with S3.1 — do not land unilaterally); components until S3.3 | Read-only for this task. |

**Business derivation stays out of React** — every mapping, merge, sort, and severity collapse lives in the builder; `FrontDeskTodayBoard` only renders `FrontDeskTodayPresentation` and passes `nowMs`.

---

## Conclusion

**1. Recommended presentation-builder function signature**

```ts
export function buildFrontDeskTodayPresentation(
  payload: ReceptionBoardCommandCenterPayload,
  opts: {
    base: string;                 // `/fi-admin/${tenantId}`
    nowMs: number;                // fixed clock; SSR = Date.parse(payload.loadedAt), client = Date.now() per tick
    mutationMode: "full" | "pin_reception" | "none";
    maxAttentionItems?: number;   // default 12
  }
): FrontDeskTodayPresentation;
```

**2. Canonical deduplication algorithm**

```
1. cards = new Map<bookingId, FrontDeskTodayCard>()
2. for each row in payload.receptionCards:
     state = deriveReceptionOperationalState({ bookingStatus, metadata, startAtIso: row.startAt, nowMs })
     if isReceptionOperationalTerminalState(state) and state != "completed": tally into summary; skip lane
     cards.set(row.id, baseCardFrom(row, state, opts))   // one card per bookingId
3. index appointments by id; for each card: merge payment (state+label) and journey by bookingId (shell → "unknown")
4. blockers = []
   for each alert in payload.actionAlerts:
     key = alert.bookingId ?? alert.patientId ?? null           // explicit key only (§2 tier 1)
     panelItem = toAttentionItem(alert)                          // always eligible for panel
     if key is a bookingId present in cards: attach blocker to that card
     else if key is a patientId: attach to each of that patient's cards (badge), one panel row
     else: panel-only
   dedupe panel by (bookingId ?? patientId, kind); dedupe card blockers by (bookingId, kind)
5. for each card: blocker.highest = max severity; blocker.summary = strongest label; sort blocker.items strongest-first
6. assign laneId from state; sort each lane with compareReceptionLaneItems
7. sort attention items by severity desc → priority desc → id asc; cap at maxAttentionItems (report dropped)
8. compute summary counts; curate global actions; return { generatedAt: payload.loadedAt, ... }
```

The invariant: **cards are minted only in step 2 from `receptionCards`.** Every later step enriches by bookingId/patientId and can only attach, never insert — which is what structurally prevents `appointments`, `queue`, ReceptionOS widgets, agenda rows, and case-linked readiness rows from ever becoming a second patient list.

**3. Highest-risk payload ambiguity**

`actionAlerts` carry **no first-class `bookingId`/`patientId`** on the client payload — the linkage exists only inside composite `id` strings (`surgery-issue-<bookingId>-<kind>`, `journey-<patientId>-<kind>`, `cal-conflict-room-<id>`) and `href`. Attributing blockers to cards by parsing those strings is brittle and will silently mis-attribute or drop blockers as alert-id formats drift. **Resolve first** by adding optional `bookingId`/`patientId` to `ReceptionBoardActionAlert` at the composition seam (the ids already exist there — no migration, no new API), and until then keep unkeyed alerts **panel-only**. This single ambiguity gates the correctness of §4 card-blocker merging.

**4. Minimum shell-tier fields for a fast first paint**

Per booking from `receptionCards`: `id`, `startAt`, `endAt`, `bookingStatus`, `metadata` (for `fi_reception_flow_phase`), `displayName`, `typeLabel`, `providerLabel`, `patientId`, `leadId` — enough to run `deriveReceptionOperationalState`, place cards in lanes, sort, and render identity + time. Plus payload-level `operationalDay` (`calendarTimezone`, `todayYmd`, window bounds), `tenantId`, `loadedAt`, `quickActions`, and `loadTier`. With only these, Today paints complete lanes and counts; `payment` shows `unknown`, `attentionItems` is empty, and card blockers/`contact` fill in on full-tier hydration.
