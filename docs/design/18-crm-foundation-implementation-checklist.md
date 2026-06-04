# CRM foundation implementation checklist (Stage 1O)

## Purpose

This document is the **implementation checklist** for the CRM foundation described in [17-crm-foundation-architecture.md](./17-crm-foundation-architecture.md). It **locks product and schema decisions** that were open in Stage 1N, splits delivery into **ordered phases**, and defines **acceptance criteria**, **risks**, and **rollback** per phase.

**Scope:** planning and sequencing only. **No SQL or application code** is specified here beyond file/table names as guidance.

---

## Authority and supersession

- **Architecture:** [17-crm-foundation-architecture.md](./17-crm-foundation-architecture.md) remains the conceptual source for entities and relationships.
- **Stage 1O** resolves the Stage 1N **timeline pre-case** fork in favour of **`fi_crm_activity_events`** (see [Locked decisions](#locked-decisions-stage-1o)).
- When implementation diverges, update **both** doc 17 (architecture) and this checklist, or add an ADR-style note in doc 17’s status section.

---

## Locked decisions (Stage 1O)

| Topic | Decision |
|--------|-----------|
| **Pre-case CRM vs `fi_timeline_events`** | Introduce **`fi_crm_activity_events`** for all CRM-native activity **before** or **without** a `fi_cases` row. Continue to use **`fi_timeline_events`** only when a **`case_id`** exists and the product wants a **clinical** timeline row (dual-write from CRM service when rules are met). |
| **Lead identity** | Every **`fi_crm_leads`** row has a **required** **`person_id`** → `fi_persons(id)`. If the UI/API receives a lead without an existing person, the **server must create** `fi_persons` (and link) using existing foundation patterns (`src/lib/fi/foundation` resolution style) before inserting the lead. |
| **Tasks** | **Lead-first:** **`lead_id` NOT NULL** on `fi_crm_tasks`. **`patient_id`** and **`case_id`** are **optional** denormalised/secondary anchors for navigation and reporting. |
| **Messages (Phase 1)** | Store **`body_preview`**, **`subject`**, **`channel`**, **`direction`**, **`external_*` ids**, **`metadata`**, timestamps — **no full message body** in Postgres for Phase 1. |
| **Pipeline stages** | **Lazy-seeded per tenant:** default hair-restoration stages are inserted on **first CRM use** for that tenant (e.g. first lead list load, first “open CRM” admin action, or explicit “initialise CRM” — exact trigger is an implementation detail), **not** in a blanket migration that touches all tenants. |
| **RLS & writes (initial)** | **Tenant-scoped RLS** for **`authenticated`**: members may **`SELECT`** rows for their tenant (same spirit as foundation). **Mutations** go through **server actions / route handlers** using **`SUPABASE_SERVICE_ROLE_KEY`** (or equivalent **service-role** path), gated by **`FI_ADMIN_API_KEY`** and/or future auth roles — **no broad authenticated `INSERT`/`UPDATE`** on CRM tables in Phase 1 unless explicitly added later. |
| **Uniqueness** | Use **`CREATE UNIQUE INDEX … WHERE`** (partial unique indexes) for scoped uniqueness (e.g. external lead ids, pipeline `(tenant_id, organisation_id, pipeline_key, slug)` where nulls are handled with partial indexes per scope). Avoid sentinel UUID hacks. |

---

## Proposed implementation stages

| # | Phase | Summary |
|---|--------|---------|
| 1 | [CRM additive migrations](#phase-1--crm-additive-migrations) | Tables: CRM core + `fi_crm_activity_events`; indexes; FKs; lazy-seed hook points (no mass seed). |
| 2 | [CRM RLS / grants](#phase-2--crm-rls--grants) | `SELECT` for tenant members; service_role grants for writes; document bypass rules. |
| 3 | [CRM service helpers](#phase-3--crm-service-helper-library) | `src/lib/fi/crm/*` (or parallel under `foundation`) — loaders, lazy seed, lead+person create. |
| 4 | [CRM directory / list screen](#phase-4--crm-directory--list-screen) | FI Admin route: paginated leads for tenant. |
| 5 | [Lead detail screen](#phase-5--lead-detail-screen) | Read-only or mostly read-only aggregate: lead, person, stages, activity. |
| 6 | [Manual lead creation](#phase-6--manual-lead-creation) | Form + server action: person + lead + optional org/clinic. |
| 7 | [Stage movement](#phase-7--stage-movement) | Transitions: `fi_crm_lead_stage_history`, optional `fi_crm_activity_events`, optional `fi_timeline_events` when `case_id` set. |
| 8 | [Tasks and notes](#phase-8--tasks-and-notes) | CRUD via service actions; list on lead detail. |
| 9 | [Quotes foundation](#phase-9--quotes-foundation) | Templates + quote rows; optional amounts; no HubSpot. |
| 10 | [HubSpot sync preparation](#phase-10--hubspot-sync-preparation) | Mapping conventions, idempotency keys, stub worker or doc-only boundary. |

Phases **4–10** depend on **1–3**; phases **6+** depend on **5** for UX continuity; **7** depends on **6** (or seed leads); **8–9** depend on **5–7**; **10** can proceed in parallel with **8–9** once **2** and **`fi_crm_lead_source_ids`** exist.

---

## Phase 1 — CRM additive migrations

**Goal:** Additive DDL only — new `fi_crm_*` tables plus **`fi_crm_activity_events`**, no behaviour change to existing apps.

### Tables involved

- `fi_crm_pipeline_stages`
- `fi_crm_leads` (**`person_id` NOT NULL** per lock)
- `fi_crm_lead_stage_history`
- **`fi_crm_activity_events`** (new vs doc 17 list): `tenant_id`, `lead_id`, `activity_kind` (text), `title`, `detail` (jsonb), `occurred_at`, `created_at`; optional `fi_timeline_event_id` when a clinical timeline row was created; optional `patient_id` / `case_id` for context.
- `fi_crm_tasks` (**`lead_id` NOT NULL**)
- `fi_crm_notes`, `fi_crm_messages` (Phase 1 message columns per lock)
- `fi_crm_quote_templates`, `fi_crm_quotes`
- `fi_crm_lead_source_ids`

### Files likely created / changed

- `supabase/migrations/20xxxxxxxx_fi_crm_*` (one or more ordered files)
- `supabase/README.md` (migration index note)
- `docs/design/17-crm-foundation-architecture.md` (add `fi_crm_activity_events` to table list / ERD when implementation starts — or sub-PR doc patch)

### Risks

- Long-running migration if mis-scoped (e.g. accidental mass seed).
- FK order mistakes against `fi_tenants`, `fi_organisations`, `fi_clinics`, `fi_persons`, `fi_patients`, `fi_cases`.
- **`fi_timeline_events.case_id` NOT NULL** unchanged — activity must not try to insert timeline without case.

### Rollback strategy

- **Forward-only migrations** in dev: `supabase db reset` / down migration if team uses reversible files.
- **Production:** new tables empty — rollback is **`DROP TABLE`** only if no production data yet; after go-live use **deprecation** not drop.

### Acceptance criteria

- [ ] All listed tables exist with FKs to foundation tables where required.
- [ ] **`fi_crm_leads.person_id`** is **`NOT NULL`**.
- [ ] **`fi_crm_tasks.lead_id`** is **`NOT NULL`**.
- [ ] **`fi_crm_activity_events`** exists and references `fi_crm_leads` + `tenant_id`.
- [ ] Partial unique indexes created for agreed uniqueness (e.g. `fi_crm_lead_source_ids`, pipeline stage slug per scope).
- [ ] **No** global pipeline seed migration across all tenants.

---

## Phase 2 — CRM RLS / grants

**Goal:** Safe read for tenant members; writes only via privileged path.

### Tables involved

All `fi_crm_*` from Phase 1.

### Files likely created / changed

- `supabase/migrations/20xxxxxxxx_fi_crm_rls.sql` (enable RLS, policies, grants)
- Optionally extend `docs/design/06-foundation-layer-architecture.md` cross-link

### Risks

- Policy bugs exposing cross-tenant data (critical).
- Overly permissive `service_role` grants.

### Rollback strategy

- `DROP POLICY` / `ALTER TABLE … DISABLE ROW LEVEL SECURITY` in a follow-up migration (emergency); prefer feature flag to hide CRM routes before disabling RLS in prod.

### Acceptance criteria

- [ ] **`authenticated`**: `SELECT` policies restricted by tenant membership (`fi_users` / `auth.uid()` pattern aligned with foundation).
- [ ] **No** generic authenticated `INSERT`/`UPDATE`/`DELETE` on CRM tables for Phase 1 (unless explicitly scoped to a future role — default **deny**).
- [ ] **`service_role`**: explicit **`GRANT`** for operations server actions need (`INSERT`/`UPDATE`/`DELETE` as minimal set).
- [ ] RLS documented in this repo’s security notes.

---

## Phase 3 — CRM service helper library

**Goal:** Typed loaders, lazy pipeline seed, “create person + lead” orchestration, activity append helpers.

### Tables involved

All CRM tables; reads on `fi_persons`, `fi_patients`, `fi_cases` for joins.

### Files likely created / changed

- `src/lib/fi/crm/` (new): e.g. `leads.ts`, `pipeline.ts`, `activity.ts`, `types.ts`
- `src/lib/fi/foundation/index.ts` (re-exports if desired)
- **Tests** (optional first slice): `*.test.ts` if project adds unit tests for pure helpers

### Risks

- Duplicating foundation logic instead of calling existing resolvers.
- Lazy seed race (concurrent first requests) — mitigate with **idempotent upsert** or advisory lock per tenant.

### Rollback strategy

- Remove exports / delete folder; no DB change if migrations already applied.

### Acceptance criteria

- [ ] **`ensureDefaultPipelineStages(tenantId)`** (or equivalent) idempotent; **no-op** if stages already exist.
- [ ] **`createLeadWithPerson(...)`** creates/links **`fi_persons`** then **`fi_crm_leads`** with **`person_id`** set.
- [ ] **`appendCrmActivityEvent(...)`** writes **`fi_crm_activity_events`**.
- [ ] Helpers use **`supabaseAdmin()`** only from server contexts (same discipline as configuration actions).

---

## Phase 4 — CRM directory / list screen

**Goal:** FI Admin can see leads for a tenant in a simple table/list.

### Tables involved

`fi_crm_leads`, `fi_crm_pipeline_stages`, `fi_persons` (minimal join), optional `fi_organisations` / `fi_clinics` for labels.

### Files likely created / changed

- `app/(fi-admin)/fi-admin/[tenantId]/crm/page.tsx` (or `…/leads/page.tsx`)
- `src/components/fi/CrmLeadListPanel.tsx` (or similar)
- `app/(fi-admin)/fi-admin/[tenantId]/layout.tsx` (nav link **“CRM”** / **“Leads”**)

### Risks

- N+1 queries; missing pagination.

### Rollback strategy

- Hide nav link; remove route; data remains.

### Acceptance criteria

- [ ] List is **tenant-scoped** and respects RLS for reads.
- [ ] Pagination or cap documented if full pagination deferred.
- [ ] Opening the list triggers **lazy pipeline seed** once per tenant (if stages missing).

---

## Phase 5 — Lead detail screen

**Goal:** Single-lead view: stage, person id, org/clinic, linked patient/case if any, recent **`fi_crm_activity_events`**.

### Tables involved

`fi_crm_leads`, `fi_crm_lead_stage_history`, `fi_crm_pipeline_stages`, `fi_crm_activity_events`, optional `fi_patients`, `fi_cases`, `fi_timeline_events` (read-only slice when `case_id` present).

### Files likely created / changed

- `app/(fi-admin)/fi-admin/[tenantId]/crm/leads/[leadId]/page.tsx`
- `src/components/fi/CrmLeadDetailPanel.tsx`

### Risks

- Leaking another tenant’s lead via ID enumeration — block with **404** on cross-tenant mismatch in server loader.

### Rollback strategy

- Remove route; list-only mode.

### Acceptance criteria

- [ ] Detail page verifies **`lead.tenant_id === route tenantId`** before render.
- [ ] Shows **activity stream** from **`fi_crm_activity_events`** (and timeline snippet section if case exists — optional in this phase).

---

## Phase 6 — Manual lead creation

**Goal:** FI Admin can create a lead; server **creates or resolves `person_id`** per lock.

### Tables involved

`fi_persons`, `fi_crm_leads`, optional `fi_crm_lead_source_ids` for manual source tag; **`fi_crm_activity_events`** row “lead.created”.

### Files likely created / changed

- `lib/actions/fi-crm-actions.ts` (or `lib/actions/crm-leads-actions.ts`)
- Form components under `src/components/fi/`
- Phase 4/5 pages wire to creation success redirect

### Risks

- Duplicate persons if matching rules are weak — document match strategy or accept duplicates with merge as later phase.

### Rollback strategy

- Disable submit / feature flag; data retained.

### Acceptance criteria

- [ ] **Every** new lead has **`person_id`** (create or link).
- [ ] Server action gated by **`FI_ADMIN_API_KEY`** (or aligned gate) consistent with [15-configuration-admin-editing.md](./15-configuration-admin-editing.md) until role-based auth exists.
- [ ] Initial **`fi_crm_activity_events`** row recorded.

---

## Phase 7 — Stage movement

**Goal:** Change `current_stage_id`; append **`fi_crm_lead_stage_history`**; append activity; optionally insert **`fi_timeline_events`** when **`case_id`** on lead is non-null.

### Tables involved

`fi_crm_leads`, `fi_crm_pipeline_stages`, `fi_crm_lead_stage_history`, `fi_crm_activity_events`, optionally `fi_timeline_events`.

### Files likely created / changed

- Extend `lib/actions/fi-crm-actions.ts` (stage transition action)
- `CrmLeadDetailPanel` stage control UI

### Risks

- Invalid transitions (skip stages) — Phase 1 may allow any forward/back with audit only; document business rules later.
- Dual-write to timeline failing mid-flight — use **single transaction** where possible.

### Rollback strategy

- Revert stage in DB manually rare; prefer new history row to correct.

### Acceptance criteria

- [ ] Stage change writes **`fi_crm_lead_stage_history`** (append-only).
- [ ] **`fi_crm_activity_events`** records `stage.changed` (or similar).
- [ ] If **`lead.case_id` is set**, optional **`fi_timeline_events`** insert with agreed `event_kind` and `detail` containing `lead_id` (implementation detail).

---

## Phase 8 — Tasks and notes

**Goal:** Minimal CRUD for tasks and notes on a lead; messages remain preview-only.

### Tables involved

`fi_crm_tasks`, `fi_crm_notes`, `fi_crm_messages` (read-only list from external ingest later — optional), `fi_crm_activity_events` for each mutation.

### Files likely created / changed

- Extend actions + `CrmLeadDetailPanel` sections
- Optional `CrmTaskList`, `CrmNoteList` components

### Risks

- Notes containing PII — align with foundation PII policy; consider size limits.

### Rollback strategy

- Hide UI sections; tables remain.

### Acceptance criteria

- [ ] Tasks: **`lead_id` required**; optional **`patient_id` / `case_id`** validated for tenant consistency (and ideally consistent with the lead’s linked patient/case when those FKs are set).
- [ ] Notes: satisfy [doc 17](./17-crm-foundation-architecture.md) (**at least one** of `lead_id`, `patient_id`, `case_id`); Phase 1 **UI** may only expose **lead-attached** notes from the lead detail page (`lead_id` set).
- [ ] Each task/note create (and optional update) appends **`fi_crm_activity_events`** per team convention (`task.created`, `note.created`, etc.).

---

## Phase 9 — Quotes foundation

**Goal:** CRUD templates (structure JSON) and create quote snapshots linked to lead/case; still **no** HubSpot.

### Tables involved

`fi_crm_quote_templates`, `fi_crm_quotes`, `fi_crm_leads`, `fi_cases`, `fi_crm_activity_events`.

### Files likely created / changed

- Components for template list / quote draft
- Actions for template save, quote generate

### Risks

- JSON schema drift — version `schema_version` on template.

### Rollback strategy

- Hide “Quotes” UI; tables unused.

### Acceptance criteria

- [ ] Quote line items follow **optional amounts** rule from doc 17.
- [ ] Quotes cannot be mistaken for financial system of record — UI copy neutral.

---

## Phase 10 — HubSpot sync preparation

**Goal:** Idempotent mapping hooks, no live sync required to ship.

### Tables involved

`fi_crm_lead_source_ids`, `fi_crm_messages` (metadata + external ids), optional new **`fi_crm_external_mappings`** table (future) — **if not added**, store HubSpot stage/deal hints in **`fi_crm_pipeline_stages.metadata`** and **`fi_crm_leads.metadata`** until mapping table is justified.

### Files likely created / changed

- `docs/design/` addendum or `docs/hubspot-mapping.md` (optional)
- Stub `src/lib/fi/crm/hubspot/` with types only **or** empty placeholder **if** code is allowed later (this checklist still allows **doc-only** for Phase 10)

### Risks

- Premature coupling to HubSpot field names in DB without version pins.

### Rollback strategy

- N/A doc-only; if stub code, delete folder.

### Acceptance criteria

- [ ] Document **`source_system` value** for HubSpot (e.g. `hubspot`).
- [ ] Document **idempotency** key: `fi_crm_lead_source_ids` uniqueness.
- [ ] Document **inbound message** dedupe via `external_message_id` on `fi_crm_messages` (partial unique index where not null).
- [ ] Explicit statement: **no OAuth / sync worker** required to close Phase 10.

---

## Remaining blockers (post–Stage 1O)

These are **not** re-opened by Stage 1O locks but remain for later design/implementation:

| Blocker | Notes |
|---------|--------|
| **Notes `lead_id` strictness** | Checklist Phase 1 UI is **lead-context only**; schema may still allow patient/case-only notes per doc 17 if a later screen needs them. |
| **Org/clinic sub-roles** | RLS still tenant-flat; finer grants need a roles model. |
| **Full message body storage** | Phase 1 is preview/metadata only; vault/provider strategy for Phase 2+. |
| **Person deduplication** | Merge/dedupe rules for `fi_persons` when creating leads from multiple sources. |
| **CRM for non–FI-admin users** | End-user / clinic staff UI and auth are out of scope for early phases. |
| **Performance at scale** | Archiving, indexing review once message sync lands. |

---

## Stage 2C — CRM service data access (implementation progress)

**Goal (met):** Typed CRM helpers under `src/lib/crm/`, service-role-only mutations behind `server-only`, lazy idempotent default pipeline seeding per **explicit** tenant/org/clinic scope (no blanket multi-tenant seed), unit tests for pure helpers.

### Library layout

| Path | Role |
|------|------|
| `src/lib/crm/index.ts` | Types + pure exports (safe tree-shake from docs; no Supabase). |
| `src/lib/crm/server.ts` | **Server-only** re-exports: pipeline load/seed, leads, stage moves, history, activity, tasks, notes, message previews. Route handlers / server actions should import from here. |
| `src/lib/crm/pipeline.ts` | `loadPipelineStages`, `ensureDefaultPipelineStages`, `getEntryPipelineStage`. |
| `src/lib/crm/leads.ts` | `createCrmLeadWithPerson` (always `resolveOrCreatePerson` or verified `person_id`), `loadCrmLeadById`. |
| `src/lib/crm/stageMovement.ts` | `moveCrmLeadToStage` — updates lead, `appendCrmLeadStageHistory`, `appendCrmActivityEvent` (`stage.changed`); optional `fi_timeline_events` when `case_id` set. |
| `src/lib/crm/stageHistory.ts` | `appendCrmLeadStageHistory`, `loadCrmLeadStageHistory`. |
| `src/lib/crm/activity.ts` | `appendCrmActivityEvent`, `loadCrmActivityTimelineForLead`. |
| `src/lib/crm/tasks.ts`, `notes.ts`, `messages.ts` | Task / lead note / preview-only message writers + activity append; read previews for lead. |

### Commands

- Pure tests: `npm run test:unit` (`src/lib/crm/pure.test.ts`, `src/lib/crm/stage2d.test.ts`).

### Checklist mapping (Phase 3 / Stage 2C)

- [x] Idempotent `ensureDefaultPipelineStages` for a given scope; no-op when any stage row already exists for that scope + `pipeline_key`.
- [x] `createCrmLeadWithPerson` resolves or verifies `fi_persons` before `fi_crm_leads` insert.
- [x] `appendCrmActivityEvent` for CRM-native activity.
- [x] Service-role / `server-only` discipline for all mutating paths; **no** new client-side CRM mutation code.

### Deferred to later stages (post–Stage 2C)

- FI Admin CRM screens (list/detail) — see Stage 2D for gated HTTP/actions.
- Further transaction wrapping for stage move + timeline dual-write.

---

## Stage 2D — CRM gated HTTP + server actions (implementation progress)

**Goal (met):** Tenant-scoped CRM reads and privileged writes behind **Next.js Route Handlers** and **`lib/actions/fi-crm-actions.ts`** server actions. Every mutation path validates input (Zod + message preview key policy), enforces access **before** calling `@/src/lib/crm/server`, and keeps message bodies preview-only at the boundary.

### Access model

| Path | Requirement |
|------|----------------|
| **FI internal** | `adminKey` in JSON body (same as configuration actions) **or** HTTP header `X-FI-Admin-Key` / query `adminKey` for GET, matching `FI_ADMIN_API_KEY`, plus tenant must exist. |
| **Authenticated tenant member (reads)** | Supabase session (`cookies()` or `Authorization: Bearer` on API requests) and an `fi_users` row with `auth_user_id` = current user and `tenant_id` = route tenant (any `role`). |
| **Authenticated CRM writes** | Same membership **and** `fi_users.role` in `{ fi_admin, admin, crm_operator }` (case-insensitive). |

### API routes (`/api/tenants/[tenantId]/crm/...`)

| Method | Route | Purpose |
|--------|--------|---------|
| GET | `…/crm/pipeline-stages` | Lazy-seed default stages for scope; returns `stages`. Query: `organisationId`, `clinicId`, `pipelineKey`. |
| GET | `…/crm/leads/[leadId]` | Lead detail. |
| PATCH | `…/crm/leads/[leadId]` | Update lead details (summary, status, priority, owner, org/clinic, metadata); **never** changes `current_stage_id` (Stage 2H). |
| GET | `…/crm/leads/[leadId]/activity` | Activity timeline (`events`). Query: `limit`. |
| GET | `…/crm/leads/[leadId]/previews` | Parallel `tasks`, `notes`, `messages` previews. |
| POST | `…/crm/leads` | Create lead (+ person resolution). |
| POST | `…/crm/leads/[leadId]/stage` | Move lead stage (`toStageId`). |
| POST | `…/crm/leads/[leadId]/activity` | Append CRM activity event. |
| POST | `…/crm/leads/[leadId]/tasks` | Create task. |
| PATCH | `…/crm/leads/[leadId]/tasks/[taskId]` | Update task (non-terminal fields; Stage 2I). |
| POST | `…/crm/leads/[leadId]/notes` | Create **internal lead note** (`fi_crm_lead_notes`, Stage 2J). |
| PATCH | `…/crm/leads/[leadId]/notes/[noteId]` | Update lead note (body / visibility / pinned). |
| POST | `…/crm/leads/[leadId]/notes/[noteId]/archive` | Archive lead note. |
| POST | `…/crm/leads/[leadId]/messages/preview` | Message preview only; rejects `body`, `content`, `html`, `text`, `fullbody`, etc. at top level and inside `preview`. |

### Server actions

- `lib/actions/fi-crm-actions.ts`: `crmCreateLeadAction`, `updateCrmLeadDetailsAction`, `crmMoveLeadStageAction`, `crmAppendActivityAction`, `crmCreateTaskAction`, `updateCrmTaskAction`, `completeCrmTaskAction`, `reopenCrmTaskAction`, `crmCreateNoteAction` (general `fi_crm_notes`), **`createCrmLeadNoteAction`**, **`updateCrmLeadNoteAction`**, **`archiveCrmLeadNoteAction`** (Stage 2J), `crmCreateMessagePreviewAction` — same Zod + gate ordering; mutations import **`@/src/lib/crm/server`** only for Supabase writes.

### Supporting modules

| Path | Role |
|------|------|
| `src/lib/crm/crmGate.ts` | `assertCrmTenantReadAllowed`, `assertCrmTenantWriteAllowed`, `resolveAuthUserId`, `CrmAccessError`. |
| `src/lib/crm/crmGatePolicy.ts` | Pure role / FI-admin key helpers (unit-testable without Next). |
| `src/lib/crm/crmApiSchemas.ts` | Zod schemas for POST bodies / pipeline query. |
| `src/lib/crm/crmHttp.ts` | JSON helpers + `extractAdminKeyFromRequest` for routes. |
| `src/lib/crm/messageBodyKeysPolicy.ts` | Forbidden full-body keys (shared with `validation.ts`). |
| `src/lib/crm/activity.ts` | `loadCrmActivityTimelineForLead` (+ existing append). |
| `src/lib/crm/tasks.ts`, `notes.ts`, `leadNotes.ts`, `messages.ts` | `loadCrmTasksForLead`, `loadCrmNotesForLead`, `loadCrmLeadNotesForLead`, `loadCrmMessagesForLead`. |

### Commands

- Unit tests: `npm run test:unit` (`pure.test.ts`, `stage2d.test.ts`, `stage2g.test.ts`, `stage2h.test.ts`, `stage2i.test.ts`, `stage2j.test.ts`, `crmLeadListQuery.test.ts`).

### Checklist mapping (Stage 2D)

- [x] Gated CRM API routes + server actions; writes use service-role helpers from `@/src/lib/crm/server` only.
- [x] Tenant-scoped reads; cross-tenant lead access returns 404 when lead missing for tenant.
- [x] Zod + preview key policy; message preview rejects unsafe body-style keys at route and action level.
- [x] `server-only` on `src/lib/crm/server.ts`; ESLint `no-restricted-imports` on `src/components/**/*.tsx` blocking `@/src/lib/crm/server`.

### Deferred (unchanged)

- Full FI Admin CRM list / kanban workflow (Phase 4–5); Stage 2E adds a minimal shell only.

---

## Stage 2E — CRM internal shell UI (implementation progress)

**Goal (met):** Read-first FI Admin pages under `/fi-admin/[tenantId]/crm` to verify pipeline, lead detail, activity, tasks, notes, and message previews using the same access model as Stage 2D writes (`fi_users` roles), plus small smoke forms that call **`lib/actions/fi-crm-actions.ts`** only (no `@/src/lib/crm/server` in `src/components`).

### Routes

| Path | Purpose |
|------|---------|
| `/fi-admin/[tenantId]/crm` | Lead index (filters, sort, pagination), pipeline panel, lead UUID jump, **create-lead panel** (Stage 2G). |
| `/fi-admin/[tenantId]/crm/leads/[leadId]` | Lead summary, **edit-details panel** (Stage 2H), pipeline recap, activity / **tasks workflow** (Stage 2I) / **internal lead notes workflow** (Stage 2J) / general notes / messages panels, mutation smoke (move stage, foundation note, message preview). |

### Access

- **Nav:** `CRM` link in tenant FI layout only when `getCrmShellNavAllowed(tenantId)` — signed-in Supabase user with `fi_users.role` ∈ `{ fi_admin, crm_operator }` (case-insensitive).
- **Route:** `assertCrmShellPageAccess` on both CRM pages; otherwise redirect to `/fi-admin` (no session) or `/fi-admin/[tenantId]/cases` (wrong / insufficient role).

### Files

| Path | Role |
|------|------|
| `src/lib/crm/crmShellAccess.ts` | Nav visibility + `assertCrmShellPageAccess` (redirect-based gate). |
| `src/lib/crm/crmShellLoaders.ts` | Pipeline + lead bundle + **lead index** loaders (caller must assert first). |
| `src/lib/crm/crmGatePolicy.ts` | `CRM_SHELL_NAV_ROLES_LOWER`, `isCrmShellNavRole`. |
| `src/components/fi/crm/CrmDataPanels.tsx` | Read-only presentation (props only). |
| `src/components/fi/crm/CrmLeadIdJump.tsx`, `CrmCreateLeadPanel.tsx`, `CrmLeadEditPanel.tsx`, `CrmLeadTasksWorkflow.tsx`, `CrmLeadNotesWorkflow.tsx`, `CrmLeadSmokeForms.tsx` | Client shell UI → server actions only. |

### Commands

- Same as Stage 2D: `npm run lint`, `npm run build`, `npm run test:unit`.

### Checklist mapping (Stage 2E)

- [x] CRM shell routes + tenant layout nav (role-gated).
- [x] Read panels + empty states; **lead list** (Stage 2F) + smoke mutations via Stage 2D actions only.
- [x] No `src/components` imports of `@/src/lib/crm/server` (loaders live under `src/lib/crm/`; pages orchestrate).

---

## Stage 2F — CRM lead list index (implementation progress)

**Goal (met):** `/fi-admin/[tenantId]/crm` is the internal **lead index** (table, filters, sorting, pagination, deep links to `/crm/leads/[leadId]`). Reads stay behind `assertCrmShellPageAccess` + `crmShellLoaders` / `fi_crm_leads_shell_page` (always `p_tenant_id`-scoped). Client UI does **not** import `@/src/lib/crm/server`; filter bar is GET-only; mutations remain Stage 2D server actions / API.

### Data

| Piece | Role |
|-------|------|
| `supabase/migrations/20260607130001_fi_crm_leads_shell_page_fn.sql` | RPC `fi_crm_leads_shell_page` — filters, ILIKE search (summary + person `metadata` display/email hints), whitelist sort keys, limit/offset; `EXECUTE` granted to **`service_role` only**. |
| `src/lib/crm/leadList.ts` | `loadCrmLeadsShellPage` — calls RPC, maps JSON to `CrmShellLeadListItem`. |
| `src/lib/crm/crmShellLoaders.ts` | `loadCrmShellLeadsIndex` (lazy pipeline seed + list), `loadCrmShellUserPickerOptions` (owner filter). |
| `src/lib/crm/crmLeadListQuery.ts` | Pure URL/query parsing, href builder, `crmLeadListHasActiveFilters`. |

### UI

| Path | Role |
|------|------|
| `app/(fi-admin)/fi-admin/[tenantId]/crm/page.tsx` | Orchestrates loaders + list + empty states; keeps pipeline + create-lead panel. |
| `src/components/fi/crm/CrmLeadListFilters.tsx` | Client **GET** form (no CRM server imports). |
| `src/components/fi/crm/CrmLeadListTable.tsx` | Server table + row links. |
| `src/components/fi/crm/CrmLeadListPagination.tsx` | Server prev/next + range. |

### Tests

- `src/lib/crm/crmLeadListQuery.test.ts` (included in `npm run test:unit`).

### Deferred

- Kanban / board views; saved views; non–GET-driven filter UX.

---

## Stage 2G — CRM internal lead creation (implementation progress)

**Goal (met):** Replace the amber “smoke” create form with a structured **Create lead** panel on `/fi-admin/[tenantId]/crm` that always produces `fi_crm_leads.person_id` (link by UUID or `resolveOrCreatePerson`), enforces a **non-empty summary**, optionally records **`fi_crm_lead_source_ids`** (pre-check + insert with race cleanup), and scopes org/clinic when those entities exist.

### Person paths

| Mode | Behaviour |
|------|-----------|
| **New / matched person** | `person` payload: display name, email, phone, optional external person id, optional JSON metadata; `source_system` defaults to `fi_crm` when blank. |
| **Existing person** | `personId` must be a tenant-scoped `fi_persons.id` (UUID). |

### External lead id (`fi_crm_lead_source_ids`)

- Request fields: `sourceSystem` + `sourceLeadId` (both required together when either is non-blank; Zod + `normaliseOptionalLeadSource`).
- Server: duplicate lookup before lead insert; unique-violation cleanup deletes the draft lead and returns a friendly race message (`leadSourceInsertRaceErrorMessage`).

### Mutations and validation

- **Only** `crmCreateLeadAction` from `lib/actions/fi-crm-actions.ts` (Stage 2D pattern); `createCrmLeadWithPerson` extended for summary (required string), optional source mapping, org/clinic tenant checks + clinic↔org consistency.
- Inline field errors on the panel; server / Zod errors in a prominent error banner.
- Message preview rules and `crmCreateMessagePreviewAction` unchanged.

### Files

| Path | Role |
|------|------|
| `src/components/fi/crm/CrmCreateLeadPanel.tsx` | Client create form (two person modes, scope pickers, source id pair). |
| `src/lib/crm/leadSourceMappingPolicy.ts` | Pure normalisation + duplicate/race copy (unit-tested). |
| `src/lib/crm/leads.ts` | Source mapping + org/clinic validation + required summary. |
| `src/lib/crm/crmApiSchemas.ts` | `crmCreateLeadBodySchema`: required `summary`, optional paired `sourceSystem` / `sourceLeadId`. |
| `src/lib/crm/crmShellLoaders.ts` | `loadCrmShellScopePickerOptions` for org/clinic dropdowns. |
| `src/lib/crm/types.ts` | `CrmShellOrgOption`, `CrmShellClinicOption`. |

### Tests

- `src/lib/crm/stage2g.test.ts` — Zod + `leadSourceMappingPolicy` (included in `npm run test:unit`).

### Commands

- `npm run lint`, `npm run build`, `npm run test:unit`.

---

## Stage 2H — CRM lead detail edits (implementation progress)

**Goal (met):** Authorised CRM writers can update **non-stage** lead fields on `/fi-admin/[tenantId]/crm/leads/[leadId]` via `updateCrmLeadDetailsAction` and `PATCH …/crm/leads/[leadId]`, with controlled status/priority enums, tenant-scoped owner/org/clinic validation, JSON metadata rules, and a **`lead.updated`** activity row whose `detail` lists **changed field names only** (`changed_keys`).

### Editable fields

| Column | Notes |
|--------|--------|
| `summary` | Required non-empty. |
| `status` / `priority` | Allowed values enforced in Zod + `crmLeadDetailsPolicy` constants. |
| `primary_owner_user_id` | Must reference `fi_users` for the same tenant (or null). |
| `organisation_id` / `clinic_id` | Tenant-scoped; clinic must match selected org when both set. |
| `metadata` | Full object replace from staff JSON; optional **FI-admin** shallow merge patch when `adminKey` matches `FI_ADMIN_API_KEY`. |

### Explicitly out of scope

- **`current_stage_id`** — only `crmMoveLeadStageAction` / `POST …/stage` may change stage.

### Files

| Path | Role |
|------|------|
| `src/lib/crm/leadDetailsUpdate.ts` | `updateCrmLeadDetails` service helper + activity append. |
| `src/lib/crm/crmLeadDetailsPolicy.ts` | Pure enums, metadata JSON parsing, `collectChangedLeadDetailKeys`, stable metadata fingerprint. |
| `src/lib/crm/crmApiSchemas.ts` | `crmUpdateLeadDetailsBodySchema` (strict — rejects stage keys). |
| `lib/actions/fi-crm-actions.ts` | `updateCrmLeadDetailsAction`. |
| `app/api/tenants/[tenantId]/crm/leads/[leadId]/route.ts` | `PATCH` handler. |
| `src/lib/crm/crmShellLoaders.ts` | `loadCrmShellLeadDetailPageData` (bundle + owner/org/clinic pickers). |
| `src/components/fi/crm/CrmLeadEditPanel.tsx` | Client edit form. |

### Tests

- `src/lib/crm/stage2h.test.ts` — policy + Zod (included in `npm run test:unit`).

### Commands

- `npm run lint`, `npm run build`, `npm run test:unit`.

---

## Stage 2I — CRM lead task workflow (implementation progress)

**Goal (met):** On `/fi-admin/[tenantId]/crm/leads/[leadId]`, CRM writers manage **tasks** end-to-end (create, edit fields, complete, reopen) via **`lib/actions/fi-crm-actions.ts`** and optional **`PATCH /api/tenants/[tenantId]/crm/leads/[leadId]/tasks/[taskId]`**, with tenant/lead-scoped ownership, assignee validation against **`fi_users`**, controlled **status** / **task_type** enums, **`completed_at`** only via complete/reopen paths, and **`fi_crm_activity_events`** for **`task.created`** (existing), **`task.updated`** (changed field names only), **`task.completed`**, **`task.reopened`**.

### Validation rules

| Rule | Enforcement |
|------|-------------|
| Task belongs to lead + tenant | `loadCrmTaskForLead` + `.eq` on `tenant_id`, `lead_id`, `id` |
| Assignee in tenant | `fi_users` lookup on create/update |
| Status / type | Zod enums + `crmTaskPolicy` pure helpers |
| `completed_at` | Only `completeCrmTask` / `reopenCrmTask` (not `updateCrmTask`) |
| `due_at` | Nullable; parsed ISO; invalid datetime rejected |
| Title | Required non-empty on create and when `title` is in update patch |

### API / actions

| Surface | Role |
|---------|------|
| `updateCrmTaskAction`, `completeCrmTaskAction`, `reopenCrmTaskAction` | Server actions (same gate as Stage 2D). |
| `PATCH …/crm/leads/[leadId]/tasks/[taskId]` | Optional REST update (same Zod + gate as action). |
| `crmCreateTaskBodySchema` (tightened) | Create: enum **active** status + task type; `due_at` refine. |

### Pure modules (unit-tested)

| Path | Role |
|------|------|
| `src/lib/crm/crmTaskPolicy.ts` | Active statuses, types, done constant, complete/reopen body key allow-list. |
| `src/lib/crm/crmTaskBuckets.ts` | `groupCrmTasksByBuckets` — overdue / due today / upcoming / no due / completed (UTC day). |
| `src/lib/crm/crmTaskChangedFields.ts` | `collectChangedTaskDetailKeys` / snapshots for activity metadata. |
| `src/lib/crm/crmTaskOwnership.ts` | `isTaskOwnedByLeadTenant` (pure). |

### UI

| Path | Role |
|------|------|
| `src/components/fi/crm/CrmLeadTasksWorkflow.tsx` | Client task list (bucketed), create form, inline edit, complete/reopen; assignee picker from tenant users; **no** `@/src/lib/crm/server` import. |
| `src/components/fi/crm/CrmLeadSmokeForms.tsx` | Task smoke removed; stage / foundation note / message smoke unchanged. |

### Tests

- `src/lib/crm/stage2i.test.ts` — policy, buckets, changed keys, complete/reopen payload rules, ownership helper, update-task Zod (included in `npm run test:unit`).

### Commands

- `npm run lint`, `npm run build`, `npm run test:unit`.

---

## Stage 2J — CRM internal lead notes workflow (implementation progress)

**Goal (met):** On `/fi-admin/[tenantId]/crm/leads/[leadId]`, CRM writers manage **internal lead notes** (`fi_crm_lead_notes`, distinct from general `fi_crm_notes`) via **`createCrmLeadNoteAction`**, **`updateCrmLeadNoteAction`**, **`archiveCrmLeadNoteAction`**, and REST **`POST/PATCH …/crm/leads/[leadId]/notes`** (+ **`POST …/notes/[noteId]/archive`**), with tenant/lead-scoped access, **visibility** enum (`internal` | `sales` | `clinical` | `admin`), **no client-driven** `tenant_id` / `lead_id` / `author_user_id` / timestamps / `archived_at`, **`archived_at`** blocking edits and pins, activity kinds **`lead_note.created`**, **`lead_note.updated`** (`changed_keys` only), **`lead_note.archived`** (no note body in activity detail), and **`tryResolveFiUserIdForTenant`** for author on create when using session auth.

### Data

| Table | Migration |
|-------|-----------|
| `fi_crm_lead_notes` | `supabase/migrations/20260608120001_fi_crm_lead_notes.sql` (RLS: authenticated SELECT; `service_role` INSERT/UPDATE/DELETE). |

### Validation rules

| Rule | Enforcement |
|------|-------------|
| Note belongs to lead + tenant | `loadCrmLeadNoteForLead` + `.eq` on `tenant_id`, `lead_id`, `id` |
| Visibility | Zod enum + `crmLeadNotePolicy` |
| Non-empty body | Policy + Zod `min(1)` on create/patch body |
| Archived | `assertLeadNoteNotArchived` before update; archive clears pin |
| Author | Optional `fi_users.id` from `tryResolveFiUserIdForTenant` only (not from client JSON) |

### API / actions

| Surface | Role |
|---------|------|
| `createCrmLeadNoteAction`, `updateCrmLeadNoteAction`, `archiveCrmLeadNoteAction` | Server actions (same gate as Stage 2D). |
| `POST …/crm/leads/[leadId]/notes`, `PATCH …/notes/[noteId]`, `POST …/notes/[noteId]/archive` | REST (Zod + gate + optional author resolution from Bearer/cookies). |

### Pure modules (unit-tested)

| Path | Role |
|------|------|
| `src/lib/crm/crmLeadNotePolicy.ts` | Visibility allow-list, non-empty body, archived guard, **`sortCrmLeadNotesForDisplay`**, `isLeadNoteOwnedByLeadTenant`. |
| `src/lib/crm/crmLeadNoteChangedFields.ts` | `collectChangedLeadNoteDetailKeys` / snapshots (`note_body`, `note_visibility`, `is_pinned` only). |

### UI / loader

| Path | Role |
|------|------|
| `src/components/fi/crm/CrmLeadNotesWorkflow.tsx` | Create form, sorted list (pinned first), inline edit, archive; archived section collapsed by default. |
| `src/lib/crm/crmShellLoaders.ts` | `loadCrmShellLeadBundle` includes **`leadNotes`** via `loadCrmLeadNotesForLead`. |

### Tests

- `src/lib/crm/stage2j.test.ts` — visibility, body, changed keys, archived guard, sort, scope helper, Zod (included in `npm run test:unit`).

### Commands

- `npm run lint`, `npm run build`, `npm run test:unit`.

---

## Document status

**Stage 1O — checklist only.** Implementation PRs should reference this file and update checkboxes or link to GitHub issues/epics as work completes.

---

## Related documents

- [17-crm-foundation-architecture.md](./17-crm-foundation-architecture.md)
- [15-configuration-admin-editing.md](./15-configuration-admin-editing.md) (service-action gate pattern)
- [06-foundation-layer-architecture.md](./06-foundation-layer-architecture.md)
