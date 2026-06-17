# ImagingOS Phase IM-2 — Universal Image Ingestion Pipeline

**Date:** 2026-06-17  
**Scope:** Pure, type-safe universal ingestion contracts and stub pipeline  
**Repository:** Follicle Intelligence (FI OS)

---

## What IM-2 Adds

Phase IM-2 extends the shared ImagingOS engine (`src/lib/imaging-os/`) with a **universal ingestion layer** that any FI imaging source can call without schema migrations or UI changes:

| Module | Purpose |
|--------|---------|
| `intake.ts` (extended) | `ImagingOsImageIngestionRequest`, `ImagingOsNormalizedImageIntake`, `normalizeImageIngestionRequest()` |
| `pipeline.ts` | `runImagingOsIngestionPipeline()` — normalize → quality → protocol → classification |
| `adapters/fiOsPatientImageAdapter.ts` | FI OS patient upload → ingestion request |
| `adapters/hliImageAdapter.ts` | HLI upload/classification → ingestion request |
| HairAudit service update | Routes stub classify through the new pipeline while preserving the 7-field response |

Key behaviors:

- **Deterministic intake IDs** from `source_system` + storage anchor + timestamp fallback
- **Canonical category resolution** via `mapExternalCategoryToCanonical()`, with `canonical_category_hint` override
- **Processability gate** — requires `storage_path`, `public_url`, or `signed_url`
- **Warnings, not throws** — sparse input returns a normalized record with `warnings[]`
- **Pipeline status** — `"dry_run"` when processable, `"not_processable"` when storage reference missing

---

## What IM-2 Deliberately Does Not Add

IM-2 is a **pure contract and stub orchestration** phase. It does **not**:

- Add database schema migrations
- Fetch images from storage or signed URLs
- Run pixel analysis or AI/model classification
- Change HairAudit endpoint response shape
- Alter any UI or upload routes
- Rename `src/lib/imagingOs/` (legacy ImagingOS UI/server layer)
- Remove or break IM-1 `runImagingOsStubPipeline()` behavior

---

## Source Systems Supported

`ImagingOsImageIngestionRequest.source_system`:

| Value | Typical consumer |
|-------|------------------|
| `hairaudit` | HairAudit internal classify endpoint |
| `hli` | Hair Intelligence Engine |
| `fi_os` | FI OS patient image library |
| `patient_upload` | Generic patient-origin uploads |
| `consultation_os` | Consultation OS workflows |
| `surgery_os` | Surgery OS workflows |
| `manual_upload` | Staff manual uploads |
| `unknown` | Unclassified origin |

IM-1 values (`iiohr`, `external`) remain valid for backward compatibility.

---

## Upload Surfaces

`ImagingOsImageIngestionRequest.upload_surface` includes IM-2 surfaces (`patient_portal`, `clinic_console`, `internal_api`, `case_gallery`, `consultation_form`, `surgery_workflow`, `audit_upload`) plus IM-1 surfaces (`hairaudit_case_upload`, `fi_patient_profile`, etc.).

---

## Pipeline Shape

```typescript
runImagingOsIngestionPipeline(request: ImagingOsImageIngestionRequest)
```

Returns:

```typescript
{
  intake: ImagingOsNormalizedImageIntake;   // metadata_version: "imaging-intake.v2"
  quality: ImageQualityResult;            // stub: not_evaluated
  protocol: ImageProtocolEvaluation;      // stub: not_evaluated (single image)
  classification: ImageClassificationResult; // stub: dry_run
  pipeline_version: "imaging-os-ingestion-v1";
  status: "dry_run" | "not_processable";
}
```

When `intake.is_processable === false`:

- Intake is still returned with warnings
- Quality remains `not_evaluated`
- Classification remains stub-compatible (`dry_run`)
- Status is `"not_processable"`

---

## Adapter Strategy

Adapters are **pure mappers** — no I/O:

```
┌─────────────────────┐     buildXxxIngestionRequest()     ┌──────────────────────────────┐
│ Source system       │ ─────────────────────────────────► │ ImagingOsImageIngestionRequest│
│ (HairAudit, HLI,    │                                    └──────────────┬───────────────┘
│  FI OS patient, …)  │                                                   │
└─────────────────────┘                                                   ▼
                                                          runImagingOsIngestionPipeline()
```

| Adapter | Function | `source_system` | Default `upload_surface` |
|---------|----------|-----------------|--------------------------|
| FI OS patient | `buildFiOsPatientImageIngestionRequest()` | `fi_os` | `case_gallery` |
| HLI | `buildHliImageIngestionRequest()` | `hli` | `patient_portal` |
| HairAudit (inline) | `buildHairAuditIngestionRequest()` | `hairaudit` | `audit_upload` |

Future phases wire upload routes and workers through these adapters without changing the core pipeline.

---

## HairAudit Compatibility

The HairAudit internal endpoint (`POST /api/internal/hairaudit/image-classify`) **response contract is unchanged**:

```typescript
{
  category: string;
  canonical_photo_category: string;
  confidence: number;
  quality_status: string;
  protocol_status: string;
  classifier_version: string;  // still "fi-os-stub-v1"
  notes: string;
}
```

`buildStubClassificationResponse()` now calls `runImagingOsIngestionPipeline()` internally via `buildHairAuditIngestionRequest()`. External clients and `fiOsImageClassifierClient.parseFiOsClassifierResponseBody` require no changes.

---

## Recommended IM-3: Protocol Completeness Engine

Extend `evaluateImageProtocol()` to accept a **case-level category set** from normalized intakes:

- Aggregate `canonical_photo_category` across all images in a case/session
- Compare against protocol template required slots (FI OS `fi_imaging_protocol_templates`, HLI Stage 8B slots)
- Return `compliant` / `deviation` / `non_compliant` with missing/duplicate/low-quality categories
- Wire guided capture and HairAudit audit flows to surface protocol gaps

---

## Recommended IM-4: Storage / Signed URL Orchestration and Quality Heuristics

- Resolve `storage_bucket` + `storage_path` to signed URLs (server-side only, outside pure pipeline)
- Optional lightweight heuristics: MIME validation, min resolution, file size bands
- Pixel-level quality scoring (blur, lighting, angle) via Sharp or dedicated CV service
- Persist `ImagingOsNormalizedImageIntake` + pipeline snapshot to `hli_image_classifications` or a dedicated ledger
- Digital Twin attachment: link normalized intakes to `fi_media_assets` / Patient Twin rollup

---

## Testing

```bash
npm run test:imaging-os-im1   # IM-1 regression
npm run test:imaging-os-im2   # IM-2 universal ingestion
npm run test:upload-phase3f   # HairAudit endpoint integration
npm run build
```

Tests live in `tests/imagingOsPhaseIm2.test.ts`.

---

## Folder Distinction

| Path | Role |
|------|------|
| `src/lib/imaging-os/` | Shared intelligence engine (IM-1 + IM-2) — **this phase** |
| `src/lib/imagingOs/` | Existing ImagingOS UI/server layer — **unchanged in IM-2** |

Do not conflate or rename these folders until a dedicated consolidation phase.
