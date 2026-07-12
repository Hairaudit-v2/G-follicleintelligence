# FI-UX-REBUILD-1 — S4.2: Canonical Pipeline Presentation Contract

**Date:** 2026-07-11
**Status:** Ticket-ready design (read-only audit; no code changed)
**Depends on:** S4.1 Canonical Pipeline Stage & Lead Model (in flight — Cursor; not yet landed). S4 plan (`fi-ux-rebuild-1-s4-pipeline-v1-plan.md`).
**Objective:** Define the pure presentation boundary between the existing CRM engine and the future Pipeline UI — one deterministic, deduplicated `PipelinePresentation`: one card per `leadId`, one staff column, one canonical next follow-up, one owner, one consultation summary, one conversion state, advisory actions, and a time-based Follow-ups view over the same leads.

> **S4.1 coupling.** This contract consumes the S4.1 staff-stage model (slug→staff-column crosswalk, terminal/holding classification, unknown-stage fallback, urgency boundary). Those types are referenced here as `PipelineStaffColumnId` / `PipelineStaffStageModel` / `pipelineUrgencyBoundary`; if S4.1's exported names differ, only the imports in §21 change. **No S4.1 file is modified.**

---

## 1. Raw loader and payload inventory

| Payload section | Loader / source | Entity key | Staff value | Duplicate risk | Keep for Pipeline? |
|---|---|---|---|---|---|
| Enriched kanban cards | `loadCrmShellLeadsBoardIndex` → `enrichCrmKanbanCards` | **`lead.id`** | **Canonical card source** (lead + stage + person + owner + patient + daysInStage + overdueTaskCount + isHighValue) | Low (board dedupes by lead) | **Yes — canonical** |
| Paginated lead list | `loadCrmShellLeadsIndex` (`loadCrmLeadsShellPage`) | `lead.id` | List/table view of same leads | High (same leads) | **No** (board index is the source) |
| LeadFlow workspace payload | `loadLeadFlowDashboardPayload` | mixed | Follow-up priorities, booking readiness (derived) | High (re-derives from same leads) | **No** (derive from canonical instead) |
| LeadFlow operator payload | `loadLeadFlowOperatorDashboardPayload` | HubSpot-first | External intelligence | High + external | **No** (diagnostics, not staff card data) |
| Consultation conversion board | `loadConsultationConversionBoardPayload` | lead / booking | Consult→surgery columns (derived from bookings) | High (alternate board of same leads) | **Consultation input only** (feed `consultationsByLeadId`; not a second board) |
| Lead tasks | `loadCrmTasksForLead` / board overdue aggregate | `task.id` (lead_id link) | Follow-ups + next action | Multiple tasks/lead | **Yes** (full tier + Follow-ups) |
| Lead communications | `loadCrmLeadCommunicationsForLead` | `comm.id` | Contact log + `next_follow_up_at` **hint** | competes with tasks | **Hint only** (never canonical follow-up) |
| Consultation / bookings | `loadBookingsForLead` / conversion loader | `booking.id` (lead_id) | Consultation state | multiple/lead | **Consultation input** |
| Conversion state | `loadCrmLeadConversionState` (also on `FiCrmLeadRow.converted_*`) | `lead.id` | Converted/patient link | — | **Yes** (from lead row) |
| Owner / person resolvers | `loadCrmShellUserPickerOptions`; `person.metadata`; `personMetadataDisplayLabel` | user/person | Owner + display name | — | **Yes** |
| Stage definitions | `loadCrmShellPipelineStages` (`ensureDefaultPipelineStages`) | `stage.id` | Column mapping | scope dupes | **Yes** (via S4.1 crosswalk) |
| Today lead/task signals | dashboard `staleLeads` / `tasksDue` | lead/task | urgency deep-links | re-derives | **No** (urgency is a filter here) |

**Source classification:** canonical lead rows = enriched kanban cards; stage defs = pipeline stages; follow-up tasks = `fi_crm_tasks`; communication hints = `fi_crm_lead_communications.next_follow_up_at`; consultation state = bookings/conversion loader; conversion state = lead `converted_*`; patient linkage = `lead.patient_id`; urgency = derived (daysInStage/overdueTaskCount/isHighValue); analytics = LeadFlow payloads; external diagnostics = HubSpot/operator payload; duplicate representations = list/workspace/conversion boards.

**Canonical composition point:** **do not accept one mega-payload.** The builder should accept **explicit arrays/maps** — `leads: CrmKanbanLeadCard[]` (the board index is the single best canonical source: it already enriches, dedupes by lead, and reports `total`/`truncated`) plus separately-loaded `stages`, `tasksByLeadId`, optional `communicationsByLeadId`, optional `consultationsByLeadId`. This keeps the builder pure and lets shell/full tiers pass different inputs. **Caveat:** the board index is query-filtered and page-capped (`CRM_BOARD_PAGE_SIZE=100 × CRM_BOARD_MAX_PAGES=25` = 2500, `truncated` flag) — Follow-ups therefore covers only the loaded lead set; §16 handles hidden counts.

