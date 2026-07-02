# DoctorOS Stage 1C — Voice-to-note foundation

## Purpose

Allow clinicians to **record or upload consultation audio**, run **speech-to-text**, then use an **LLM** to split the transcript into fixed **structured clinical sections**. Outputs are persisted for review; nothing is treated as the official record until **explicit approval**.

## Storage

| Table | Role |
| --- | --- |
| `fi_clinical_notes` | Canonical row: `transcript_raw` (ASR) vs `sections` (JSON object). `record_status`: `ai_draft` → `approved` (or `archived`). Optional `case_id` / `consultation_id`. |
| `fi_patient_timeline_events` | Milestone row per voice session (`event_kind = clinical_voice_note`); title/detail updated on approval. |

RLS: tenant-member **SELECT** only; **writes** via `service_role` (Next.js API route + server actions), matching `fi_consultations`.

## UI

- **Patient profile**: Actions bar — **Voice note**; Clinical tab — list card for recent voice notes.
- **Case detail**: **Voice note** when `foundation_patient_id` is present (note is scoped to patient + optional case).

## Configuration

- `OPENAI_API_KEY` — required for transcription + structuring.
- `OPENAI_CLINICAL_NOTE_MODEL` — optional (default `gpt-4o-mini`).

## API

`POST /api/tenants/{tenantId}/patients/{patientId}/voice-notes/process` — `multipart/form-data` with field `audio` (File), optional `caseId`. Same CRM write gate as other tenant patient APIs.

## Safety

- New notes are always **`ai_draft`** until **Approve official record** (`approveClinicalVoiceNoteAction`).
- **Transcript** remains in `transcript_raw`; structured output in `sections` — both visible in the review modal; transcript is labelled as separate from the approved record narrative.

## Deferred

- Merge `fi_patient_timeline_events` into the Stage 4D read-only treatment timeline card (currently separate write model).
- Audio retention in Supabase Storage (`audio_storage_*` columns reserved).
- Editing structured sections before approve; versioning; specialty-specific prompts.
