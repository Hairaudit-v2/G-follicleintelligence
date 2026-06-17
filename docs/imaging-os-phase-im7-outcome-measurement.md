# ImagingOS Phase IM-7 — Outcome Measurement Contracts

## What IM-7 Adds

Phase IM-7 introduces **outcome measurement infrastructure** under `src/lib/imaging-os/outcomes.ts`. It answers:

> “Does this case have sufficient imaging evidence to support objective clinical outcome analysis?”

The engine evaluates unified evidence sets using only:

- Canonical image categories (IM-1)
- Normalized intake metadata (IM-2)
- Protocol and progression context (IM-3, IM-5)
- Clinical usability from quality evaluation (IM-4)
- Surgical event alignment (IM-6)

No AI, pixel comparison, image fetching, schema migrations, UI changes, or endpoint contract changes are involved.

## Outcome Measurement Philosophy

Outcome measurement is distinct from progression readiness (IM-5) and surgical readiness (IM-6):

| Layer | Question |
|-------|----------|
| IM-5 Progression | Is the case ready for longitudinal tracking? |
| IM-6 Surgical | Does surgical workflow documentation meet domain requirements? |
| **IM-7 Outcome** | Can we objectively measure clinical outcomes from available evidence? |

IM-7 defines the **contracts** that future AI models and HairAudit scoring engines will rely on. It does not perform comparison or scoring — it determines whether the evidence foundation exists.

## Measurement Domains

`ImagingOsOutcomeMeasurementDomain` defines ten outcome measurement domains:

| Domain | Required timepoints | Key categories | Notes |
|--------|--------------------|----------------|-------|
| `growth_assessment` | baseline, month_6, month_12 | front, top, crown | Requires baseline |
| `density_change` | baseline, month_12 | top, crown, microscopic | Density-focused |
| `donor_recovery` | pre_op, immediate_post_op, day_14, month_6 | donor | Donor healing |
| `recipient_survival` | immediate_post_op, month_12 | recipient, front | Graft survival |
| `hairline_design_review` | pre_op, month_12 | front | Design outcome |
| `patient_satisfaction_linkage` | baseline, month_12 | front | Satisfaction correlation |
| `surgical_outcome_audit` | pre_op, immediate_post_op, month_12 | front, top, crown, donor, recipient | Requires graft_tray + implantation_complete events |
| `revision_outcome_review` | pre_op, month_12 | front, top, crown, donor, recipient | Requires revision_review event |
| `longitudinal_medical_response` | baseline, month_3, month_6, month_12 | front, top, crown | Medical treatment |
| `unknown` | — | — | Returns invalid |

Registry: `IMAGING_OUTCOME_MEASUREMENT_REQUIREMENTS`

Each entry includes:

- `required_timepoints` / `required_categories` / `optional_categories`
- `required_surgical_events` (optional, for surgical domains)
- `minimum_usable_images_per_timepoint`
- `requires_baseline` / `requires_quality_threshold`
- `description`

## Unified Evidence Model

`ImagingOsOutcomeEvidence` bridges progression and surgical image models:

```typescript
{
  image_id?, patient_id?, surgical_case_id?,
  canonical_category, timepoint,
  surgical_event?, quality_status?, is_clinically_usable?,
  metadata?
}
```

Bridge helpers:

- `buildOutcomeEvidenceFromProgressionImage()` — IM-5 → IM-7
- `buildOutcomeEvidenceFromSurgicalImage()` — IM-6 → IM-7 (maps surgical events to timepoints)

## Scoring System

`evaluateOutcomeMeasurementReadiness()` returns:

- **`measurement_status`**: `measurable`, `partially_measurable`, `insufficient_evidence`, or `invalid`
- **`readiness_score`**: average of coverage dimensions (0–100):
  1. Required timepoint coverage
  2. Required category coverage across all required timepoints
  3. Surgical event coverage (when required)
  4. Minimum usable image count coverage per timepoint
- **`present_timepoints` / `missing_timepoints`**
- **`missing_categories_by_timepoint`**
- **`required_surgical_events` / `missing_surgical_events`**
- **`usable_evidence_count` / `unusable_evidence_count`**
- **`quality_blockers`**
- **`recommended_next_capture`**

