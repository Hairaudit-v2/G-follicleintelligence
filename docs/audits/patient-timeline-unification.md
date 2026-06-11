# Patient Twin timeline — source audit and unification notes

**Scope:** Read-only audit of what contributes to **Patient Twin V1** (`loadPatientTwinV1`) with emphasis on the **`timeline`** projection, compared to the **Stage 4D patient treatment timeline** (`loadPatientTimelineSources` + `buildPatientTimeline`) used on the patient profile. **No code changes.**

---

## 1. Definitions (avoid ambiguity)

| Surface | Loader / builder | What users see as “timeline” |
|---------|------------------|------------------------------|
| **Patient Twin — “Foundation timeline” card** | `loadPatientTwinV1` → `buildFoundationTimeline` in `patientTwinLoader.server.ts` | Only **`fi_timeline_events`** rows scoped to the patient’s foundation id(s) and linked **case ids** (deduped, newest first, cap 100). UI: `PatientTwinTimelineCard`. |
| **Patient profile — treatment timeline** | `loadPatientTimelineSources` + `buildPatientTimeline` | **Synthetic items** from leads, `fi_bookings`, `fi_cases`, `fi_crm_activity_events`, clinical row, `fi_patient_images`, patient row — **does not query `fi_timeline_events`**. |

These are **two different read models**. Unification work must state which is canonical for “patient timeline” or merge them explicitly.

---

## 2. Patient Twin `timeline.items` — how it is built

1. **`loadUniversalPatientRecord`** (`src/lib/fi/foundation/patientRecord.ts`) loads `timeline_events` from **`fi_timeline_events`** where `tenant_id` matches and **`patient_id` IN foundation patient id set** OR **`case_id` IN resolved case id set** (chunked, dedupe by event id, sort by `occurred_at` desc, query limit 2000 before dedupe).
2. **`buildFoundationTimeline`** maps each row to `PatientTwinTimelineItem` with **`source_type: "fi_timeline_events"`** only (`patientTwinTypes.ts`).

**Provenance:** `patientTwinLoader.server.ts` lists `fi_timeline_events` under `SOURCE_TABLES_USED`.

---

## 3. Other Patient Twin sections (same page, not merged into `timeline`)

| Section | Primary sources | Relationship to `timeline` |
|---------|-----------------|---------------------------|
| **CRM** | `fi_crm_leads`, `fi_crm_tasks` (count), `fi_crm_activity_events` (single latest row for summary text), `fi_crm_pipeline_stages`, `fi_users`, `fi_clinics`, `fi_organisations` | Parallel narrative; card copy says CRM is summarised separately from foundation timeline. |
| **Cases** | `v_fi_case_foundation` via UPR | **`latest_milestone`** per case is derived from the **same** `timeline_events` list used for `timeline.items` (first event per case in that sorted list). |
| **Pathology** | `fi_pathology_requests`, `fi_pathology_results`, `fi_pathology_result_items`, `fi_pathology_ai_interpretations` | Structured cards; **not** folded into `timeline.items`. |
| **Audits** | `fi_reports`, `fi_audits`, `fi_model_runs`, `fi_scorecards` | Rollups + latest released report; not timeline rows. |
| **Media** | `v_fi_media_unified` | Counts / latest per `asset_type`; not timeline rows. |
| **Imaging** | `fi_patient_images` (active) | Counts by library axis; not timeline rows. |
| **Clinical** | `fi_patient_clinical_details` | Structured profile only in V1 twin. |

---

## 4. Source-by-source matrix (requested domains)

Legend: **Twin TL** = Patient Twin `timeline.items` (`fi_timeline_events`). **Profile TL** = `buildPatientTimeline` unified feed.

