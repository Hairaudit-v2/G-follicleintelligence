# FI-UX-REBUILD-1 — S4.4: Pipeline Loader Composition, Hydration & Dual-Run Plan

**Date:** 2026-07-11
**Status:** Ticket-ready plan (read-only audit; no code changed)
**Depends on:** S4.1 (`527aff21`), S4.2 (`e693b680`), S4.3 (`90e959bb`) — all landed. `PipelineWorkspace` exists but is **not mounted** on `/crm`.
**Objective:** The server composition + release-verification layer to safely mount `PipelineWorkspace`: one shell loader, one full loader, a permission resolver, tenant stage definitions for move-target resolution, a pure dual-run comparison, and a controlled harness. **No `/crm` switch, nav rename, or redirects in S4.4.**

> **The adapter already dictates the contract.** `PipelineWorkspace` requires: `initialPresentation: PipelinePresentation`, `permissions: PipelinePresentationPermissions`, `tenantStages: readonly PipelineMoveStageDefinition[]`, `onRefreshPresentation?: () => Promise<PipelinePresentation>`, and optional `fullPresentation`/`currentUserId`/`canCreateEnquiry`. Its mutations are already wired to `crmMoveLeadStageAction` + `completeCrmTaskAction` (convert/mark-lost/contact defer to the lead workspace). S4.4 only has to **produce those four inputs** and verify parity. The builder signature is `buildPipelinePresentation({ leads: CrmKanbanLeadCard[], tasksByLeadId?, communicationsByLeadId?, consultationsByLeadId?, reminderJobsByLeadId?, nowMs, base, permissions, sourceTotal? })`; `loadTier` is inferred from whether `tasksByLeadId` is supplied.

---

## 1. Current `/crm` loader audit

| Loader / function | Data returned | Queries | View | Pipeline shell/full? | Risk |
|---|---|---:|---|---|---|
| `loadCrmShellLeadsBoardIndex` | `{ cards: CrmKanbanLeadCard[], total, truncated, query }` | paginated leads (≤25×100) + `enrichCrmKanbanCards` (clinical, stage-entry, activity, overdue-count batches) | board | **Shell — canonical lead source** | Board cap 2500 / `truncated` |
| `loadCrmShellLeadsIndex` (`loadCrmLeadsShellPage`) | `{ items, total, query }` paginated | one leads page | list | No (board index is canonical) | Duplicate lead query vs board |
| `loadLeadFlowDashboardPayload` | workspace priorities/analytics | many | workspace | No | Re-derives from same leads |
| `loadCrmShellPipelineStages` (`ensureDefaultPipelineStages`) | `FiCrmPipelineStageRow[]` | 1 (+lazy seed) | all | **Shell — stage defs** | Scope dupes |
| `loadCrmShellUserPickerOptions` | owners `{id,email}` | 1 | filters | Optional (owner labels) | — |
| `loadCrmTasksForLead` | tasks for **one** lead | 1/lead | detail | **Full — needs batch variant** | **N+1** if per-card |
| `loadCrmLeadCommunicationsForLead` | comms for one lead | 1/lead | detail | **Full (hint) — batch** | N+1; PHI if body loaded |
| `loadBookingsForLead` | bookings for one lead | 1/lead | detail | **Full (consultation) — batch** | N+1 |
| `loadReminderJobsForLead` | reminder jobs for one lead | 1/lead | detail | **Full (next-action) — batch** | N+1 |
| `loadCrmLeadConversionState` | lead+person+patient+case | 3–4/lead | detail | No (conversion is on `FiCrmLeadRow.converted_*` already in board card) | Redundant |
| `getCrmShellPageSession` / `getCrmShellSessionIfAllowed` | `CrmShellSession {authUserId,fiUserId,role,canUseClinicFeatures}` | 2–4 | gate | **Permissions** | — |
| `isFiOsPlatformAdminFullSessionBypass` + `loadProxyFiUserRowForPlatformAdminTenant` | platform-admin proxy | 2 | gate | **Permissions** | — |
| `canMutateClinicFromOperatorContext` | mutate bool (pure) | 0 | board | **Permissions** | — |