### Measurement Status Thresholds

| Status | Condition |
|--------|-----------|
| `measurable` | Score ≥ 90 and all required elements present |
| `partially_measurable` | Score ≥ 50 |
| `insufficient_evidence` | Score < 50 |
| `invalid` | Unknown domain |

## Quality Dependencies

Only **clinically usable** evidence counts toward readiness:

- `is_clinically_usable === true`, OR
- `quality_status` is `acceptable` or `excellent`

`not_evaluated` quality does not count. Unusable evidence is tracked in `unusable_evidence_count` and may generate `quality_blockers`.

When `requires_baseline` is true, baseline timepoint must have sufficient usable evidence.

## Next Capture Recommendations

`recommendNextCaptureRequirements()` analyzes an evaluation result and returns:

```typescript
{
  missing_timepoints,
  missing_categories,
  next_recommended_capture: string,
  priority_level?: "high" | "medium" | "low"
}
```

Priority is elevated for missing `baseline` or `month_12` captures. When the dataset is complete (`measurable`), the recommendation is `"Outcome dataset complete."`.

## Domain Recommendation

`recommendOutcomeMeasurementDomain()` maps workflow context to outcome domains:

| Input | Domain |
|-------|--------|
| `surgery_growth_tracking` | `growth_assessment` |
| `donor_recovery_tracking` | `donor_recovery` |
| `recipient_growth` | `recipient_survival` |
| `outcome_audit` | `surgical_outcome_audit` |
| `hairaudit_outcome_12month` | `growth_assessment` |
| `hli_longitudinal_review` | `longitudinal_medical_response` |
| `revision_review` | `revision_outcome_review` |

## HairAudit Integration Role

`evaluateHairAuditOutcomeMeasurement()` in `adapters/hairAuditOutcomeMeasurementAdapter.ts`:

1. Maps HairAudit category labels → canonical categories (IM-1)
2. Maps timepoint labels → canonical timepoints (IM-5)
3. Maps optional surgical_event labels → surgical events (IM-6)
4. Evaluates against `surgical_outcome_audit` domain

This adapter is additive — it does not alter existing HairAudit endpoint contracts or the IM-6 surgical outcome adapter.

## Evaluator Version

All results include `evaluator_version: "imaging-outcome-contract-v1"`.

## Testing

```bash
npm run test:imaging-os-im7
```

Tests cover registry integrity, measurable/partial/insufficient states, baseline requirements, surgical event requirements, quality gating, bridge helpers, HairAudit adapter, domain recommendation, next capture recommendations, and IM-1 through IM-6 compatibility.

## Recommended IM-8: True Visual Comparison Engine

IM-7 establishes **evidence contracts**. IM-8 should introduce:

1. **Pairwise image comparison** — baseline vs follow-up alignment by category and timepoint
2. **Region-of-interest contracts** — hairline, crown, donor zone bounding semantics
3. **Comparison readiness gate** — requires `measurable` status from IM-7 before comparison runs
4. **Delta artifact model** — structured output for density, coverage, and design deviation (still no AI in IM-8 foundation)

## Future AI Scoring Integration

When AI models and HairAudit scoring engines are integrated:

1. Call `evaluateOutcomeMeasurementReadiness()` first — only proceed when `measurable` or `partially_measurable`
2. Use `ImagingOsOutcomeEvidence[]` as the unified input layer
3. Respect `quality_blockers` and `recommended_next_capture` for workflow UX
4. Map scoring domains via `recommendOutcomeMeasurementDomain()` from workflow context
5. Version scoring outputs alongside `evaluator_version` for audit trails

IM-7 ensures scoring engines never run on structurally incomplete evidence.

## File Map

| File | Purpose |
|------|---------|
| `src/lib/imaging-os/outcomes.ts` | Domain registry, evidence model, evaluation engine |
| `src/lib/imaging-os/adapters/hairAuditOutcomeMeasurementAdapter.ts` | HairAudit → outcome measurement bridge |
| `tests/imagingOsPhaseIm7.test.ts` | Phase IM-7 test suite |
| `docs/imaging-os-phase-im7-outcome-measurement.md` | This document |
