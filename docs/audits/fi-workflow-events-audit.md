# FI OS — Workflow, timeline, CRM, and automation audit

**Scope:** Read-only inventory of event-like signals, ingestion paths, timeline and CRM side-effects, server actions, triggers, and operational integrations as implemented in this repository at audit time. No code was changed for this document.

**Conventions used here**

- **Producer FI events** — HTTP-ingested envelopes validated by `parseFiEventEnvelope` / `ingestFiEvent`, persisted in `fi_events`, handled under `lib/fi/events/handlers/`.
- **Foundation timeline** — Curated rows in `fi_timeline_events` (`event_kind`, optional `fi_event_id` provenance).
- **CRM activity** — Append-only rows in `fi_crm_activity_events` (`activity_kind`), optionally linked to a timeline row via `fi_timeline_event_id`.
- **Reminder automation** — `fi_reminder_templates.trigger_event` + scheduled `fi_reminder_jobs` processed by cron; not the same table as `fi_events`, but operationally an event bus for comms.

---

## 1. Producer FI events (`fi_events` / `POST /api/fi/events`)

**Transport:** `app/api/fi/events/route.ts` → `ingestFiEvent` (`lib/fi/events/ingest.ts`).

**Envelope (all types):** `FiEventEnvelope` in `src/types/fi-events.ts`

| Field | Role |
|--------|------|
| `tenant_id` | Tenant scope (required) |
| `event_type` | Dispatcher key (required) |
| `source_system` | `hli` \| `hairaudit` \| `clinic` (must match `event_type`) |
| `source_event_id` | Idempotency key (required) |
| `occurred_at` | Optional ISO time |
| `identifiers` | Optional `source_patient_id`, `source_case_id`, `source_clinic_id`, `source_doctor_id` |
| `payload` | Type-specific object (parsed in `lib/fi/events/schema.ts`) |

**Note:** `src/lib/fi/vocabulary.ts` lists additional *design* event names (e.g. `hli.blood_request.generated`) that are **not** accepted by the live ingest schema; treat the schema in `lib/fi/events/schema.ts` as authoritative for runtime.

---

## 2. Event-by-event audit (producer → handlers → side effects)

| Event name | Source module | Trigger condition | Payload (validated shape) | Consumers / effects |
|------------|---------------|-------------------|---------------------------|------------------------|
| `hli.intake.submitted` | Ingest: `lib/fi/events/ingest.ts` → `lib/fi/events/handlers/hliIntakeSubmitted.ts` | Valid envelope; `identifiers.source_case_id` required; new or in-flight `fi_events` row per idempotency rules | `payload.intake`: `full_name`, `email`, `dob`, `sex` required; optional `country`, `primary_concern`, `selections`, `notes` | **Global / legacy:** `fi_events`, `fi_event_links`, `fi_cases` / intakes via `lib/fi/events/mapping.ts`. **Foundation dual-write:** `dualWriteFoundationFromFiEvent` → persons, patients, case foundation, **`fi_timeline_events`** (`event_kind` `intake_submitted`). **Submit:** `maybeSubmitCaseFromEvent` only (no `maybeTriggerPipelineFromEvent` in this handler). **Reads:** admin/integrity loaders querying `fi_events`. |
| `hli.document.uploaded` | Same → `lib/fi/events/handlers/hliDocumentUploaded.ts` | Valid envelope; `identifiers.source_case_id` required | `payload.document`: `kind` ∈ `blood_pdf` \| `blood_csv` \| `supporting_docs`; `filename`, `storage_path` required; optional `mime_type`, `size_bytes` | **Global:** uploads + links as in handler. **Foundation:** dual-write → timeline **`media_uploaded`**, **`fi_media_assets`** for the document. **Submit + pipeline:** `maybeSubmitCaseFromEvent` then, if submit reason is `submitted` or `already_submitted_or_beyond`, **`maybeTriggerPipelineFromEvent`** → `runPipeline` (`lib/fi/pipeline`). |
| `hairaudit.case.submitted` | Same → `lib/fi/events/handlers/hairauditCaseSubmitted.ts` | Valid envelope; `identifiers.source_case_id` required | `payload.case`: optional demographics / `primary_concern` / `selections` / `notes` (see parser for `concern` alias) | Same global/foundation pattern; timeline **`audit_case_submitted`**. **Submit:** `maybeSubmitCaseFromEvent` only — **no automatic pipeline trigger** in handler. |
| `hairaudit.images.uploaded` | Same → `lib/fi/events/handlers/hairauditImagesUploaded.ts` | Valid envelope; `identifiers.source_case_id` required | `payload.images`: non-empty array of `{ type, filename, storage_path }` (+ optional `mime_type`, `size_bytes`) | Global uploads; dual-write → **`fi_media_assets`** per image; timeline kind from `getHairAuditImagesTimelineSpec` (**`surgery_evidence_uploaded`** vs **`hairaudit_media_uploaded`**). **Submit + pipeline:** same pattern as HLI document (submit then conditional **`maybeTriggerPipelineFromEvent`**). |
| `clinic.ai.usage` | Parsed by `lib/fi/events/schema.ts` | Passes envelope + payload validation (`payload.usage` object required) | `{ usage: Record<string, unknown> }` | **Ingest dispatcher explicitly returns unsupported** (`lib/fi/events/ingest.ts` → `buildUnsupportedResult`). No handler, no `fi_events` row via this path beyond validation failure before dispatch — effectively a **reserved, non-operational** type today. |

