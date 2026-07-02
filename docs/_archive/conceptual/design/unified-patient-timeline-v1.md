# Unified Patient Timeline v1 — FI OS design

**Status:** Design only (no migrations, loaders, or UI changes in this document).  
**Audience:** Engineering, product, clinical ops, compliance.  
**Inputs:** `docs/audits/patient-timeline-unification.md`, `docs/audits/fi-workflow-events-audit.md`.

**Goal:** One canonical timeline strategy for **Patient Twin**, **patient profile**, **SurgeryOS**, **ConsultationOS**, **DoctorOS**, **ImagingOS**, **MedicationOS**, and the **future Patient Portal**, backed by a single persisted read model.

---

## 1. Current state summary

FI OS currently exposes **multiple parallel “timeline” narratives** for the same person. They differ in **storage**, **query path**, and **deduplication rules**. This section names the split so v1 unification has a single target.

### 1.1 Patient Twin timeline — `fi_timeline_events`

- **Loader path:** `loadPatientTwinV1` → foundation patient record → `buildFoundationTimeline`.
- **Data:** Rows in **`fi_timeline_events`** scoped by tenant and the patient’s **foundation patient id set** and/or **resolved case id set** (deduped, sorted `occurred_at` desc, capped in UI).
- **Character:** **Curated foundation milestones** — producer ingest dual-write (HLI / HairAudit), CRM stage change when a lead has `case_id`, `consultation.completed` when completion has both `patient_id` and `case_id`, and similar explicit writers.
- **Gap:** Anything that **never** inserts `fi_timeline_events` is invisible here (most CRM activity, default booking lifecycle, pathology tables, surgery plan edits, `fi_patient_images`, consultations completed without case+patient).

### 1.2 Patient profile timeline — `buildPatientTimeline` synthetic events

- **Loader path:** `loadPatientTimelineSources` + **`buildPatientTimeline`** (`patientTimelineBuild.ts`).
- **Data:** **Synthetic merge** from leads, **`fi_bookings`**, **`fi_cases`**, **`fi_crm_activity_events`**, clinical row, **`fi_patient_images`**, patient row — **does not read `fi_timeline_events`**.
- **Character:** Rich **operational + CRM chronology** tuned for the profile treatment view, with **`EXCLUDED_DUPLICATE_ACTIVITY_KINDS`** so booking/lead activities do not duplicate synthetic booking/lead items.
- **Gap:** **No foundation milestones** (ingest, pure `fi_timeline_events` only) appear on the profile timeline today — including `consultation.completed` written only to foundation.

### 1.3 CRM activity feed

- **Storage:** **`fi_crm_activity_events`** (`activity_kind`, append-only), written by `appendCrmActivityEvent` and APIs that accept **arbitrary activity kinds** (1–128 chars) from integrators.
- **Surfaces:** Lead slide-over, merged into **profile** timeline where bundled, pathology/booking UIs, `GET …/crm/leads/.../activity`.
- **Relationship to foundation:** Stage changes can **link** a row to **`fi_timeline_event_id`** when a foundation row is created; most activity kinds **do not** create foundation rows.
- **Noise / sensitivity:** Notes, messages, task churn, communications — high volume and variable **patient-appropriateness** vs staff workflow detail.

### 1.4 Imaging / media lists

- **Patient imaging library:** **`fi_patient_images`** — surfaced as **Imaging** card counts/latest on Twin; profile timeline adds **synthetic** `image_uploaded` / `image_archived` style items from the builder (not foundation by default).
- **Unified media:** **`v_fi_media_unified` / `fi_media_assets`** — **Media** card on Twin; producer ingest can dual-write **`fi_timeline_events`** (e.g. `media_uploaded`, HairAudit image kinds). **Overlap risk** with clinical imaging for some workflows (same story, different pipelines).

### 1.5 Pathology cards

- **Storage:** **`fi_pathology_requests`**, **`fi_pathology_results`**, items, AI interpretations.
- **Surfaces:** Twin **Pathology** structured card; profile timeline often shows pathology via **CRM activity** kinds (`pathology.*`, `pathology.ai_interpretation.*`) from `appendCrmActivityEvent`, not via `fi_timeline_events` by default.
- **Split:** Clinical truth in pathology tables + activity stream; Twin foundation timeline **often empty** for pathology unless explicitly dual-written later.

### 1.6 Booking records