| Source | Appears on Twin TL? | Appears elsewhere on Twin? | Appears on Profile TL? | Notes |
|--------|---------------------|-----------------------------|-------------------------|--------|
| **CRM — activity** | Only if a writer created a matching **`fi_timeline_events`** row (e.g. `crm.lead.stage_changed` from `moveCrmLeadToStage`). | Yes — CRM card (`latest_activity_summary` from raw activity; task counts). | Yes — `fi_crm_activity_events` → `crm_activity` items (with exclusions, see §6). | Most CRM activity **never** creates foundation timeline rows. |
| **CRM — tasks / “follow ups”** | Only if mirrored to foundation (today: **no** standard task→timeline write). | `open_tasks_count`; task lifecycle appears indirectly via latest activity line if recent. | Yes — `task.*` kinds in activity feed. | “Follow up” CRM tasks are **not** a separate Twin TL source. |
| **CRM — leads** | No (unless duplicated as foundation event — not standard). | Case rows may reference leads; CRM card shows lead rollups. | Yes — synthetic `lead_created` / `lead_converted` from lead rows. | |
| **Consultations** | **Yes** when `consultation.completed` is written (`completeConsultationFormInstance` requires **case_id + patient_id** on consultation). | Consultation list lives on patient profile/slide-over loaders, **not** inside Twin DTO. | **No** — Profile TL bundle has **no** `fi_consultations` / foundation timeline query. | Major **gap** between Twin TL and Profile TL for the same patient. |
| **Pathology** | Only if something wrote **`fi_timeline_events`** for it (not the default path; pathology uses **`appendCrmActivityEvent`**). | Yes — dedicated Pathology card (requests/results/AI). | Yes — via **`pathology.*`** and **`pathology.ai_interpretation.*`** CRM activity kinds. | Same clinical facts can appear as **Pathology card + Profile TL activity**; Twin TL often **empty** for pathology. |
| **Bookings** | Only if a foundation milestone exists (ingest/dual-write does **not** generally create booking rows in `fi_timeline_events`). | No booking list on Twin dashboard. | Yes — synthetic items from **`fi_bookings`** (`booking_scheduled`, completion/cancel/no-show). CRM `booking.created` / `completed` / `cancelled` activities are **excluded** from activity list to reduce dup with synthetic booking items. | Twin TL **misses** typical booking lifecycle unless explicitly dual-written elsewhere. |
| **Surgery cases / plans** | Only if mapped to foundation events (today: surgery plan patches **`fi_case_surgery_plans`**, not `fi_timeline_events`). | Indirectly via **case** row + audits; no surgery-plan card in Twin V1. | **No** — Profile TL has no `fi_case_surgery_plans` source. | Surgery planning history is **absent** from both chronological feeds unless CRM/timeline writers add it. |
| **Images** (`fi_patient_images`) | No | Yes — **Imaging** card (counts, latest capture). | Yes — `image_uploaded` / `image_archived` synthetic items. | **Media** card uses **`v_fi_media_unified`** (different pipeline from patient imaging library). |
| **Media / uploads** (`v_fi_media_unified`, `fi_media_assets`) | Yes when FI ingest dual-write creates **`media_uploaded`** etc. on a case tied to the patient. | **Media** card. | **No** in Profile TL builder. | Overlap risk with patient images for some workflows (conceptual dup, not necessarily same DB row). |
| **Producer FI ingest** | Yes — HLI/HairAudit dual-write → `fi_timeline_events` with kinds such as `intake_submitted`, `media_uploaded`, `audit_case_submitted`, etc. | Media card reflects unified media. | **No** in Profile TL. | |

---

## 5. Answers to the four questions

### 5.1 Which sources already appear (on Patient Twin `timeline`)?

Only rows in **`fi_timeline_events`** for the tenant that match the patient’s resolved **foundation patient id(s)** and/or **case id(s)**. In practice today that includes (non-exhaustive):

- FI producer ingest dual-write milestones (e.g. intake, document/image uploads, HairAudit case submitted).
- **`consultation.completed`** when consultation completion runs with patient + case linked.
- **`crm.lead.stage_changed`** when CRM stage movement dual-writes timeline and lead has `case_id`.

Anything that **never** inserts `fi_timeline_events` does **not** appear on Twin TL.

### 5.2 Which sources are missing (from Twin TL)?

Relative to the product domains you listed:

- **Most CRM activity** (messages, notes, generic tasks, many booking-related activities) — no foundation row.
- **Bookings** as operational schedule — no default foundation timeline row per booking.
- **Pathology requests/results** as first-class events — not written to `fi_timeline_events` by current mutations (CRM activity + Pathology card carry the signal).
- **Surgery planning / case surgery plan edits** — not in `fi_timeline_events`.
- **`fi_patient_images`** — not in `fi_timeline_events`.
- **Consultations** that complete **without** both `patient_id` and `case_id` — **no** `consultation.completed` timeline row (completion still succeeds; timeline insert skipped in `completeConsultationFormInstance`).

Additionally, the **Profile treatment timeline** is missing **all** pure foundation milestones (`fi_timeline_events`), including ingest and `consultation.completed`.

### 5.3 Which sources duplicate data?

