# Stage 1F — Foundation dual-write on FI event ingest

**Status:** Implemented (application layer).  
**Related:** [06-foundation-layer-architecture](./06-foundation-layer-architecture.md), [07-foundation-migration-specification](./07-foundation-migration-specification.md), [08-foundation-resolution-helpers](./08-foundation-resolution-helpers.md).

---

## 1. Purpose

After an FI producer event is validated, appended to `fi_events`, and linked via `fi_event_links` (with existing `fi_global_patients` / `fi_global_cases` resolution unchanged), the server **also** writes canonical foundation rows: organisations (optional), clinics (optional), persons, patients, `fi_cases` foundation columns, curated `fi_timeline_events`, and `fi_media_assets` references where applicable.

This is **dual-write only**: `fi_events`, `fi_global_patients`, and `fi_global_cases` remain authoritative for current HairAudit / HLI behaviour.

---

## 2. Where dual-write runs

| Location | When |
|----------|------|
| `lib/fi/events/handlers/hliIntakeSubmitted.ts` | Immediately after `linkEventToEntities`, before submit / status `processed`. Same call on idempotent `already_processed` paths (including outer `getExistingFiEventBySourceKey` short-circuit) to backfill foundation if an event was processed before Stage 1F. |
| `lib/fi/events/handlers/hairauditCaseSubmitted.ts` | Same pattern. |
| `lib/fi/events/handlers/hliDocumentUploaded.ts` | Same pattern. |
| `lib/fi/events/handlers/hairauditImagesUploaded.ts` | Same pattern. |

**Not called** when an event row exists with status `processing` only (`already_processing` short-circuit), because global links may be incomplete.

**Implementation entrypoint:** `dualWriteFoundationFromFiEvent` in `src/lib/fi/foundation/dualWriteEvent.ts` (server-only; do not import from client components).

---

## 3. Mapping rules

Central mapping: `src/lib/fi/foundation/eventMapping.ts`.

### 3.1 `fi_cases.metadata.case_type` (foundation case type)

| `event_type` | `case_type` |
|----------------|---------------|
| `hli.intake.submitted` | `hair_loss_assessment` |
| `hairaudit.case.submitted` | `audit` |
| `hli.document.uploaded` | `media` |
| `hairaudit.images.uploaded` | `general_case_event` (per-image `fi_media_assets.asset_type` carries finer semantics) |
| `clinic.ai.usage` | `general_case_event` (not ingested through handlers today) |

### 3.2 `fi_timeline_events`

One curated row per meaningful ingest event type currently in the contract. `event_kind` / `title` are defined in `getFoundationTimelineSpec` and `getHairAuditImagesTimelineSpec` (HairAudit images use a single batch row; surgical-looking image `type` strings use `surgery_evidence_uploaded`).

### 3.3 `fi_media_assets.asset_type`

| Source | Rule |
|--------|------|
| HLI document | `blood_pdf` / `blood_csv` → `hair_loss_assessment`; other kinds → `media` |
| HairAudit image `type` | Conservative keyword hints (`transplant`, `fue`, `graft`, `surgery`, `postop`, …) → `hair_transplant` or `surgery_evidence`; otherwise `media` |

**No file copy:** only metadata rows; `storage_path` / optional `source_asset_id` reference existing storage.

---

## 4. Idempotency

- Relies on Stage 1E helpers: source mapping uniqueness, `createTimelineEvent` dedupe when `fi_event_id` + `case_id` + `event_kind` match, `createMediaAsset` dedupe by `(tenant_id, storage_path)` or `(tenant_id, source_system, source_asset_id)`.
- Replaying the same producer event (`source_event_id`) hits `already_processed` handlers and runs dual-write again; duplicate timeline/media rows should not appear.

---

## 5. Failure behaviour

- `dualWriteFoundationFromFiEvent` **never throws**. On any error it logs a structured line to stderr with prefix `[fi-foundation-dual-write]` and returns `{ ok: false, error }`.
- Primary ingest continues: `fi_events` status transitions, submit/trigger logic, and `fi_uploads` writes are unchanged.
- If `fi_case_id` is missing from resolution, dual-write returns `{ ok: false, skipped_reason: "missing fi_case_id" }` without logging an exception.

---

## 6. What is not dual-written yet

- `fi_event_links` optional foundation FK columns (`patient_id` / `clinic_id` to `fi_patients` / `fi_clinics`) — not updated in Stage 1F.
- `fi_global_cases.foundation_patient_id` — not written here (can be a follow-up once reconciliation rules are agreed).
- `source_doctor_id` → dedicated practitioner / `person_roles` graph — not wired.
- Producer-only concepts without events in this repo (e.g. “audit completed”, “report generated” as distinct event types) — no mapping until `FiEventType` / handlers exist.
- `clinic.ai.usage` — still unsupported in `ingestFiEvent` dispatch; no dual-write path.

---

## 7. Rollout / rollback

**Rollout:** Deploy application with dual-write enabled. Foundation tables must exist (Stage 1C migrations). Monitor `[fi-foundation-dual-write]` logs and optional reconciliation counts (`fi_timeline_events`, `fi_media_assets` vs `fi_events`).

**Rollback:** Remove or comment out handler calls to `dualWriteFoundationFromFiEvent` and redeploy. No need to delete foundation rows for rollback; stopping writes is sufficient. Database rollback follows [07 §9](./07-foundation-migration-specification.md) reverse migration order if tables are dropped.

---

## 8. Schema / product TODOs

- **Sparse identity:** events without `source_patient_id` and without normalised email can create a **new** `fi_persons` row per event (by design of `resolveOrCreatePerson`); consider stronger keys or explicit `source_person_id` on the envelope when producers support it.
- **`fi_global_cases.foundation_patient_id`:** align dual-write or a batch job once global ↔ foundation reconciliation is approved.
- **Event links foundation FKs:** populate `fi_event_links.patient_id` / `clinic_id` when read paths need direct joins.

---

## 9. Document map

| Doc | Role |
|-----|------|
| [08-foundation-resolution-helpers](./08-foundation-resolution-helpers.md) | Underlying find-or-create semantics |
| [03-event-ingestion-design](./03-event-ingestion-design.md) | Envelope lifecycle (contract unchanged) |