- **Storage:** **`fi_bookings`** (+ integrations such as Timely → `createBooking`).
- **Surfaces:** Profile timeline **synthetic** booking scheduled/completed/cancel/no-show; CRM **`booking.*`** activity when lead context exists; **excluded** from activity merge when synthetic booking items cover the same fact.
- **Foundation:** No **default** per-booking row in `fi_timeline_events` today — Twin timeline **misses** typical booking lifecycle unless added by design.

### 1.7 Case milestones

- **On Twin:** **`cases[].latest_milestone`** is derived from the **same** in-memory **`fi_timeline_events`** list as the Twin timeline card (first event per case in sorted order) — not a separate table read.
- **On profile:** Case-related synthetic items from **`fi_cases`** / leads in `buildPatientTimeline`; surgery **plan** history is largely **absent** from both chronological feeds unless CRM/timeline writers add it.

**Summary table**

| Narrative | Primary store | Main consumers today |
|-----------|---------------|----------------------|
| Foundation clinical stream | `fi_timeline_events` | Patient Twin timeline, case timeline loaders, UPR |
| Profile treatment stream | Synthetic + CRM + bookings + images + cases | Patient profile timeline |
| CRM operational stream | `fi_crm_activity_events` | CRM UI, profile merge, analytics |
| Pathology clinical | Pathology tables + CRM activity | Twin card, profile via activity |
| Scheduling | `fi_bookings` + CRM booking activity | Profile synthetic items, reminders |
| Media vs imaging | `fi_media_assets` / unified view vs `fi_patient_images` | Twin cards, ingest timeline kinds |

---

## 2. Canonical timeline decision

### 2.1 Recommendation

**Yes — recommend `fi_timeline_events` as the canonical persisted timeline table** for FI OS v1: the **single append-only store** for patient- and case-scoped **milestones** that every OS and Portal can query or project from.

Treat it as the **canonical append-only patient/case chronology** with these qualifiers:

- **Canonical persisted** means: one **ordered, queryable, idempotent** row stream in **`fi_timeline_events`** for **cross-product** surfaces (Twin, profile, SurgeryOS, ConsultationOS, DoctorOS, ImagingOS, MedicationOS, Portal, AnalyticsOS). Other tables (CRM activity, bookings, pathology) remain **systems of record** for their domains; timeline rows **reference** them rather than replacing them.
- **CRM activity** remains the **system of record for staff collaboration** (notes, comms, task updates). It should **not** be fully mirrored into foundation. Instead, **milestone projections** from CRM (or from domain tables) are written to `fi_timeline_events` under strict rules.
- **Profile timeline** becomes a **read model** that **preferentially reads canonical rows** and only uses **synthetic assembly** where a row is not yet projected (transition) or where the product explicitly keeps data **synthetic-only** (short-lived or denormalised-only).

Rationale aligned to audits:

- Producer ingest and case foundations **already** anchor on `fi_timeline_events`.
- Case timelines and Twin **already** treat foundation as the **clinical milestone** layer.
- `buildPatientTimeline` already solves **dedupe within the profile** but **cannot** serve Twin, Portal, or analytics without duplicating merge logic everywhere.

### 2.2 Which events should be persisted (in `fi_timeline_events`)

Persist **durable, patient- or case-relevant milestones** that are stable enough to show in **Twin, Portal, and lifecycle analytics**:

- **Intake / ingest / audit submission** (existing producer dual-write kinds).
- **Consultation lifecycle** (created, completed, summary generated, quote created — see §4).
- **Pathology state transitions** that matter clinically (requested, result uploaded, reviewed — **thin** titles; pointers to request/result ids in metadata).
- **Booking lifecycle** at **milestone** granularity (created, completed, cancelled as product requires — **not** every reschedule field-level update).
- **Surgery / case** milestones (case created, plan created/major version, procedure day completed, follow-up completed).
- **Imaging / media** when the product needs **one chronological stream** across modules; prefer **one kind per business fact** with dedupe keys (§7).
- **Treatment** completions that are billable/clinical milestones (PRP, exosomes, iron infusion — when product registers them).
- **Medication** milestones when MedicationOS exists (started, dose changed, stopped).
- **Documents** generated for the patient journey (consent, report, handout) when they are **versioned artifacts** worth auditing.
- **Tasks** only when they represent **patient-visible commitments** or **regulated follow-ups** (optional; default off — §2.3).
- **Audit** class for compliance-significant actions (immutable row; detail in metadata).
- **Portal** submissions/uploads that are **clinical or operational milestones** (not every page view).

