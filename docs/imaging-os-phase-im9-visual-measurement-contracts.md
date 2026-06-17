# ImagingOS Phase IM-9 — Visual Measurement Engine Contracts

## What IM-9 Adds

Phase IM-9 introduces **visual measurement contracts** under `src/lib/imaging-os/measurement.ts`. It answers:

> “How should future AI/vision/pixel engines report measurable findings from comparison-ready image evidence?”

The engine defines contracts using only:

- Canonical image categories (IM-1)
- Normalized intake metadata (IM-2)
- Protocol and progression context (IM-3, IM-5)
- Clinical usability from quality evaluation (IM-4)
- Surgical and outcome evidence alignment (IM-6, IM-7)
- Comparison readiness and measurement targets (IM-8)

No AI, pixel analysis, image fetching, schema migrations, UI changes, or endpoint contract changes are involved.

## Measurement Philosophy

Visual measurement is distinct from comparison readiness (IM-8):

| Layer | Question |
|-------|----------|
| IM-8 Comparison | Can baseline and follow-up images be paired for scientific visual comparison? |
| **IM-9 Measurement** | What domains, units, and result shapes should future engines use when reporting findings? |

IM-9 defines the **contracts** that future AI models and pixel-level measurement engines must conform to. It does not measure images — it validates stub results and bridges IM-8 comparison targets to measurement domains.

## Measurement Domains

`ImagingOsMeasurementDomain` defines thirteen clinical measurement domains:

| Domain | Preferred unit | Requires comparison pair |
|--------|----------------|--------------------------|
| `density` | hairs_per_cm2 | yes |
| `coverage` | percent | yes |
| `caliber` | score_0_100 | yes |
| `donor_density` | hairs_per_cm2 | yes |
| `scar_visibility` | score_0_100 | yes |
| `recipient_survival` | percent | yes |
| `graft_survival` | percent | yes |
| `hairline_position` | millimeters | yes |
| `temporal_angle` | degrees | yes |
| `frontal_density` | hairs_per_cm2 | yes |
| `scalp_visibility` | percent | yes |
| `miniaturization` | score_0_100 | yes |
| `graft_count_validation` | grafts | no |
| `unknown` | — | Returns invalid |

Registry: `IMAGING_MEASUREMENT_REQUIREMENTS`

Each entry includes:

- `allowed_units` / `preferred_unit`
- `compatible_comparison_domains`
- `minimum_confidence`
- `requires_comparison_pair`
- `requires_human_review_below_confidence`
- `description`

## Measurement Units and Methods

### Units (`ImagingOsMeasurementUnit`)

`percent`, `hairs_per_cm2`, `grafts_per_cm2`, `hairs`, `grafts`, `millimeters`, `degrees`, `score_0_100`, `ratio`, `categorical`, `unknown`

### Methods (`ImagingOsMeasurementMethod`)

`ai_vision`, `pixel_analysis`, `manual_clinician`, `manual_auditor`, `imported_external`, `estimated`, `contract_stub`

IM-9 stubs use `contract_stub` by default. Real engines will use `ai_vision`, `pixel_analysis`, or manual methods.

## Measurement Result Contract

`ImagingOsVisualMeasurementResult` is the canonical output shape:

```typescript
{
  measurement_id: string
  domain: ImagingOsMeasurementDomain
  value: number | string | null
  unit: ImagingOsMeasurementUnit
  confidence: number              // 0–1
  method: ImagingOsMeasurementMethod
  evidence_pair_id?: string
  baseline_image_id?: string
  followup_image_id?: string
  comparison_domain?: ImagingOsComparisonDomain
  requires_human_review: boolean
  validation_status: "valid" | "warning" | "invalid"
  warnings: string[]
  blockers: string[]
  metadata?: Record<string, unknown>
  measured_at?: string
  evaluator_version: "imaging-measurement-contract-v1"
}
```

## Confidence and Human Review Rules

`validateVisualMeasurementResult()` enforces:

| Rule | Outcome |
|------|---------|
| Unknown domain | `invalid` |
| Unit not in `allowed_units` | `invalid` |
| Confidence outside 0–1 | `invalid` |
| Confidence below `minimum_confidence` | `warning` |
| Confidence below `requires_human_review_below_confidence` | `requires_human_review: true` |
| Missing comparison pair when required | `warning` for `contract_stub`, `invalid` for other methods |
| Null value | Allowed only for `contract_stub` or `estimated` |
| Numeric unit with non-number value | Non-number values produce `warning` |

Example thresholds for `density`:

- `minimum_confidence`: 0.75
- `requires_human_review_below_confidence`: 0.85

## Relationship to IM-8 Comparison Readiness