---

## 2. Canonical card source

**Only `fi_crm_leads.id` may mint a card.** Card-minting rule:

1. Build `Map<leadId, PipelineLeadCard>` from `leads: CrmKanbanLeadCard[]` (one entry per `lead.id`).
2. Enrich existing entries from tasks, communications, consultations, conversion, stage model — **enrichment only mutates existing cards**.
3. No task / communication / consultation / patient / booking / HubSpot row may create a card.
4. No enrichment step inserts a missing lead — a source keyed to an absent `leadId` is reported in diagnostics (`orphanTaskIds`, etc.), never minted.
5. Multiple leads for one person → multiple separate cards (never merged by person).
6. A converted lead remains a lead card with `conversion.state = "converted"` + `patientId` link.
7. Archived leads follow the **S4.1 visibility rule** (default: hidden from active columns, counted in diagnostics; surfaced only under an explicit "archived" filter if S4.1 says so).

**Safest canonical rows:** `CrmKanbanLeadCard[]` from `loadCrmShellLeadsBoardIndex`. It contains all leads needed for **Board**; **Follow-ups** reuses the same set (a task whose lead is outside the loaded set = orphan, §6/§16). It does **not** carry per-lead task lists or consultation state — those arrive via the maps (full tier).

---

## 3. Proposed Pipeline presentation types

```ts
// pipelinePresentation.types.ts — pure; no React, no server-only, no loaders.
import type { PipelineStaffColumnId } from "@/src/lib/crm/pipelineStaffModel"; // S4.1

export type PipelineUrgencyLevel = "blocker" | "action_needed" | "information";
export type PipelineUrgencyFlag =
  | "overdue_follow_up" | "due_today" | "untouched_new" | "unassigned"
  | "stale" | "consultation_due" | "consultation_no_show" | "high_value" | "blocked";
export type PipelineNextActionKind = "task" | "task_no_date" | "communication_hint" | "appointment" | "reminder" | "none";
export type PipelineConsultationState = "none" | "booked" | "due_today" | "completed" | "cancelled" | "no_show";
export type PipelineBlockerSeverity = "blocker" | "action_needed" | "information";
export type PipelineCardActionId =
  | "contact" | "log_outcome" | "schedule_follow_up" | "complete_follow_up"
  | "assign_owner" | "move_stage" | "book_consultation" | "mark_lost"
  | "reopen" | "convert" | "open_lead" | "open_patient";

export type PipelineCardBlocker = {
  id: string; kind: string; label: string; severity: PipelineBlockerSeverity; href: string | null;
};

export type PipelineLeadCard = {
  leadId: string;                                   // CANONICAL KEY
  person: { personId: string | null; displayName: string; patientId: string | null };
  contact: { hasEmail: boolean; hasPhone: boolean; preferredChannel: "phone"|"email"|"sms"|null };
  owner: { userId: string | null; displayName: string | null; unassigned: boolean };
  source: { key: string | null; label: string; externalSystem: string | null };
  stage: {
    backendStageId: string | null; backendSlug: string | null; backendLabel: string | null;
    staffColumnId: PipelineStaffColumnId; staffColumnLabel: string; daysInStage: number | null;
  };
  urgency: { flags: PipelineUrgencyFlag[]; highest: PipelineUrgencyLevel | null; primaryLabel: string | null };
  nextAction: { kind: PipelineNextActionKind; label: string; dueAtIso: string | null; overdue: boolean; sourceId: string | null };
  followUps: { openCount: number; overdueCount: number; dueTodayCount: number; nextTaskId: string | null };
  consultation: { state: PipelineConsultationState; nextBookingId: string | null; nextBookingAtIso: string | null; lastConsultationId: string | null };
  conversion: { state: "active"|"converted"|"lost"|"archived"; convertedAtIso: string | null; patientId: string | null; lostReason: string | null };
  score: { value: number | null; highValue: boolean };
  blockers: PipelineCardBlocker[];
  primaryAction: PipelineCardActionId | null;
  secondaryActions: PipelineCardActionId[];
  links: { lead: string; patient: string | null; calendar: string; consultation: string | null };
};

export type PipelinePresentationColumn = {
  id: PipelineStaffColumnId; label: string;
  kind: "active" | "holding" | "terminal_won" | "terminal_lost";
  cards: PipelineLeadCard[]; count: number; collapsedByDefault: boolean;
};

export type PipelineFollowUpItem = {
  taskId: string; leadId: string; personDisplayName: string; title: string;
  dueAtIso: string | null; assignee: { userId: string | null; displayName: string | null };
  status: string; contact: { hasEmail: boolean; hasPhone: boolean };
  allowedActions: PipelineCardActionId[]; links: { lead: string };
};

export type PipelineFollowUpView = {
  buckets: { overdue: PipelineFollowUpItem[]; dueToday: PipelineFollowUpItem[]; upcoming: PipelineFollowUpItem[]; noDueDate: PipelineFollowUpItem[]; completed: PipelineFollowUpItem[] };
  summary: { overdue: number; dueToday: number; upcoming: number; noDueDate: number };
};

export type PipelineFilterOption = { id: string; label: string; count: number };
export type PipelineFilterOptions = {
  staffColumns: PipelineFilterOption[]; backendStages: PipelineFilterOption[];
  owners: PipelineFilterOption[]; sources: PipelineFilterOption[];
  urgency: PipelineFilterOption[]; lifecycle: PipelineFilterOption[]; // active/holding/terminal
};

export type PipelineGlobalAction = { id: "new_enquiry"|"open_follow_ups"|"open_board"; label: string; href: string | null };

export type PipelinePresentationSummary = {
  totalLeads: number; byColumn: Record<string, number>;
  unassigned: number; overdueFollowUps: number; dueTodayFollowUps: number;
  untouchedNew: number; converted: number; lost: number;
};

export type PipelinePresentationDiagnostics = {
  sourceLeadCount: number; visibleLeadCount: number; hiddenLeadCount: number;
  duplicateLeadIds: string[]; orphanTaskIds: string[]; unknownStageLeadIds: string[];
  conversionInconsistencies: Array<{ leadId: string; kind: string }>;
};

export type PipelinePresentation = {
  generatedAt: string; loadTier: "shell" | "full";
  columns: PipelinePresentationColumn[];
  followUps: PipelineFollowUpView;
  summary: PipelinePresentationSummary;
  filters: PipelineFilterOptions;
  actions: PipelineGlobalAction[];
  diagnostics: PipelinePresentationDiagnostics;
};
```