### 2.3 Which events should remain synthetic

Keep **synthetic-only** (assembled at read time, **not** mirrored 1:1 to foundation) for:

- **Pure rollups** (“first visit”, “days since last contact”) — compute in loaders or materialised views, not per-row timeline spam.
- **Ephemeral CRM noise** — task `updated`, message body previews, minor field edits — stay in **`fi_crm_activity_events`** only unless promoted by policy (§2.4).
- **Redundant projections** where the **source table is the UI’s natural home** and timeline adds no new fact — e.g. listing every pathology **AI interpretation archive** if the Pathology card is authoritative; only **major** transitions become foundation rows.
- **Transition period:** Until dual-write covers a domain, **read model** may still **synthesize** from legacy sources **only if** idempotent backfill has not yet created the canonical row (§8).

### 2.4 Which CRM noise should not be mirrored

Do **not** mirror into `fi_timeline_events` by default:

- **`note.created`**, **`lead_note.*`**, raw **`message.logged`** text — sensitive and voluminous; keep in CRM with access controls.
- **`task.updated`**, **`task.reopened`** — operational churn; optional **single** `task.created` / `task.completed` only if Portal/analytics explicitly need them.
- **`lead.updated`** — unless mapped to a **milestone** (e.g. disqualification) with a dedicated `event_kind`.
- **Reminder delivery noise** — successful sends already create **`lead_communication.created`**; do not duplicate as foundation unless a **regulated** patient communication log is required as a milestone.
- **Arbitrary integrator `activity_kind`** strings — never auto-project to foundation without a **registry allow-list** mapping.

### 2.5 How to avoid duplicates

- **Single writer rule:** Domain mutation (booking, pathology, consultation) writes **at most one** foundation row per **idempotency key** (§7).
- **CRM exclusion parity:** Maintain a **central policy** (successor to `EXCLUDED_DUPLICATE_ACTIVITY_KINDS`) that defines: “this `activity_kind` is **not** merged into **patient-visible** feeds when foundation row exists” — **and** “this activity_kind must **not** trigger a second foundation row” if foundation is already written by the domain mutator.
- **Linked references:** When CRM stage change already creates **`fi_timeline_event_id`**, reuse that linkage in APIs instead of inserting a second row.
- **Read model merge:** Unified API sorts by `occurred_at`, then **collapses** duplicate **logical facts** using `(event_kind, source_table, source_id)` or explicit **`supersedes_timeline_event_id`** only when needed (rare; prefer idempotent insert failure).

---

## 3. Timeline event categories

Categories are **namespaces for `event_kind` prefixes**, UI filtering, Portal visibility, and analytics grouping. They are **not** mutually exclusive with workflow engines; they are **presentation and policy** dimensions.

| Category | Purpose | Example kinds (non-exhaustive) |
|----------|---------|--------------------------------|
| **`crm`** | Pipeline and relationship milestones | `crm.lead.stage_changed` (existing), future `crm.lead.qualified` |
| **`consultation`** | Consult workflow | `consultation.completed`, `consultation.summary_generated` |
| **`pathology`** | Lab / blood / results | `pathology.requested`, `pathology.result_uploaded` |
| **`booking`** | Scheduling lifecycle | `booking.created`, `booking.completed` |
| **`surgery`** | Surgical case / plan / day-of | `surgery.plan_created`, `surgery.procedure_completed` |
| **`medication`** | MedicationOS (future) | `medication.started`, `medication.dose_changed` |
| **`imaging`** | Captures, protocols | `imaging.image_uploaded`, `imaging.protocol_completed` |
| **`treatment`** | In-clinic treatment episodes | `treatment.prp_completed` |
| **`document`** | Generated or uploaded documents | `document.generated` |
| **`task`** | Tasks promoted to milestones | `task.created`, `task.completed` |
| **`audit`** | Compliance / security / break-glass | `audit.record_accessed` (example; define carefully) |
| **`portal`** | Patient-initiated signals | `portal.form_submitted`, `portal.photo_uploaded` |

**Existing producer kinds** (`intake_submitted`, `media_uploaded`, `audit_case_submitted`, `hairaudit_media_uploaded`, `surgery_evidence_uploaded`, etc.) map to **`document`**, **`imaging`**, or **`audit`** **taxonomy in the read model** even if DB `event_kind` strings stay stable for backward compatibility (v1 can add **`category`** in API responses via a registry map without renaming stored kinds immediately).

