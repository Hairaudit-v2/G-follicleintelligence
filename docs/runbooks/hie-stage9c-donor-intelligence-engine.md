# HIE Stage 9C — Donor Intelligence Engine

## Purpose

Stage 9C adds a **shared Donor Intelligence Engine** that estimates donor-zone photographic quality, qualitative density, risk signals, and **banded** (non-exact) donor capacity hints from clinical donor images plus optional hair-loss classification context.

Consumers:

- **FI OS** (Patient Twin and imaging workflows)
- **HairAudit** (audit donor photography)
- **Hair Longevity Institute** (diagnostic intake / progress donor review)

This stage is **clinical decision-support** only. It is **not** a definitive medical measurement, **not** surgery planning AI, and **not** outcome prediction.

## Clinical caution

- Output uses **bands only** (for example `4000_6000` for safe donor capacity). **Do not** treat bands as exact graft counts or density measurements.
- Assessments are **image-based**. Lighting, focus, wet hair, angle, and digital compression can materially change appearance versus in-person trichoscopy or calibrated photography.
- **Clinician review** is required before operational or surgical use. `review_status` tracks pending / accepted / corrected / rejected workflows.

## Schema

Table: `public.hair_intelligence_donor_assessments`

Key columns:

| Column | Role |
| --- | --- |
| `source_system` | `fi_os`, `hairaudit`, or `hair_longevity` |
| `source_record_id` | Optional upstream record id (e.g. FI patient image id) |
| `tenant_id`, `patient_id`, `case_id` | Optional FI foundation linkage |
| `image_classification_id` | Optional FK to `hli_image_classifications` |
| `hair_loss_classification_id` | Optional FK to `hair_intelligence_hair_loss_classifications` |
| `donor_region`, `donor_quality_rating`, `confidence_score` | Core assessment |
| `estimated_density_band`, `*_risk`, `safe_donor_capacity_band`, `lifetime_graft_budget_band`, `extraction_caution_level` | Banded / risk fields |
| `clinical_observations`, `ai_notes` | Text (bounded length in DB) |
| `review_status`, `reviewed_by_user_id`, `reviewed_at` | Human review |
| `assessor_version` | Model / fallback provenance |

RLS follows the shared HIE pattern: **service role** inserts/updates; **authenticated** tenant members may **SELECT** rows where `tenant_id` matches their `fi_users` membership. No broad anonymous access.

## Supported donor regions

`occipital`, `left_parietal`, `right_parietal`, `nape`, `beard`, `body`, `mixed`, `unknown`

## Output bands and enums

- **Donor quality:** `excellent`, `good`, `moderate`, `poor`, `unsafe`, `unknown`
- **Density band:** `very_low` … `very_high`, `unknown`
- **Risks (miniaturisation / retrograde / overharvesting):** `low`, `moderate`, `high`, `unknown`
- **Safe donor capacity band:** `under_1500`, `1500_2500`, `2500_4000`, `4000_6000`, `over_6000`, `unknown`
- **Lifetime graft budget band:** `under_3000`, `3000_5000`, `5000_7000`, `over_7000`, `unknown`
- **Extraction caution:** `low`, `moderate`, `high`, `avoid`, `unknown`

## FI OS use

- Server actions: `src/lib/actions/fi-donor-intelligence-actions.ts`
  - `assessPatientDonorImageAction(tenantId, patientId, patientImageId)`
  - `updateDonorAssessmentReviewAction(tenantId, patientId, assessmentId, body)`
- Adapter: `src/lib/hair-intelligence/donorIntelligence/adapters/fiOsDonorAssessment.server.ts`
  - Resolves a **short-lived signed URL** from `fi_patient_images`
  - Links latest **donor** `hli_image_classifications` row for that image when present
  - Links latest **hair loss classification** for the patient when present
  - Calls the shared `assessDonor` pipeline and persists one ledger row

Patient Twin UI: `PatientDonorIntelligenceCard` on the Twin dashboard (near Hair Loss Classification and progression).

## HairAudit use

- Adapter: `hairAuditDonorAssessment.server.ts`
- Pass a **pre-authorised** signed `image_url_for_model` from the HairAudit storage pipeline; `source_system = hairaudit`.
- No duplicated OpenAI wiring beyond the shared assessor.

## HLI use

- Adapter: `hairLongevityDonorAssessment.server.ts`
- `source_system = hair_longevity` for diagnostic intake / progress donor review flows.
- Same shared assessor and persistence layer.

## Fallback behaviour

If `OPENAI_API_KEY` is missing or no image URL can be resolved:

- `donor_region` and `donor_quality_rating` default to `unknown`
- `confidence_score` is `0`
- Risk and band fields default to `unknown` where applicable
- `ai_notes` explains that AI was unavailable or no image was supplied

Model resolution order (env):

1. `OPENAI_DONOR_ASSESSOR_MODEL`
2. `OPENAI_HAIR_LOSS_CLASSIFIER_MODEL`
3. `OPENAI_HAIR_IMAGE_CLASSIFIER_MODEL`
4. `OPENAI_CLINICAL_NOTE_MODEL`
5. `gpt-4o-mini`

## Manual testing

1. Apply migration `20260813120001_hie_stage9c_donor_intelligence.sql` (e.g. `supabase db push` or your standard migration path).
2. Ensure `OPENAI_API_KEY` is set in the environment that runs FI OS server actions (optional for fallback-only tests).
3. Open **Patient Twin** for a tenant patient with at least one gallery image (ideally AI-tagged `donor`).
4. Click **Assess donor image** and confirm a new row appears in `hair_intelligence_donor_assessments` with expected bands.
5. Use **Correct assessment** to set `review_status` to `corrected` / `accepted` and adjust fields; confirm update persists.
6. Optionally verify RLS: as an authenticated tenant user, Twin read path should still return assessments via service-role loader where applicable.

## Future Stage 9D (recommended direction)

**Recipient / midscalp surgical candidacy triage (non-planning)** — structured read of recipient photos + pathology + donor ledger context to flag **review topics** (e.g. shock loss risk discussion, medication interaction prompts, consent documentation gaps). Explicitly **not** automated surgical plans, **not** outcome guarantees, and still **clinician-gated** with the same review-status pattern.