The UI never needs raw payloads: column membership (`staffColumnId`), urgency (`urgency`), next follow-up (`nextAction`), overdue (`nextAction.overdue`/`followUps`), conversion (`conversion`), actions (`primaryAction`/`secondaryActions`), duplicates/hidden (`diagnostics`) are all pre-computed. No DB rows or HubSpot payloads are exposed.

---

## 4. Shell-tier vs full-tier contract

**One builder over differently-enriched inputs** (not two loaders, not one loader with a tier param). `loadTier` reflects which optional maps were supplied.

| Tier | Inputs | Card fields populated |
|---|---|---|
| **Shell** | `leads: CrmKanbanLeadCard[]` + stage model | leadId, person.displayName, stage (+daysInStage), owner, source, contact availability, `conversion` (from lead row), `score.highValue`, `followUps.overdueCount` (from kanban `overdueTaskCount`), `links.lead`. `nextAction.kind="none"` placeholder; `consultation.state="none"`; `blockers` cheap-only. |
| **Full** | + `tasksByLeadId`, `communicationsByLeadId?`, `consultationsByLeadId`, `reminderJobsByLeadId?` | canonical `nextAction` (§5), `followUps.{openCount,dueTodayCount,nextTaskId}`, `consultation` (§7), full `blockers`, `urgency` flags needing tasks/consultations, Follow-ups view. |

**Never in every board payload:** full communication history, message bodies, all notes, clinical record details, financial history, HubSpot diagnostics, owner/business analytics, full activity timeline. (The lead **workspace** loads those on drill-in only.)

**Rationale for one builder:** the board loader already produces `CrmKanbanLeadCard` cheaply (with `overdueTaskCount` + `daysInStage`); shell can paint columns immediately. The exact next-follow-up **date**, the Follow-ups view, and consultation state require the maps — so they are full-tier. Shell knows *overdue count* but not the *next due date* (the kanban aggregate returns a count, not the task), so shell must not claim a next-follow-up date.

---

## 5. Follow-up source-of-truth contract

**Rule: tasks are canonical; `communications.next_follow_up_at` is a secondary hint only.** Reuse the existing tested **`deriveCrmLeadNextAction(tasks, reminderJobs, leadBookings, now)`** (tasks-first → booking → reminder), then append the comms hint as a final fallback via a thin wrapper `derivePipelineNextAction`.

| Case | Deterministic behaviour |
|---|---|
| 1. Open task w/ due + comms hint | Task wins → `kind: "task"`, `dueAtIso = task.due_at`. Hint ignored. |
| 2. Multiple open follow-up tasks | Earliest `due_at` wins (`deriveCrmLeadNextAction`); others counted in `followUps.openCount`. |
| 3. Task with no due date | `kind: "task_no_date"` (after all dated tasks/bookings); no `dueAtIso`. |
| 4. Comms hint, no task | `kind: "communication_hint"`, `dueAtIso = next_follow_up_at`, `sourceId = comm.id`. |
| 5. Completed task + future comms hint | Completed tasks excluded; comms hint used (`communication_hint`). |
| 6. Conflicting task vs comms dates | Task date wins (canonical); hint never overrides. |
| 7. Overdue task + future task | Earliest due wins (the overdue one) → `overdue: true`. |
| 8. Task assigned to non-owner | Next-action still selected by due date; assignee irrelevant to selection (owner unchanged, §9). |
| 9. Orphan task (lead absent) | Not selected (its lead has no card); reported `orphanTaskIds`. |
| 10. Duplicate task IDs | First by `(due_at, taskId)`; duplicates dropped deterministically. |

