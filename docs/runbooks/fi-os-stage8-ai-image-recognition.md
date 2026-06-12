# FI OS Stage 8A — AI image recognition & dynamic patient gallery

## Purpose

Stage 8A adds **Hair Image Intelligence (HLI)**: shared, multi-product classification of clinical hair-restoration photography, with **FI OS** persisting the current classification on `fi_patient_images` for Patient Twin, reports, and timelines. This stage is **classification and gallery foundation only** — no donor density, Norwood/Ludwig auto-grading, or custom model training.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Optional for FI | When unset, classification returns a safe **unknown** result with confidence `0` and an explanatory note (no outbound vision call). |
| `OPENAI_HAIR_IMAGE_CLASSIFIER_MODEL` | Optional | Vision-capable chat model (default: `OPENAI_CLINICAL_NOTE_MODEL` or `gpt-4o-mini`). |

## Database

### `fi_patient_images` (denormalised current state)

| Column | Notes |
|--------|--------|
| `ai_image_category` | Check constraint: `front`, `left_profile`, `right_profile`, `top`, `crown`, `donor`, `graft_tray`, `immediate_post_op`, `follow_up`, `microscopic`, `unknown` |
| `ai_image_category_confidence` | `0`–`1` |
| `ai_hair_state` | `wet`, `dry`, `unknown` |
| `ai_shave_state` | `shaved`, `non_shaved`, `partially_shaved`, `unknown` |
| `ai_surgery_stage` | `pre_op`, `intra_op`, `immediate_post_op`, `follow_up`, `unknown` |
| `ai_image_ai_notes` | Short model / staff notes |
| `ai_image_review_status` | `pending` (default), `accepted`, `corrected`, `rejected` |
| `ai_image_reviewed_by_staff_id` | `fi_staff.id` when resolved |
| `ai_image_reviewed_at` | Timestamptz |
| `ai_image_classified_at` | Timestamptz |
| `ai_image_classifier_version` | Version string (includes model slug when OpenAI used) |

Indexes: `(tenant_id, patient_id, ai_image_category)`, `(tenant_id, patient_id, ai_surgery_stage)`, `(tenant_id, ai_image_review_status)`, `(tenant_id, ai_image_classified_at desc)`.

### `hli_image_classifications` (shared ledger)

Append-only classification rows for **`fi_os`**, **`hairaudit`**, **`hair_longevity`**: `source_system`, `source_record_id`, optional `tenant_id` / `patient_id` / `case_id`, `image_url_or_storage_path` (internal storage ref such as `bucket:path` — **never** expose in public APIs), enums for category / hair / shave / surgery / `clinical_use_context`, `confidence`, `classifier_version`, review fields, `notes`, `created_at`.

RLS: tenant members **SELECT** when `tenant_id` matches their `fi_users` membership; writes use **service role** from server actions / adapters.

## AI fallback behaviour

If `OPENAI_API_KEY` is missing, the shared classifier returns:

- `category` / states / `surgery_stage`: **`unknown`**
- `category_confidence`: **`0`**
- `notes`: explains that AI is not configured

FI OS still records the run on `fi_patient_images` and inserts a ledger row on automated classification (when wired through the FI adapter).

## Safety & privacy

- **Private bucket**: imaging continues to use signed URLs generated with the Supabase **service role**; storage paths and bucket names must not be logged or returned to browsers except as short-lived signed URLs for authorised staff.
- **Clinical scope**: prompts constrain outputs to hair-restoration photography triage; this is **not** a diagnostic endpoint.
- **PII**: model notes are stored in `ai_image_ai_notes` / `hli_image_classifications.notes` — treat as clinical-adjacent text under your data-retention policy.

## Gallery grouping rules (`patientJourneyGallery.ts`)

- **`mostRecent`**: newest captures by `taken_at` (fallback `created_at`), capped for a hero strip.
- **Timed windows** (when `procedure_date_ymd` exists on the linked case): **immediate post-op** ≈ day 0–21 after procedure; **sixMonth** ≈ days 120–240; **twelveMonth** ≈ days 240–450; **pre-op** = captures before procedure day.
- **Anatomy / angle**: `microscopic`, `donor` / `graft_tray`, `crown`, `front` / `left_profile` / `right_profile` / `top` → hairline/front bucket.
- **`unknownNeedsReview`**: unknown category, very low confidence, or `rejected` review status.
- **Twin UI**: sections merge timed follow-up buckets into a single **Follow-up** rail.

## Code layout (shared service)

- `src/lib/hair-intelligence/imageClassification/` — prompts, OpenAI vision call, enum validation, ledger persistence.
- Adapters: `adapters/fiOsPatientImageClassification.server.ts`, `adapters/hairAuditImageClassification.server.ts`, `adapters/hairLongevityImageClassification.server.ts`.
- FI types re-export: `src/lib/imaging/aiImageClassificationTypes.ts`.
- Server actions: `src/lib/actions/fi-image-ai-actions.ts`.

## Next stage — Smart Clinical Photography Protocol (Stage 8B)

Use this prompt with Cursor when you are ready for **Stage 8B**:

> **Stage 8B — Smart Clinical Photography Protocol for FI OS.** Build on Stage 8A HLI classification: define per-tenant/clinic **capture protocols** (angles, lighting, distance, shave state, wet vs dry rules) that **gate** uploads and scheduling; integrate with ImagingOS protocol sessions and `fi_patient_images` metadata; staff UX with live compliance hints; server validation + runbook updates. Reuse `src/lib/hair-intelligence/imageClassification/` for any new AI hints without duplicating vision prompts. Do not implement density or Norwood automation.

## Manual test checklist

1. Apply migration `20260729120001_fi_os_stage8a_hli_ai_image_classification.sql` (`supabase db reset` or `migration up`).
2. Open **Patient Twin** for a patient with active `fi_patient_images`.
3. Confirm **gallery sections** render; **Most recent** thumbnails appear.
4. Click **Analyse image** with `OPENAI_API_KEY` unset — row should show **unknown** fields and note about missing AI.
5. Set `OPENAI_API_KEY`, repeat — categories should populate (realistic clinical photo recommended).
6. Use **Correct category** + **Save review** — verify `ai_image_review_status` and staff linkage update in Supabase and Twin revalidates.
