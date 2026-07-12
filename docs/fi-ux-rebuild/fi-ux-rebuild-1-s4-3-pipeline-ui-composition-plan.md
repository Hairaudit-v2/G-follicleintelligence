# FI-UX-REBUILD-1 — S4.3: Pipeline Board & Follow-ups UI Composition Plan

**Date:** 2026-07-11
**Status:** Ticket-ready plan (read-only audit; no code changed)
**Depends on:** S4.1 stage model (`527aff21`) + S4.2 presentation (`e693b680`) — both landed. Consumes **only** `PipelinePresentation`.
**Objective:** Thinnest React implementation of one staff-facing Pipeline (Board + Follow-ups + lead-workspace drill-in). No `/crm` switch, nav change, or redirect (that is S4.5). No child touches raw lead/task/consultation/stage/HubSpot data.

> **Thesis.** S4.2 already did the hard work: `presentation.columns` are pre-grouped into the 9 staff columns, cards carry `primaryAction`/`secondaryActions`/`urgency`/`nextAction`, and `followUps` is bucketed. S4.3 is a **rendering + mutation-wiring** layer. The current `CrmKanbanBoard` cannot be reused — it derives column membership from raw backend `stages` and reads raw `card.lead`. The one genuine engineering gap is **grouped-column → backend-stage destination resolution** (S4.1 explicitly deferred it), which needs a pure helper before mutation wiring.

---

## 1. Existing CRM component inventory

| Component | Current purpose | As-is | Wrapper | Pattern only | Replace | Risk |
|---|---|---:|---:|---:|---:|---|
| `CrmKanbanBoard` | Kanban over raw `stages`, optimistic move, own refresh | ✖ | ✖ | ✅ | **Yes** | **Derives column membership from raw `stage.id`**; reads raw cards |
| `CrmKanbanColumn` | Column shell (title/count/drop handlers) | ➖ | ✅ | — | — | Neutral-ish; drop handlers are drag-specific |
| `CrmLeadKanbanCard` | Lead card from raw `CrmKanbanLeadCard` | ✖ | ✖ | ✅ | **Yes** | **Derives name/owner/subtitle from `card.lead`/`person.metadata`**; move menu lists raw stages |
| Stage-move control (menu + drag in card) | Move to any raw backend stage | ✖ | ✖ | ✅ | **Yes** | Lists raw `stages`; no staff-column grouping |
| Drag-and-drop (HTML5 in board/card) | Desktop drag to move | ✖ | ✖ | ✅ | Replace | Not accessible; desktop-only; optimistic |
| `CrmLeadListTable` (`/crm?view=list`) | Filterable table | ✖ | ✖ | — | Retire (S4.5) | Third door; raw rows |
| `LeadFlowDashboard` / `LeadFlowOperatorDashboard` | Workspace/HubSpot dashboards | ✖ | ✖ | — | Retire | Derives priorities/analytics from raw payloads |
| Follow-up/task lists (`CrmLeadTasksWorkflow`) | Task list on lead detail | ➖ | ✅ | ✅ | Partial | Mutation runner reusable; list derives buckets |
| Owner selector (edit panel) | Assign owner | ➖ | ✅ | — | Reuse pattern | Existing mutation |
| Communication quick actions (`CrmLeadCommunicationsWorkflow`) | Log call/email | ➖ | ✅ | — | Reuse | Existing mutation |
| Consultation-booking (`QuickCallInBookingModal`, `LeadBookNextAppointmentCard`) | Book from lead | ✅ | — | — | Reuse | Existing flow |
| Conversion actions (`CrmLeadConversionPanel`) | Convert lead | ➖ | ✅ | — | Reuse | `executeCrmLeadConversion` |
| Lost/reopen (stage move to lost) | via move menu | ➖ | — | ✅ | Replace UI | Uses move mutation |
| Filters (`CrmLeadListFilters`, `CrmLeadIndexViewTabs`) | URL filters + view tabs | ➖ | ✅ | ✅ | Replace | Reads raw stages/owners |
| Loading skeletons | List/board skeletons | ✅ | — | — | Reuse/adapt | Neutral |
| Empty states (inline in `/crm` page) | Empty copy | ✅ | — | — | Reuse pattern | Neutral |
| `LeadSlideOver` + `useCrmLeadSlideOver` | Lead drill-in overlay + `openLead(leadId)` + session (role/canUseClinicFeatures) | ✅ | — | — | **Reuse** | Drill-in provider |
| `NewEnquiryDialog` | New lead creation | ✅ | — | — | **Reuse** | §12 |
| Toast / error banner | Feedback | ✅ | — | — | Reuse | Neutral |
| `crmMoveLeadStageAction` | Stage-move mutation | ✅ | — | — | **Reuse** | Canonical; takes real `toStageId` |

