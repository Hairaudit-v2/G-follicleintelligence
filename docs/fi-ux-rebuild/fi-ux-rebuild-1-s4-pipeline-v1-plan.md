# FI-UX-REBUILD-1 — S4: Pipeline v1 Consolidation Plan

**Date:** 2026-07-11
**Status:** Ticket-ready plan (read-only audit; no code changed)
**Depends on:** S3 Front Desk track (S3.4 cutover in flight — do not touch). Reuses the S3 method: presentation contract → thin UI → route switch → dual-run → nav shrink → redirects → S11 retirement.
**Objective:** Replace the multi-door enquiry/CRM/follow-up/conversion experience with **one staff-facing Pipeline** workspace, reusing the existing `fi_crm_*` engine (no schema rebuild, no HubSpot rebuild, no clinical/payment change).

> **Thesis.** The CRM engine is already single-sourced: **`fi_crm_leads` is the canonical entity, `fi_crm_pipeline_stages` owns stage, `moveCrmLeadToStage` / `executeCrmLeadConversion` are the single mutation paths.** The problem is **presentation multiplicity** — the same leads are surfaced through `/leadflow`, `/crm?view=workspace|board|list`, `/consultation-conversion`, and a "Follow-ups" nav row, each with its own framing. S4 collapses the doors, not the data.

---

## 1. Current route map

| Visible label | Route | Primary component | Loader / data source | Mutation paths | Role access | Current purpose |
|---|---|---|---|---|---|---|
| Enquiries | `/leadflow` | `LeadFlowOperatorDashboard` | `loadLeadFlowOperatorDashboardPayload` (HubSpot-first) | (read-mostly; links out) | CRM shell (`getCrmShellPageSession`) | HubSpot-flavoured enquiry intelligence |
| Enquiries (Workspace) | `/crm` (`?view=workspace`, default) | `LeadFlowDashboard` | `loadLeadFlowDashboardPayload` | task/stage via lead detail + kanban | CRM shell | Follow-up priorities + booking readiness |
| Enquiries (Board) | `/crm?view=board` | `CrmKanbanBoard` | `loadCrmShellLeadsBoardIndex` | `moveCrmLeadToStage` (drag) | CRM shell | Stage kanban |
| Enquiry index (List) | `/crm?view=list` | `CrmLeadListTable` | `loadCrmShellLeadsIndex` | — (navigates to detail) | CRM shell | Filterable enquiry table |
| Lead detail | `/crm/leads/[leadId]` | lead workspace (tabs) | `loadCrmLeadById` + tasks/comms/notes/conversion loaders | tasks, comms, notes, stage, convert | CRM shell | Single lead workspace |
| Conversion board | `/consultation-conversion` | conversion board | `loadConsultationConversionBoardPayload` | stage (indirect) | bookings/CRM shell | Consult→surgery conversion columns |
| Follow-ups | `/crm` (nav row `follow-up-queue`, shortLabel "Tasks") | same `/crm` workspace | same | task complete/reopen | CRM shell | Third door into the same workspace |
| Enquiries (New) | quick-create `NewEnquiryDialog` | dialog on `/crm` | `createLead` (`leads.ts`, status `open`) | create lead | CRM shell | New enquiry entry |
| (deep links) Today → CRM | `/` Today feed | `todayFeedEntityAttentionLoader` / dashboard staleLeads/tasksDue | link to `/crm/leads/{id}` | — | all staff | Stale leads + due tasks deep-link into CRM |

**Hidden / flagged / internal:**
- `/leadflow` and `/crm` both set `metadata.title = "Enquiries"` — two routes, one label already.
- Internal **LeadFlow** naming persists in components/loaders (`LeadFlowDashboard`, `leadFlowDashboardLoader`, `publishLeadFlowEvent`) — engine-internal, must stay out of staff chrome.
- Platform-admin: `isFiOsPlatformAdminFullSessionBypass` proxies into any tenant's CRM shell via `loadProxyFiUserRowForPlatformAdminTenant`.
- HubSpot: `src/lib/crm/hubspotImport/*` ingestion; `external_message_id` / `external_thread_id` on comms/messages.

---

## 2. Navigation inventory

| Nav entry | Surface | Route | Verdict |
|---|---|---|---|
| **Enquiries** (`crm` row) | Primary sidebar / More | `/leadflow` | **Merge → Pipeline** (becomes the single door) |
| — sub "Enquiries" (`leadflow-dashboard`) | sidebar sub-item | `/leadflow` | **Hide** (redirect later) |
| — sub "Enquiries" (`crm-workspace`) | sidebar sub-item | `/crm` | **Merge → Pipeline** |
| **Follow-ups** (`follow-up-queue` row, "Tasks") | primary sidebar / More | `/crm` | **Hide** (fold into Pipeline as a filter/view) |
| **Conversion board** (`consultation-conversion-board`) | Consultations sub-item | `/consultation-conversion` | **Merge → Pipeline** (or keep as a Pipeline filtered view) |
| Active-route mapping | `getFiOsShellActiveSidebarId` | `/crm`, `/leadflow` → `crm` | **Keep group highlighted** for legacy during rollout |
| Role filter | `getCrmShellNavAllowed` | — | **Reuse** (Pipeline uses same predicate) |
| Quick-create (New enquiry) | `NewEnquiryDialog` | `/crm` | **Reuse** inside Pipeline |
| Search results | global search → leads | `/crm/leads/{id}` | **Keep** (deep-link into Pipeline lead workspace) |
| Breadcrumbs / aria / metadata | "Enquiries" | — | **Rename → Pipeline** (staff-facing) |