**Duplicated queries today:** switching `/crm` `view` re-runs a different lead loader each time — `loadCrmShellLeadsBoardIndex` (board), `loadCrmShellLeadsIndex` (list), `loadLeadFlowDashboardPayload` (workspace) — three separate lead-fetch paths for the same tenant leads, plus owners/stages/diagnostics reloaded per view. Pipeline collapses these to **one** board-index fetch feeding the builder.

---

## 2. Canonical shell-loader design

```ts
// pipelineLoader.server.ts
type PipelineShellPayload = {
  presentation: PipelinePresentation;           // loadTier: "shell"
  tenantStages: PipelineMoveStageDefinition[];  // §7
  permissions: PipelinePresentationPermissions; // §6
  currentUserId: string | null;
  generatedAt: string;
};

export async function loadPipelineShellPayload(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<PipelineShellPayload>;
```

Steps (reuse existing loaders — **do not** reimplement kanban enrichment):
1. `getCrmShellPageSession(tenantId)` — resolve CRM shell access (redirects if unauthorised; platform-admin proxy handled inside).
2. `loadCrmShellLeadsBoardIndex(tenantId, searchParams)` → `{ cards, total, truncated }` (canonical board-enriched leads).
3. `loadCrmShellPipelineStages(tenantId)` → adapt to `PipelineMoveStageDefinition[]` (§7).
4. `resolvePipelinePermissions(session)` (§6).
5. `buildPipelinePresentation({ leads: cards, nowMs: Date.now(), base: /fi-admin/${tid}, permissions, sourceTotal: total })` — **no maps → `loadTier: "shell"`**.
6. Return `{ presentation, tenantStages, permissions, currentUserId: session.fiUserId, generatedAt }`.

**Shell must NOT load:** full communications, task histories, activity timelines, notes, message bodies, clinical records, financial data, LeadFlow analytics, HubSpot diagnostics. (It already avoids them — the board index only batch-loads clinical scale summaries + overdue **count**, not bodies.)

**Exact reuse:** `getCrmShellPageSession`, `loadCrmShellLeadsBoardIndex`, `loadCrmShellPipelineStages`, `buildPipelinePresentation`. No new lead enrichment.

---

## 3. Full-enrichment loader design

```ts
type PipelineFullPayload = { presentation: PipelinePresentation; generatedAt: string }; // loadTier: "full"

export async function loadPipelineFullPayload(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<PipelineFullPayload>;
```

Steps:
1. Re-run the **same** `loadCrmShellLeadsBoardIndex(tenantId, searchParams)` (same filters/window) → identical `cards`/`total` (see §4 for the identity guard).
2. Extract `leadIds = cards.map(c => c.lead.id)`.
3. **Batch-load enrichment by lead-id array** (new batch loaders, §5): `tasksByLeadId`, `communicationsByLeadId`, `consultationsByLeadId`, `reminderJobsByLeadId`.
4. Build the maps, then `buildPipelinePresentation({ leads: cards, tasksByLeadId, communicationsByLeadId, consultationsByLeadId, reminderJobsByLeadId, nowMs, base, permissions, sourceTotal: total })` — **maps present → `loadTier: "full"`**.
5. Return one complete presentation with the **same visible lead-ID set** as shell.

**Avoiding N+1:** never call per-lead loaders in a loop. Add batch loaders that take `leadIds: string[]`, chunk (120–150 like `enrichCrmKanbanCards`), and query with `.in("lead_id", batch)`. No child component or browser fetches tasks/consultations per card — the adapter's `onRefreshPresentation` calls this one full loader.

---

## 4. Shell/full identity stability

**Hard invariant:** `shell visible lead IDs === full visible lead IDs` (same set, same order after S4.2 sort). The full tier enriches only; it must not add/remove cards, change identity, silently change `sourceTotal`, or move a card because a different lead set was loaded.

Shared inputs (both loaders use identical values):
- **filters + pagination + search** — the same `searchParams` passed to `loadCrmShellLeadsBoardIndex`.
- **lead IDs** — derived from the same board index call.
- **source total** — `total` from the same call.
- **tenant scope** — same `tenantId` + default pipeline scope.
- **operational clock** — `nowMs` passed once; the full payload records its own `generatedAt` (a later instant is fine; the *lead set* must match).

