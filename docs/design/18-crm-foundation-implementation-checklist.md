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

## Document status

**Stage 1O — checklist only.** Implementation PRs should reference this file and update checkboxes or link to GitHub issues/epics as work completes.

---

## Related documents

- [17-crm-foundation-architecture.md](./17-crm-foundation-architecture.md)
- [15-configuration-admin-editing.md](./15-configuration-admin-editing.md) (service-action gate pattern)
- [06-foundation-layer-architecture.md](./06-foundation-layer-architecture.md)