### 2.1 Foundation timeline kinds tied to producer ingest

From `getFoundationTimelineSpec` / `getHairAuditImagesTimelineSpec` (`src/lib/fi/foundation/eventMapping.ts`) and `dualWriteFoundationFromFiEvent` (`src/lib/fi/foundation/dualWriteEvent.ts`):

| Producer `event_type` | `fi_timeline_events.event_kind` | Title (default) |
|----------------------|----------------------------------|-------------------|
| `hli.intake.submitted` | `intake_submitted` | HLI intake submitted |
| `hli.document.uploaded` | `media_uploaded` | HLI document uploaded |
| `hairaudit.case.submitted` | `audit_case_submitted` | HairAudit case submitted |
| `hairaudit.images.uploaded` | `hairaudit_media_uploaded` or `surgery_evidence_uploaded` | Per image-type heuristics |

Timeline row `detail` merges description/metadata from `createTimelineEvent`; dual-write passes metadata including `global_case_id`, `source_system`, producer `event_type`.

### 2.2 Case submission and pipeline triggers (application-level)

| Function | Module | Role |
|----------|--------|------|
| `maybeSubmitCaseFromEvent` | `lib/fi/events/trigger.ts` | Invokes `submitCaseIfReady` when ingest handlers choose to auto-submit. |
| `maybeTriggerPipelineFromEvent` | `lib/fi/events/trigger.ts` | After case is not `draft` and requirements met, dedupes against `fi_model_runs` then **`runPipeline`**. |
| `maybeSubmitAndRunCase` | `lib/fi/events/trigger.ts` | Convenience chain (submit then trigger); used from scripts / tooling patterns. |

**Important asymmetry:** `hli.intake.submitted` and `hairaudit.case.submitted` call **submit only**. **`hli.document.uploaded`** and **`hairaudit.images.uploaded`** are the ingest paths that may **start the scoring pipeline** once the case is already submitted (or past draft).

---

## 3. Foundation timeline events outside producer ingest

These write **`fi_timeline_events`** without going through `fi_events` ingest.

| Logical event / `event_kind` | Source module | Trigger | Payload / metadata highlights | Consumers |
|------------------------------|---------------|---------|-------------------------------|-----------|
| `crm.lead.stage_changed` | `src/lib/crm/stageMovement.ts` (`moveCrmLeadToStage`) | Lead moved to a different pipeline stage; optional dual-write when `lead.case_id` set (default on) | Title “CRM stage changed”; metadata: `lead_id`, `from_stage_id`, `to_stage_id` | **CRM:** `appendCrmLeadStageHistory`, `appendCrmActivityEvent` (`stage.changed`) with `fiTimelineEventId` link. **UI:** merged into case timeline loaders (`src/lib/cases/caseTimelineLoaders.ts` / `caseTimelineBuild.ts`), universal case record, Patient Twin loaders. |
| `consultation.completed` | `src/lib/consultationForms/consultationFormMutations.server.ts` (`completeConsultationFormInstance`) | Consultation form instance locked/completed; `case_id` + `patient_id` on consultation; deduped by existing `fi_timeline_events` with same `form_instance_id` in `detail` | Metadata: `consultation_id`, `form_instance_id`, outcome fields, `template_slug` | Same case timeline / UPR surfaces as other foundation events. |