**Recommended precedence** (wrapper): 1) earliest open task with due; 2) open task without date; 3) next booking / reminder (via `deriveCrmLeadNextAction`); 4) communication hint; 5) none.

> **Deviation note (coordinate):** `deriveCrmLeadNextAction` orders *booking/reminder before* any comms hint (it has no comms concept). The S4.2 prompt suggested comms hint at #3 *before* booking at #4. **Recommendation: keep the existing helper's order and put the comms hint last** — reusing the tested helper beats inventing a new rule, and tasks/bookings are stronger operational signals than a comms `next_follow_up_at` timestamp. Flag this ordering choice for S4.5 dual-run as an *intentional* difference.

---

## 6. Task and lead deduplication

- **One card per `leadId`** — `Map<leadId, card>`; enrichment attaches, never inserts.
- **Multiple tasks per card** — all counted in `followUps`; only the canonical next surfaces on the card (`nextTaskId`).
- **One canonical next task** — earliest open dated task (§5).
- **Task counts retained** — `openCount`, `overdueCount`, `dueTodayCount`.
- **No task mints a card** — tasks keyed to an absent lead → `orphanTaskIds`.
- **One task appears once in Follow-ups** — bucketed by `groupCrmTasksByBuckets` (exactly one of overdue/due_today/upcoming/no_due/completed).
- **Completed tasks excluded from active buckets** — `completed_at` set → `completed` bucket only.
- **Orphan tasks reported, no card** — diagnostics.
- **Duplicate task IDs ignored deterministically** — dedupe by `taskId`, keep first after stable sort.
- **Equal due dates sorted stably** — `(due_at asc, taskId asc)` (matches `crmTaskBuckets` sort + taskId tiebreak).

**Canonical keys:** lead card = `leadId`; follow-up work item = `taskId`. **Never** dedupe leads by personId / patientId / email / phone.

---

## 7. Consultation enrichment