**Keep / merge / hide / redirect table:**

| Item | Action |
|---|---|
| One "Pipeline" nav row | **Keep** (single door; replaces "Enquiries") |
| "Follow-ups" nav row | **Hide** (fold in) |
| "Enquiries" duplicate sub-items | **Hide** |
| "Conversion board" Consultations sub-item | **Merge** into Pipeline as a saved view/filter (or hide) |
| `/leadflow`, `/crm`, `/consultation-conversion` routes | **Keep live** during rollout → **redirect** after parity → **retire** S11 |

**Target principle: one staff-facing Pipeline door.** No new rail item — Pipeline reuses the existing CRM nav slot (rename + point at the consolidated route). The existing architecture already reserves this slot; the audit finds **no** need for a new top-level destination.

---

## 3. Current data model and source-of-truth audit

| Entity | Table / type | PK | Source of truth for | Links to | Duplicate risk |
|---|---|---|---|---|---|
| Lead / enquiry | `fi_crm_leads` (`FiCrmLeadRow`) | `id` | **stage, owner, status, conversion** | person_id, patient_id, case_id, current_stage_id, primary_owner_user_id | Multiple leads per person (valid); HubSpot re-import (guard) |
| Person | `fi_persons` | `id` | identity (name/contact metadata) | 1→N leads, 1→1 patient | Ambiguous-identity merge (guarded at conversion) |
| Patient | `fi_patients` | `id` | clinical record | person_id, created/linked at conversion | Double-create (guarded by `resolveOrCreatePatient`) |
| Pipeline stage | `fi_crm_pipeline_stages` | `id` | **stage vocabulary** (slug/label/order/is_entry/is_won/is_lost) | leads.current_stage_id | Per org/clinic scope duplicates (by design) |
| Task / follow-up | `fi_crm_tasks` | `id` | **next action / follow-up** | lead_id, patient_id, case_id, consultation_id, assignee_user_id | Multiple open tasks per lead; stale duplicates |
| Communication | `fi_crm_lead_communications` | `id` | contact log; carries `next_follow_up_at` | lead_id, external ids | **`next_follow_up_at` competes with tasks.due_at** |
| Message | `fi_crm_messages` | `id` | channel messages | lead/patient/case, external ids | HubSpot dupes via external ids |
| Note | `fi_crm_lead_notes` / `fi_crm_notes` | `id` | internal notes | lead/patient/case | — |
| Activity | `fi_crm_activity_events` | `id` | derived audit trail | lead/patient/case, timeline event | — |
| Stage history | `fi_crm_lead_stage_history` | `id` | stage audit / daysInStage | lead_id, from/to stage | — |
| Consultation | consultations tables | `id` | consult status | lead/case/booking | One lead → many consultations |
| Booking | `fi_bookings` | `id` | appointment | lead_id, patient_id, case_id | — |

**Clear answers:**

- **One enquiry = one lead?** Yes — an enquiry is created as one `fi_crm_leads` row (`createLead`, status `open`).
- **When does a lead become a patient?** At **explicit conversion** (`executeCrmLeadConversion`) — `resolveOrCreatePatient` creates/links `fi_patients`, sets `lead.patient_id` + `converted_person_id`/`converted_at`. Not at consultation booking.
- **Multiple leads per person?** Yes — `fi_persons` 1→N `fi_crm_leads`. Valid (re-enquiry, different treatment interest).
- **One lead → several consultations?** Yes — consultations/bookings reference `lead_id`; the lead is unchanged.
- **Who owns pipeline stage?** `fi_crm_leads.current_stage_id` → `fi_crm_pipeline_stages`.
- **Who owns next follow-up date?** **`fi_crm_tasks.due_at` is canonical** (`deriveCrmLeadNextAction` reads tasks first). `fi_crm_lead_communications.next_follow_up_at` is a **secondary hint**, not the source of truth — this split is the core ambiguity (§7, §16).
- **Who owns assigned consultant?** `fi_crm_leads.primary_owner_user_id` (lead owner); tasks have their own `assignee_user_id`.
- **Who owns conversion?** `fi_crm_leads` (`converted_*` columns) via `executeCrmLeadConversion` — single path.
- **Where do HubSpot / external events fit?** Ingestion (`hubspotImport`) writes leads/comms/messages with `external_message_id`/`external_thread_id`; those are **reconciliation keys**, not a second entity.
- **Follow-ups = tasks, events, or records?** **Tasks** (`fi_crm_tasks`, `task_type: follow_up`). Not separate records.
- **Canonical vs derived?** Canonical: leads, stages, tasks, comms, persons, patients. Derived: `CrmKanbanLeadCard` signals (daysInStage, overdueTaskCount, isHighValue, next-action), conversion-board columns, Today stale-lead/task feeds.

**No new schema required** — the model already supports the target. (One optional, non-blocking cleanup discussed in §7/§16: standardise "next follow-up" on tasks.)

---

## 4. Duplicate workflow map