**Hydration guard (pure):**
```ts
function assertPipelineTierIdentity(shellIds: string[], fullIds: string[]):
  { ok: true } | { ok: false; missing: string[]; extra: string[] };
```
The adapter (or the full loader) compares shell vs full lead-ID sets; on mismatch it **blocks the swap** (keeps showing shell + logs a diagnostic) rather than replacing the board with a divergent set. A genuine card move from newer server data is valid only on an **explicit refresh** (which re-runs *both* stages consistently), never from full using a different window.

---

## 5. Presentation input maps

| Map | Source table / loader | Batch key | Included | Excluded | Sort / dedupe |
|---|---|---|---|---|---|
| `tasksByLeadId` | `fi_crm_tasks` (new `loadCrmTasksByLeadIds`) | `lead_id` | active + completed tasks for the lead window (fields per `PipelineTaskInput`: id, leadId, title, dueAtIso, completedAtIso, status, assigneeUserId) | notes bodies, unrelated leads | dedupe by `taskId`; builder sorts (`due_at asc, taskId asc`) |
| `communicationsByLeadId` | `fi_crm_lead_communications` (new `loadCrmCommunicationHintsByLeadIds`) | `lead_id` | **only** `{ communicationId, leadId, nextFollowUpAtIso, channel, outcome }` (the **hint**) | subject, preview, body, external ids | keep latest `next_follow_up_at`; **never becomes a task** |
| `consultationsByLeadId` | bookings (new `loadConsultationBookingsByLeadIds`) | `lead_id` | consultation-type bookings only `{ bookingId, consultationId?, startAtIso, status, cancelledAtIso }` | non-consult bookings, PHI | builder picks next-future-active vs most-recent-terminal |
| `reminderJobsByLeadId` | `fi_reminder_jobs` (new `loadReminderJobsByLeadIds`) | `lead_id` | `{ reminderId, leadId, scheduledAtIso, status, label }` per next-action helper contract | template bodies | pending, `scheduled_at >= now-120s` (matches `deriveCrmLeadNextAction`) |

Guarantees: task IDs dedupe deterministically; communication `next_follow_up_at` stays a **hint** (builder places it after tasks/bookings/reminders); consultations include only consultation bookings; reminder jobs follow the existing helper's window; **orphan tasks (lead not in the window) are reported in `diagnostics.orphanTaskIds`, never card-minted** (builder already enforces this).

---

## 6. Permission resolution

Authoritative existing helpers (do **not** duplicate legacy role checks):
- **View:** `getCrmShellSessionIfAllowed` / `getCrmShellPageSession` (CRM shell roles `admin`/`fi_admin`/`crm_operator` + tenant-admin CRM roles; platform-admin proxy).
- **Mutate:** `canMutateClinicFromOperatorContext({ userRole, canUseClinicFeatures })` (`canUseClinicFeatures` from `resolveDevelopmentClinicAccessForTenant` — this is the **capability-override** path).
- **Convert:** mutate **and** clinic features (conversion creates patient/case) — `canMutate` + role in `CRM_MUTATION_ROLES_LOWER`/clinic features.
- **Book consultation:** bookings-operator eligibility (`getBookingsOperatorSessionIfAllowed`).

```ts
type PipelineResolvedPermissions = {
  canView: boolean; canMutate: boolean; canConvert: boolean;
  canBookConsultation: boolean; canCreateEnquiry: boolean;
};

export function resolvePipelinePermissions(session: CrmShellSession, opts?: {
  bookingsOperator?: boolean;
}): PipelineResolvedPermissions;
```
Mapping: `canView = session exists`; `canMutate = canMutateClinicFromOperatorContext(session)`; `canConvert = canMutate && isConversionRole`; `canBookConsultation = opts.bookingsOperator ?? canMutate`; `canCreateEnquiry = canMutate`. The adapter consumes `PipelinePresentationPermissions` (`canMutate`, `canConvert`, `canBookConsultation?`) + `canCreateEnquiry`. **Read-only** (`canMutate=false`) → S4.2 emits only `open_lead`/`open_patient`; adapter hides mutation buttons. **No new Pipeline role**; capability overrides preserved because they ride `canUseClinicFeatures`.

---

## 7. Stage definitions for movement