---

## 4. CRM activity events (`fi_crm_activity_events`)

**Writer:** `appendCrmActivityEvent` (`src/lib/crm/activity.ts`).

**API / actions:** `crmAppendActivityAction` (`lib/actions/fi-crm-actions.ts`), `POST …/crm/leads/[leadId]/activity` (`app/api/tenants/.../activity/route.ts`) — **`activityKind` is any string 1–128 chars** (`crmAppendActivityBodySchema`), so external integrators can emit custom kinds not listed below.

### 4.1 `activity_kind` values emitted in first-party code

| `activity_kind` | Source module | Trigger (summary) |
|-----------------|----------------|-------------------|
| `lead.created` | `src/lib/crm/leads.ts` | New CRM lead |
| `lead.updated` | `src/lib/crm/leadDetailsUpdate.ts` | Lead fields updated |
| `lead.converted_to_person` | `src/lib/crm/leadConversion.ts` | Lead conversion flow |
| `lead.case_seeded` | `src/lib/crm/leadConversion.ts` | Case linked during conversion |
| `stage.changed` | `src/lib/crm/stageMovement.ts` | Stage movement (links `fi_timeline_event_id` when created) |
| `note.created` | `src/lib/crm/notes.ts` | CRM note |
| `task.created` | `src/lib/crm/tasks.ts` | Task created |
| `task.updated` | `src/lib/crm/tasks.ts` | Task updated |
| `task.completed` | `src/lib/crm/tasks.ts` | Task completed |
| `task.reopened` | `src/lib/crm/tasks.ts` | Task reopened |
| `message.logged` | `src/lib/crm/messages.ts` | Message preview / log |
| `lead_note.created` | `src/lib/crm/leadNotes.ts` | Lead-specific note |
| `lead_note.updated` | `src/lib/crm/leadNotes.ts` | Lead note update |
| `lead_note.archived` | `src/lib/crm/leadNotes.ts` | Lead note archived |
| `lead_communication.created` | `src/lib/crm/leadCommunications.ts` | Contact log row created (including **reminder processor** outbound sends) |
| `lead_communication.updated` | `src/lib/crm/leadCommunications.ts` | Contact log updated |
| `lead_communication.archived` | `src/lib/crm/leadCommunications.ts` | Contact log archived |
| `booking.created` | `src/lib/bookings/bookings.ts` | Booking persisted |
| `booking.updated` | `src/lib/bookings/bookings.ts` | Booking updated |
| `booking.cancelled` | `src/lib/bookings/bookings.ts` | Booking cancelled |
| `booking.completed` | `src/lib/bookings/bookings.ts` | Booking completed |
| `appointment.instructions_sent` | `lib/actions/fi-booking-actions.ts` | Instructions sent action |
| `pathology.blood_request.created` | `src/lib/pathology/pathologyRequestMutations.server.ts` | Blood request created |
| `pathology.blood_request.cancelled` | `src/lib/pathology/pathologyRequestMutations.server.ts` | Blood request cancelled |
| `pathology.blood_request.sent` | `src/lib/pathology/pathologySendToPatient.server.ts` | PDF emailed to patient |
| `pathology.blood_result.uploaded` | `src/lib/pathology/pathologyResultMutations.server.ts` | Result uploaded |
| `pathology.blood_result.reviewed` | `src/lib/pathology/pathologyResultMutations.server.ts` | Result reviewed |
| `pathology.blood_result.archived` | `src/lib/pathology/pathologyResultMutations.server.ts` | Result archived |
| `pathology.ai_interpretation.generated` | `src/lib/pathology/pathologyAiInterpretationMutations.server.ts` | AI interpretation generated |
| `pathology.ai_interpretation.reviewed` | `src/lib/pathology/pathologyAiInterpretationMutations.server.ts` | AI interpretation reviewed |
| `pathology.ai_interpretation.archived` | `src/lib/pathology/pathologyAiInterpretationMutations.server.ts` | AI interpretation archived |

