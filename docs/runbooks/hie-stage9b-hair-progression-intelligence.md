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

## Related

- Stage 9A runbook: [`hie-stage9a-hair-loss-classification-engine.md`](./hie-stage9a-hair-loss-classification-engine.md)
- MedicationOS design: [`../design/medication-os-v1.md`](../design/medication-os-v1.md)
