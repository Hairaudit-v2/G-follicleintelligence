# ImagingOS Phase IM-8 — Visual Comparison Contracts

## What IM-8 Adds

Phase IM-8 introduces **visual comparison readiness infrastructure** under `src/lib/imaging-os/comparison.ts`. It answers:

> “Can two or more images be scientifically compared for future visual analysis?”

The engine evaluates image sets using only:

- Canonical image categories (IM-1)
- Normalized intake metadata (IM-2)
- Protocol and progression context (IM-3, IM-5)
- Clinical usability from quality evaluation (IM-4)
- Surgical and outcome evidence alignment (IM-6, IM-7)

No AI, pixel comparison, image fetching, schema migrations, UI changes, or endpoint contract changes are involved.

## Comparison Philosophy

Visual comparison is distinct from progression readiness (IM-5), surgical readiness (IM-6), and outcome measurement (IM-7):

| Layer | Question |
|-------|----------|
| IM-5 Progression | Is the case ready for longitudinal tracking? |
| IM-6 Surgical | Does surgical workflow documentation meet domain requirements? |
| IM-7 Outcome | Can we objectively measure clinical outcomes from available evidence? |
| **IM-8 Comparison** | Can baseline and follow-up images be paired for scientific visual comparison? |

IM-8 defines the **contracts** that future AI models and pixel-level measurement engines will rely on. It does not perform comparison or scoring — it determines whether valid comparison pairs exist.

## Comparison Domains

`ImagingOsComparisonDomain` defines ten visual comparison domains:

| Domain | Baseline | Allowed follow-up | Key categories |
|--------|----------|-------------------|----------------|
| `growth_change` | baseline | month_3, month_6, month_12 | front, top, crown |
| `density_change` | baseline | month_6, month_12 | top, crown, microscopic |
| `donor_recovery_change` | pre_op | immediate_post_op, day_14, month_6, month_12 | donor |
| `recipient_growth_change` | immediate_post_op | month_6, month_12 | recipient, front |
| `hairline_design_change` | pre_op | month_12 | front |
| `scalp_visibility_change` | baseline | month_6, month_12 | top, crown, front |
| `graft_survival_change` | immediate_post_op | month_12 | recipient, graft_tray |
| `longitudinal_medical_response` | baseline | month_3, month_6, month_12 | front, top, crown |
| `revision_comparison` | pre_op | month_12 | front, top, crown, donor, recipient |
| `unknown` | — | — | Returns invalid |

Registry: `IMAGING_COMPARISON_REQUIREMENTS`

Each entry includes:

- `required_baseline_timepoint` / `allowed_followup_timepoints`
- `required_categories`
- `minimum_images_per_comparison`
- `requires_same_category_match` / `requires_quality_threshold`
- `description`

## Comparison Image Model

`ImagingOsComparisonImage` represents a single image in a comparison context:

```typescript
{
  image_id?, patient_id?, surgical_case_id?,
  canonical_category, timepoint,
  quality_status?, is_clinically_usable?,
  captured_at?, metadata?
}
```

Bridge helpers connect prior phases:

- `buildComparisonImageFromOutcomeEvidence()` — IM-7 → IM-8
- `buildComparisonImageFromProgressionImage()` — IM-5 → IM-8

## Comparison Readiness Logic

`evaluateVisualComparisonReadiness()` returns:

- **`comparison_status`**: `ready`, `partial`, `insufficient_data`, or `invalid`
- **`readiness_score`**: percentage of required categories with valid comparison pairs (0–100)
- **`required_baseline_timepoint`**
- **`detected_followup_timepoints`**
- **`missing_required_categories`**
- **`valid_comparison_pairs` / `invalid_comparison_pairs`**
- **`measurement_targets_available`**
- **`quality_blockers` / `warnings`**

### Usability Rules

Only clinically usable images count toward comparison pairs:

- `is_clinically_usable === true`, or
- `quality_status` is `excellent` or `acceptable`

### Pair Construction

For each required category:

1. Find a usable baseline image at `required_baseline_timepoint`
2. Find a usable follow-up image at any `allowed_followup_timepoint`
3. Verify category match (when `requires_same_category_match` is true)
4. Verify quality gate on both images
5. Build an `ImagingOsComparisonCandidate` with `timepoint_delta` (e.g. `baseline → month_12`)

### Comparison Status Thresholds

| Status | Condition |
|--------|-----------|
| `ready` | Score = 100 (all required categories have valid pairs) |
| `partial` | Score ≥ 50, or baseline images present but follow-up incomplete |
| `insufficient_data` | Score < 50 and no baseline images present |
| `invalid` | Unknown domain |

## Measurement Targets

`determineMeasurementTargets()` returns the future measurements a comparison domain enables:

| Domain | Targets |
|--------|---------|
| `growth_change` | density, coverage, caliber |
| `density_change` | density, coverage, caliber |
| `donor_recovery_change` | donor_density, extraction_healing, scar_visibility |
| `recipient_growth_change` | recipient_survival, density, coverage |
| `hairline_design_change` | hairline_position, temporal_angle, frontal_density |
| `graft_survival_change` | graft_survival, density |
| `scalp_visibility_change` | scalp_visibility, coverage |
| `longitudinal_medical_response` | density, coverage, caliber |
| `revision_comparison` | density, coverage, hairline_position, donor_recovery, graft_survival |

These targets are attached to each `ImagingOsComparisonCandidate` for downstream engines.

## Domain Recommendation

`recommendComparisonDomain()` maps workflow context to comparison domains:

| Input | Comparison domain |
|-------|-------------------|
| `growth_assessment` | `growth_change` |
| `density_change` | `density_change` |
| `donor_recovery` | `donor_recovery_change` |
| `recipient_survival` | `recipient_growth_change` |
| `hairline_design_review` | `hairline_design_change` |
| `surgical_outcome_audit` | `graft_survival_change` |
| `longitudinal_medical_response` | `longitudinal_medical_response` |
| `revision_outcome_review` | `revision_comparison` |

## HairAudit Integration Role

`evaluateHairAuditVisualComparison()` in `hairAuditComparisonAdapter.ts`:

- Maps HairAudit category labels → canonical categories (IM-1)
- Normalizes timepoint labels (IM-5)
- Resolves quality status (IM-4)
- Evaluates `growth_change` comparison readiness

No HairAudit endpoint contract changes. The adapter is a pure function for internal orchestration.

## Recommended IM-9: Visual Measurement Engine

IM-9 should build on IM-8 comparison pairs to perform actual measurements:

1. Accept `ImagingOsComparisonCandidate` pairs where `comparison_ready === true`
2. Run pixel-level or AI-assisted measurement for each `measurement_target`
3. Return structured deltas (e.g. density change %, hairline position shift)
4. Respect quality gates and category match constraints from IM-8

IM-8 ensures IM-9 only operates on scientifically valid comparison pairs.

## Future AI Comparison Models

Future AI comparison models should:

- Consume `ImagingOsComparisonReadinessResult` before attempting analysis
- Require `comparison_status === "ready"` or explicitly handle `partial` with warnings
- Use `measurement_targets` from candidates to scope model output
- Never bypass usability rules — unusable images must remain excluded
- Report results against `timepoint_delta` and `canonical_category` for auditability

## Files Added

| File | Purpose |
|------|---------|
| `src/lib/imaging-os/comparison.ts` | Domain registry, evaluator, bridges, recommendation |
| `src/lib/imaging-os/adapters/hairAuditComparisonAdapter.ts` | HairAudit → growth_change adapter |
| `tests/imagingOsPhaseIm8.test.ts` | Phase IM-8 test suite |

## Test Command

```bash
npm run test:imaging-os-im8
```