**CRM activity consumers:** lead slide-over / shell loaders, patient timeline merge (`patientTimelineBuild.ts` when CRM data is bundled), pathology and booking UIs, `GET …/crm/leads/.../activity`, analytics that read `fi_crm_activity_events`.

---

## 5. Reminder “events” (scheduling + delivery automation)

**Constants:** `REMINDER_TRIGGER_EVENTS` in `src/lib/reminders/reminderConstants.ts`:

- `booking_created`, `booking_48h_before`, `booking_24h_before`, aliases `booking_48h`, `booking_24h`, `post_consult`, `lead_created`

**Enqueue:** `src/lib/reminders/reminderEnqueue.server.ts` — `syncBookingReminderJobs` (from `src/lib/bookings/bookings.ts`), `syncPostConsultReminderJobs` (`src/lib/consultations/consultationMutations.server.ts`), `syncLeadCreatedReminderJobs` (`src/lib/crm/leads.ts`).

**Processor:** `processReminderJobsOnce` in `src/lib/reminders/reminderProcessor.server.ts` — called from **`app/api/cron/fi-reminder-jobs/route.ts`** (Vercel Cron / ops).

**Delivery:** `sendReminderDelivery` in `src/lib/reminders/reminderDelivery.server.ts` — **Resend** (email) or **Twilio** (SMS), gated by `FI_REMINDERS_LIVE_DELIVERY` (`src/lib/reminders/reminderLiveDeliveryPolicy.server.ts`).

**CRM bridge:** When a job has `lead_id`, successful send creates **`fi_crm_lead_communications`** via `createCrmLeadCommunication`, which emits **`lead_communication.created`** activity (see §4).

---

## 6. External webhooks (non–`fi_events` producers)

| Ingress | Module | Effect chain |
|---------|--------|--------------|
| `POST /api/tenants/[tenantId]/integrations/timely/patient` | `src/lib/integrations/timely/timelyPatientWebhook.server.ts` | Upserts person/patient + `fi_patient_source_ids` for Timely external id (no CRM activity in this file path). |
| `POST /api/tenants/[tenantId]/integrations/timely/appointment` | `src/lib/integrations/timely/timelyAppointmentWebhook.server.ts` | Creates **internal `fi_bookings`** row via `createBooking` (with `leadId: null` in default path) + external id mapping → inherits **booking + reminder** behaviour from `src/lib/bookings/bookings.ts`. |

Auth: `src/lib/integrations/timely/timelyWebhookAuth.server.ts` (Bearer secret).

---

## 7. Scheduled jobs (cron)

| Route | Purpose |
|-------|---------|
| `app/api/cron/fi-reminder-jobs/route.ts` | Drains `fi_reminder_jobs` via `processReminderJobsOnce`. |
| `app/api/cron/iiohr-hr-perth-staff-sync/route.ts` | HR staff sync (operational ETL, not mapped to `fi_events` / CRM activity taxonomy in this audit). |

---

## 8. Server actions (`"use server"`) — inventory by domain

Files under `lib/actions/`, `lib\actions/`, and `src/lib/actions/` (representative list from repository scan):