| Workflow | Current doors | Existing mutation(s) | Proposed single home |
|---|---|---|---|
| Review new enquiry | `/leadflow`, `/crm` workspace, board, list | — (read) | Pipeline board **New** column / New filter |
| Assign owner | lead detail, kanban card | lead update (`primary_owner_user_id`) | Pipeline card action → same mutation |
| Contact lead | lead detail (comms) | `leadCommunications` create | Pipeline card / lead workspace → same |
| Record call/email outcome | lead detail | `fi_crm_lead_communications` (outcome) | Pipeline lead workspace → same |
| Schedule follow-up | lead detail (tasks) | `fi_crm_tasks` create | Pipeline follow-up action → **tasks only** |
| See overdue follow-ups | `/crm` workspace, Today feed, task buckets | — (read; `groupCrmTasksByBuckets`) | Pipeline **Follow-ups filter/view** (one derivation) |
| Book consultation | lead detail, calendar, conversion board | booking create (links `lead_id`) | Pipeline card "Book consultation" → existing booking flow |
| Move pipeline stage | kanban drag, lead detail | **`moveCrmLeadToStage`** (single) | Pipeline board → same single path |
| Mark converted | lead detail conversion | **`executeCrmLeadConversion`** (single) | Pipeline convert action → same |
| Mark lost | lead detail (stage=lost) | `moveCrmLeadToStage` to `is_lost` + reason metadata | Pipeline card → same |
| Reopen lead | lead detail | `moveCrmLeadToStage` to active stage | Pipeline card → same |
| Open patient | lead detail, converted link | link (`patient_id`) | Pipeline card link |
| View communication history | lead detail | — (read `fi_crm_lead_communications`) | Pipeline lead workspace |

**Field/mutation-path divergences to resolve in presentation (not by new mutations):**
- **Next follow-up** is read from *two* fields (`tasks.due_at` vs `comms.next_follow_up_at`) — the builder must pick **tasks** as canonical and treat comms as a hint.
- **Owner vs assignee**: lead `primary_owner_user_id` vs task `assignee_user_id` — surface lead owner as the card owner; task assignee only inside the follow-up.
- Stage move and conversion already single-path — **do not add alternates.**

---

## 5. Proposed Pipeline information architecture

**Recommendation: Option B — Board + Follow-ups**, where Follow-ups is a **view/filter over the same lead set**, not a separate product, and a lead **workspace** is the drill-in (not a peer tab).

```
Pipeline
├── Board        (stage columns; primary)
├── Follow-ups   (time-based view of the SAME leads: due today / overdue / mine)
└── (lead workspace — drill-in, not a top tab)
```

- **Why not Option A (board only):** overdue follow-up work is time-ordered, not stage-ordered; forcing it into stage columns hides the "who do I call today" job that reception/consultants do first. A Follow-ups *view* solves this without a second product.
- **Why not Option C (board + queue + comms):** a standalone communications inbox is out of scope (constraint) and the engine has no clean omnichannel inbox; comms live inside the lead workspace.
- **Follow-ups is a filter, not a queue product:** it reads the same leads and their `fi_crm_tasks`, applying `groupCrmTasksByBuckets`. Completing a follow-up uses the existing task mutation and can optionally suggest a stage move — but never forks the data.

This retires **Enquiries + CRM + Follow-ups + Conversion board** into one hub with **two human-facing views + a drill-in** — within the "no more than three views" limit and biased toward two.

---

## 6. Pipeline stage audit

Crosswalk of every stage/status vocabulary (DB `fi_crm_pipeline_stages` default set is the source of truth):

| Current value | Current label | Source | Proposed staff label | Keep / map / retire |
|---|---|---|---|---|
| `new` (is_entry) | New inquiry | DB stage | **New** | Keep |
| `contacted` | Contacted | DB stage | **Contacting** | Keep (relabel) |
| `qualified` | Qualified | DB stage | **Qualified** | Keep |
| `consult_scheduled` | Consult scheduled | DB stage | **Consultation booked** | Keep (relabel) |
| `consult_completed` | Consult completed | DB stage | **Consulted** | Keep (group under "Consultation") |
| `treatment_planning` | Treatment planning | DB stage | **Planning / quote** | Keep (group) |
| `quote_sent` | Quote sent | DB stage | **Planning / quote** | Keep (group) |
| `deposit_or_booked` | Deposit / booked | DB stage | **Booked / deposit** | Keep |
| `in_treatment` | In treatment | DB stage | **In treatment** | Keep |
| `won_closed` (is_won) | Won / completed | DB stage | **Converted** | Keep (terminal-won) |
| `lost` (is_lost) | Lost | DB stage | **Closed / lost** | Keep (terminal-lost) |
| `nurture` | Nurture | DB stage (sort 110, after lost) | **Nurture / follow-up** (holding lane) | Keep as **holding lane**, not sequential |
| lead `status`: `open` | — | `fi_crm_leads.status` | (implicit active) | Keep (not a column) |
| lead `status`: `converted` / `lost` / `archived` | — | `fi_crm_leads.status` (`terminalLeadStatuses`) | terminal | Keep as status, **not** a column |
| conversion-board cols: `consultation_booked`…`surgery_booked`,`lost` | — | `consultationConversionBoardLoader` (derived) | (fold into board views) | **Retire as a separate board**; derive from stages |
| Today signals: staleLeads / tasksDue | — | dashboard loader | urgency filters | Map to **filters**, not stages |