---

## 4. Proposed event kinds

Below are **proposed canonical `event_kind` strings** (dot-separated). Exact strings may be aliased to legacy kinds during transition; **idempotency** must use **stable source keys**, not display titles.

### 4.1 Consultation

| `event_kind` | When emitted |
|--------------|----------------|
| `consultation.created` | Consultation instance created and associated to patient and/or case per product rules. |
| `consultation.completed` | Form/instance locked/completed (align rules so patient-scoped timelines are not silently skipped). |
| `consultation.summary_generated` | AI or staff summary artifact attached and considered final for a given version. |
| `consultation.quote_created` | Financial quote generated from consultation context. |

### 4.2 Pathology

| `event_kind` | When emitted |
|--------------|----------------|
| `pathology.requested` | Request created / sent for processing (maps from blood request created/sent policy). |
| `pathology.result_uploaded` | Result file/record stored and linked. |
| `pathology.reviewed` | Staff clinical review completed (human sign-off). |

### 4.3 Booking

| `event_kind` | When emitted |
|--------------|----------------|
| `booking.created` | Booking persisted with start time (includes Timely-created internal bookings). |
| `booking.completed` | Appointment completed (or product-defined terminal success state). |

### 4.4 Surgery / case

| `event_kind` | When emitted |
|--------------|----------------|
| `surgery.case_created` | Surgical case record created or seeded from lead conversion (if distinct from generic `fi_cases` creation, alias or dedupe). |
| `surgery.plan_created` | First plan or **major** plan revision committed (define “major” in implementation notes). |
| `surgery.procedure_completed` | Procedure day closed / documented per SurgeryOS rules. |
| `surgery.followup_completed` | Post-op follow-up milestone completed. |

### 4.5 Imaging

| `event_kind` | When emitted |
|--------------|----------------|
| `imaging.image_uploaded` | New clinical image in `fi_patient_images` (or unified asset if that is the chosen single source for a workflow). |
| `imaging.protocol_completed` | Imaging protocol run finished (devices / capture checklist). |

### 4.6 Medication (MedicationOS)

| `event_kind` | When emitted |
|--------------|----------------|
| `medication.started` | Medication episode started for patient. |
| `medication.dose_changed` | Therapeutically meaningful dose change. |
| `medication.stopped` | Episode ended (any reason: completed course, adverse, switched). |

### 4.7 Treatment

| `event_kind` | When emitted |
|--------------|----------------|
| `treatment.prp_completed` | PRP session completed and recorded. |
| `treatment.exosomes_completed` | Exosomes session completed. |
| `treatment.iron_infusion_completed` | Iron infusion session completed. |

### 4.8 Task

| `event_kind` | When emitted |
|--------------|----------------|
| `task.created` | Optional: only if task is **patient-visible** or **regulated follow-up**. |
| `task.completed` | Optional: paired completion milestone. |

### 4.9 Document

| `event_kind` | When emitted |
|--------------|----------------|
| `document.generated` | PDF/report/consent generated and stored with stable `document_id`. |

### 4.10 Portal

| `event_kind` | When emitted |
|--------------|----------------|
| `portal.photo_uploaded` | Patient-submitted photo passes validation and is stored. |
| `portal.form_submitted` | Patient-submitted form instance submitted. |

**Legacy coexistence:** Keep existing kinds such as `crm.lead.stage_changed`, `intake_submitted`, `media_uploaded`, `consultation.completed` (if already unprefixed) in the registry with **aliases** to the category model above.

---

## 5. Relationship model

Each **`fi_timeline_events`** row SHOULD be filterable and joinable without parsing free text. Recommended columns / JSON shape (conceptual — **future migration**, not implemented here):