Adapt `loadCrmShellPipelineStages(tenantId): FiCrmPipelineStageRow[]` → `PipelineMoveStageDefinition[]`:

```ts
function toPipelineMoveStageDefinitions(rows: FiCrmPipelineStageRow[]): PipelineMoveStageDefinition[] {
  return rows.map(r => ({
    id: r.id, slug: r.slug, label: r.label, sortOrder: r.sort_order,
    isEntry: r.is_entry, isWon: r.is_won, isLost: r.is_lost,
    archived: Boolean((r.metadata as any)?.archived) || false, // no dedicated column; infer from metadata
  }));
}
```
Requirements met: real `fi_crm_pipeline_stages.id`, slug, label, sortOrder, won/lost/entry flags, archived (inferred), tenant scope (loader is tenant-scoped). **Never** a staff-column id as a persistence id (the move-target resolver rejects `stageId === columnId`).

**Client-safe subset:** stage id/slug/label/sortOrder/flags are non-PHI and safe to ship to the client (the adapter needs them for `resolvePipelineColumnEntryStage`). **Recommendation:** include **active stages** (non-archived) in the shell payload for move destinations; **exclude archived** from the client (they can't be destinations) but keep them server-side for dual-run/audit. So shell `tenantStages` = active only; a separate audit path may read archived.

---

## 8. Refresh ownership

**Recommendation: Option D — server-rendered shell + one client full-hydration owner.**

- **Initial shell:** the `/crm` page (S4.5) server-renders `loadPipelineShellPayload` → `<PipelineWorkspace initialPresentation=shell tenantStages permissions onRefreshPresentation=… />`.
- **Full hydration:** a single **server action** (or route handler) `refreshPipelinePresentation(tenantId, searchParams)` → `loadPipelineFullPayload(...).presentation`, wired to the adapter's `onRefreshPresentation`. The adapter calls it once after mount (and stores into state).
- **Mutation refresh:** reuse the **same** `onRefreshPresentation` (the adapter already does `await refresh()` after move/complete) — no separate mechanism.
- **Manual refresh:** same `onRefreshPresentation` (header button).
- **Optional later 60s:** a single interval calling the same `onRefreshPresentation` — one owner, no second loop.

Why not the others: **A** (server action returning full) is essentially Option D's refresh owner — adopt it as the single owner. **B** (API endpoint) is equivalent; a server action is simpler and typed. **C** (`router.refresh()` only) can't return a typed `PipelinePresentation` to the adapter's `onRefreshPresentation` and would re-render the whole page loader (shell) on every mutation — risking shell replacing newer full data. This avoids duplicate queries (one loader per refresh), races (single in-flight `isRefreshing` guard already in the adapter), and two loops.

**Polling in S4.4: NO.** Pipeline is not a live floor board. Default to mutation-driven + manual refresh; a 60s interval is opt-in later only if evidence shows staleness matters.

---

## 9. Filter and pagination contract

Current `/crm` params (via `parseCrmLeadListQuery`): `view` (workspace/board/list), `owner`, `stage`, `status`, `search` (`q`/`searchRaw`), `page`, `pageSize`, `source`, sorting. Future Pipeline input:

```ts
type PipelineQueryState = {
  view: "board" | "follow_ups";
  staffColumnIds: string[];       // client-side over loaded cards
  backendStageSlugs: string[];    // server-side (advanced)
  ownerIds: string[];             // server-side
  sourceKeys: string[];           // server-side
  urgencyFlags: string[];         // client-side (derived)
  lifecycle: "active" | "holding" | "terminal" | null; // client-side
  search: string | null;          // server-side (affects source total)
};
```

- **Server-side (affect the lead window + `total`):** `search`, `ownerIds`, `backendStageSlugs`, `sourceKeys`, pagination. These must be applied in `loadCrmShellLeadsBoardIndex` so both tiers load the same window.
- **Client-side (over already-loaded cards, no refetch):** `staffColumnIds`, `urgencyFlags`, `lifecycle`, `view` — the adapter already does this (`filterPipelineColumns`/`filterPipelineFollowUps`).
- **Truncation:** server truncation (`truncated`/`total`) surfaces as `diagnostics.hiddenLeadCount`; client filters never claim completeness.
- **Follow-ups consistency:** built from the **same** loaded lead window's tasks — never a separate lead set.
- **Search affects source totals:** a server search narrows `total`, so `hiddenLeadCount` reflects the searched set.

**S4.4 defines the contract only** — do not switch live query parsing (that is S4.5). **Never load all leads for client filtering** — server filters bound the window; client filters only re-slice the loaded cards.

---

## 10. Legacy view parity map

| Legacy view | Current information | New Pipeline location | Intentional omission |
|---|---|---|---|
| Workspace (`LeadFlowDashboard`) | follow-up priorities, booking readiness | Follow-ups view + card urgency/next-action | manager analytics/KPIs |
| Board (`CrmKanbanBoard`) | per-backend-stage kanban | Board (staff columns) | raw per-slug columns |
| List (`CrmLeadListTable`) | filterable table + columns | Board cards + filters | dense table columns (some → lead workspace) |
| LeadFlow priorities/operator | HubSpot-first intelligence | (none on cards) | **removed from staff** (platform-admin/diagnostic only) |
| Follow-ups (task queue) | overdue/due tasks | Follow-ups buckets | separate-product framing |
| Conversion board (`/consultation-conversion`) | consult→surgery columns | card `consultation` state + Booked/deposit column | separate board |
| Lead detail (`/crm/leads/[id]`) | full comms/tasks/notes/convert | **preserved** (drill-in) | — |

**Classification:** preserved-in-Pipeline (board, follow-ups, priorities-as-urgency); preserved-in-lead-workspace (comms history, notes, conversion flow, per-slug stage moves); intentionally removed (manager KPIs, HubSpot operator intelligence, dense list columns); platform-admin/diagnostic-only (LeadFlow operator, diagnostics); **true gaps to check before cutover** — any *workflow* (not just a field) reachable only from list/workspace/conversion board (e.g. bulk actions, a specific saved filter, a booking-readiness action) must be confirmed present in Pipeline or the lead workspace. **Reconciling lead IDs is necessary but not sufficient** — §12 hard/intentional split plus a workflow walkthrough is required.

---

## 11. Dual-run comparison contract

```ts
// pipelineDualRunComparison.ts — pure; no PHI.
export function comparePipelineDualRun(input: {
  legacyCards: readonly CrmKanbanLeadCard[];       // from loadCrmShellLeadsBoardIndex (same window)
  legacyStages: readonly FiCrmPipelineStageRow[];
  pipeline: PipelinePresentation;
  tenantId: string;
  nowMs: number;
}): PipelineDualRunComparison;
```
`PipelineDualRunComparison` per the prompt: `legacyLeadIds`, `pipelineLeadIds`, `missingFromPipeline`, `extraInPipeline`, `duplicatePipelineLeadIds`, `stageMismatches[]` (`{leadId, backendStageSlug, pipelineColumnId, expected}`), `ownerMismatches`, `nextActionMismatches[]` (`{leadId, legacyDueAtIso, pipelineDueAtIso, reason, expected}`), `overdueMismatches`, `consultationMismatches`, `conversionMismatches`, `orphanTaskIds`, `hiddenLeadCount`, `pass`.

- **Same window:** both sides derive from the identical `loadCrmShellLeadsBoardIndex` call — lead-ID reconciliation should be exact by construction; any diff is a real defect.
- **Stage compare:** legacy `current_stage_id`→slug vs `resolvePipelineStaffStage(slug).columnId`; grouping is `expected: true`.
- **Pure, IDs/counts only** — no names, emails, phones, or communication content in output.

---

## 12. Hard vs intentional differences

**Hard failures (`pass=false`):** missing lead; extra lead; duplicate Pipeline card; backend-stage→column mismatch (not from grouping); owner mismatch; converted/lost mismatch; task-overdue mismatch; patient/conversion linkage mismatch; shell/full identity mismatch; mutation-capability regression.

**Intentional (classified, never `pass=false`):** multiple backend stages grouped into one staff column; urgency moved from columns/widgets into filters/badges; communication follow-up hint placed **after** tasks/bookings/reminders; analytics/manager KPIs removed; raw list columns not on cards; Follow-ups as task buckets not a peer product; Nurture as holding; terminal columns collapsed.

**Each intentional difference is explicitly flagged** (`expected: true` with a `reason`), and the comparator asserts that intentional flags are set **only** for the enumerated reasons — a broad `expected` must never mask missing data. Test #19 specifically checks the task/comms-ordering difference is classified, not hidden.

---

## 13. Controlled verification harness

**Preferred minimum:**
1. **Pure comparison helper + tests** (fixtures) — deterministic, no I/O.
2. **Controlled script** `scripts/pipeline-dualrun.ts` against a selected tenant — loads legacy board + builds pipeline via the same window, runs `comparePipelineDualRun`, prints IDs/counts + `pass`. Read-only.
3. **Optional hidden platform-admin preview route** for visual verification (§14) — read-only by default.
4. **No ordinary-staff diagnostics.** No temporary structured logs beyond platform-admin.

Mutation testing (if needed) uses a **dedicated test lead** or a **staging tenant** — never mutating real production leads. The preview does not alter data by default.

---

## 14. Preview / harness design

**Recommendation:** a **hidden platform-admin preview route** is worthwhile for visual parity, but keep it minimal and removable — `app/(fi-admin)/fi-admin/[tenantId]/pipeline-preview/page.tsx` gated to platform admin (or reuse an existing platform-admin diagnostics area if one exists). Requirements: platform-admin only (`isFiOsPlatformAdminFullSessionBypass`); selected tenant via param; renders `PipelineWorkspace` from **the same shell/full loaders** (parity); no staff nav exposure; read-only by default; mutation mode behind an explicit query flag + dedicated test lead; diagnostics IDs/counts only; trivially deletable after cutover.

If the team prefers zero new routes, a **script-only** approach (harness #2) plus the fixture tests is sufficient — the preview is a convenience, not a gate. Either way, **do not create a permanent staff product route** (that is S4.5's `/crm` switch).

---

## 15. Cutover gates for S4.5

**Required green:** no missing/extra/duplicate lead IDs; shell/full lead sets identical; backend stages reconcile (grouping intentional); owners reconcile; converted/lost reconcile; overdue reconcile; consultation links reconcile or documented; next-action diffs intentional; grouped-stage moves resolve to **real tenant stage IDs**; read-only non-mutating; capability overrides pass; lead creation works; stage move works; task completion works; conversion flow works; **no duplicate loaders or polling loops**; hidden/truncated counts accurate; production build passes.

**Block cutover:** any lead disappears; a lead appears twice; shell/full use different windows; task/consultation enrichment mints a card; a **staff-column id reaches a mutation**; owner changes due to task assignee; communication hint overrides a task; read-only gains a mutation; capability override lost; legacy deep links break; full hydration replaces the board with a spinner; ordinary staff see diagnostics.

---

## 16. Performance budget

Targets (baseline from current board — `enrichCrmKanbanCards` already chunks at 120–150):

| Stage | Target |
|---|---|
| Shell loader | < ~400ms server (board index + stages + permissions) |
| First meaningful render | shell paints immediately on SSR |
| Full enrichment | < ~700ms (4 batched map loads over the window) |
| Mutation refresh | one full-loader call; < ~700ms |
| Board window | ≤ 2500 (`CRM_BOARD_PAGE_SIZE 100 × 25`), `truncated` surfaced |
| Task batch | chunk 120 lead-ids/query |
| Consultation batch | chunk 120–150 lead-ids/query |

**N+1 risks:** per-lead `loadCrmTasksForLead`/`loadBookingsForLead`/`loadReminderJobsForLead`/`loadCrmLeadCommunicationsForLead` if looped — **must** use batch `.in("lead_id", batch)` variants. Structured timing logs: counts + elapsed + tenantId (permitted), **no PHI**, no permanent dashboards.

---

## 17. Error handling

| Failure | Behaviour |
|---|---|
| Shell loader failure | staff see a non-technical "Pipeline couldn't load — retry" notice; platform-admin sees error kind |
| Full enrichment failure | keep **shell** presentation visible; header notes "details unavailable"; retry on next refresh |
| Partial task failure | that map empty; cards keep shell fields; diagnostic logged (admin) |
| Partial consultation failure | consultation `none`; no card loss |
| Permission resolution failure | fail closed to read-only view (never grant mutation on error) |
| Stale stage definitions | move-target resolver returns `no_backend_stage_for_column`; that destination disabled (already handled by adapter) |
| Hidden/truncated data | `hiddenLeadCount` note, never silent |
| Duplicate lead diagnostics | admin-only; hard alarm |
| Unknown stage | S4.1 fallback column (`qualified`) + `unknownStageLeadIds` (admin) |
| Refresh race | adapter's single `isRefreshing` guard; **last valid presentation stays visible** on failure (already implemented — `refresh()` catches and keeps prior state) |

Ordinary staff get useful, non-technical notices; platform-admin gets IDs + warning kinds. The last valid (full) presentation remains visible after a refresh failure.

---

## 18. Test plan

1. Shell loader uses canonical board leads. 2. Shell calls builder once. 3. Full enriches the same lead IDs. 4. Shell/full lead IDs equal. 5. Tasks batch-loaded (no N+1). 6. Consultations batch-loaded. 7. Communications remain hints (never tasks). 8. Orphan tasks don't mint cards. 9. Tenant stages include real IDs. 10. Permissions preserve capability overrides. 11. Read-only → non-mutating actions. 12. Platform-admin proxy works. 13. Dual-run detects missing lead. 14. …extra lead. 15. …duplicate card. 16. …stage mismatch. 17. Grouped-column mapping accepted as intentional. 18. Owner mismatch blocks. 19. Task/comms ordering diff classified. 20. Overdue mismatch blocks. 21. Conversion mismatch blocks. 22. Hidden/truncated counts reconcile. 23. Shell/full identity mismatch blocks. 24. Preview is platform-admin only. 25. No PHI in dual-run output. 26. One refresh owner used. 27. Full failure keeps shell/last-full. 28. No polling loop by default. 29. Existing lead deep links unchanged. 30. Production build passes.

---

## 19. File-level implementation plan

**Add:**
- `src/lib/crm/pipelineLoader.types.ts` — `PipelineShellPayload`, `PipelineFullPayload`, `PipelineResolvedPermissions`, `PipelineQueryState`.
- `src/lib/crm/pipelineLoader.server.ts` — `loadPipelineShellPayload`, `loadPipelineFullPayload`, `resolvePipelinePermissions`, `toPipelineMoveStageDefinitions`, and **batch loaders** `loadCrmTasksByLeadIds` / `loadCrmCommunicationHintsByLeadIds` / `loadConsultationBookingsByLeadIds` / `loadReminderJobsByLeadIds` (new, mirror `enrichCrmKanbanCards` chunking).
- `src/lib/crm/pipelineLoader.test.ts` — shell/full identity, batch, permissions.
- `src/lib/crm/pipelineDualRunComparison.ts` + `.test.ts` — pure comparison + fixtures.
- `scripts/pipeline-dualrun.ts` — controlled tenant run.
- **Optional:** `app/(fi-admin)/fi-admin/[tenantId]/pipeline-preview/page.tsx` (platform-admin only) — only if visual harness is wanted.

**Smallest additive changes to existing loaders:** none required to existing files — the batch loaders are **new** functions in `pipelineLoader.server.ts` reusing the same tables/patterns. (If a shared query helper is cleaner, add exported helpers additively; do not modify per-lead loaders.)

**Do not modify** S4.1–S4.3 files unless a proven contract defect is found (none identified — the adapter contract is satisfiable as-is).

---

## 20. Delivery sequence

- **S4.4A — Loader input + permission contracts:** `pipelineLoader.types.ts` + `resolvePipelinePermissions` + `toPipelineMoveStageDefinitions` + tests. Pure/shared.
- **S4.4B — Shell loader:** `loadPipelineShellPayload` (board leads + stages + permissions → shell presentation) + tests.
- **S4.4C — Full enrichment loader:** batch loaders + `loadPipelineFullPayload` + N+1/identity tests.
- **S4.4D — Dual-run comparison:** pure helper + fixtures.
- **S4.4E — Controlled tenant verification:** `scripts/pipeline-dualrun.ts` (+ optional preview route).
- **S4.4F — Performance/error closure:** timing logs, partial-failure + refresh-race tests.

**No live `/crm` switch** (that is S4.5).

---

## Conclusion

**1. Canonical shell-loader contract** — `loadPipelineShellPayload(tenantId, searchParams) → { presentation(shell), tenantStages: PipelineMoveStageDefinition[], permissions, currentUserId, generatedAt }`, composed from `getCrmShellPageSession` + `loadCrmShellLeadsBoardIndex` + `loadCrmShellPipelineStages` + `buildPipelinePresentation` (no enrichment maps). Loads no comms/tasks/notes/clinical/financial/analytics.

**2. Canonical full-loader contract** — `loadPipelineFullPayload(tenantId, searchParams) → { presentation(full), generatedAt }`: re-run the same board index for the identical window, batch-load tasks/comms-hints/consultations/reminders by lead-id, build maps, one `buildPipelinePresentation` call, same visible lead-ID set as shell.

**3. Permission resolver** — `resolvePipelinePermissions(session)` from authoritative helpers (`getCrmShellSessionIfAllowed`, `canMutateClinicFromOperatorContext`, conversion-role + bookings-operator checks) → `{ canView, canMutate, canConvert, canBookConsultation, canCreateEnquiry }`. No new role; capability overrides ride `canUseClinicFeatures`.

**4. Shell/full identity invariant** — `shell lead IDs === full lead IDs` (same filters/window/scope/total). A pure `assertPipelineTierIdentity` blocks the shell→full swap on mismatch; card moves come only from explicit refresh, never from a divergent full window.

**5. Batch enrichment strategy** — four new batch loaders keyed by `lead_id` array, chunked 120–150 with `.in(...)` (mirroring `enrichCrmKanbanCards`); comms carry only the `next_follow_up_at` hint; orphan tasks reported not minted; **no per-card client fetches, no N+1**.

**6. Refresh ownership** — Option D: SSR shell + a **single** server action (`onRefreshPresentation`) returning the full `PipelinePresentation`, reused for hydration, mutation refresh, and manual refresh. One loop, one in-flight guard. **No polling by default.**

**7. Dual-run comparison contract** — pure `comparePipelineDualRun({ legacyCards, legacyStages, pipeline, tenantId, nowMs }) → PipelineDualRunComparison`; both sides from the same board window; IDs/counts only, no PHI; grouping/urgency/comms-ordering flagged `expected`.

**8. Controlled verification mechanism** — pure fixtures + `scripts/pipeline-dualrun.ts` against a selected tenant, plus an optional hidden **platform-admin-only** read-only preview route; mutation testing only via a dedicated test lead/staging tenant; removable after cutover.

**9. S4.5 cutover gates** — green only when lead IDs + shell/full sets + stages + owners + conversion + overdue + consultations reconcile (grouping/next-action diffs intentional), grouped moves resolve to real stage IDs, read-only stays non-mutating, capability overrides pass, all four mutations work, no duplicate loaders/pollers, hidden counts accurate, build passes. Block on any vanished/duplicated lead, divergent windows, enrichment-minted card, staff-column id in a mutation, assignee-as-owner, hint-over-task, read-only mutation, lost override, broken deep link, spinner-replaces-board, or staff-visible diagnostics.

**10. Highest-risk loader ambiguity** — **shell/full window divergence.** Both tiers must load the *exact same* lead set; if the full loader re-queries with even slightly different filters/pagination/clock, cards appear to move, vanish, or duplicate purely from the enrichment fetch — indistinguishable from a real data change and corrupting dual-run. Resolution: both tiers call `loadCrmShellLeadsBoardIndex` with identical `searchParams`, derive lead IDs and `sourceTotal` from that one call, and gate the swap on `assertPipelineTierIdentity`. Secondary: per-lead enrichment loops (N+1) — forbidden; batch only.

**11. Minimum reversible S4.4 slice** — **S4.4A + S4.4B**: the permission resolver + stage adapter + `loadPipelineShellPayload` returning a shell `PipelineShellPayload`, exercised only by unit tests and the `scripts/pipeline-dualrun.ts` harness (or the hidden preview) — **no `/crm` change, no full loader, no mutations**. This proves the canonical shell composition and permission/stage contracts against a real tenant and is reversible by deleting the new files; the full loader (S4.4C), dual-run (S4.4D), and verification (S4.4E) layer on before S4.5 mounts it live.