IM-9 consumes IM-8 output via `buildMeasurementStubsFromComparisonResult()`:

1. Accept `ImagingOsComparisonReadinessResult`
2. Only create stubs when `comparison_status` is `ready` or `partial`
3. Map each `measurement_targets_available` entry to an `ImagingOsMeasurementDomain`
4. Attach the first `valid_comparison_pair` as evidence context
5. Return an array of `ImagingOsVisualMeasurementResult` stubs

### Target → Domain Mapping

| IM-8 target | IM-9 domain |
|-------------|-------------|
| `density` | `density` |
| `coverage` | `coverage` |
| `caliber` | `caliber` |
| `donor_density` | `donor_density` |
| `scar_visibility` | `scar_visibility` |
| `recipient_survival` | `recipient_survival` |
| `graft_survival` | `graft_survival` |
| `hairline_position` | `hairline_position` |
| `temporal_angle` | `temporal_angle` |
| `frontal_density` | `frontal_density` |
| `scalp_visibility` | `scalp_visibility |

Targets without a mapping (e.g. `extraction_healing`, `donor_recovery`) are skipped.

### Comparison Domain Recommendations

`recommendMeasurementDomainsForComparisonDomain()` maps comparison domains to suggested measurement domains for future engines:

| Comparison domain | Recommended measurement domains |
|-------------------|--------------------------------|
| `growth_change` | density, coverage, caliber, frontal_density |
| `density_change` | density, caliber, miniaturization |
| `donor_recovery_change` | donor_density, scar_visibility, scalp_visibility |
| `recipient_growth_change` | recipient_survival, density, coverage |
| `hairline_design_change` | hairline_position, temporal_angle, frontal_density |
| `graft_survival_change` | graft_survival, recipient_survival, graft_count_validation |
| `longitudinal_medical_response` | density, caliber, miniaturization, coverage |
| `revision_comparison` | density, coverage, scar_visibility, hairline_position |

## HairAudit Scoring Bridge

`buildHairAuditMeasurementStubs()` in `hairAuditMeasurementAdapter.ts`:

- Accepts HairAudit-style image records **or** an existing `ImagingOsComparisonReadinessResult`
- When records are supplied, calls `evaluateHairAuditVisualComparison()` (IM-8)
- Builds measurement stubs via `buildMeasurementStubsFromComparisonResult()`
- Returns `ImagingOsVisualMeasurementResult[]`

No HairAudit endpoint contract changes. The adapter is a pure function for internal orchestration.

## Stub Creation

`createVisualMeasurementStub()` creates contract placeholders:

- Default method: `contract_stub`
- Default value: `null`
- Default confidence: `0`
- Preferred unit from domain registry when unit not supplied
- Deterministic `measurement_id` from domain, method, comparison domain, and image IDs
- Full validation via `validateVisualMeasurementResult()`

## What IM-9 Deliberately Does Not Do

IM-9 explicitly excludes:

- AI or vision model calls
- Pixel-level image analysis
- Image fetching or storage access
- Database reads or writes
- Schema migrations
- UI changes
- HairAudit endpoint contract changes
- Actual numeric measurement of clinical findings

## Recommended IM-10: HairAudit Score Contract / Digital Twin Imaging Summary

IM-10 should build on IM-9 measurement stubs to define:

1. HairAudit score contract shapes (overall case score, domain subscores)
2. Digital Twin imaging summary aggregation from measurement results
3. Score confidence propagation from IM-9 `requires_human_review` flags
4. Audit trail linking scores to comparison pairs and evidence image IDs

IM-9 ensures IM-10 only aggregates results that conform to validated measurement contracts.

## Later: Real AI/Pixel Measurement Engines

Future measurement engines should:

- Consume `ImagingOsComparisonReadinessResult` where `comparison_status === "ready"` (or handle `partial` explicitly)
- Use `recommendMeasurementDomainsForComparisonDomain()` to scope output
- Return `ImagingOsVisualMeasurementResult` with appropriate `method` (`ai_vision`, `pixel_analysis`, etc.)
- Set `confidence` within 0–1 and respect human review thresholds
- Pass `validateVisualMeasurementResult()` before persisting or scoring
- Never bypass IM-8 usability rules or category match constraints

## Files Added

| File | Purpose |
|------|---------|
| `src/lib/imaging-os/measurement.ts` | Domain registry, result contract, validation, bridges |
| `src/lib/imaging-os/adapters/hairAuditMeasurementAdapter.ts` | HairAudit → measurement stub adapter |
| `tests/imagingOsPhaseIm9.test.ts` | Phase IM-9 test suite |
| `docs/imaging-os-phase-im9-visual-measurement-contracts.md` | This document |

## Test Command

```bash
npm run test:imaging-os-im9
```