**Hidden business derivation — must NOT be reused directly:** `CrmKanbanBoard` (column membership from raw `stage.id`; `unassigned` bucket from `!current_stage_id`), `CrmLeadKanbanCard` (name via `personMetadataDisplayLabel`, owner via `card.lead`/`owner.email`, subtitle from `card.lead.summary`, overdue from `overdueTaskCount`, move menu from raw `stages`), `LeadFlowDashboard*` (priority/analytics derivation), list/filter components (read raw stages/owners). Re-invoking any would fork derivation away from S4.2. **Reuse only:** the slide-over provider, `NewEnquiryDialog`, `crmMoveLeadStageAction` + task/comms/convert mutation runners, `QuickCallInBookingModal`, toast/skeleton primitives, and the *visual patterns* (column shell, drag handle, dropdown move menu).

---

## 2. Recommended component tree

```text
PipelineWorkspace                (client adapter — ONLY raw-data + hydration holder)
├── PipelineHeader               (title, New enquiry trigger, last-updated, refresh)
├── PipelineViewTabs             (Board | Follow-ups)
├── PipelineFilterBar            (from presentation.filters; URL query)
├── PipelineSummary              (from presentation.summary)
├── PipelineBoard                (renders presentation.columns in order)
│   └── PipelineColumn           (one staff column; collapse for terminal/holding)
│       └── PipelineLeadCard     (one PipelineLeadCard; emits onAction)
├── PipelineFollowUps            (from presentation.followUps)
│   └── PipelineFollowUpBucket
│       └── PipelineFollowUpItem (emits onAction)
└── PipelineEmptyState
```

| Component | Props | Responsibility | Client/Server | Local state | Invokes actions | Raw loader data | Consumes |
|---|---|---|---|---|---|---|---|
| `PipelineWorkspace` | `presentation`, `permissions`, `tenantId`, `initialFilters` | Hold hydration/refresh; own action runner; slide-over; URL filter sync | **Client** | tier, busy, view, filters | **Yes** (runner) | **Yes (only here)** | whole `PipelinePresentation` |
| `PipelineHeader` | `summary`, `lastUpdated`, `loadTier`, `onRefresh`, `onNewEnquiry`, `canCreate` | Title, refresh, New enquiry | Client | — | delegates | No | slice |
| `PipelineViewTabs` | `view`, `counts`, `onChange` | Board/Follow-ups toggle | Client | — | No | No | slice |
| `PipelineFilterBar` | `filters: PipelineFilterOptions`, `active`, `onChange`, `view` | Render filter chips + counts | Client | drawer open | No | No | `filters` |
| `PipelineSummary` | `summary: PipelinePresentationSummary` | Count tiles | Client | — | No | No | `summary` |
| `PipelineBoard` | `columns: PipelinePresentationColumn[]`, `busyLeadId`, `onAction` | Layout of columns in given order | Client | — | delegates | No | `columns` |
| `PipelineColumn` | `column: PipelinePresentationColumn`, `busyLeadId`, `onAction` | Header, count, collapse, "N more" | Client | collapsed, revealed | delegates | No | one column |
| `PipelineLeadCard` | `card: PipelineLeadCard`, `busy`, `onAction` | Render card + primary/overflow actions | Client | overflow open | delegates via `onAction` | No | one card |
| `PipelineFollowUps` | `followUps: PipelineFollowUpView`, `busyTaskId`, `onAction` | Bucketed task view | Client | expanded buckets | delegates | No | `followUps` |
| `PipelineFollowUpBucket` | `label`, `items`, `busyTaskId`, `onAction` | One bucket | Client | — | delegates | No | slice |
| `PipelineFollowUpItem` | `item: PipelineFollowUpItem`, `busy`, `onAction` | One task row + actions | Client | — | delegates | No | one item |
| `PipelineEmptyState` | `canCreate`, `onNewEnquiry` | Empty pipeline CTA | Client | — | No | No | slice |

Only `PipelineWorkspace` knows hydration/refresh and the raw inputs. Prefer merging trivial wrappers (e.g. `PipelineFollowUpBucket` may inline into `PipelineFollowUps` if it adds no test value).

---

## 3. Raw-data boundary

`PipelineWorkspace` is the sole adapter. It may receive `initialData` (shell `PipelinePresentation`), a `permissions` object, current user context, and route filter state; it builds/refreshes the full presentation (or receives it) and passes **only** presentation slices + callbacks to children. **No child calls `buildPipelinePresentation`; no child imports `CrmKanbanLeadCard` / `FiCrm*Row` / task / consultation types.**