- **FI / foundation:** `fi-actions.ts` (includes `backfillFoundationFromProcessedEventsAction` — replays `dualWriteFoundationFromFiEvent` for processed `fi_events` missing timeline), `fi-foundation-bootstrap-actions.ts`, `fi-first-case-wizard-actions.ts`
- **CRM:** `fi-crm-actions.ts` (lead, stage, tasks, notes, comms, conversion, append activity, etc.)
- **Bookings / calendar:** `fi-booking-actions.ts`, `fi-booking-conflict-preview-actions.ts`, `fi-next-available-booking-slots-actions.ts`, `fi-calendar-quick-create-actions.ts`, `fi-calendar-testing-actions.ts`, `fi-calendar-reminder-testing-actions.ts`, `fi-clinic-booking-setup-autofix-actions.ts`, `fi-clinic-booking-setup-test-actions.ts`
- **Reminders:** `fi-reminder-job-actions.ts`, `fi-reminder-template-actions.ts`
- **Consultation / forms:** `fi-consultation-actions.ts`, `fi-consultation-form-actions.ts`
- **Clinical:** `fi-clinical-voice-note-actions.ts`, `fi-prescribing-actions.ts`, `fi-pharmacy-transmission-actions.ts`, `fi-imaging-actions.ts`, `fi-case-actions.ts`, `fi-case-procedure-day-actions.ts`, `fi-case-surgery-planning-actions.ts`, `fi-case-post-op-actions.ts`, `fi-medication-reorder-actions.ts`
- **Patients / tenant / staff / payroll / HR:** `fi-patient-actions.ts`, `fi-tenant-admin-actions.ts`, `fi-staff-actions.ts`, `fi-staff-pin-actions.ts`, `fi-rooms-actions.ts`, `fi-services-actions.ts`, `fi-clinic-setup-wizard-actions.ts`, `fi-os-auth-actions.ts`, `fi-configuration-actions.ts`, `fi-tax-localisation-actions.ts`, `fi-payment-record-actions.ts`, `reception-board-flow-action.ts`, `fi-quick-call-in-actions.ts`, plus `src/lib/actions/fi-hr-staff-import-actions.ts`, `fi-hr-staff-sync-actions.ts`, `fi-hr-sync-health-actions.ts`, `fi-evolved-payroll-staff-import-actions.ts`, `fi-staff-fi-user-link-actions.ts`, `fi-staff-import-actions.ts`, `fi-staff-role-review-actions.ts`, `push-current-hr-staff-to-fi-actions.ts`

These actions **mutate state** but are not a parallel “event bus”; they are user- or admin-initiated entry points that may call the libraries above (which then append CRM activity, timeline rows, bookings, reminders, etc.).

---

## 9. Database triggers vs application “triggers”

PostgreSQL `CREATE TRIGGER` occurrences in migrations reviewed for this audit are predominantly **`updated_at` maintenance** on operational tables (e.g. pathology, consultations, external entity mappings). **No migration-defined trigger was found that emits `fi_events` or writes `fi_timeline_events`.** Workflow coupling is **application-level** (TypeScript handlers and mutators).

---

## 10. Cursor / IDE automation hooks

No `hooks.json` (or equivalent Cursor hook config) was found **inside this repository**. Any local Cursor hooks would live outside the repo and are not auditable here.

---

## 11. Integration matrix (requested dimensions)

### 11.1 Timeline integration

| Source | Writes `fi_timeline_events`? | How surfaced |
|--------|------------------------------|--------------|
| Producer FI ingest dual-write | Yes (§2.1) | Case timeline loaders, `UniversalCaseRecord`, Patient Twin, OS dashboards |
| CRM stage change | Yes (`crm.lead.stage_changed`) | Same + CRM activity link |
| Consultation form completion | Yes (`consultation.completed`) | Same |
| CRM activity alone | No (separate table) | Merged in unified timelines where loaders join CRM + foundation |

### 11.2 Task creation integration

**CRM tasks** (`src/lib/crm/tasks.ts`): creating/updating/completing/reopening tasks writes **`fi_crm_tasks`** (and related tables) and **`appendCrmActivityEvent`** with `task.*` kinds. **No automatic FI producer event or `fi_timeline_events` row** is created solely from task mutations unless other code paths also run.

### 11.3 Booking integration

**Core:** `src/lib/bookings/bookings.ts` — persists bookings, calls **`syncBookingReminderJobs`**, **`appendCrmActivityEvent`** for lifecycle kinds when lead context exists.

**Timely:** Webhook → `createBooking` → same booking pipeline (reminders; CRM activity if applicable).

**UI / actions:** `lib/actions/fi-booking-actions.ts` (e.g. instructions → `appointment.instructions_sent`).

