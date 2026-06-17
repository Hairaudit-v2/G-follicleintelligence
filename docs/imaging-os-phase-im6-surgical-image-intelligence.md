# ImagingOS Phase IM-6 — Surgical Image Intelligence Hooks

## What IM-6 Adds

Phase IM-6 introduces a **surgical image intelligence layer** under `src/lib/imaging-os/surgical.ts`. It answers:

> “Does this surgical case have the imaging evidence required for planning, procedural documentation, donor recovery review, recipient growth tracking, and outcome auditing?”

The engine evaluates case-level image sets using only:

- Canonical image categories (IM-1)
- Normalized intake metadata (IM-2)
- Protocol and progression context (IM-3, IM-5)
- Clinical usability from quality evaluation (IM-4)

No AI, pixel comparison, image fetching, schema migrations, UI changes, or endpoint contract changes are involved.

## Why Surgical Readiness Matters

SurgeryOS workflows, HairAudit outcome auditing, and future Outcome Intelligence all depend on **event-aligned, category-complete, quality-gated** surgical image sets. IM-6 provides the structural bridge that determines whether a case is ready for surgical planning, intraoperative documentation review, donor/recipient follow-up, or outcome audit — before any visual comparison or model inference runs.

## Surgical Event Model

`ImagingOsSurgicalImageEventType` defines canonical surgical workflow milestones:

| Event | Typical use |
|-------|-------------|
| `pre_op` | Baseline / pre-operative documentation |
| `recipient_design` | Hairline and recipient zone planning |
| `donor_mapping` | Donor zone marking and planning |
| `graft_tray` | Graft counting and tray documentation |
| `extraction_documentation` | Donor extraction phase |
| `implantation_documentation` | Recipient implantation in progress |
| `implantation_complete` | Final placement confirmation |
| `immediate_post_op` | Day-of surgery post-operative photos |
| `day_14_review` | Early post-op follow-up |
| `month_3_review` … `month_12_outcome` | Standard surgical follow-up intervals |
| `revision_review` | Revision case documentation |
| `unknown` | Missing or unrecognized label |

`normalizeSurgicalImageEventType()` maps external aliases (e.g. `preop`, `grafts`, `donor_zone`, `m12`, `revision`) to canonical values deterministically.

## Surgical Image Model

`ImagingOsSurgicalImage` extends the progression image concept with surgical context:

- `surgical_case_id` — from `surgery_id` or `case_id` on intake
- `surgical_event` — workflow milestone (from metadata `surgical_event`, `event_type`, or `workflow_stage`)
- `timepoint` — optional longitudinal anchor from intake metadata
- Quality fields inherited from IM-4 evaluation

`buildSurgicalImageFromIntake()` bridges IM-2 intake + IM-4 quality into `ImagingOsSurgicalImage`.

## Readiness Domains

`IMAGING_SURGICAL_READINESS_REQUIREMENTS` defines six surgical readiness domains:

| Domain | Required events | Required categories | Min usable / event |
|--------|----------------|--------------------|--------------------|
| `surgery_planning` | pre_op, recipient_design, donor_mapping | front, top, crown, donor, recipient | 2 |
| `intraoperative_documentation` | graft_tray, extraction_documentation, implantation_complete | graft_tray, donor, recipient | 1 |
| `donor_recovery` | pre_op, immediate_post_op, day_14_review, month_6_review, month_12_outcome | donor | 1 |
| `recipient_growth` | pre_op, immediate_post_op, month_6_review, month_12_outcome | front, top, crown, recipient | 2 |
| `outcome_audit` | pre_op, immediate_post_op, month_12_outcome | front, top, crown, donor, recipient | 3 |
| `revision_review` | revision_review, pre_op | front, top, crown, donor, recipient | 2 |

Each registry entry also lists optional categories for future enrichment (not scored in IM-6 readiness).

## Readiness Scoring

`evaluateSurgicalImageReadiness()` returns:

- **`readiness_status`**: `ready`, `partial`, `not_ready`, or `invalid`
- **`completeness_score`**: average of three coverage dimensions (0–100):
  1. Required event coverage
  2. Required category coverage across all required events
  3. Minimum usable image count coverage per event
- **`present_events` / `missing_events`**
- **`missing_categories_by_event`**
- **`usable_images_by_event` / `unusable_images_by_event`**
- **`quality_blockers`** and **`warnings`**

### Readiness thresholds