**Findings:**
- **Duplicate/overlapping stages:** `consult_completed` + `treatment_planning` + `quote_sent` are a fine-grained mid-funnel; group them into 1–2 staff columns while keeping all slugs in DB.
- **Technical statuses exposed to staff:** none egregious, but "Consult scheduled/completed", "Deposit / booked" read as internal — relabel.
- **Lifecycle vs urgency mixing:** `nurture` is a *holding* state (sort order after `lost`), not a funnel step — treat as a lane/filter, never between Qualified and Converted. Stale/overdue are **urgency**, must be **filters** (§12), not columns.
- **Terminal states:** `won_closed` (is_won) and `lost` (is_lost) must remain terminal; conversion also flips `fi_crm_leads.converted_*`.
- **Lost/inactive reasons:** keep as **metadata** on the lead (`metadata.crm_*` / lost reason), not as columns.

**Canonical staff-facing stage model (backend-compatible, no migration):** present the DB slugs grouped into staff columns —
`New → Contacting → Qualified → Consultation (consult_scheduled + consult_completed) → Planning/Quote (treatment_planning + quote_sent) → Booked/Deposit (deposit_or_booked + in_treatment) → Converted (won_closed)`, with **Closed/lost (lost)** and **Nurture** as holding lanes. A pure crosswalk maps each of the 12 slugs → one staff column; stage moves still write the underlying slug via `moveCrmLeadToStage`.

---

## 7. Follow-up model audit

**How follow-ups work today:**
- **Storage:** `fi_crm_tasks` (`task_type: follow_up|call|meeting|email|other`).
- **Due date:** `due_at`. **Owner:** `assignee_user_id`. **Status:** `open|in_progress|blocked` → `done` (`completed_at` set). **Lead/patient/consultation linkage:** `lead_id` (required), `patient_id`, `case_id`, `consultation_id`.
- **Buckets:** `groupCrmTasksByBuckets` → `overdue | due_today | upcoming | no_due | completed` (UTC date vs now).
- **Next action:** `deriveCrmLeadNextAction` → earliest open task with due date, else next booking, else reminder job, else "none".
- **Communication outcome:** `fi_crm_lead_communications.outcome` + `next_follow_up_at` (a *second* place a "next follow-up" can live).
- **Recurrence / snooze:** no first-class recurrence; "snooze" = editing `due_at`.
- **Today feed:** dashboard `tasksDue` surfaces due tasks and deep-links to `/crm/leads/{id}`.

**Answers:**
- **Separate product or filtered queue?** A **filtered task queue** — no separate storage. It should become a **Pipeline view**, not a peer product.
- **Can it be a Pipeline filter/view?** Yes — reuse `groupCrmTasksByBuckets` over the same lead set.
- **Overdue calculated consistently?** Two derivations exist (`groupCrmTasksByBuckets` UTC-date vs ad-hoc dashboard checks). **Standardise on `groupCrmTasksByBuckets`** in the builder.
- **Multiple open follow-ups per lead?** Yes — allowed; the card shows the **single canonical next** (`deriveCrmLeadNextAction`) and a count of others.
- **One canonical next action?** Yes — `deriveCrmLeadNextAction` (tasks-first). Adopt it verbatim.
- **Does completing a follow-up update stage?** **No** (task complete and stage move are independent). Keep independent; optionally *suggest* a stage move, never auto-move.
- **Stale duplicate tasks?** Possible (multiple open follow-ups); dedupe **display** by canonical-next, keep others visible in the workspace.
- **External CRM tasks synced?** HubSpot tasks are not first-class here; treat external follow-up hints as read-only until reconciled.

**Target model:** **one canonical follow-up = `fi_crm_tasks`**; `comms.next_follow_up_at` is a **hint** the builder may display but not treat as the source of truth. Do **not** keep a parallel Follow-ups queue. (Optional S4.4 non-blocking cleanup: when a comms outcome sets `next_follow_up_at`, also create/roll a `fi_crm_tasks` follow-up so there is exactly one canonical next — additive, no migration.)

---

## 8. Communication audit

| Communication action | Current surface | Mutation / service | Audit trail | Pipeline effect |
|---|---|---|---|---|
| Log call | lead detail | `fi_crm_lead_communications` (type=call) | activity event | may set `next_follow_up_at` (hint) |
| Email (log/send) | lead detail | comms + `fi_crm_messages` | activity + external ids | optional follow-up |
| SMS | lead detail | comms/messages | activity | optional follow-up |
| Note | lead detail | `fi_crm_lead_notes` / `fi_crm_notes` | — | none |
| Communication history | lead detail | read comms/messages | — | context only |
| HubSpot sync | ingestion | `hubspotImport/*` | external ids | inbound leads/comms |
| Inbound reply | ingestion/messages | `fi_crm_messages` (inbound) | external thread | may reopen follow-up |
| Templates | comms composer | templates service | — | none |
| Task-after-contact | lead detail | `fi_crm_tasks` create | activity | sets next follow-up |
| Failure / retry | send service | provider retry state | logs | none |