### 11.4 Email integration

| Path | Mechanism |
|------|-----------|
| Reminders | Resend HTTP API (`src/lib/reminders/reminderDelivery.server.ts`) when live delivery enabled |
| Pathology send-to-patient | Resend (`src/lib/pathology/pathologySendToPatient.server.ts`, route under `app/api/tenants/.../send-to-patient`) |
| Pharmacy transmission | Resend (`lib/actions/fi-pharmacy-transmission-actions.ts`) |
| Calendar reminder testing | Admin actions (`lib/actions/fi-calendar-reminder-testing-actions.ts`) |

Shared config: `src/lib/reminders/reminderDeliveryConfig.server.ts` / `reminderDeliveryConfig.ts` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, etc.).

### 11.5 Notification integration

- **Patient reminders:** SMS/email via reminder processor (§5); CRM contact log + activity when lead-anchored.
- **Staff “HR notification” summaries:** Computed in-app for staff directory / HR sync health (`src/lib/staff/staffHrNotificationSummary.ts`, loaders) — **not** push notifications or a separate `fi_notifications` event bus in the scanned paths.
- **No Inngest / Trigger.dev** (or similar) usage detected in `.ts` / `.tsx` sources.

---

## 12. Missing automation opportunities (gaps and inconsistencies)

1. **`clinic.ai.usage` is validated but never handled** — Either remove from the allow-list, or implement ingest, storage, and downstream analytics; today it only produces a 400-level “unsupported” response after validation in the dispatcher.
2. **Design vs code drift** — `docs/design/03-event-ingestion-design.md` and `src/lib/fi/vocabulary.ts` describe event types (e.g. `hli.blood_request.generated`) that **do not exist** in `lib/fi/events/schema.ts` / `ingestFiEvent`. Producers following docs-only risk 400 errors.
3. **Pipeline trigger gap on intake / HairAudit case** — `hli.intake.submitted` and `hairaudit.case.submitted` may auto-submit but **never call `maybeTriggerPipelineFromEvent`** in-handler. If the product expectation is “submit then score,” that only happens when a **document or image** ingest arrives afterward (or another code path calls the trigger).
4. **No unified outbound webhook for FI lifecycle** — Ingest and pipeline completion do not show a first-class “FI → customer webhook” implementation in the audited paths (design mentions optional callbacks; not mirrored as a single module here).
5. **CRM append activity is unconstrained** — Public/admin APIs allow arbitrary `activityKind` strings; good for flexibility, weaker for cross-tenant analytics unless you add conventions or enums.
6. **Timely → booking without lead** — Default `leadId: null` means **no CRM activity** from booking helpers that require a lead; reminders still anchor on booking/patient. If CRM parity is required for Timely traffic, explicit lead linking automation is missing.
7. **No DB-level event outbox** — Everything is synchronous application code; retries depend on producer replay and idempotent `fi_events` keys, not a transactional outbox pattern.
8. **Reminder jobs vs timeline** — Successful sends log CRM communications but **do not create `fi_timeline_events`** unless users treat communications as sufficient clinical timeline (product decision).

---

## 13. Primary source files (for maintainers)

- Ingest: `lib/fi/events/ingest.ts`, `lib/fi/events/schema.ts`, `app/api/fi/events/route.ts`
- Handlers: `lib/fi/events/handlers/*.ts`
- Triggers: `lib/fi/events/trigger.ts`
- Foundation dual-write / timeline: `src/lib/fi/foundation/dualWriteEvent.ts`, `createTimelineEvent.ts`, `eventMapping.ts`
- CRM activity: `src/lib/crm/activity.ts`, `src/lib/crm/*.ts` (callers in §4)
- Reminders: `src/lib/reminders/reminderConstants.ts`, `reminderEnqueue.server.ts`, `reminderProcessor.server.ts`, `app/api/cron/fi-reminder-jobs/route.ts`
- Bookings: `src/lib/bookings/bookings.ts`
- Timely: `src/lib/integrations/timely/*.server.ts`, `app/api/tenants/[tenantId]/integrations/timely/*/route.ts`

---

*End of audit.*