| Status | Condition |
|--------|-----------|
| `ready` | All required events present, all required categories satisfied per event, minimum usable counts met |
| `partial` | `completeness_score >= 50` but not ready |
| `not_ready` | `completeness_score < 50` |
| `invalid` | Unknown readiness domain |

## Quality Dependency

Only **clinically usable** images count toward surgical readiness:

1. `is_clinically_usable === true` → usable
2. `is_clinically_usable === false` → not usable
3. When undefined: `quality_status` of `excellent` or `acceptable` → usable; all other statuses (including `not_evaluated`) → not usable

## Workflow Recommendation

`recommendSurgicalReadinessDomain()` maps workflow context to the appropriate readiness domain:

| Input signal | Domain |
|--------------|--------|
| `protocol: surgery_planning` | `surgery_planning` |
| `surgical_event: graft_tray` / `extraction_documentation` / `implantation_complete` | `intraoperative_documentation` |
| `protocol: donor_analysis` | `donor_recovery` |
| `assessment_type: donor_recovery_tracking` | `donor_recovery` |
| `assessment_type: surgery_growth_tracking` | `recipient_growth` |
| `assessment_type: hairaudit_outcome_12month` | `outcome_audit` |
| `surgical_event: revision_review` | `revision_review` |

Returns `undefined` when no confident mapping exists.

## SurgeryOS / HairAudit / Outcome Intelligence Bridge

### SurgeryOS

SurgeryOS uploads via `surgery_workflow` surface can be adapted through `buildSurgicalImageFromIntake()`. Metadata fields `surgical_event`, `event_type`, and `workflow_stage` drive event classification. `recommendSurgicalReadinessDomain()` selects the evaluation domain from protocol or event context.

### HairAudit

`evaluateHairAuditSurgicalOutcomeReadiness()` in `adapters/hairAuditSurgicalOutcomeAdapter.ts` maps HairAudit category labels and timepoints to surgical events, then evaluates against the `outcome_audit` domain:

| HairAudit timepoint | Surgical event |
|--------------------|----------------|
| `baseline`, `pre_op` | `pre_op` |
| `immediate_post_op`, `postop` | `immediate_post_op` |
| `12_month`, `month_12`, `follow_up` | `month_12_outcome` |

No HairAudit endpoint response shape changes are required — the adapter operates on in-memory category/timepoint arrays.

### Outcome Intelligence (future)

IM-6 readiness gates provide the prerequisite check before Outcome Intelligence scoring. A case must reach `ready` on `outcome_audit` before downstream outcome measurement contracts (IM-7) can be enforced.

## Pipeline Integration

Single-image ingestion (`runImagingOsIngestionPipeline`) is **unchanged** — surgical readiness is not forced on per-upload paths.

Case-level helpers are exported from `index.ts`:

- `normalizeSurgicalImageEventType()`
- `evaluateSurgicalImageReadiness()`
- `recommendSurgicalReadinessDomain()`
- `buildSurgicalImageFromIntake()`
- `evaluateHairAuditSurgicalOutcomeReadiness()`

Typical case flow:

```typescript
const images = intakeRecords.map((intake, i) =>
  buildSurgicalImageFromIntake({ intake, quality: qualityResults[i] })
);
const domain =
  recommendSurgicalReadinessDomain({ protocol, surgical_event, assessment_type }) ??
  "surgery_planning";
const result = evaluateSurgicalImageReadiness({ domain, images });
```

## What IM-6 Deliberately Does Not Do

- No schema migrations
- No UI changes
- No image fetching or storage access
- No AI / model calls
- No pixel-level comparison
- No changes to HairAudit endpoint response shapes
- No breaking changes to IM-1 through IM-5 behavior

## Recommended IM-7: Outcome Measurement Contracts

IM-7 should build on IM-6 surgical readiness gates to:

1. Define formal outcome measurement contracts (density, coverage, graft survival proxies)
2. Wire `outcome_audit` readiness into HairAudit scoring prerequisites
3. Emit structured readiness events when cases cross `partial` → `ready`
4. Connect surgical milestone completeness to SurgeryOS dashboard indicators

## Later: AI Surgical Image Interpretation

Future phases can add model-based surgical image interpretation (graft count verification, donor extraction zone analysis, recipient density estimation) once IM-6 ensures validated, event-aligned, quality-gated inputs rather than incomplete case sets.

## Tests

Run:

```bash
npm run test:imaging-os-im6
```

Covers event normalization, registry completeness, readiness evaluation, workflow recommendation, intake adapter, HairAudit outcome adapter, and IM-1–IM-5 compatibility.
