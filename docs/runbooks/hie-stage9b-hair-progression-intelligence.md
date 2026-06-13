# HIE Stage 9B — Hair Progression Intelligence Engine

## Purpose

Build **longitudinal intelligence** on top of the Stage 9A classification ledger (`hair_intelligence_hair_loss_classifications`): multi-timepoint timelines, progression velocity, stability bands, treatment–progression contrast (MedicationOS), simple Norwood forecasting, cohort signatures, clinician review weighting, and optional **anonymised** population benchmarks.

This stage intentionally **excludes** donor density, surgery planning, and surgical outcomes.

## Architecture

| Layer | Responsibility |
| ----- | ---------------- |
| **Pure engine** | `src/lib/hair-intelligence/hairProgressionIntelligence/` — ordinal mapping, weighted regression velocity, stability labels, therapy before/after slopes, Norwood forecast, cohort signature, review multipliers, cohort velocity summaries. |
| **Patient Twin** | `loadPatientTwinHairProgressionSection` merges classifications (up to 150 points, chronological) + `fi_patient_therapy_events` (up to 400 rows), then attaches `intelligence.hair_progression` on the twin DTO. |
| **Network table** | `hair_intelligence_progression_network_buckets` — **no PHI**; weekly rows keyed by `cohort_signature` + `week_bucket` with `sample_count`, `mean_velocity`, `p25_velocity`, `p75_velocity`. Ingestion is **out of band** (cron / admin pipeline with service role). |

## Database

Migration: `supabase/migrations/20260813120001_hie_stage9b_hair_progression_intelligence.sql`.

- **RLS enabled**, no tenant column — default deny for `authenticated`; **`service_role`** granted DML for ingestion and twin-time reads.
- Twin loader reads the latest bucket row for the patient’s computed `cohort_signature` (second-phase enrich).

## Cohort signature

Stable key: `classification_system|pattern_type|sex|age_band` (see `buildHairProgressionCohortSignature`). Sex prefers the latest non-unknown model tag on the timeline; optional foundation sex can be wired later.

## Treatment linkage

Uses MedicationOS canonical codes: `finasteride`, `dutasteride`, `oral_minoxidil`, `topical_minoxidil`, `prp`, `exosomes`. First exposure inferred from `therapy_started`, `session_completed`, or `plan_activated` events with matching `canonical_code`.

## Confidence & review

Velocity regression weights each point by `confidence_score × hairLossReviewStatusToConfidenceMultiplier(review_status)` (`accepted` / `corrected` up-weight; `rejected` down-weight). `clinician_review_weighting` exposes aggregate multipliers on the twin.

## Forecasting

When the dominant system is **Norwood**, regression slope is positive, and the latest ordinal is below **V**, the engine projects years to reach Norwood **V** using the weighted slope (simple linear extrapolation — not a survival model).

## Patient Twin UI (Stage 9B.1)

The FI Admin **Patient Twin** dashboard renders a read-only **Hair progression intelligence (HIE)** card (`PatientTwinHairProgressionCard`, immediately after the Stage 9A hair loss classification card and before outcome/pathology/imaging blocks) fed by `twin.intelligence.hair_progression` (same DTO as the engine output). It surfaces:

- Dominant classification system, latest grade / ordinal, **Progression velocity** (raw and confidence-weighted grades/year), **Classification stability** (with rationale), first and latest analysed dates, analysed point count, span, and clinician review weighting.
- **Treatment-associated velocity change** — one block per tracked MedicationOS canonical (`finasteride`, `dutasteride`, `oral_minoxidil`, `topical_minoxidil`, `prp`, `exosomes`) with before/after slopes and delta when computable.
- **Forecast** — only when the DTO includes a Norwood linear estimate to grade **V** (`estimated_years_to_target`).
- **Network cohort context** — anonymised bucket match (`hair_intelligence_progression_network_buckets`); safe empty copy when no row matches.

Clinical caution is shown in-card: *AI progression intelligence supports review and does not replace clinical judgement.*

Pure display helpers and unit tests live in `src/lib/hair-intelligence/hairProgressionIntelligence/progressionDisplay.ts` (+ `.test.ts`).

### Manual test steps (FI Admin)

1. Open **Patient Twin** for a patient with **a single** hair-loss classification row: confirm **Insufficient longitudinal data** (insufficient window / points) and that velocity lines show em dashes where the engine returns nulls; stability badge reads **Insufficient longitudinal data** (neutral).
2. Open Twin for a patient with **two or more** Norwood (or other dominant) graded points spanning **≥ ~6 weeks**: confirm **Classification stability** badge and non-empty **Progression velocity** values where the engine produces slopes; dates and analysed point count align with the ledger.
3. Open Twin for a patient with **therapy events** (MedicationOS) for at least one tracked code: confirm **Treatment-associated velocity change** lists all six therapies; exposed therapies show first exposure date; before/after/delta populate when enough pre/post grade points exist; notes explain sparse data when not.
4. Open Twin for a patient whose cohort **does not** match a network bucket (or ingestion empty): **Network cohort context** shows the safe empty state; cohort signature and age band still render from the twin DTO.
5. (Optional) Norwood-positive slope below V: if `forecast` is non-null, confirm **Years to Norwood V** displays `estimated_years_to_target` only — no extra forecasting beyond the DTO.

Developer checks: `npm run typecheck`, `npm run lint`, `npx tsx --test src/lib/hair-intelligence/hairProgressionIntelligence/progressionDisplay.test.ts`.

## Related

- Stage 9A runbook: [`hie-stage9a-hair-loss-classification-engine.md`](./hie-stage9a-hair-loss-classification-engine.md)
- MedicationOS design: [`../design/medication-os-v1.md`](../design/medication-os-v1.md)
