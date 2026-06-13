# HIE Stage 9D — Recipient & surgical candidacy review intelligence

## Purpose

Stage 9D surfaces **structured clinician review topics** and **candidacy concern signals** from:

- Recipient-area photographs (vision model)
- Latest **hair loss classification** (Stage 9A)
- **Hair progression intelligence** (Stage 9B): stability label, velocity context
- Latest **donor assessment** (Stage 9C): quality, miniaturisation / retrograde risk, capacity band (as context only)
- **Therapy history** (`fi_patient_therapy_events` + active plan items): finasteride, dutasteride, minoxidil, PRP, exosomes (heuristic string match on canonical codes and event types)
- **Pathology presence** only: whether pathology request/result rows exist for the patient (no interpretation of results)

Persisted rows: `public.hair_intelligence_recipient_candidacy_reviews`.

## Clinical caution

This engine **does not**:

- Create surgical plans or recommend graft numbers  
- Recommend hairline design or predict outcomes  
- Replace surgeon judgement or provide definitive medical advice  
- Interpret pathology results (only “records exist” as a workflow signal)

Human clinicians remain the decision makers. Outputs are **discussion prompts** (`review_topics`) and **review signals** for charting and QA.

## Schema

See migration `supabase/migrations/20260814120001_hie_stage9d_recipient_candidacy_review.sql`.

Key columns:

| Column | Role |
|--------|------|
| `recipient_quality_rating` | Overall recipient-area photographic / contextual triage band |
| `diffuse_thinning_risk`, `shock_loss_risk`, `density_expectation_risk` | Risk bands for discussion |
| `medication_stabilisation_needed`, `pathology_review_recommended` | Boolean workflow signals |
| `surgical_timing_risk` | Includes `delay_recommended` as a **review** band, not an automated decision |
| `review_topics` | JSON array of short clinician-facing strings |
| `progression_velocity` | Numeric snapshot from Stage 9B DTO (weighted or raw grades/year when available) |

RLS: same pattern as Stage 9C donor table — `authenticated` **SELECT** when tenant member; `service_role` **INSERT/UPDATE**.

## Inputs used

| Input | Source |
|-------|--------|
| Recipient image | `fi_patient_images` (signed URL) or caller-provided model URL (HairAudit / HLI adapters) |
| HLI classification link | Latest `hli_image_classifications` for the image with `image_category` in `front`, `crown`, `top`, `left_profile`, `right_profile` |
| Hair loss | Latest `hair_intelligence_hair_loss_classifications` for tenant + patient |
| Donor | Latest `hair_intelligence_donor_assessments` id (context only) |
| Progression | `loadPatientTwinHairProgressionSection` (same DTO as Patient Twin Stage 9B) |
| Therapy | `fi_patient_therapy_events` + active plan summary from MedicationOS loaders |
| Pathology | Count presence on `fi_pathology_requests` / `fi_pathology_results` |

Default image selection (FI OS, no `patient_image_id`): latest HLI row for patient in recipient categories; else first active `fi_patient_images` with `ai_image_category` in `front` → `crown` → `top`.

## Review topics generation

The model returns `review_topics` as a JSON string array. Parsing and length limits are enforced in `modelRecipientAssessmentJsonParse.ts` (max topics / string length).

## FI OS integration

- **Server actions**: `src/lib/actions/fi-recipient-intelligence-actions.ts`  
  - `assessPatientRecipientCandidacyAction(tenantId, patientId, patientImageId)`  
  - `updateRecipientAssessmentReviewAction(tenantId, patientId, reviewId, body)`  
- **Adapter**: `assessFiOsPatientRecipientAndPersist` in `adapters/fiOsRecipientAssessment.server.ts`  
- **UI**: `PatientRecipientCandidacyCard` on Patient Twin (below Hair Loss, Progression, Donor).

Actions enforce tenant write via `assertCrmTenantWriteAllowed` and revalidate Patient Twin + imaging paths.

## HairAudit integration

`assessHairAuditRecipientAndPersist` — pass `image_url_for_model` plus optional tenant/patient/case for context loading. When tenant + patient are omitted, vision still runs with minimal `{}` context.

## HLI integration

`assessHairLongevityRecipientAndPersist` — same contract as HairAudit adapter.

## Fallback behavior

If there is **no image URL** or **no `OPENAI_API_KEY`**: persist a row with `recipient_quality_rating = unknown`, `confidence_score = 0`, `review_topics = []`, and explanatory `ai_notes` (assessor version suffix `fallback=no_image` or `fallback=no_api_key`).

## Manual testing

1. Apply migration (`supabase db push` or project workflow).  
2. Open **Patient Twin** for a patient with active images and (ideally) hair loss + progression + donor + therapy data.  
3. Under **Recipient & surgical candidacy review**, choose a recipient-area image → **Assess surgical candidacy**.  
4. Confirm card shows ratings, risks, topics, summary; confirm row in `hair_intelligence_recipient_candidacy_reviews`.  
5. Use **Correct assessment** → **Save assessment review** and confirm `review_status` / edits persisted.

## Future Stage 10 dependency

Stage 10 can consume `review_topics`, `recipient_quality_rating`, and `review_status` as **pre-surgical checklist** inputs for human-led planning workflows. Recommended Stage 10 prompt direction:

> “Given an accepted recipient candidacy review row and the same structured context, produce a **surgeon-authored checklist** of items to confirm in consultation (no numbers, no design, no outcome claims).”

Keep Stage 10 strictly **non-prescriptive** and **human-confirmed** before any planning artifacts.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Required for vision JSON assessor |
| `OPENAI_RECIPIENT_ASSESSOR_MODEL` | Optional override (defaults chain through donor / classifier models then `gpt-4o-mini`) |
