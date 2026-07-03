# ImageOS AI Graft Tray Validation (IMAGING-AI-GRAFT-PILOT-1)

## Stage 2 scope

Staff-only AI-assisted validation for graft tray photos. The system estimates graft counts from tray images and compares them against SurgeryOS manual counts. Results are **never authoritative** until a human accepts, corrects, or rejects via clinical review.

Stage 1 foundation (`fi_imaging_graft_tray_links`, tray evidence in SurgeryOS, reconciliation gate) is required.

## Feature flags

| Variable | Default | Effect |
|----------|---------|--------|
| `FI_IMAGING_ENABLE_GRAFT_TRAY_AI_COUNT` | `false` | Master switch — when off, no jobs enqueued and provider returns unavailable |
| `FI_IMAGING_GRAFT_TRAY_AI_PROVIDER` | `stub` | `stub` or `openai_vision` (preview) |
| `FI_IMAGING_GRAFT_TRAY_COUNT_TOLERANCE_PERCENT` | `5` | Within-tolerance threshold for AI vs manual comparison |
| `FI_IMAGING_REQUIRE_GRAFT_TRAY_CAPTURE` | `false` | Stage 1 gate — blocks reconciliation without linked tray photo |

Staging enablement and UAT steps: [imaging-os-graft-tray-staging-uat.md](./imaging-os-graft-tray-staging-uat.md).

## Provider architecture

```
graft_tray capture
  → maybeEnqueueGraftTrayCountEstimateJob (flag-gated)
  → fi_imaging_ai_analysis_jobs (kind: graft_tray_count_estimate)
  → imagingAiAnalysisJobWorker
  → graftTrayCountProvider.server
       ├── stub (default)
       └── openai_vision (preview, staff review mandatory)
  → fi_imaging_graft_tray_ai_estimates
  → fi_patient_images.metadata.graft_tray_ai_estimate (staff-only)
```

Pure logic: `graftTrayCountProviderCore.ts`  
Types: `graftTrayCountTypes.ts`  
Review mutations: `graftTrayCountReviewMutations.server.ts`

## Data flow

1. `graft_tray` image captured and linked (Stage 1).
2. If `FI_IMAGING_ENABLE_GRAFT_TRAY_AI_COUNT=true`, job `graft_tray_count_estimate` is enqueued.
3. Worker resolves manual count from confirmed tray events → session extracted grafts → missing.
4. Provider returns estimate + confidence + assessable flag.
5. Comparison produces mismatch band: `within_tolerance`, `minor_mismatch`, `material_mismatch`, `unable_to_assess`, `manual_count_missing`, `image_not_assessable`.
6. Result stored in `fi_imaging_graft_tray_ai_estimates` and image metadata.
7. Every result starts as `review_status: pending_review`.
8. Clinical review queue surfaces graft tray AI items with action buttons.

## Review workflow

Staff actions (Imaging review queue or API):

| Action | Effect |
|--------|--------|
| `accept_ai_estimate` | Records acceptance; does **not** overwrite SurgeryOS manual counts |
| `accept_manual_count` | Confirms manual count as source of truth |
| `correct_count` | Stores staff-corrected count on estimate record |
| `reject_ai_estimate` | Rejects AI estimate; preserves original for audit |
| `request_retake` | Flags retake; routes to imaging retake flow |

Manual SurgeryOS graft counts remain authoritative unless staff explicitly accepts or corrects via review.

## Patient-safety rules

- Staff-only metadata keys (`graft_tray_ai_estimate`, `graft_tray_ai_estimate_id`, etc.)
- Redacted from patient portal, PDF, and share exports
- Graft tray view labels blocked from patient export cards (`\bgraft\b` pattern)
- No patient-facing diagnosis or surgical claims from AI outputs
- Provider/model version stored on every estimate for audit

## SurgeryOS UI

Graft Counting Assistant tray evidence panel shows:

- Linked tray image
- AI estimate vs manual count
- Mismatch band and confidence
- Review status with CTA when pending

Language uses “AI estimate” and “validation check” — not “confirmed count”.

## Known limitations

- Default stub provider — not clinical-grade vision counting
- OpenAI vision path is preview-only behind flag
- No automatic SurgeryOS count mutation
- Requires graft tray link + optional manual count for meaningful comparison
- Pre-Stage-2 tray images are not backfilled

## Future Stage 3 options

- Dedicated graft-tray vision model with composition breakdown (singles/doubles/triples)
- Tighter linkage to specific tray count events
- Optional reconciliation gate on unresolved AI mismatch
- Theatre-real-time estimate during capture (with explicit staff ack)