| Field | Cardinality | Usage |
|-------|-------------|--------|
| **`tenant_id`** | Required | Tenant isolation; all queries scoped. |
| **`clinic_id`** | Optional | When milestone is clinic-specific (procedure day, booking location). |
| **`patient_id`** | Required *when patient-scoped* | Primary Twin / profile / Portal key; some ingest rows may resolve patient via case only — product rule should **enforce** resolution or backfill. |
| **`lead_id`** | Optional | CRM linkage; never the sole identifier for clinical milestones if a patient exists. |
| **`case_id`** | Optional | Case-scoped milestones; required for kinds that are inherently case-bound (many surgery/imaging on a case). |
| **`consultation_id`** | Optional | ConsultationOS joins. |
| **`booking_id`** | Optional | Booking dedupe and deep links. |
| **`pathology_request_id`** | Optional | Pathology request card / workflow. |
| **`pathology_result_id`** | Optional | Result review / PDF. |
| **`medication_id`** | Optional | MedicationOS linkage. |
| **`image_id`** | Optional | `fi_patient_images` or unified media id — **one canonical pointer policy** per kind. |
| **`document_id`** | Optional | Generated document linkage. |
| **`actor_user_id`** | Optional | Staff or system actor for audit narratives. |
| **`occurred_at`** | Required | Sort key; may differ from `created_at` for backfill. |
| **`metadata`** | JSON | **Non-PII preference** for analytics; store **ids**, enums, version numbers, template slugs; redact or encrypt sensitive payloads per policy. |

**Nullability rules (design intent):**

- Every row MUST be retrievable in **Patient Twin** context: resolve **`patient_id`** OR **`case_id`** that maps to foundation patient set (current Twin behaviour). **Portal** and **ConsultationOS** SHOULD require **`patient_id`** for patient-facing rows.
- **`fi_event_id`** (existing pattern from audits) remains valuable for **producer provenance** when the row originates from `fi_events`.

---

## 6. UI consumption model

All listed surfaces consume the **same canonical timeline read model** (query/projection over **`fi_timeline_events`** + registry for category, titles, and visibility). One **canonical read API** (internal module or route) returns **ordered timeline DTOs** with: `event_kind`, `category`, `occurred_at`, `title`, `summary`, `deep_links`, `visibility`, foreign keys, and `metadata` shaped for each consumer.

### 6.1 Patient Twin timeline card

- **Source:** Canonical **`fi_timeline_events`** (long term: no second “foundation-only” merge path).
- **Presentation:** Foundation-style cards; rows deep-link to SurgeryOS, ConsultationOS, pathology, booking, imaging, or medication contexts via foreign keys.
- **CRM card:** Remains a **separate summary** of latest CRM activity — **not** a parallel timeline store.

### 6.2 Patient profile timeline

- **Phase A (transition):** Canonical rows first + **residual synthetic** items only where backfill/dual-write has not yet created a row; same dedupe keys as §7.
- **Phase B (end state):** **Single stream** from persisted timeline rows; shrink or retire `buildPatientTimeline` merge for milestones that now exist in `fi_timeline_events`.

### 6.3 SurgeryOS case timeline

- **Filter:** `case_id` plus categories relevant to the surgical journey: `surgery`, `booking`, `pathology`, `imaging`, `document`, `treatment`, `medication`, and selected `consultation` rows tied to the case.
- **Milestones:** Prefer sort by `occurred_at`; use **explicit `event_kind` ordering** only for fixed stepper UIs (e.g. portal progress).

### 6.4 ConsultationOS patient summary

- **Filter:** `consultation_id` for the active session sidebar; **patient-wide** slice for pre-visit and longitudinal context.
- **Emphasis:** `consultation.*`, `pathology.*`, `booking.*`, `document.generated`, and **`medication.*`** when MedicationOS is live (contra-indications, ongoing therapy).

### 6.5 Patient Portal timeline / progress view

- **Filter:** **`visibility = patient_safe`** from registry + row policy; **no** raw CRM note bodies or staff-only kinds.
- **Progress:** Derive **checklist steps** from ordered canonical kinds (e.g. intake → consultation → pathology reviewed → booking → procedure → follow-up), not from ad-hoc CRM strings.

### 6.6 AnalyticsOS lifecycle reporting

- **Input:** **`fi_timeline_events`** + **`event_kind`** registry (categories, funnels).
- **Metrics:** Time-between-milestones, conversion rates, cohort curves — all keyed on **`occurred_at`** and stable **`event_kind`**.
- **CRM:** Keep **`fi_crm_activity_events`** as a **separate** dataset for comms/task analytics unless a row is explicitly mapped to a foundation milestone.

### 6.7 DoctorOS, ImagingOS, and MedicationOS (same API, different filters)

These OS modules **do not** define a second timeline table; they **slice** the canonical stream:

