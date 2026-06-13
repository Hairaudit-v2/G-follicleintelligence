# HIE Stage 10 — Surgeon Consultation Checklist Engine

## Purpose

Stage 10 assembles **existing** Hair Intelligence Engine (HIE) signals plus MedicationOS therapy history and pathology workflow **presence** into a **structured surgeon-facing consultation checklist**. Each row is a set of **discussion topics** and review flags for clinician preparation.

This engine **does not**:

- recommend graft counts or surgery plans  
- design hairlines  
- predict outcomes  
- replace clinician judgement  
- issue automated medical recommendations  

The **human clinician** remains the decision-maker.

## Architecture

| Layer | Responsibility |
| --- | --- |
| **Supabase** | `hair_intelligence_consultation_checklists` ledger; RLS: `service_role` insert/update, `authenticated` tenant-member `SELECT`. |
| **Domain** | `src/lib/hair-intelligence/consultationChecklist/*` — prompt, JSON parse, enum clamps, OpenAI text call, fallback, persist, review validation, analytics helpers. |
| **Adapters** | `adapters/*` — thin wrappers setting `source_system` (`fi_os`, `hairaudit`, `hair_longevity`) while reusing `generateConsultationChecklistAndPersist`. |
| **FI OS actions** | `src/lib/actions/fi-consultation-checklist-actions.ts` — tenant write gate, generate + review update, revalidation. |
| **Patient Twin** | `PatientConsultationChecklistCard` embedded after Recipient Candidacy Review. |
| **Consultation workspace** | `ConsultationPreparationChecklistPanel` — read-only latest checklist when a patient is linked. |

## Input sources

The generator (`generateChecklist.server.ts`) loads, **per patient**:

1. **Hair loss classification** — latest `hair_intelligence_hair_loss_classifications` (system, grade, pattern, severity scores, confidence, review status).  
2. **Progression intelligence** — latest DTO from `loadPatientTwinHairProgressionSection` (stability label, weighted / raw velocity, rapid / diffuse-unstable booleans derived from stability label, analysis basis).  
3. **Donor intelligence** — latest `hair_intelligence_donor_assessments` (quality, capacity band, miniaturisation / retrograde risk, extraction caution, confidence).  
4. **Recipient intelligence** — latest `hair_intelligence_recipient_candidacy_reviews` (diffuse/shock risks, medication stabilisation flag, pathology review flag, surgical timing / expectation risks, review topics, summary).  
5. **Therapy history** — `fi_patient_therapy_events` (+ active plan summary) for modalities (finasteride, dutasteride, oral/topical minoxidil, PRP, exosomes), active-plan coverage, and stabilisation-related stop/hold/cancel/adverse signals.  
6. **Pathology presence** — boolean flags only: `pathology_ordered` (any `fi_pathology_requests` row), `pathology_completed` (any `fi_pathology_results` row). **No interpretation** of results.

Foreign keys on the checklist row link to the **latest** classification, donor assessment, and recipient review IDs used for that run.

## Checklist generation logic

1. Build a single JSON context object (see `checklistPrompt.ts` for the contract).  
2. If `OPENAI_API_KEY` is missing or the HTTP call fails, use **`generateChecklistFallback`** (`priority_level: low`, empty items, `confidence_score: 0`, explanatory `ai_notes`).  
3. On success, **`modelChecklistJsonParse`** validates and clamps enums / string lengths.  
4. **Persist** via `insertHairIntelligenceConsultationChecklistRow` with `checklist_status = 'generated'`, `review_status = 'pending'`.  
5. **`generator_version`** records engine version and model id (or fallback reason).

Model env override: `OPENAI_CONSULTATION_CHECKLIST_MODEL` (optional); otherwise falls back to `OPENAI_CLINICAL_NOTE_MODEL`, then other shared HIE model envs, then `gpt-4o-mini`.

## FI OS integration

- **Actions**: `generatePatientConsultationChecklistAction`, `updateConsultationChecklistReviewAction` in `fi-consultation-checklist-actions.ts`.  
- **Write gate**: `assertCrmTenantWriteAllowed` (same pattern as Stage 9D).  
- **Revalidation**: Patient Twin + patient profile paths; optional `consultationId` in the generate body revalidates `/fi-admin/{tenant}/consultations/{id}`.  
- **Adapter**: `generateFiOsPatientConsultationChecklistAndPersist`.

## HairAudit integration

Use `generateHairAuditConsultationChecklistAndPersist` when HairAudit has tenant/patient context. **No duplicate prompts** — shared generator only.

## HLI (Hair Longevity) integration

Use `generateHairLongevityConsultationChecklistAndPersist` for `hair_longevity` source rows. Same shared generator and prompt.

## Fallback behaviour

| Condition | Behaviour |
| --- | --- |
| No OpenAI key | Persist row with low priority, empty checklist, confidence 0, `ai_notes` explains missing key. |
| OpenAI error / non-JSON | Same pattern with “unreachable / failed” messaging. |
| Missing tenant or patient id | Fallback row with `no_patient_context` note. |

## Manual testing

1. Apply migration `20260815120001_hie_stage10_consultation_checklist_engine.sql`.  
2. Ensure `OPENAI_API_KEY` (and optionally `OPENAI_CONSULTATION_CHECKLIST_MODEL`) in the environment used by the Next server.  
3. Open **Patient Twin** for a patient with Stage 9A–9D data and therapy events where possible.  
4. Click **Generate consultation checklist**; confirm UI shows priority, items, flags, and booleans.  
5. In Supabase (or SQL), confirm a new row in `hair_intelligence_consultation_checklists` with FKs populated when upstream rows exist.  
6. Use **Correct checklist** → **Save checklist review**; confirm `review_status`, `reviewed_at`, and edited arrays persist.  
7. Open a **consultation** with the same patient linked; confirm **Pre-consultation checklist (HIE)** panel shows the latest snapshot or directs to Twin if none.

## Future Stage 11 dependency

Stage 11 can treat this table as the **canonical pre-consultation artifact** for:

- auto-attaching checklist excerpts to consultation exports / PDFs  
- cross-tenant analytics on discussion preparedness (using `checklistAnalytics.ts`)  
- workflow automation that **still** only surfaces topics to clinicians (no autonomous medical decisions)

**Suggested Stage 11 prompt direction:** “Given an accepted consultation checklist row + completed consultation structured sections, produce a **clinician-editable** encounter recap bullet list and documentation reminders — still **no** graft counts, surgical plans, or outcome predictions.”