| Duplication pattern | Where |
|---------------------|--------|
| **Same underlying fact, two Twin surfaces** | e.g. ingest media → **`fi_timeline_events`** + **`v_fi_media_unified`** (timeline narrative vs media card). |
| **Same `timeline_events` list, two presentations** | `twin.timeline.items` (full list, capped) vs **`cases[].latest_milestone`** (first event per case from same array in loader). |
| **Pathology: CRM activity vs Pathology card** | Profile TL shows pathology via activity; Twin shows pathology tables; Twin TL may show **nothing** for pathology — tri-fold split. |
| **Booking: synthetic Profile TL items vs CRM** | Builder excludes certain `booking.*` activity kinds when synthetic booking items exist — mitigates duplicate **within Profile TL** only. |
| **Imaging vs media** | Patient clinical images (`fi_patient_images`) vs unified media assets — overlapping **clinical** story, different tables. |

### 5.4 Which sources should become timeline events (`fi_timeline_events`)?

Recommendations are **product-dependent**; below is a technical consolidation view.

| Source | Recommendation | Rationale |
|--------|----------------|-----------|
| **Consultation milestones** | **Yes** (extend coverage) | Today `consultation.completed` only when case+patient; consider `consultation.started` / `locked` or always attach patient-scoped event to avoid silent gaps. |
| **Pathology major state transitions** | **Optional but valuable** | Gives Twin TL parity with Profile TL without opening CRM activity; keep **thin** titles and point to request/result ids in `detail`. |
| **Booking lifecycle** | **Optional** | If Twin TL should be the canonical clinical chronology, mirror key transitions (`booking.completed`, etc.) **or** formally declare bookings profile-only and never in foundation. |
| **Surgery plan draft / key updates** | **Optional** | Otherwise invisible on both timelines; link to `case_id` and plan id in `detail`. |
| **CRM chatter (notes, comms, minor tasks)** | **Usually no** | High volume + sensitivity; Profile TL already handles via CRM activity with `is_sensitive` flags. Prefer CRM TL or keep as activity-only. |
| **Every CRM task** | **No** by default | Noisy; task list + activity feed suffices unless regulatory need for foundation audit trail. |
| **Patient images** | **Usually no** | Profile TL + Imaging card; foundation timeline if you need one chronological stream across modules (then dedupe with media uploads). |

---

## 6. Profile TL — CRM exclusions (duplicate mitigation)

`patientTimelineBuild.ts` defines **`EXCLUDED_DUPLICATE_ACTIVITY_KINDS`** including `booking.created`, `booking.completed`, `booking.cancelled`, `lead.created`, `lead.converted_to_person`, `lead.case_seeded` so those do not appear **twice** alongside synthetic lead/booking items.

Pathology and other kinds are **not** globally excluded — they flow through CRM activity into Profile TL.

---

## 7. Unification implementation directions (planning only)

1. **Pick a canonical patient chronology** for FI OS: either expand **`fi_timeline_events`** as the single append-only clinical stream, or treat **`buildPatientTimeline`** as canonical and **feed Twin TL from the same builder** (adding foundation events to the bundle).
2. **If Twin TL stays foundation-only:** add targeted `createTimelineEvent` calls (or a single “timeline projection” worker) for pathology, bookings, surgery — **or** change Twin UI to embed the Profile TL component for a merged view.
3. **If Profile TL is canonical:** extend `PatientTimelineSourceBundle` with **`foundationTimelineEvents`** and map them in `buildPatientTimeline` with a distinct `item_type` / `source_type` extension.
4. **Consultation gap:** align completion rules so every completed consultation emits a patient- or case-scoped foundation event when product requires Twin TL consistency.
5. **Dedupe rules:** centralise “one fact, one row” policy (e.g. booking vs CRM activity vs foundation) mirroring `EXCLUDED_DUPLICATE_ACTIVITY_KINDS` logic.

---

## 8. Key source files

| Concern | File |
|---------|------|
| Twin loader + foundation timeline slice | `src/lib/patientTwin/patientTwinLoader.server.ts` |
| Twin types | `src/lib/patientTwin/patientTwinTypes.ts` |
| Twin timeline UI | `src/components/fi-admin/patientTwin/PatientTwinTimelineCard.tsx` |
| Foundation timeline query | `src/lib/fi/foundation/patientRecord.ts` |
| Profile TL sources | `src/lib/patients/timeline/patientTimelineServer.ts` |
| Profile TL merge / exclusions | `src/lib/patients/timeline/patientTimelineBuild.ts` |
| Consultation completion → foundation event | `src/lib/consultationForms/consultationFormMutations.server.ts` |

---

*End of audit.*