**Recommendation for Pipeline v1:** put **quick-contact + log-outcome + schedule-follow-up** on the card/lead workspace (all existing mutations); keep **full history, templates, HubSpot sync, message threads** in the **lead workspace** (linked, not inlined on cards). **Do not build an omnichannel inbox** — the engine has no clean one and the constraint forbids it.

---

## 9. Consultation conversion path

```
New enquiry (fi_crm_leads, status=open, stage=new)
 → Contacting (stage=contacted; comms logged)
 → Qualified (stage=qualified)
 → Consultation booked (stage=consult_scheduled; fi_bookings links lead_id — NO new lead)
 → Consulted (stage=consult_completed)
 → Planning/Quote (treatment_planning / quote_sent)
 → Booked/Deposit (deposit_or_booked / in_treatment)
 → Converted (executeCrmLeadConversion → fi_patients created/linked, optional draft fi_cases; stage=won_closed)
   or Closed/lost (stage=lost, is_lost; reason in metadata)
```

**Boundaries / findings:**
- **Patient created:** at **conversion only** (`resolveOrCreatePatient`), not at consultation booking.
- **Booking a consultation duplicates the lead?** **No** — the booking references `lead_id`; the lead is unchanged.
- **Conversion automatic or manual?** **Manual** — `executeCrmLeadConversion` is called explicitly; stage moves do not auto-convert.
- **Super/payment effect on conversion?** Payment/superannuation workflows are separate (financial); conversion does **not** depend on them and must not be changed here.
- **Cancelled consultation → back to Pipeline?** The lead never left; a cancelled/rescheduled booking leaves the lead at its stage — surface it as a follow-up, don't auto-move stage.
- **No-show → follow-up?** Not automatic today; recommend a **suggested** follow-up (existing task mutation), not an auto-rule.
- **Lost reasons:** recorded as lead **metadata** at stage→lost; keep as metadata, expose a reason picker on the Pipeline "Mark lost" action (existing mutation).

**Recommended transition model:** one lead moves through stages via `moveCrmLeadToStage`; conversion via `executeCrmLeadConversion`; **no clinical or financial logic changes** — Pipeline only orchestrates the existing transitions.

---

## 10. Role and capability model