**Current derivation:** consultation state comes from **bookings** linked to the lead (`loadBookingsForLead`, and the conversion board's `loadConsultationConversionBoardPayload` picks a column from `booking_status` + `start_at` + `cancelled_at`). Booking statuses: `scheduled | confirmed | arrived | completed | cancelled | no_show`.

**Canonical `PipelineConsultationState` selection** (from `consultationsByLeadId: PipelineConsultationInput[]`, where each input = `{ bookingId, startAtIso, status, cancelledAtIso }` limited to consultation-type bookings):

1. **Next future active booking** (`status ∈ {scheduled, confirmed, arrived}`, `startAt ≥ todayStart`): `booked`; if `startAt` is today → `due_today`. Sets `nextBookingId`/`nextBookingAtIso`.
2. Else **most recent terminal**: `completed` → `completed` (sets `lastConsultationId`); `no_show` → `no_show`; `cancelled` (or `cancelled_at`) → `cancelled`.
3. Else `none`.

| Case | Rule |
|---|---|
| Multiple consultations/lead | One summary: future-active beats past-terminal; among futures pick earliest; among terminals pick most recent. |
| Future booking + completed past | `booked`/`due_today` (future wins); `lastConsultationId` still set from the completed one. |
| Rescheduled | New future booking = the active one; old cancelled is terminal-ignored. |
| No-show then new booking | Future booking wins → `booked`; `no_show` retained only if no future booking. |
| Cancelled booking | `cancelled` only if it is the most recent and no active future exists. |
| Consultation without lead linkage | Not in `consultationsByLeadId` (keyed by lead) → ignored; never mints a card. |
| Booking linked to both patient & lead | Attributed by `lead_id` to that one lead card. |

**Never** create multiple lead cards for multiple consultations — consultation is a per-lead summary field.

---

## 8. Conversion and lost-state reconciliation

Inputs: `lead.status` (`open`/`converted`/`lost`/`archived`), `current_stage_id` → stage `is_won`/`is_lost`, `converted_at`, `patient_id`, lost-reason metadata, archived. **Apply S4.1 precedence** for the canonical `conversion.state`.

| Inconsistent-but-recoverable record | Presentation state | Audit warning | Visible? | Mutations |
|---|---|---|---|---|
| `converted_at` set but active stage | `converted` (conversion timestamp wins) | `conversionInconsistencies: converted_active_stage` | Yes | Suppress `convert`; allow `open_patient` |
| Won stage, no `patient_id` | `active` (won unproven) | `won_without_patient` | Yes | Allow `convert` |
| `status=lost` but active stage | `lost` (status wins per S4.1) | `lost_active_stage` | Terminal column | Suppress mutations except `reopen` |
| Active status but lost stage | `lost` (stage `is_lost` wins) or per S4.1 | `active_lost_stage` | Terminal | `reopen` only |
| Converted, no patient link | `converted` | `converted_without_patient` | Yes | Suppress `open_patient` |
| Archived w/ open tasks | `archived` | `archived_with_open_tasks` | Per S4.1 visibility | Suppress mutations |

**Never silently rewrite DB values** — the builder classifies and warns via `diagnostics.conversionInconsistencies`; the card stays visible (so staff can fix it), and inconsistent records suppress the risky mutation only.

---

## 9. Owner and assignment rules

- **Card owner** = `lead.primary_owner_user_id` (surfaced via `owner.userId`/`displayName`; `unassigned = true` when null/missing).
- **Follow-up item assignee** = `task.assignee_user_id`.
- **Assigned-to-me (Board)** filter → lead owner.
- **Assigned-to-me (Follow-ups)** filter → task assignee.
- **Missing/deleted owner** → `unassigned` (never blank).
- **Task assigned to someone else** never changes the lead owner.

Current UI conflict: the board shows lead owner (`item.owner.email`), while task assignee only appears in lead-detail task lists — S4.2 formalises the split so the two filters read different fields.

---

## 10. Urgency derivation

Presentation-level flags (thresholds reuse **S4.1 `pipelineUrgencyBoundary`**; where loaders currently differ, S4.2 adopts the S4.1 helper as canonical — do not invent new thresholds):

| Flag | Input | Threshold | Applies to | Severity | Label | Filter |
|---|---|---|---|---|---|---|
| `overdue_follow_up` | task `due_at`<now, active, not completed (`overdueTaskCount`>0) | any | active/holding | action_needed | "Overdue follow-up" | ✅ |
| `due_today` | task due today | UTC today (`groupCrmTasksByBuckets`) | active/holding | action_needed | "Due today" | ✅ |
| `untouched_new` | stage=new + no activity since create | S4.1 (e.g. daysInStage ≥ threshold / no contact) | active | action_needed | "New, not contacted" | ✅ |
| `unassigned` | `owner.unassigned` | — | active/holding | action_needed | "Unassigned" | ✅ |
| `stale` | `daysInStage`/`lastActivityAtIso` | S4.1 stale threshold | active/holding | information | "Stale" | ✅ |
| `consultation_due` | `consultation.state ∈ {booked,due_today}` | today/near | active | information | "Consultation due" | ✅ |
| `consultation_no_show` | `consultation.state = "no_show"` | — | active | action_needed | "Consultation no-show" | ✅ |
| `high_value` | `isHighValue` (priority high/urgent/p1/critical) | — | active/holding | information | "High value" | ✅ |
| `blocked` | any `blocker`-severity blocker (§11) | — | active/holding | blocker | "Blocked" | ✅ |

Terminal leads (converted/lost/archived) carry no active urgency flags. `urgency.highest` = max severity; `urgency.primaryLabel` = label of the highest (ties → fixed flag order above, then flag id).

---

## 11. Blocker model

**On Pipeline cards:** no contact details; no owner; overdue follow-up (as blocker only when also past a hard threshold — otherwise urgency flag); consultation no-show needing rebook; missing required next action; conversion inconsistency (§8); duplicate external-identity warning (HubSpot `external_*` collision surfaced by loader).

**Excluded:** clinical readiness, surgery-day blockers, financial ledger detail, platform diagnostics, marketing analytics, system health.

Severity: `blocker | action_needed | information`. **Strongest-blocker selection:** max severity; ties broken by a fixed `kind` priority order then `kind` asc (deterministic). `blockers[]` retains all (strongest first); the card's `urgency.highest` reflects the strongest. Secondary blockers stay available for the workspace.

---

## 12. Action contract

| Action | Existing mutation / route | Role requirement | State requirement | Server re-check |
|---|---|---|---|---|
| `contact` | `leadCommunications` create | canMutate | active/holding | ✅ |
| `log_outcome` | `fi_crm_lead_communications` (outcome) | canMutate | active/holding | ✅ |
| `schedule_follow_up` | `fi_crm_tasks` create | canMutate | active/holding | ✅ |
| `complete_follow_up` | task complete (`crmTaskPolicy`) | canMutate | has open task | ✅ |
| `assign_owner` | lead update (`primary_owner_user_id`) | canMutate | any active | ✅ |
| `move_stage` | **`moveCrmLeadToStage`** | canMutate | not terminal (unless reopen) | ✅ |
| `book_consultation` | existing booking flow (links `lead_id`) | canMutate + bookings | active | ✅ |
| `mark_lost` | `moveCrmLeadToStage` → `is_lost` + reason metadata | canMutate | active/holding | ✅ |
| `reopen` | `moveCrmLeadToStage` → active stage | canMutate | terminal | ✅ |
| `convert` | **`executeCrmLeadConversion`** | canMutate + canConvert | qualified+; not converted | ✅ |
| `open_lead` | route `/crm/leads/{id}` | view | any | n/a (nav) |
| `open_patient` | route `/patients/{id}` | view | has `patientId` | n/a (nav) |

`primaryAction`/`secondaryActions` are **advisory** (computed from `permissions` + state); React must not independently decide eligibility, and the server re-checks every mutation. Read-only (`canMutate=false`) → only `open_lead`/`open_patient`. No new mutation APIs.

---

## 13. Column and card sorting

Columns come from S4.1 (order supplied). **Deterministic within-column order** (validate against current kanban, which sorts by stage + recency):

1. `blocked` (blocker severity) → 2. overdue follow-up → 3. due today → 4. untouched new → 5. consultation due/no-show → 6. earliest `nextAction.dueAtIso` → 7. high value → 8. oldest `created_at` → 9. `leadId` (stable fallback).

- **Null/invalid dates** sort last (treat as `+Infinity`).
- **Terminal columns** (converted/lost): sort by `convertedAtIso`/recency desc, then `leadId`.
- **Nurture (holding):** same rules but no urgency escalation drives it up; ordered by nextAction then leadId.
- **Equal scores / all-equal keys** → `leadId` asc.

The UI receives cards **already ordered**; it must not re-sort by business fields.

---

## 14. Follow-ups view contract

Built from `tasksByLeadId` over the **same** loaded leads, using `groupCrmTasksByBuckets(tasks, now)` (overdue / due_today / upcoming / no_due / completed — each task in exactly one bucket). Each `PipelineFollowUpItem`: `taskId`, `leadId`, `personDisplayName`, `title`, `dueAtIso`, `assignee`, `status`, `contact`, `allowedActions` (`complete_follow_up`/`contact` gated), `links.lead`.

- A task appears in **exactly one** bucket.
- **Completed** may be omitted by default or capped (e.g. last 50) — configurable, not required for first paint.
- **Orphan tasks** (lead not in the card map) are **excluded** from buckets and reported in `diagnostics.orphanTaskIds` (they have no lead card to open).
- Bucket ordering: `(due_at asc, taskId asc)` (matches `crmTaskBuckets`).

---

## 15. Filter model

Filters derived from presentation data (counts computed by the builder), stable IDs, URL-query-friendly:

| Filter group | IDs | Select | Applies to |
|---|---|---|---|
| Staff column | `col:<staffColumnId>` | multi | Board |
| Backend stage | `stage:<slug>` | multi | Board (advanced) |
| Owner | `owner:<userId>` | multi | Board |
| Assigned to me | `mine` | toggle | Board (owner) / Follow-ups (assignee) |
| Unassigned | `unassigned` | toggle | Board |
| Source | `source:<key>` | multi | Board |
| Overdue | `overdue` | toggle | Board + Follow-ups |
| Due today | `due_today` | toggle | Board + Follow-ups |
| Untouched new | `untouched_new` | toggle | Board |
| Consultation due | `consultation_due` | toggle | Board |
| High value | `high_value` | toggle | Board |
| Lifecycle | `life:active` / `life:holding` / `life:terminal` | single | Board |

Each option carries a `count`. **No separate route per filter** — filters are query params over the one Pipeline route. `mine` intentionally reads lead owner on Board and task assignee on Follow-ups (§9).

---

## 16. Truncation, pagination and hidden counts

```ts
diagnostics: {
  sourceLeadCount: number;   // sourceTotal from board loader (page.total)
  visibleLeadCount: number;  // cards minted
  hiddenLeadCount: number;   // max(0, sourceLeadCount - visibleLeadCount)
  duplicateLeadIds: string[];
  orphanTaskIds: string[];
  unknownStageLeadIds: string[];
}
```

- **Never silently drop leads** — `hiddenLeadCount` derives from the board loader's `total` vs minted cards (the board is capped at 2500 / `truncated`).
- **Preserve source total** via `sourceTotal` input.
- **One card per visible lead.**
- **Unknown-stage leads** stay visible under the S4.1 fallback column and are listed in `unknownStageLeadIds`.
- **Pagination/windowing stays loader-owned** — the builder reports, the UI shows "N more", never pretends a column is complete.

---

## 17. Presentation invariants

1. Every visible `leadId` appears exactly once (across all columns).
2. Every card belongs to exactly one staff column.
3. Every task appears in at most one Follow-ups bucket.
4. No task mints a lead card.
5. No consultation mints a lead card.
6. Multiple consultations enrich one card.
7. Multiple leads for one person → separate cards.
8. Converted leads retain lead identity (+patient link).
9. Unknown stages use the S4.1 fallback.
10. Terminal/holding classification is deterministic.
11. Exactly one canonical next action per lead.
12. Exactly one canonical owner per card.
13. Same inputs + same `nowMs` → identical output (pure).
14. No PHI in diagnostics (IDs/counts only).

---

## 18. Proposed builder signature

```ts
export function buildPipelinePresentation(input: {
  leads: CrmKanbanLeadCard[];                                           // canonical card source (board-enriched)
  stageModel: PipelineStaffStageModel;                                  // S4.1 crosswalk + fallback + terminal/holding
  tasksByLeadId?: ReadonlyMap<string, FiCrmTaskRow[]>;                  // full tier
  communicationsByLeadId?: ReadonlyMap<string, FiCrmLeadCommunicationRow[]>; // optional hint
  consultationsByLeadId?: ReadonlyMap<string, PipelineConsultationInput[]>;  // full tier
  reminderJobsByLeadId?: ReadonlyMap<string, FiReminderJobWithTemplate[]>;   // optional (next-action parity)
  nowMs: number;
  base: string;                                                        // `/fi-admin/${tid}`
  permissions: { canMutate: boolean; canConvert: boolean };
  sourceTotal?: number;                                                // board loader page.total
}): PipelinePresentation;
```

Recommendations:
- **Use enriched `CrmKanbanLeadCard[]`** as lead inputs — safer than raw rows (already deduped, board-scoped, carries daysInStage/overdue/highValue/person/owner). Raw `FiCrmLeadRow[]` would force the builder to re-enrich (I/O) — reject.
- **Pass stage rows via the S4.1 model** (`PipelineStaffStageModel`), not raw `FiCrmPipelineStageRow[]`, so slug→column + fallback live in S4.1.
- **Maps constructed by the loader before the builder** — the builder stays pure (no grouping queries).
- **Communications optional** (hint; omit on shell).
- **Consultations optional** (full tier only).
- **Pure:** no Supabase, React, loaders, feature flags, mutations, or wall-clock (`nowMs` injected).

---

## 19. Dual-run preparation (for S4.5)

Fields S4.5 should compare old CRM vs new presentation:

| Field | Reconciliation |
|---|---|
| Lead IDs (set) | **Hard** — must match (missing/extra = block) |
| Duplicate lead IDs | **Hard** — must be empty |
| Backend stage slug | **Hard** — per lead |
| Staff column | Intentional (S4.1 grouping) |
| Owner | **Hard** |
| Canonical next follow-up | Intentional where comms-hint ordering differs (§5); else hard |
| Overdue state | **Hard** (same `groupCrmTasksByBuckets`/overdue rule) |
| Consultation linkage | Mostly hard; state grouping intentional |
| Converted/lost state | **Hard** |
| Orphan tasks | Reported, not a card diff |
| Hidden/truncated counts | Intentional (both truncate) |

Intentional differences: staff-column grouping, urgency-as-filter, comms-hint-last ordering, dropped analytics. **Do not implement the dual-run helper here.**

---

## 20. Test matrix

1. One lead row → one card. 2. Duplicate enrichment → no second card. 3. Multiple tasks enrich one card. 4. Earliest open dated task = canonical next. 5. Comms hint does **not** override an open task. 6. Comms hint used when no task. 7. Completed task not selected. 8. Overdue flag consistent (`groupCrmTasksByBuckets`). 9. One task → one bucket. 10. Orphan task reported, no card. 11. Multiple consultations → one card. 12. Future consultation selected over past completed. 13. No-show then new booking → `booked`. 14. Converted lead links patient. 15. Lost lead retains reason. 16. Owner ≠ task assignee, no conflict. 17. Unassigned explicit. 18. Two leads one person → separate. 19. Unknown stage → S4.1 fallback. 20. Nurture stays holding. 21. Converted/lost terminal. 22. Strongest blocker deterministic. 23. Secondary blockers retained. 24. Advisory actions respect permissions. 25. Read-only → nav actions only. 26. Equal priorities → `leadId`. 27. Invalid dates fail safe (sort last). 28. Truncated source → `hiddenLeadCount`. 29. Empty input → valid empty presentation. 30. Same input+clock → identical output. 31. Diagnostics IDs/counts only (no PHI). 32. No LeadFlow/CRM technical terms in staff labels.

---

## 21. File-level implementation plan

**Add:**
- `src/lib/crm/pipelinePresentation.types.ts` (§3 types).
- `src/lib/crm/pipelinePresentation.ts` (`buildPipelinePresentation` + `derivePipelineNextAction` wrapper + pure helpers).
- `src/lib/crm/pipelinePresentation.test.ts` (§20 matrix).

**Smallest additive exports needed (coordinate, do not modify behaviour):**
- Task models: `groupCrmTasksByBuckets`, `CRM_TASK_ACTIVE_STATUS_VALUES`, `CrmTaskUiBucket` (already exported).
- Next-action: `deriveCrmLeadNextAction`, `CrmLeadNextAction` (already exported) — wrapped, not modified.
- Stage model: S4.1 `PipelineStaffColumnId` / `PipelineStaffStageModel` / crosswalk + fallback + terminal/holding classifier (**S4.1 owns**; import only).
- Consultation: a small pure `PipelineConsultationInput` shape + a booking→state mapper (may live in the builder file; reuse conversion-board status logic conceptually, no import of the server loader).
- Kanban types: `CrmKanbanLeadCard`, `CrmShellLeadListItem` (already exported).

**Do not modify:** routes, navigation, React components, mutations, HubSpot ingestion, DB schema, S3 files, S4.1 files (unless an exported *type* is genuinely required — coordinate, additive only).

---

## 22. Verification plan

**Focused (per-PR):**
- `node --test src/lib/crm/pipelinePresentation.test.ts` (new).
- `node --test src/lib/crm/crmLeadNextAction.test.ts` `crmTaskBuckets`-related tests, S4.1 stage-model tests, kanban tests (unchanged, prove no regression via reuse).
- `tsc --noEmit` on the new files (typecheck the contract).
- Terminology audit (no LeadFlow/CRM/OS in staff labels).

**Repository-wide (pre-merge):**
- Full `node --test` CRM suite (stage-move, conversion, task policy) — proves reused helpers unchanged.
- Role permission preflight audit.
- Repo typecheck + production build.

Distinguish: focused = new presentation + reused-helper tests + typecheck; repo-wide = full CRM suite + preflight + build.

---

## Conclusion

**1. Builder input & output** — `buildPipelinePresentation({ leads: CrmKanbanLeadCard[], stageModel, tasksByLeadId?, communicationsByLeadId?, consultationsByLeadId?, reminderJobsByLeadId?, nowMs, base, permissions, sourceTotal? }) → PipelinePresentation` (`columns`, `followUps`, `summary`, `filters`, `actions`, `diagnostics`, `loadTier`, `generatedAt`). Pure — no I/O, no React, no clock.

**2. Canonical card-minting rule** — build `Map<leadId, card>` from `leads` (board-enriched `CrmKanbanLeadCard`); every other source *enriches existing cards only*; nothing else (task/comm/consultation/booking/patient/HubSpot) mints or inserts; multiple leads per person stay separate; converted leads keep their card + patient link.

**3. Canonical next-follow-up rule** — tasks canonical via reused `deriveCrmLeadNextAction` (earliest open dated task → task-no-date → booking/reminder), then `communications.next_follow_up_at` as the **final** fallback; comms never overrides a task. (Comms-last ordering is an intentional deviation from the prompt's #3 slot, justified by reusing the tested helper — flag for dual-run.)

**4. Consultation summary rule** — one `PipelineConsultationState` per lead from lead-linked bookings: next future active booking (`booked`/`due_today`) wins over most-recent terminal (`completed`/`no_show`/`cancelled`) → else `none`; multiple consultations never mint extra cards.

**5. Owner vs task-assignee rule** — card owner = `lead.primary_owner_user_id`; Follow-up assignee = `task.assignee_user_id`; Board "mine" = owner, Follow-ups "mine" = assignee; missing owner = explicit `unassigned`; a non-owner task assignee never changes lead owner.

**6. Shell/full-tier boundary** — shell = `leads` + stage model (columns, owner, source, contact, conversion, high-value, overdue **count**, lead link); full adds tasks/comms/consultations for the canonical next-action **date**, follow-up counts, consultation state, full blockers, and the Follow-ups view. One builder, differently-enriched inputs; shell never claims a next-follow-up date.

**7. Deduplication algorithm** — `for lead in leads: map.set(lead.id, mint(lead))` (skip duplicate leadIds → `duplicateLeadIds`); enrich by leadId from tasks/comms/consultations/conversion (attach-only); tasks bucket once via `groupCrmTasksByBuckets`, dedupe by `taskId`, orphans → `orphanTaskIds`; sort each column deterministically ending in `leadId`. Never dedupe by person/patient/email/phone.

**8. Presentation invariants** — the 14 in §17; load-bearing ones: one card per visible `leadId`, one column per card, one bucket per task, one canonical next-action + owner per card, deterministic output, PHI-free diagnostics.

**9. Highest-risk payload ambiguity** — the **two next-follow-up sources** (`fi_crm_tasks.due_at` vs `fi_crm_lead_communications.next_follow_up_at`) *combined with* the fact that the board loader supplies only an **overdue task count**, not the next task. If shell tier infers a next-follow-up from the count, or the builder treats the comms hint as canonical, cards show a wrong "next action" and dual-run throws false failures. Resolution: tasks canonical (reused helper), comms hint last, and shell tier exposes overdue **count only** — never a next-follow-up date — until full-tier tasks arrive.

**10. Minimum S4.2 slice** — `pipelinePresentation.types.ts` + a **shell-only** `buildPipelinePresentation` (leads + stage model → columns + summary + diagnostics, one card per `leadId`, no tasks/comms/consultations) + its fixture tests. This proves one-card-per-lead, staff-column mapping, dedup, and hidden-count reporting against real board output with zero new loaders or mutations; full-tier enrichment (next-action, Follow-ups, consultation) and the URL filter wiring layer on afterward.
