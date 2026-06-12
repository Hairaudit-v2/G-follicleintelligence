# HIE Stage 9A — Hair Loss Classification Engine

## Purpose

Teach Project Helix to **recognise hair loss patterns** from clinical scalp photographs using a **shared** Hair Intelligence Engine (HIE) module. Results are stored in a **multi-product ledger** (`hair_intelligence_hair_loss_classifications`) for FI OS, HairAudit, and Hair Longevity — **not** in `fi_patient_images`.

This stage does **not** include donor density, surgery planning, outcome prediction, medication recommendations, or global dashboards.

**Longitudinal progression (Stage 9B)** lives in [`hie-stage9b-hair-progression-intelligence.md`](./hie-stage9b-hair-progression-intelligence.md).

## Architecture

- **Database**: shared table + RLS (tenant member `SELECT`; `INSERT`/`UPDATE` via **service role** only).
- **Domain**: `src/lib/hair-intelligence/hairLossClassification/` — prompt, OpenAI vision call, JSON parse, enum normalisation, persist, analytics helper.
- **Adapters** (thin): FI OS (`fiOsHairLossClassification.server.ts`), HairAudit, HLI — map platform context and call `classifyAndPersistHairLossClassification`; **no duplicated prompt logic**.
- **FI OS UI**: server actions + Patient Twin card (`PatientHairLossClassificationCard.tsx`).

## Database schema

Table: `public.hair_intelligence_hair_loss_classifications`

Key columns: `source_system`, `source_record_id`, optional `tenant_id` / `patient_id` / `case_id`, optional FK `image_classification_id` → `hli_image_classifications(id)`, `classification_system`, `pattern_type`, `classification_grade`, `confidence_score`, regional severity scores (0–10), boolean flags, `sex_classification`, optional `age_estimate_range`, `ai_notes`, review fields, `classifier_version`, timestamps.

RLS mirrors `hli_image_classifications`: authenticated **SELECT** when `tenant_id` matches `fi_users` membership; writes via **service role** from server actions.

Migration file: `supabase/migrations/20260812120001_hie_stage9a_hair_loss_classification.sql`.

## Classification systems supported

| System   | Grades (normalised)                                      |
| -------- | -------------------------------------------------------- |
| Norwood  | I, II, III, III Vertex, IV, V, VI, VII, unknown          |
| Ludwig   | I, II, III, unknown                                      |
| Sinclair | I, II, III, IV, V, unknown                               |
| Olsen    | mild, moderate, severe, unknown                          |
| custom   | short free-text (≤32 chars) or unknown                   |

Pattern types and review statuses are constrained in SQL and mirrored in TypeScript (`types.ts`, `enumValidation.ts`).

## AI prompt structure

- File: `classificationPrompt.ts` — single shared user prompt (vision).
- Implementation: `openAiHairLossClassifier.server.ts` — `gpt-4o-mini` by default; override with `OPENAI_HAIR_LOSS_CLASSIFIER_MODEL`, else `OPENAI_HAIR_IMAGE_CLASSIFIER_MODEL`, else `OPENAI_CLINICAL_NOTE_MODEL`.
- Model output is **strict JSON**; parsing and coercion live in `modelHairLossJsonParse.ts`.

## Fallback behaviour

If `OPENAI_API_KEY` is missing, the classifier returns a safe result: `pattern_type` **unknown**, `confidence_score` **0**, `classification_system` **custom**, `classification_grade` **unknown**, and notes explaining that the classifier is unavailable. **No** durable public bucket URLs are used — only short-lived signed URLs passed into the vision call.

## FI OS integration

- Server actions: `src/lib/actions/fi-hair-loss-classification-actions.ts`  
  - `classifyPatientHairLossAction`  
  - `updateHairLossClassificationReviewAction`
- Adapter: `adapters/fiOsHairLossClassification.server.ts` loads `fi_patient_images`, signs URL, optionally links latest `hli_image_classifications` row for the same image id, persists hair loss row.

## HairAudit integration

- Adapter: `adapters/hairAuditHairLossClassification.server.ts` — accepts a pre-signed `imageUrlForModel` and metadata; persists with `source_system = hairaudit`. Future work: baseline vs follow-up comparison on audit cases.

## HLI integration

- Adapter: `adapters/hairLongevityHairLossClassification.server.ts` — same pattern with `source_system = hair_longevity` for intake/progress images when a signed URL is available.

## Future Stage 9B dependency

**Suggested Stage 9B**: longitudinal **progression** and **delta analytics** (same patient, multiple `hair_intelligence_hair_loss_classifications` rows over time) — trend of severity scores, grade stability, and linkage to `hli_image_classifications` / photo protocol completeness. Optional: cohort-level rollups using `classificationAnalytics.ts` as a building block for the Global Hair Intelligence Network.

## Environment variables

| Variable                             | Required | Description                                      |
| ------------------------------------ | -------- | ------------------------------------------------ |
| `OPENAI_API_KEY`                     | For AI   | Enables vision classification                    |
| `OPENAI_HAIR_LOSS_CLASSIFIER_MODEL`  | No       | Overrides default OpenAI model for this engine   |

Supabase service role (existing app pattern) is used for storage signing and ledger writes.

## Manual test checklist

1. Apply migration (`supabase db push` / migration up as per your workflow).
2. Open **Patient Twin** for a patient with active scalp images in the gallery.
3. Click **Analyze hair loss** — confirm Norwood/Ludwig/etc., confidence, and severity scores appear.
4. Use **Save classification review** after edits — confirm row updates in `hair_intelligence_hair_loss_classifications`.
