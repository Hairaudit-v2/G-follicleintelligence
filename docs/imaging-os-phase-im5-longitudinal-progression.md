# ImagingOS Phase IM-5 — Longitudinal Progression Engine

## What IM-5 Adds

Phase IM-5 introduces a **longitudinal progression readiness engine** under `src/lib/imaging-os/progression.ts`. It answers:

> “Do we have enough clinically usable images across time to assess progression or outcome?”

The engine evaluates case-level image sets using only:

- Canonical image categories (IM-1)
- Normalized intake metadata (IM-2)
- Protocol context (IM-3)
- Clinical usability from quality evaluation (IM-4)

No AI, pixel comparison, image fetching, schema migrations, or UI changes are involved.

## Why Progression Readiness Matters

Clinical outcome intelligence — HairAudit scoring, HLI longitudinal review, surgical growth tracking, and future Digital Twin progression — all depend on **time-aligned, category-complete, quality-gated** image sets. IM-5 provides the structural layer that determines whether a case is ready for those downstream systems before any visual comparison or model inference runs.

## Timepoint Model

`ImagingOsTimepoint` defines canonical clinical milestones:

| Timepoint | Typical use |
|-----------|-------------|
| `baseline` | Initial intake / before treatment |
| `pre_op` | Surgical planning |
| `immediate_post_op` | Day-of surgery documentation |
| `day_14` | Early post-op follow-up |
| `month_3` … `month_24` | Standard follow-up intervals |
| `annual_review` | Yearly review outside strict month windows |
| `unknown` | Missing or unrecognized label |

`normalizeImagingOsTimepoint()` maps external aliases (e.g. `before`, `m12`, `pre-op`, `two_week`) to canonical values deterministically.

## Assessment Types

`IMAGING_PROGRESSION_REQUIREMENTS` defines six assessment workflows:

| Assessment | Required timepoints | Required categories | Min usable / timepoint |
|------------|--------------------|--------------------|------------------------|
| `hair_loss_monitoring` | baseline, month_6, month_12 | front, top, crown | 2 |
| `medical_treatment_response` | baseline, month_3, month_6 | front, top, crown | 2 |
| `surgery_growth_tracking` | pre_op, immediate_post_op, month_6, month_12 | front, top, crown, donor, recipient | 3 |
| `donor_recovery_tracking` | pre_op, immediate_post_op, day_14, month_6, month_12 | donor | 1 |
| `hairaudit_outcome_12month` | baseline, month_12 | front, top, crown, donor | 3 |
| `hli_longitudinal_review` | baseline, month_6, month_12 | front, top, crown | 2 |

Each registry entry also lists optional categories for future enrichment (not scored in IM-5 readiness).

## Readiness Scoring

`evaluateLongitudinalProgressionReadiness()` returns:

- **`readiness_status`**: `ready`, `partial`, `not_ready`, or `invalid`
- **`completeness_score`**: average of three coverage dimensions (0–100):
  1. Required timepoint coverage
  2. Required category coverage across all required timepoints
  3. Minimum usable image count coverage per timepoint
- **`present_timepoints` / `missing_timepoints`**
- **`missing_categories_by_timepoint`**
- **`usable_images_by_timepoint` / `unusable_images_by_timepoint`**
- **`quality_blockers`** and **`warnings`**

### Readiness thresholds

| Status | Condition |
|--------|-----------|
| `ready` | All required timepoints present, all required categories satisfied, minimum usable counts met |
| `partial` | `completeness_score >= 50` but not ready |
| `not_ready` | `completeness_score < 50` |
| `invalid` | Unknown assessment type |

### Progression direction (IM-5 placeholder)

`progression_direction` is reserved for future visual/intelligence phases:

- `insufficient_data` when `ready` or `partial` (data exists but visual progression not evaluated)
- `not_evaluated` when `not_ready` or `invalid`

IM-5 does **not** infer improving/stable/worsening trends.

## Quality Dependency

Only **clinically usable** images count toward progression readiness:

1. `is_clinically_usable === true` → usable
2. `is_clinically_usable === false` → not usable
3. When undefined: `quality_status` of `excellent` or `acceptable` → usable; all other statuses (including `not_evaluated`) → not usable

`buildProgressionImageFromIntake()` bridges IM-2 intake + IM-4 quality into `ImagingOsProgressionImage`, preferring metadata timepoint fields (`timepoint`, `assessment_timepoint`, `followup_month`).

## Pipeline Integration

Single-image ingestion (`runImagingOsIngestionPipeline`) is **unchanged** — progression is not forced on per-upload paths.

Case-level helpers are exported from `pipeline.ts` and `index.ts`:

- `buildProgressionImageFromIntake()`
- `evaluateLongitudinalProgressionReadiness()`
- `recommendProgressionAssessmentForWorkflow()`
- `runImagingOsCaseProgressionEvaluation()`

Typical case flow:

```typescript
const images = intakeRecords.map((intake, i) =>
  buildProgressionImageFromIntake({ intake, quality: qualityResults[i] })
);
const assessment =
  recommendProgressionAssessmentForWorkflow({ source_system, upload_surface, protocol }) ??
  "hair_loss_monitoring";
const result = runImagingOsCaseProgressionEvaluation({ assessment_type: assessment, images });
```

## What IM-5 Deliberately Does Not Do

- No schema migrations
- No UI changes
- No image fetching or storage access
- No AI / model calls
- No pixel-level comparison or visual progression inference
- No changes to HairAudit endpoint response shapes
- No breaking changes to IM-1 through IM-4 behavior

## Recommended IM-6: Surgical Image Intelligence / Outcome Hooks

IM-6 should build on IM-5 readiness gates to:

1. Wire progression evaluation into case-level orchestration (HairAudit, surgery workflows)
2. Emit structured readiness events when cases cross `partial` → `ready`
3. Connect `hairaudit_outcome_12month` readiness to HairAudit scoring prerequisites
4. Add surgical milestone hooks (pre-op → post-op → follow-up) for Surgery OS dashboards

## Later: True Visual Progression Models

Future phases can populate `progression_direction` with real trend analysis once pixel-level or model-based comparison is available. IM-5 ensures those models receive validated, time-aligned, quality-gated inputs rather than incomplete case sets.