- **DoctorOS:** Staff-facing filter over full categories where role permits; honour **break-glass**, **sensitivity**, and audit policy on `metadata`; align with clinical review workflows (`pathology.reviewed`, `document.generated`, etc.).
- **ImagingOS:** `category = 'imaging'` (and legacy producer kinds mapped to imaging in the registry); join on **`image_id`** / protocol identifiers for viewers and QA.
- **MedicationOS:** `category = 'medication'`; join on **`medication_id`** for titration history, stops, and cross-checks in ConsultationOS / SurgeryOS **without** duplicating prescription state in CRM activity.

---

## 7. Duplicate prevention

### 7.1 Idempotency identity

Treat each logical milestone as:

> **`(tenant_id, event_kind, source_table, source_id)`**  
> with **`patient_id`** (and/or **`case_id`**) present for patient/case-scoped queries.

Including **`patient_id`** in application-level idempotency checks helps catch mis-keyed writes early; the **database unique constraint** may remain on `(tenant_id, event_kind, source_table, source_id)` when `source_id` globally identifies one fact (see §7.2).

Where:

- **`source_table`** — e.g. `fi_bookings`, `fi_pathology_results`, `fi_consultations`, `fi_crm_activity_events`, `fi_events`.
- **`source_id`** — primary key of the driving row **or** deterministic synthetic id for producer replay (e.g. producer `source_event_id` hashed into uuid policy).

### 7.2 Database uniqueness (future migration)

Recommended **partial unique index** (conceptual):

- **Unique:** `(tenant_id, event_kind, source_table, source_id)` **WHERE** `source_table IS NOT NULL AND source_id IS NOT NULL`.

Additional rules:

- **Producer ingest:** Continue to use **`fi_events`** idempotency; foundation row creation should be **replay-safe** (same `fi_event_id` → same or skipped timeline row).

### 7.3 CRM vs foundation

- If **`booking.created`** is persisted to foundation from `fi_bookings.id = X`, then CRM activity for `booking.created` MUST NOT create a **second** foundation row; profile merge MUST exclude duplicate activity (extend current exclusion list in one **central registry**).

### 7.4 Imaging vs media

- If both pipelines can fire for one capture, **choose one `source_table`** for timeline or enforce **single writer** per capture type (ImagingOS decision).

### 7.5 Backfill strategy (idempotent)

- Backfill jobs **INSERT … ON CONFLICT DO NOTHING** (or equivalent) on the unique key above.
- **Re-run safe:** same source row never creates duplicates.
- **Verification:** nightly counts of **orphan** CRM activities with `fi_timeline_event_id` set vs foundation row exists.

---

## 8. Backfill plan

Staged, **read-only analytics first**, then **insert missing foundation rows** per domain. Order respects dependencies (patient/case resolution before children).

| Stage | Source | Target kinds (examples) | Notes |
|-------|--------|-------------------------|--------|
| **B0 — inventory** | All sources | N/A | Count per patient/case how many milestones **lack** foundation rows; define allow-list mapping from CRM `activity_kind` → `event_kind`. |
| **B1 — Bookings** | `fi_bookings` | `booking.created`, `booking.completed`, cancellations if product wants | Prefer booking table over CRM activity as **source_table**; exclude duplicates per §7. |
| **B2 — Consultations** | `fi_consultations` / form instances | `consultation.completed`, `consultation.created` | Fix historical rows missing `case_id`/`patient_id` **before** claiming parity (data fix track, not timeline table). |
| **B3 — Pathology** | Requests/results | `pathology.requested`, `pathology.result_uploaded`, `pathology.reviewed` | Map from pathology tables; ignore duplicate CRM activities for same ids. |
| **B4 — CRM milestones** | `fi_crm_activity_events` | **Only** allow-listed kinds (e.g. `stage.changed` already linked) | Do **not** bulk-import notes/messages. |
| **B5 — Patient images** | `fi_patient_images` | `imaging.image_uploaded` | One row per image or per batch per policy; dedupe on image id. |
| **B6 — Cases / surgery** | `fi_cases`, surgery plans, procedure days | `surgery.case_created`, `surgery.plan_created`, `surgery.procedure_completed` | Define “major plan revision” algorithm conservatively to avoid bloat. |
| **B7 — Follow-ups** | Post-op follow-up records, scheduled follow-up bookings, or milestone tables SurgeryOS defines | `surgery.followup_completed`, and/or `booking.completed` when the appointment type is follow-up | Dedupe: one **`source_table` + `source_id`** per completed follow-up episode; do not also emit a duplicate generic booking row if product maps follow-up visits to `surgery.followup_completed` only. |
| **B8 — Producer replay** | `fi_events` processed | Existing dual-write kinds | Use existing **`backfillFoundationFromProcessedEventsAction`** pattern where applicable; align with `dualWriteFoundationFromFiEvent`. |
| **B9 — Medications** | MedicationOS tables (future) | `medication.*` | Run after schema exists; backfill from episode start, dose change audit rows, and stop rows. |