**Testable architectural invariant:** a static test (or `eslint no-restricted-imports`) over `src/components/fi/crm/pipeline/**` (excluding `PipelineWorkspace.tsx`) asserts that **no file imports** `@/src/lib/crm/types` (`CrmKanbanLeadCard`, `FiCrm*Row`), `crmShellLoaders`, `crmKanbanExtras`, or `buildPipelinePresentation`. Child prop types must reference only `@/src/lib/crm/pipelinePresentation.types`. This mechanically prevents raw CRM inputs from leaking into child props (satisfies test #2).

---

## 4. Board layout

Render `presentation.columns` **in the order supplied** (S4.1 order: New · Contacting · Qualified · Consultation · Planning/quote · Booked/deposit · Converted · Nurture · Closed/lost). The board must not rebuild order or re-bucket.

Nine columns is too many for a flat horizontal board on a clinic tablet. Split by `column.kind`:

- **Active (6):** New → Booked/deposit — the default working set.
- **Terminal/holding (3):** Converted (`terminal_won`), Nurture (`holding`), Closed/lost (`terminal_lost`) — **honour `collapsedByDefault`** and place **after** the active set (or behind a lifecycle filter), shown as a collapsed row with count, expandable. They never dominate the default workflow.

| Surface | Behaviour |
|---|---|
| **Desktop** | Active columns in a single **board-level** horizontal scroll (never per-column scroll); column width ~20rem; **sticky column headers** with count; each column caps ~12 cards then "Show all (N)"; terminal/holding as collapsed sections below. |
| **Clinic tablet (768×1024)** | **Vertical stacked** stage sections (accordion), each expandable; sticky filter/view controls; **no nested horizontal scroll**; ≥44px touch targets; card primary action always visible. (Reuse the Front Desk vertical-stack tablet pattern.) |
| **Phone** | Single-column **stage accordion**; a current-stage filter chip to focus one column; compact card; actions in an accessible overflow menu. |

Empty active columns render as a thin "No leads" placeholder (kept for scannability); empty terminal/holding columns are omitted. Hidden/truncated leads surface as a board-level "N more — narrow filters" note driven by `diagnostics.hiddenLeadCount` (§16), never a silent cap.

---

## 5. Pipeline lead card design

Default content from `PipelineLeadCard` only:

- **Person name** (`person.displayName`) → links `links.lead`.
- **Source** (`source.label`).
- **Owner** (`owner.displayName` or "Unassigned").
- **Stage** (`stage.staffColumnLabel`; `stage.daysInStage` as "Nd in stage").
- **Contact availability** (`contact.hasEmail`/`hasPhone` icons; `preferredChannel`).
- **Canonical next action** (`nextAction.label` + `nextAction.dueAtIso` when present).
- **Overdue / due-today** (`nextAction.overdue` / `followUps.overdueCount`/`dueTodayCount`) — non-colour cue + text.
- **Consultation summary** (`consultation.state` chip when not `none`).
- **Strongest blocker** (`blockers[0]` by severity) + **"+N" count** (`blockers.length - 1`).
- **High-value** (`score.highValue`) badge.
- **Conversion/patient link** (`links.patient` when `conversion.state = "converted"`).
- **Primary action** (`primaryAction`) + **overflow** (`secondaryActions`).

**Must NOT appear by default:** raw metadata; internal stage IDs (`backendStageId`); full communication history; all tasks; long notes; HubSpot diagnostics; clinical detail; financial detail; marketing analytics; technical "CRM"/"LeadFlow"/"OS" language.

**Card states:** two only — **standard** (above) and **busy** (during a mutation). No separate compact/expanded state in S4.3 (drill-in owns depth); a tablet-compact density may drop `source`/`daysInStage` to secondary, but that is CSS, not a new state.

---

## 6. Primary action display

Render `card.primaryAction` + `card.secondaryActions` verbatim — **never recalculate eligibility** (S4.2 computed it from permissions + state; server re-checks). Action → handler/route map:

| Action | Handler / route |
|---|---|
| `contact` / `log_outcome` | existing comms mutation (via slide-over or inline) |
| `schedule_follow_up` / `complete_follow_up` | existing task mutation |
| `assign_owner` | existing lead-owner mutation |
| `move_stage` | `crmMoveLeadStageAction` (destination via §7/§8 helper) |
| `book_consultation` | existing booking flow (`QuickCallInBookingModal`) |
| `mark_lost` / `reopen` | `crmMoveLeadStageAction` (lost stage / active stage) |
| `convert` | `executeCrmLeadConversion` (via `CrmLeadConversionPanel`) |
| `open_lead` / `open_patient` | navigation (`links.lead` / `links.patient`) |

- **Always visible:** `primaryAction` (one button). **Overflow:** `secondaryActions` in a dropdown.
- **Destructive confirm:** `mark_lost` and `convert` require a confirm step (reason picker for lost).
- **Busy state:** the acted card sets `aria-busy`, disables its actions while `busyLeadId === card.leadId`.
- **Concurrency:** one in-flight mutation per card (`busyLeadId`); the board stays interactive for other cards.
- **Focus return:** after completion + refresh, return focus to the acted card (`data-lead-id`).
- **Server refresh:** `router.refresh()` + one re-fetch (§15); no optimistic move in S4.3.
- **Error:** toast the server error; card stays in its server-confirmed column (test #26).

No new mutations.

---

## 7. Stage movement UX

**Recommendation: Option A — explicit "Move stage" action only** for S4.3. Drag (current HTML5 impl) is desktop-only, inaccessible, and optimistic; defer it. Explicit move is tablet-safe, keyboard-operable, and works cleanly with grouped staff columns.

A "Move stage" control opens a menu of **staff columns** (from `PIPELINE_STAFF_COLUMN_ORDER`); selecting one must **resolve a real backend stage id** within that column and call `crmMoveLeadStageAction(tenantId, leadId, { toStageId, changedBy, source: "fi_admin_pipeline" })`. Requirements:

- Show **staff columns** as destinations (not raw slugs) for the common path.
- Resolve the chosen column → an **actual tenant backend stage id** (§8).
- Preserve **direct moves to a specific backend stage** in the **lead workspace** (advanced), where the current per-slug menu already exists.
- Prevent invalid won/lost transitions in the UI (offer `convert`/`mark_lost`/`reopen` instead of a raw move into terminal columns); server validation stays authoritative.
- Never persist a staff-column id.

**Destination resolution belongs in a pure helper, built before mutation wiring** — see §8. It is small enough to ship as **S4.2A** (a pure addition alongside S4.1/S4.2), not inside a React component.

---

## 8. Grouped-column destination-stage rule

**Critical gap:** S4.1 explicitly deferred grouped-column destination selection ("mutations must still use a real stage id … deferred to S4.2/S4.3"), and neither S4.1 nor S4.2 exposes a column→stage resolver. Grouped columns:

- Consultation → `{consult_scheduled, consult_completed}`
- Planning / quote → `{treatment_planning, quote_sent}`
- Booked / deposit → `{deposit_or_booked, in_treatment}`

**Recommendation: Default entry stage per grouped column** (safest, deterministic, no hidden inference):

- Consultation → `consult_scheduled`
- Planning / quote → `treatment_planning`
- Booked / deposit → `deposit_or_booked`

Resolved generically as **the lowest-`sort_order` backend stage whose slug maps to the target column** (via `PIPELINE_DEFAULT_STAGE_CROSSWALK`), from the tenant's actual stage set — so it works for custom tenants too. Advanced movement to later sub-stages (`consult_completed`, `quote_sent`, `in_treatment`) stays in the **lead workspace**. **Reject context-aware inference** (payment/consult evidence) — it creates a hidden mutation rule the audit forbids.

**Required pure helper (S4.2A, ship before S4.3B):**
```ts
// pure; in src/lib/crm/ (not React). Never returns a staff-column id.
export function resolvePipelineColumnEntryStageId(
  columnId: PipelineStaffColumnId,
  tenantStages: readonly PipelineStageDefinition[]  // real stage rows (id + slug + sort_order + flags)
): { stageId: string; slug: string } | { error: "no_backend_stage_for_column" };
```
Selection: filter tenant stages whose `resolvePipelineStaffStage(stage).columnId === columnId`; pick lowest `sortOrder`; return its real `id`. For `converted`/`closed_lost`, route to `convert`/`mark_lost` instead of a raw move. Unit-test against the default 12-stage set + a custom tenant + a missing-stage tenant (returns the error, UI disables that destination).

---

## 9. Follow-ups view

Over `presentation.followUps` (task-keyed) — **not** a separate product, **not** a second stage board.

- **Buckets:** Overdue → Due today → Upcoming → No due date → Completed (last, capped/omittable).
- **Default visibility:** Overdue + Due today expanded; Upcoming collapsed with count; No-due-date collapsed; Completed hidden by default (toggle, capped e.g. 50).
- **Ordering:** as supplied (S4.2 sorts `due_at asc, taskId asc`).
- **Max visible / cap:** ~25 per bucket with "Show all (N)"; Completed capped.
- **Assigned-to-me:** filters by **task assignee** (§10) — distinct from Board's owner filter.
- **Item shows:** `personDisplayName`, `title`, `dueAtIso`, `assignee.displayName`, `status`, contact icons, `allowedActions`, `links.lead`.
- **Actions:** complete (existing task mutation), snooze/reschedule (edit `due_at`), schedule another follow-up, open lead. Contact shortcut where `allowedActions` includes it.
- **Owner display:** show task assignee primarily; lead owner only if needed for disambiguation.

The view must **not** mint lead cards. A lead with several tasks yields several follow-up items (task id is canonical here) — that is expected and not a duplicate-lead violation.

---

## 10. Filter design

One filter system over `presentation.filters` (stable IDs + counts already computed). **Never** read raw stages/owners.

| Board filters | Follow-ups filters |
|---|---|
| staff column (`col:*`), backend stage (`stage:*`, advanced/hidden), owner (`owner:*`), assigned-to-me (owner), unassigned, source (`source:*`), overdue, due today, consultation due, high value, lifecycle (`life:active/holding/terminal`) | bucket, task assignee, assigned-to-me (assignee), lead owner, source, contact availability |

- **Persistence:** URL query params (future-route-ready for S4.5); temporary UI toggles reflect into the query. **No separate route per filter.**
- **Reset:** a "Clear filters" affordance; lifecycle single-select, others multi-select.
- **Tablet/phone:** filters collapse into a **drawer** with an active-filter summary chip row.
- **Counts:** each option shows its `count` from `PipelineFilterOption`.
- **Advanced backend-stage filter hidden by default** (staff use staff columns; power users expand).
- **`assigned-to-me` reads owner on Board, assignee on Follow-ups** (§9/§16 of S4.2).

---

## 11. Board vs Follow-ups tabs

Labels: **`Board`** and **`Follow-ups`** (no "List" third tab — the list view retires in S4.5; the lead workspace is a drill-in, not a hub tab).

**Default view for S4.3:** **Board**, deterministically, for all roles. Avoid role-specific defaults — the product has no stable per-user preference model, and a remembered/role default adds state and test surface for no S4.3 benefit. (A future role/remembered default can layer on once a preference store exists.)

---

## 12. New enquiry action

`NewEnquiryDialog` is reusable directly from `PipelineHeader`.

- **Trigger:** a "New enquiry" button in `PipelineHeader` (and in `PipelineEmptyState`), gated by `permissions.canMutate`.
- **Success:** `router.refresh()` (+ single re-fetch) so the new lead appears in **New** without a second poll loop; no optimistic insert.
- **Focus:** dialog focuses its first field on open; on success returns focus to the trigger.
- **Tablet fit:** dialog uses the existing responsive modal sizing (verify ≤ tablet width, scrolls internally).
- **Route after success:** stay on the board (lead appears in New); optionally offer "Open lead" to `links.lead`.

Do not redesign lead creation.

---

## 13. Lead workspace integration

Keep `/crm/leads/[leadId]` as the drill-in. **Reuse the existing `LeadSlideOver` + `useCrmLeadSlideOver`** (`openLead(leadId)`) for the in-board drill-in (shallow overlay), with the full page as the deep-link/fallback target — this is the stable workspace-shell pattern already used by the kanban.

- **Card open:** `open_lead` → `openLead(card.leadId)` (slide-over); ctrl/middle-click → full page `links.lead` (preserve current card affordance).
- **Return-to-board:** closing the slide-over returns to the board with **Board/Follow-ups filters preserved** (filters live in URL/adapter state, not the overlay).
- **Deep links from Today:** `/crm/leads/{id}` still resolves (full page) — unchanged.
- **Converted patient navigation:** `open_patient` → `links.patient`.
- **Mobile:** slide-over becomes a full-height sheet; full page on very small widths.
- **Lazy load:** full communications/tasks/notes load **only after** drill-in (the slide-over payload loader), never on every card.

Do not duplicate the workspace inside cards.

---

## 14. Shell/full hydration UI

| Tier | Rendered |
|---|---|
| **Shell** (`loadTier: "shell"`) | Columns + cards immediately: identity, owner, stage, source, contact, conversion (from lead row), high-value, `followUps.overdueCount`. `nextAction.kind = "none"` → render **no** next-action line (not "No follow-up"). Consultation `none` → hidden. |
| **Full** (`loadTier: "full"`) | Next action + date, Follow-ups view populated, consultation summary, full blockers, complete `secondaryActions`. |

Requirements:
- **Card count stable** across shell→full (same `leadId` set; enrichment only fills fields).
- **No column duplication.**
- **Board interactive** where safe during hydration.
- **No full-screen spinner after first paint** — a subtle "Updating…" in the header only.
- **Placeholders ≠ real values** — absent next-action renders empty, never a fake "No follow-up".
- **Actions disabled until full where they depend on full data:** `complete_follow_up`, `schedule_follow_up` (need task/next-action), `book_consultation` where `consultation` drives eligibility. `move_stage`, `assign_owner`, `open_lead`, `convert`, `mark_lost` depend only on shell-available fields and can stay enabled.

---

## 15. Refresh and mutation handling

- **No optimistic stage movement in S4.3** — the current optimistic move (in `CrmKanbanBoard`) re-derives stage refs client-side; S4.3 defers to server-confirmed + `router.refresh()` so an error leaves the card in its true column (test #26). (Optimism can return later once stable.)
- **Server-confirmed flow:** run mutation → on ok `router.refresh()` + one re-fetch of the presentation input → on error toast.
- **`router.refresh()` vs client refetch:** use `router.refresh()` (server re-renders the page loader) as primary; a single client refetch only if the adapter owns the presentation build.
- **One refresh loop only** — reuse a single mechanism (the existing `FI_CRM_KANBAN_REFRESH_EVENT` pattern or a single adapter effect); **no second poller**.
- **Polling:** **not needed** — Pipeline is not a live floor board. Prefer **mutation-driven refresh** + an optional **60-second** background refresh (not the Front Desk 30s cadence).
- **Refresh triggers:** after lead creation, task completion, stage move, conversion — all via the single loop.
- **Stale/last-updated:** header shows `generatedAt` as "Updated HH:MM" + a manual refresh button.

---

## 16. Permission and capability behaviour

Drive everything from S4.2 `permissions` + per-card `primaryAction`/`secondaryActions`; server re-checks every mutation.

| Session | Behaviour |
|---|---|
| Full CRM operator / consultant / clinic manager / tenant admin | Full actions per card `allowedActions`. |
| Receptionist w/ capability override | Same actions as granted by `canUseClinicFeatures` — no role inflation (preserve override path). |
| Platform admin | Full (proxy). |
| Read-only | Only `open_lead`/`open_patient`; a **read-only banner**; mutation buttons **hidden** (not just disabled) to reduce clutter. |
| Finance / clinical with conditional view | View board; actions per `permissions` (typically none). |

- **Actions hidden vs disabled:** hide for read-only; disable (with reason) only for transient state (busy / full-tier-pending).
- **Owner assign / convert / mark-lost / booking / task completion** all gate on `permissions` + card `allowedActions`.
- **No new Pipeline role**; capability overrides preserved.

---

## 17. Loading, empty and error states

| State | Treatment |
|---|---|
| Initial shell loading | Column skeletons until shell paints. |
| Full enrichment loading | Header "Updating…"; cards keep shell fields; next-action/consultation slots blank (not fake). |
| Empty Pipeline | `PipelineEmptyState` with **New enquiry** (if `canMutate`) + explanation. |
| Empty column | Thin "No leads" placeholder (active); omit terminal/holding. |
| No Follow-ups due | Friendly "Nothing due" per bucket; overall "You're all caught up". |
| Filter → no results | "No leads match — clear filters" with reset. |
| Truncated source | Board note "Showing X of Y — narrow filters" from `diagnostics.hiddenLeadCount`. |
| Partial enrichment failure | Board stays on shell; quiet non-blocking notice; retry on next refresh. |
| Mutation error | Toast; card stays server-confirmed. |
| Refresh failure | Quiet banner; last good board visible; auto-retry. |
| Unknown-stage / orphan-task | **Not on staff cards** — unknown-stage leads render in the fallback column (`qualified`) but their diagnostic codes go to platform-admin/structured logging/tests only. |

Ordinary staff never see `diagnostics` internals (duplicate/orphan/unknown IDs, warning codes) — those route to platform-admin audit + structured logs + test assertions. A card only surfaces a **staff-actionable** blocker (e.g. missing contact), never a raw diagnostic.

---

## 18. Tablet and mobile requirements

Current `CrmKanbanBoard` uses `lg:flex-row lg:overflow-x-auto` — a horizontal board that, on a 768px tablet, forces horizontal scrolling and small drag targets. S4.3 fixes this by adopting the **Front Desk vertical tablet pattern**:

- **Tablet (768×1024) / phone:** **stacked** stage sections (accordion), not a horizontal board; **one** board-level scroll (vertical); sticky header + filter row; card full-width; summary above columns; terminal/holding collapsed at the bottom; Follow-up buckets stacked; ≥44px touch targets; actions in accessible overflow menus; dialogs/drawers sized to viewport; **no nested horizontal scroll**; usable without browser zoom.
- **Landscape (1024×768):** may show 2–3 active columns with a single board-level horizontal scroll; still no per-column scroll.
- **Desktop:** horizontal active board (single scroll) + collapsed terminal/holding.

Assessment: **yes**, Pipeline should reuse the Front Desk vertical-stack approach — it is the established, tablet-proven pattern and avoids the current nested-scroll problem.

---

## 19. Accessibility

- **Semantic stage sections:** each column `<section aria-labelledby>` with an `<h2>`/`<h3>` header including count ("Qualified, 7 leads").
- **Keyboard stage movement:** the "Move stage" menu is fully keyboard-operable (no drag required) — the accessible alternative to drag.
- **Accessible filters:** filter chips are buttons with `aria-pressed`; drawer is a labelled dialog.
- **Focus restoration:** after a mutation + refresh, focus returns to the acted card / follow-up row.
- **Mutation announcements:** an `aria-live="polite"` region announces moves/completions ("Lead moved to Consultation").
- **Non-colour cues:** urgency/blocker/overdue carry icon + text, not colour alone.
- **Menu keyboard behaviour:** overflow/move menus arrow-navigable, Esc closes, focus returns to trigger.
- **Collapsed terminal/holding + Follow-up buckets:** `aria-expanded` toggles with counts in the label.
- **Due-date / source / owner labels:** screen-reader-safe text (no colour-only, no truncation-only meaning).
- **Destructive confirm:** `mark_lost`/`convert` use a labelled confirmation dialog.
- **Terminology:** all visible + accessible copy uses **Pipeline** terms — never "CRM", "LeadFlow", "kanban", "OS", or backend slugs.

---

## 20. Operational telemetry

Rollout-only, no PHI, no business KPIs:

- Pipeline first meaningful render; shell→full hydration duration.
- Duplicate-lead invariant failure (hard alarm on `diagnostics.duplicateLeadIds`).
- Hidden/truncated lead count (`diagnostics.hiddenLeadCount`).
- Unknown-stage count / orphan-task count (`diagnostics`).
- Mutation success/failure by action id; stage-move **destination column** (not lead identity).
- Filter usage; Board vs Follow-ups usage; refresh failures.

**Never** add revenue KPIs, conversion analytics, marketing dashboards, or owner-value panels; **never** log lead/patient names, emails, or phones.

---

## 21. Test plan

1. UI renders from `PipelinePresentation` only. 2. Child props contain no raw CRM inputs (import-boundary test, §3). 3. One lead → one card. 4. Column order follows presentation. 5. Nurture is holding + collapsed as supplied. 6. Converted + Closed/lost terminal + collapsed. 7. Unknown-stage lead visible in fallback column. 8. Shell renders without claiming a next action. 9. Full adds next action without changing card count. 10. Tasks never create board cards. 11. Multiple leads/person render separately. 12. Primary action comes from presentation. 13. Read-only → nav actions only. 14. Explicit move uses a real backend stage id. 15. Grouped column cannot persist the staff-column id (resolver returns a real stage id). 16. Follow-up task in exactly one bucket. 17. Complete task uses existing mutation. 18. Task assignee distinct from lead owner. 19. New enquiry uses existing creation flow. 20. Converted lead opens patient link. 21. Lost lead offers Reopen where supplied. 22. Filters use stable presentation filter IDs. 23. Hidden lead count visible. 24. Empty Pipeline offers New enquiry where permitted. 25. Empty Follow-ups useful. 26. Mutation failure leaves server-confirmed state. 27. Tablet: no nested horizontal scroll. 28. Touch targets ≥44px. 29. Keyboard stage move without drag. 30. State changes announced. 31. No CRM/LeadFlow/OS language. 32. No staff diagnostics surfaced.

---

## 22. File-level implementation plan

**Add (`src/components/fi/crm/pipeline/`, all `"use client"` presentational except the adapter):**
- `PipelineWorkspace.tsx` (adapter; only raw-data/hydration/refresh + action runner + slide-over)
- `PipelineHeader.tsx`, `PipelineViewTabs.tsx`, `PipelineFilterBar.tsx`, `PipelineSummary.tsx`
- `PipelineBoard.tsx`, `PipelineColumn.tsx`, `PipelineLeadCard.tsx`
- `PipelineFollowUps.tsx` (may inline `PipelineFollowUpBucket`), `PipelineFollowUpItem.tsx`
- `PipelineEmptyState.tsx`
- `src/lib/crm/pipelineUiHelpers.ts` (pure label/format/action-map helpers; no derivation)

**Add pure helper (S4.2A, before S4.3B):** `src/lib/crm/pipelineMoveTarget.ts` → `resolvePipelineColumnEntryStageId(columnId, tenantStages)` + tests.

**Reuse (import):** `LeadSlideOver`/`useCrmLeadSlideOver`, `NewEnquiryDialog`, `crmMoveLeadStageAction` + task/comms/convert mutation runners, `QuickCallInBookingModal`, `CrmLeadConversionPanel`, toast/skeleton/`DropdownMenu` primitives, S4.1/S4.2 types + `PIPELINE_STAFF_COLUMN_ORDER`.

**Style tokens reuse:** existing `DashboardCard`/badge/chip class tokens; re-key colour by `PipelineUrgencyLevel`/`PipelineBlockerSeverity` (not by raw status).

**Must NOT reuse (derive business state):** `CrmKanbanBoard`, `CrmLeadKanbanCard`, `LeadFlowDashboard*`, `CrmLeadListTable`/filters. **Must NOT modify:** S4.1/S4.2 files, routes, navigation, mutations, HubSpot ingestion, DB, S3/Front Desk files.

**Tests:** fixture/static tests per presentational component (synthetic `PipelinePresentation`); adapter test (shell→full, action runner, slide-over open); import-boundary test (#2); `pipelineMoveTarget` unit tests; tablet E2E (no nested scroll, 44px).

---

## 23. Delivery slices

- **S4.3A — Read-only presentation UI:** header, Board/Follow-ups tabs, filters, columns, cards, follow-up buckets, fixture tests. No mutations, no route switch, no move-target helper needed.
- **S4.2A + S4.3B — Stage movement & task actions:** ship `resolvePipelineColumnEntryStageId` (pure) first; then explicit Move stage (staff column → backend entry stage), complete/schedule follow-up, assign owner — existing mutations only.
- **S4.3C — Contact/consultation/conversion:** contact/log outcome, book consultation, mark lost/reopen, convert — existing flows only.
- **S4.3D — Shell/full adapter & refresh:** one adapter, shell→full enrichment, mutation-driven + 60s refresh, single loop.
- **S4.3E — Tablet & accessibility closure:** vertical stack, keyboard move, focus restoration, live announcements, overflow menus.

The live `/crm` switch is **S4.5**, not S4.3.

---

## Conclusion

**1. Recommended component tree** — `PipelineWorkspace` (sole adapter) → `PipelineHeader`, `PipelineViewTabs`, `PipelineFilterBar`, `PipelineSummary`, `PipelineBoard`→`PipelineColumn`→`PipelineLeadCard`, `PipelineFollowUps`→`PipelineFollowUpItem`, `PipelineEmptyState`. Every child consumes typed `Pipeline*` slices + callbacks only.

**2. Safe existing components to reuse** — `LeadSlideOver`/`useCrmLeadSlideOver` (drill-in), `NewEnquiryDialog`, `crmMoveLeadStageAction` + task/comms/convert mutation runners, `QuickCallInBookingModal`, `CrmLeadConversionPanel`, toast/skeleton/`DropdownMenu` primitives, and visual patterns (column shell, move menu, drag handle). Style tokens re-keyed by severity.

**3. Components that must NOT be reused (derive state)** — `CrmKanbanBoard` (column membership from raw `stage.id`), `CrmLeadKanbanCard` (name/owner/subtitle/overdue/move-menu from raw rows), `LeadFlowDashboard`/`LeadFlowOperatorDashboard`, `CrmLeadListTable` + raw filter components.

**4. Board/Follow-ups layout decision** — render `presentation.columns` in order; 6 active columns as the working set (single board-level horizontal scroll on desktop, **vertical stacked accordion on tablet/phone**), Converted/Nurture/Closed-lost collapsed and placed after active (honour `collapsedByDefault`). Two tabs only: **Board** (default) + **Follow-ups**; no List tab; lead workspace is a drill-in.

**5. Grouped-column destination-stage rule** — **default entry stage** = lowest-`sort_order` backend stage mapping to the target column (Consultation→`consult_scheduled`, Planning/quote→`treatment_planning`, Booked/deposit→`deposit_or_booked`); advanced sub-stage moves stay in the lead workspace; **never persist a staff-column id**; no context inference. Implement the pure `resolvePipelineColumnEntryStageId` helper (**S4.2A**) before any move wiring.

**6. Mutation & refresh model** — explicit Move stage (Option A), no drag, no optimistic move in S4.3; all actions use existing mutations; server-confirmed → `router.refresh()` + single re-fetch; one refresh loop; mutation-driven + optional 60s background refresh; **no** 30s Front Desk-style poller.

**7. Tablet/mobile strategy** — adopt the Front Desk vertical-stack pattern: stacked stage accordion, one board-level scroll, sticky header/filters, ≥44px targets, drawer filters, no nested horizontal scroll, usable without zoom.

**8. Accessibility requirements** — semantic stage sections with counts, keyboard Move-stage as the drag alternative, focus restoration after mutations, `aria-live` announcements, non-colour urgency/blocker cues, `aria-expanded` collapsibles, labelled destructive confirms, Pipeline terminology in all visible + accessible copy.

**9. Highest-risk UI integration issue** — **grouped-column stage destination**: a staff column (`consultation`, `planning_quote`, `booked_deposit`) is not a real stage, and neither S4.1 nor S4.2 resolves it to a backend id. If the UI wired Move stage before a pure resolver exists, it would either persist a staff-column id (data corruption) or hard-code a slug (breaks custom tenants). Resolve first with `resolvePipelineColumnEntryStageId` (pure, tested against default + custom + missing-stage tenants); the UI disables destinations the resolver can't satisfy and routes terminal columns to `convert`/`mark_lost` instead of a raw move.

**10. Minimum reversible S4.3 slice** — **S4.3A**: read-only `PipelineWorkspace` + Board/Follow-ups/filters/cards rendering a real `PipelinePresentation` (built in a scratch/preview harness), **no mutations, no move-target helper, no `/crm` switch, no nav change**. It proves one-card-per-lead, presentation-driven column order, terminal/holding collapse, shell/full rendering, and the raw-data boundary — reversible by not mounting it on any route. Mutations (S4.2A + S4.3B/C), the adapter/refresh (S4.3D), and tablet/a11y (S4.3E) layer on after.