| Role | View Pipeline | Assign | Contact | Move stage | Complete follow-up | Mark lost | Convert |
|---|---|---|---|---|---|---|---|
| Receptionist | ✅ (if CRM-shell **or** capability override) | ➖ override | ✅ override | ➖ override | ✅ override | ➖ override | ➖ override |
| Consultant | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (if clinic features) |
| CRM / operator (`crm_operator`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clinic manager (tenant-admin role allowing CRM) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Finance | ➖ (only if CRM nav role) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Nurse | ➖ (view if CRM-shell/override) | ✖ | ➖ | ✖ | ➖ | ✖ | ✖ |
| Surgeon | ➖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Tenant admin | ✅ (if `tenantAdminRoleAllowsCrmShellNav`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform admin | ✅ (proxy bypass) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read-only portal user | ➖ view; **no mutations** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |

Legend: ✅ yes · ➖ conditional (capability override / CRM-shell) · ✖ no.

- **Access model:** nav visibility via `getCrmShellNavAllowed` (`isCrmShellNavRole` = admin/fi_admin/crm_operator, plus `tenantAdminRoleAllowsCrmShellNav`); mutation via `canUseClinicFeatures` / `CRM_MUTATION_ROLES_LOWER`.
- **Capability overrides preserved:** a receptionist gains Pipeline through `resolveDevelopmentClinicAccessForTenant` (`canUseClinicFeatures`) — **not** by inflating their role. Keep this path; do not add a role.
- **Dedicated capability needed?** **No** — existing CRM-shell + clinic-features predicates are sufficient for Pipeline v1. Reuse them; a new capability would fragment the model.

---

## 11. Proposed canonical Pipeline payload

Presentation contract between loaders and UI (pure; no raw HubSpot/CRM/task/consultation arrays reach React):

```ts
type PipelinePresentation = {
  generatedAt: string;
  stages: PipelineStageColumn[];      // canonical staff columns (grouped slugs)
  workQueue: PipelineWorkItem[];      // follow-up view (overdue/due-today/mine)
  summary: PipelineSummary;           // counts by stage + urgency
  filters: PipelineFilterOptions;     // owners, sources, stages, urgency flags
};

type PipelineStageColumn = {
  id: string;                         // canonical staff column id
  label: string;                      // S2 staff label
  stageSlugs: string[];               // DB slugs grouped into this column
  isTerminalWon: boolean;
  isTerminalLost: boolean;
  isHolding: boolean;                 // nurture
  cards: PipelineLeadCard[];
  count: number;
};

type PipelineLeadCard = {
  leadId: string;                     // CANONICAL KEY (fi_crm_leads.id)
  person: { personId: string; displayName: string; patientId: string | null };
  contact: { hasEmail: boolean; hasPhone: boolean };
  owner: { userId: string | null; label: string | null };
  source: string | null;             // enquiry source
  stage: { slug: string; columnId: string; label: string; daysInStage: number | null };
  lastContactAtIso: string | null;
  nextFollowUp: { atIso: string | null; label: string; kind: "task"|"appointment"|"reminder"|"none"; overdue: boolean };
  consultation: { state: string | null; nextBookingAtIso: string | null };
  score: number | null;              // only if operationally useful
  isHighValue: boolean;
  blockers: Array<{ kind: string; label: string; severity: "blocker"|"action_needed"|"information" }>;
  conversion: { converted: boolean; patientId: string | null; lostReason: string | null };
  allowedActions: PipelineActionId[]; // advisory; server re-checks
  links: { lead: string; patient: string | null; case: string | null; calendar: string };
};

type PipelineWorkItem = {
  leadId: string; taskId: string;    // task is the canonical follow-up unit
  bucket: "overdue"|"due_today"|"upcoming";
  dueAtIso: string | null; title: string;
  assigneeUserId: string | null; personDisplayName: string;
  links: { lead: string };
};
```

- **Canonical key = `leadId` (`fi_crm_leads.id`).** One lead → one card. Person grouping is a *display hint* only.
- **Avoiding duplicate lead/patient representations:** build a `Map<leadId, PipelineLeadCard>` from the lead index; enrich by leadId (tasks, comms, consultation, bookings). Multiple leads per person stay distinct (valid); HubSpot re-imports reconcile by `external_message_id`/`external_thread_id` in the loader, never by minting a second card.
- The **UI must not** merge raw HubSpot/CRM/follow-up/consultation arrays — the builder composes them into `PipelineLeadCard`.

---

## 12. Sorting, urgency and prioritisation

Keep **four independent axes** — never conflate:

1. **Stage** (lifecycle) → column membership only.
2. **Urgency** (overdue / new-untouched / consult-due / no-show / unassigned / stale) → **filters + within-column sort**, never columns.
3. **Score** (`isHighValue` / lead score) → tiebreak / badge.
4. **Next action** (`deriveCrmLeadNextAction`) → card CTA.

**Deterministic within-column ordering** (default): overdue-follow-up first → then untouched-new (oldest `created_at`) → then consult-due → then by `nextFollowUp.atIso` ascending → then `isHighValue` → then `leadId` ascending (stable tiebreak). Converted/lost sort last (or hidden in active columns).

**Follow-ups view ordering:** `groupCrmTasksByBuckets` order (overdue → due_today → upcoming), each by `due_at` asc then title, then `leadId`.

**Do not** encode urgency as fake pipeline columns (no "Overdue" column) — it becomes a filter chip.

---

## 13. Target UI behaviour

### Board
- **Stage columns** = canonical staff columns (§6); horizontal on desktop, **stacked** on tablet/phone (no nested horizontal scroll).
- **Explicit action over drag** as the primary path (drag optional, desktop-only): a "Move stage" control → `moveCrmLeadToStage`. Explicit action is tablet-safe and accessible.
- **Card content:** person name, source, owner, stage/daysInStage, next follow-up (+overdue), contact availability, high-value badge, strongest blocker, primary action, patient link. (Matches `PipelineLeadCard`.)
- **Filters:** owner (mine/unassigned), urgency (overdue/new/consult-due/stale), stage, source.
- **Assignment / quick contact / book consultation / mark lost / convert:** existing mutations, surfaced as card actions gated by `allowedActions`.
- **Tablet:** stacked columns, sticky filter bar, ≥44px targets.

### Follow-up view (retained as a view, not a product)
- Segments: **due today / overdue / upcoming / assigned to me / completed**.
- Actions: complete (existing task mutation), snooze (edit `due_at`), contact + log outcome (existing comms mutation). Completing a follow-up may *suggest* a stage move, never auto-move.

### Lead workspace (drill-in)
- Identity, communication history, tasks, consultation, conversion state, patient link. Reuse the existing `/crm/leads/[leadId]` workspace shell — do not build a new page system.

**Prefer existing workspace-shell patterns** (`DashboardCard`, lead detail tabs, kanban card primitives) over a new large page framework.

---

## 14. Performance and polling

**Current:** `loadCrmShellLeadsBoardIndex` (board, truncated with `total`/`truncated`), `loadCrmShellLeadsIndex` (paginated list), kanban batch-enriches signals. No aggressive polling on CRM today (mostly request/refresh).

**Recommendations:**
- **First paint (shell):** stage columns + lead cards **without** heavy enrichment (identity, stage, owner, next-follow-up date). Board already supports `truncated`/`total` windowing — reuse.
- **Full hydration:** signals (`daysInStage`, `overdueTaskCount`, `isHighValue`, blockers, consultation state) batch-loaded after first paint.
- **Refresh cadence:** on-demand + light interval (e.g. 60s) **only if** a board is live; **one** refresh loop (mirror S3's single-hook rule — no duplicate pollers).
- **Mutation refresh:** after stage move / convert / task complete → `router.refresh()` + single re-fetch (same pattern as Front Desk).
- **Pagination / windowing:** keep board **truncation with explicit "N more"**; never load all leads into one column.
- **Do not pull full communication history into every board card** — history lives in the lead workspace only.
- **HubSpot webhook timing:** ingestion is async; the board reconciles by external ids server-side; the UI never merges raw external arrays.

---

## 15. Legacy route strategy

| Current route | Target route | Keep live (S4.5) | Redirect (S4.6) | Platform-admin only | Retire later (S11) |
|---|---|---|---|---|---|
| `/crm` (workspace/board/list) | `/crm` (Pipeline) *(reuse slug)* | ✅ | — (becomes canonical) | ✖ | — |
| `/leadflow` | `/crm` | ✅ | ✅ 307→308 | ✖ | ✅ |
| `/consultation-conversion` | `/crm?view=…` (Pipeline filtered) | ✅ | ✅ 307→308 | ✖ | ✅ |
| `/crm/leads/[leadId]` | unchanged (drill-in) | ✅ | — | ✖ | keep |
| "Follow-ups" nav (→`/crm`) | Pipeline Follow-ups view | ✅ | n/a (nav only) | ✖ | — |

- **Reuse `/crm` as the Pipeline slug** (it is already the richest door and the least LeadFlow-branded); rename its staff label to **Pipeline**. This minimises redirects (only `/leadflow` and `/consultation-conversion` redirect).
- **Do not implement redirects in this audit.** Follow S3: route switch first (S4.5) → dual-run parity → nav shrink (S4.6) → redirects after parity → permanent retirement S11. Preserve deep links/bookmarks throughout.

---

## 16. Dual-run verification plan

Compare old CRM/enquiry representations vs the new Pipeline presentation for the same tenant.

```ts
type PipelineDualRunComparison = {
  tenantId: string;
  generatedAt: string;
  oldLeadIds: string[];              // from loadCrmShellLeadsBoardIndex
  newLeadIds: string[];              // from PipelinePresentation
  missingFromNew: string[];          // BLOCK
  extraInNew: string[];              // BLOCK
  duplicateLeadIds: string[];        // BLOCK (a leadId in >1 column)
  stageMismatches: Array<{ leadId: string; oldSlug: string; newColumnId: string; expected: boolean }>;
  ownerMismatches: string[];
  nextFollowUpMismatches: Array<{ leadId: string; oldAtIso: string|null; newAtIso: string|null; reason: "tasks_vs_comms"|"other" }>;
  overdueMismatches: string[];
  consultationLinkMismatches: string[];
  convertedLostMismatches: Array<{ leadId: string; old: string; new: string; expected: boolean }>;
  orphanTasks: string[];             // tasks whose lead is absent from either set
  pass: boolean;
};
```

- **Reconcile by `leadId`** (must be empty diff — gates cutover), separately from **stage/label** differences (allowed, flagged `expected` where the slug→column grouping intentionally reclassifies).
- **Intentional (not failures):** stage grouping/relabel; nurture as holding lane; urgency moved to filters; dropped manager/HubSpot-only signals; next-follow-up standardised on **tasks** (a `tasks_vs_comms` mismatch where the new value = task due is `expected`).
- **Go/no-go:** go only when `missingFromNew`/`extraInNew`/`duplicateLeadIds`/`orphanTasks` empty, converted/lost reconcile, and all stage/follow-up mismatches are `expected`.
- **No PHI in logs** — lead IDs and counts only; never names/emails/phones.

---

## 17. Acceptance scenarios

1. Staff sees **one** visible Pipeline door.
2. New enquiries appear **once** (one card per `leadId`).
3. One lead appears in exactly one stage column.
4. A follow-up task does **not** create a duplicate lead card.
5. Overdue follow-up shows on the canonical lead card (`nextFollowUp.overdue`).
6. Completing a follow-up uses the existing task mutation.
7. Moving stage uses `moveCrmLeadToStage` (single path).
8. Booking a consultation preserves lead linkage (no new lead).
9. Converted lead links to the patient (`conversion.patientId`).
10. Lost lead records a reason (metadata).
11. Reopened lead returns to an active stage safely.
12. Unassigned leads are findable (filter = unassigned).
13. Assigned-to-me filter works (`owner.userId`).
14. Receptionist capability override grants Pipeline without role inflation.
15. Read-only role cannot mutate.
16. External HubSpot update reconciles by external id — no duplicate card.
17. One lead with multiple consultations remains one lead card.
18. Multiple leads for one person remain distinct.
19. Pipeline and Today deep links resolve (`/crm/leads/{id}`).
20. Old `/crm` / `/leadflow` / `/consultation-conversion` remain reachable during rollout.
21. Tablet layout has no nested horizontal scrolling.
22. Terminology audit green (no "LeadFlow"/"CRM"/"OS" in staff chrome).
23. Navigation drift + role preflight green.

---

## 18. File-level implementation plan

**S4.1 — Canonical stage & entity model** *(pure; rollback = revert files)*
- Add `src/lib/crm/pipelineStaffModel.ts` (slug→staff-column crosswalk, `PipelineStageColumn` ids, `isHolding`/terminal helpers) + tests.
- Reuse: `pipelineSeedPayload.ts`, `crmTaskBuckets.ts`, `crmLeadNextAction.ts`. **No migration.** No route change.

**S4.2 — Pipeline presentation builder** *(pure)*
- Add `src/lib/crm/pipelinePresentation.ts` (+ `.types.ts`): `buildPipelinePresentation(...)`; one card per `leadId`; merge tasks (canonical next), comms hint, consultation, conversion.
- Add `pipelinePresentation.test.ts` (§17 cases, dedupe, dual-source follow-up).
- Reuse loaders read-only; do not modify CRM engine.

**S4.3 — Pipeline board UI** *(thin; consumes presentation only)*
- Add `src/components/fi/crm/pipeline/PipelineBoard.tsx` + `PipelineColumn` + `PipelineLeadCard` + `PipelineFilters`.
- Reuse `CrmKanbanBoard` card primitives / `DashboardCard`. Rollback = feature-flag off.

**S4.4 — Follow-up integration** *(view, not product)*
- Add `PipelineFollowUps.tsx` consuming `workQueue`; reuse `groupCrmTasksByBuckets` + existing task mutations.
- Optional non-blocking: on comms `next_follow_up_at`, roll a `fi_crm_tasks` follow-up (additive).

**S4.5 — Live route switch + dual-run** *(reversible: one file)*
- Point `/crm` at Pipeline behind a flag; keep `?view=` fallbacks live.
- Add `src/lib/crm/pipelineDualRunComparison.ts` + tests; run via script/platform-admin entry (no staff surface).

**S4.6 — Navigation consolidation + redirects**
- Shrink nav to one **Pipeline** row; hide Follow-ups / duplicate Enquiries sub-items (edit `fiOsShellPrimaryNav.ts` — coordinate, not a Front Desk file).
- Add `/leadflow` and `/consultation-conversion` server-page `redirect()` (307 → 308 in S11); preserve query.

**S4.7 — E2E, tablet, permissions, docs**
- E2E route/redirect specs; tablet overflow; role preflight; terminology + nav-drift audits; update `docs/fi-ux-rebuild/*`.

**Per stage:** files-to-change (nav registry in S4.6 only), files-to-add (builder/UI/tests), tests (unit + dual-run + E2E), feature flags (`PIPELINE_V1` gate on the route switch), migrations (**none required**), rollback boundary (flag off / revert single route file).

---

## Conclusion

**1. Recommended Pipeline IA** — **Option B**: one **Pipeline** hub with **Board** (stage columns) + **Follow-ups** (a time-based *view* of the same leads) + a lead **workspace** drill-in. Retires Enquiries, CRM, Follow-ups, and Conversion board into one door; no new rail item.

**2. Canonical entity key & source of truth** — **`fi_crm_leads.id`** is the canonical key; the lead owns **stage** (`current_stage_id`), **owner** (`primary_owner_user_id`), **status**, and **conversion** (`converted_*`). Stages come from `fi_crm_pipeline_stages`; follow-ups from `fi_crm_tasks`. One card per `leadId`; person grouping is display-only; multiple leads per person are valid.

**3. Canonical stage model** — keep all 12 DB slugs (source of truth, no migration); present staff columns: **New · Contacting · Qualified · Consultation · Planning/Quote · Booked/Deposit · Converted**, with **Closed/lost** and **Nurture** as holding lanes. Urgency (overdue/new/stale) and lead `status` are **filters**, never columns; `won_closed`/`lost` stay terminal; lost reasons stay metadata.

**4. Follow-up consolidation decision** — Follow-ups is **not** a peer product; it is a **filtered view over `fi_crm_tasks`** (`groupCrmTasksByBuckets` + `deriveCrmLeadNextAction`). `comms.next_follow_up_at` is a hint, not the source of truth. Completing a follow-up uses the existing task mutation and never auto-moves stage.

**5. Presentation-builder signature**
```ts
export function buildPipelinePresentation(input: {
  leads: CrmKanbanLeadCard[];
  stages: FiCrmPipelineStageRow[];
  tasksByLeadId: ReadonlyMap<string, FiCrmTaskRow[]>;
  now: Date;
  base: string;                      // `/fi-admin/${tid}`
  capabilities: { canMutate: boolean; canConvert: boolean };
}): PipelinePresentation;
```

**6. Route & navigation consolidation** — reuse `/crm` as the canonical **Pipeline** slug (rename label); redirect `/leadflow` and `/consultation-conversion` → `/crm` (307 → 308 in S11); `/crm/leads/[leadId]` stays as the drill-in. Nav: one Pipeline row; hide Follow-ups + duplicate Enquiries sub-items; keep Front-desk-style group highlighting for legacy during rollout.

**7. Dual-run verification** — pure `buildPipelineDualRunComparison` + unit tests, run live once via a script or platform-admin entry; reconcile by **`leadId`** (empty diff gates cutover) separately from stage/label diffs (flagged `expected`); lead IDs and counts only, no PHI.

**8. Highest-risk data ambiguity** — **the two "next follow-up" sources**: `fi_crm_tasks.due_at` (canonical, used by `deriveCrmLeadNextAction`) vs `fi_crm_lead_communications.next_follow_up_at` (a parallel hint). If the builder reads the wrong one, cards show a different "next action" than today and dual-run flags false failures — or a real overdue is missed. Resolve first: **tasks are canonical; comms is a hint**, and (optionally, additively) roll a task when a comms follow-up is set so exactly one canonical next exists. Secondary risk: multiple leads per person must never be merged into one card.

**9. Minimum reversible S4 slice** — **S4.1 + S4.2 + S4.3 behind a `PIPELINE_V1` flag on a scratch/preview harness**: the stage crosswalk + `buildPipelinePresentation` + a read-only `PipelineBoard` rendering real leads with one card per `leadId`, no mutations, no route switch, no nav change. This proves the one-door, one-card model against live data and is reversible by turning the flag off — mutations (S4.4), the `/crm` switch + dual-run (S4.5), and nav/redirects (S4.6) layer on afterward.