**Patient resolution:** Every backfilled row SHOULD obtain **`patient_id`** when human-visible; case-only rows must join through **`case_id`** → foundation patient mapping used by Twin today.

---

## 9. Rollout plan

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **Phase 1 — Design only** | This document + registry spreadsheet of `event_kind` → category, visibility, CRM exclusion | Product + eng + compliance sign-off on **Portal visibility** and **audit** posture |
| **Phase 2 — Helper functions** | Central `emitPatientTimelineEvent({ … })` with idempotency, typing, allow-list | Unit tests on idempotency; no UI change required |
| **Phase 3 — Dual-write new events** | Domain mutators for consultation, booking, pathology, surgery, imaging, treatment, and (when live) **MedicationOS** emit `fi_timeline_events` rows via shared helper | Twin and case timelines show new milestones without regressions |
| **Phase 4 — Backfill historical** | Staged jobs per §8 | Dashboard: % patients with parity on key funnels |
| **Phase 5 — Switch patient profile to canonical timeline** | Profile read model consumes foundation first; shrink synthetic | Profile and Twin show **same** ordering for shared kinds |
| **Phase 6 — Patient Portal timeline** | Patient-safe filter + progress UI | Portal launch criteria met; privacy review passed |

---

## 10. Risks and decisions

### 10.1 Timeline bloat

- **Risk:** Too many kinds → noisy Twin/Portal.
- **Mitigations:** Milestone-only policy (§2.2); **major revision** gates for plans; **batch** imaging uploads; retention tiering (archive old rows to cold storage **only** if legally permitted — default **keep**, compress metadata).

### 10.2 CRM noise

- **Risk:** Treating CRM as timeline of record floods clinical narrative.
- **Mitigations:** CRM stays SoR for chatter; foundation is **curated**; central exclusion + allow-list (§2.4, §7).

### 10.3 Patient privacy

- **Risk:** Metadata leaks staff notes or sensitive results.
- **Mitigations:** **`visibility`** enum on read model; **no raw note bodies** in `metadata`; encrypt or omit sensitive payloads; Portal uses **patient-safe** projection only; role-based filtering for DoctorOS.

### 10.4 Clinical auditability

- **Risk:** Editable rows undermine trust.
- **Mitigations:** **Append-only** foundation rows; corrections via **`corrected_by_timeline_event_id`** new row (optional pattern) or regulated amend workflow; **`actor_user_id`** mandatory for staff-emitted kinds where feasible.

### 10.5 Immutable vs editable timeline rows

- **Default:** **Immutable** inserts; **soft corrections** via superseding rows.
- **Exception:** purely **cosmetic** title fixes may be allowed with **audit log** of change (if legally acceptable); prefer **correction row** for medicolegal clarity.

### 10.6 Deleting source records

- **Risk:** Orphan timeline rows point to missing entities.
- **Mitigations:** **Retain** timeline row with `metadata.status = source_deleted` and **tombstone** deep links; never hard-delete clinical milestones if statute requires retention; case merge tools must **rewire** foreign keys or mark superseded.

### 10.7 Patient-visible filtering

- **Decision:** Maintain **`event_kind` → { patient_visible, portal_title_template, portal_detail_level }** in registry; **default deny** for unknown kinds in Portal; **CRM-derived** rows only appear if explicitly mapped.

---

## Appendix A — Traceability to audits

| Audit topic | This document section |
|-------------|------------------------|
| Twin vs profile split | §1 |
| Producer `fi_events` + dual-write | §2, §8 B8 |
| CRM activity inventory | §1.3, §2.4 |
| Consultation `patient_id`+`case_id` gap | §1.1, §8 B2 |
| Pathology via CRM vs foundation | §1.5, §4.2 |
| Booking synthetic vs foundation | §1.6, §4.3, §7 |
| Reminder / comms vs timeline | §2.4 |
| `EXCLUDED_DUPLICATE_ACTIVITY_KINDS` | §2.5, §7.3 |
| MedicationOS / follow-up backfill | §6.7, §8 B7, §8 B9 |

---

*End of design document.*
