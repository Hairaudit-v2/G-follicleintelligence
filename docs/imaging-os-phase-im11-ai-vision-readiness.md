# ImagingOS Phase IM-11 — AI Vision Readiness Adapter

## What IM-11 adds

Phase IM-11 introduces a **pure AI Vision Readiness Adapter** in `src/lib/imaging-os/aiVision.ts`. It defines contracts and evaluators that determine whether an ImagingOS case, comparison, or measurement context is safe and suitable for **future** AI vision analysis.

IM-11 does **not** call models, fetch images, process pixels, persist audit logs, or change UI or API endpoints.

## Why this comes before live AI

Live AI vision must not run on arbitrary uploads. IM-1 through IM-10 established category normalization, intake, protocol completeness, quality, progression, surgical evidence, outcomes, comparison, measurement, and case-level summary scoring. IM-11 layers a **gate** on top of those outputs:

1. **Task contracts** — which AI tasks exist and what each requires
2. **Evidence contracts** — what image metadata must be present
3. **Readiness evaluation** — ready, partial, blocked, or invalid
4. **Output and audit contracts** — how model results must be shaped and logged
5. **Human review policy** — when clinician or auditor sign-off is mandatory

IM-12 can then add the first live AI adapter behind a feature flag, reusing these contracts.

## AI task risk levels

| Risk level | Example tasks |
|------------|----------------|
| `low` | Category classification, quality assessment, protocol gap detection |
| `medium` | Hair loss staging, donor/recipient area assessment |
| `high` | Growth comparison, density measurement, graft survival, hairline design review |
| `clinical_review_required` | Surgical outcome review, Digital Twin summary |

Higher risk tasks require stricter quality gates, comparison/outcome readiness, summary score thresholds, and human review.

## Evidence contract

`ImagingOsAiVisionEvidence` describes model input evidence without signed URL values:

- Identity: `evidence_id`, optional `image_id`, `patient_id`, `surgical_case_id`
- Clinical context: `canonical_category`, `timepoint`, `surgical_event`
- Quality: `quality_status`, `is_clinically_usable`
- Storage references: `storage_bucket`, `storage_path`, `public_url`, `signed_url_present`
- Optional `metadata`

Bridge helpers convert from IM-2 intake, IM-7 outcome evidence, and IM-8 comparison images.

## Request contract

`ImagingOsAiVisionRequestContract` is produced by `evaluateAiVisionReadiness()` and `buildAiVisionRequestContract()`:

- `task_type`, `risk_level`, `evidence[]`
- Optional `comparison_result`, `outcome_result`, `summary_result`
- `allowed_measurement_domains`, `allowed_comparison_domains`
- `requires_human_review`, `human_review_policy`
- Contract versions: `imaging-ai-output-contract-v1`, `imaging-ai-audit-contract-v1`
- `warnings`, `blockers`, `readiness_status`

### Readiness rules

| Status | Meaning |
|--------|---------|
| `ready` | All hard requirements pass, no blockers |
| `partial` | Warnings only (e.g. high-risk advisory) |
| `blocked` | Missing evidence, failed quality/comparison/outcome/summary gates |
| `invalid` | Unknown task type |

## Model output contract

`ImagingOsAiVisionModelOutputContract` defines expected AI responses:

- `output_status`: completed, partial, failed, rejected
- Optional `measurements`, `classifications`, `findings`
- Confidence values must be 0–1
- Measurements must use domains allowed by the request
- `validateAiVisionModelOutputContract()` enforces alignment with the request

## Audit contract

`ImagingOsAiVisionAuditLogContract` is built by `buildAiVisionAuditLogContract()` for traceability:

- Links `audit_id` to `request_id`, task, risk, evidence count
- Records requested measurement and comparison domains
- Captures human review requirement and readiness status
- **No persistence in IM-11** — consumers attach storage in a later phase

## Human review rules

| Policy | When |
|--------|------|
| `not_required` | Low-risk tasks with `requires_human_review: false` |
| `recommended` | Medium-risk tasks |
| `required` | High-risk tasks with measurements |
| `clinical_sign_off_required` | `clinical_review_required` risk (surgical outcome, Digital Twin) |

Output validation additionally forces `requires_human_review` when risk is `clinical_review_required` or when high-risk tasks return measurements.

## HairAudit use case

`buildHairAuditAiVisionReadiness()` in `adapters/hairAuditAiVisionAdapter.ts` defaults to `surgical_outcome_review` and builds a request contract from HairAudit evidence plus IM-8 comparison, IM-7 outcome, and IM-10 summary inputs. No HairAudit endpoint contract changes.

`recommendAiVisionTasksForSummary()` suggests which tasks are appropriate given summary score and readiness outputs.

## Recommended IM-12: first live AI adapter

IM-12 should:

1. Add a feature-flagged live AI adapter that only runs when `readiness_status` is `ready` or explicitly `partial` with operator approval
2. Populate `ImagingOsAiVisionModelOutputContract` from a real model
3. Persist `ImagingOsAiVisionAuditLogContract` records
4. Never bypass human review for `clinical_review_required` tasks

## Safety notes

- **AI outputs are non-authoritative** until clinician or auditor sign-off
- High-risk and clinical-review tasks must not auto-update patient records
- Measurement domains outside the request contract must be rejected
- Sparse or missing upstream readiness (comparison, outcome, summary) must block execution rather than degrade silently
- Signed URLs and image bytes remain outside IM-11; evidence contracts carry references only

## Module exports

From `src/lib/imaging-os/index.ts`:

- `aiVision` module (types, registry, evaluators, bridges, validation)
- `buildHairAuditAiVisionReadiness` adapter

## Tests

```bash
npm run test:imaging-os-im11
```

Covers registry integrity, readiness evaluation, evidence bridges, audit/output contracts, HairAudit adapter, recommendations, and IM-1–IM-10 compatibility.
