# ImagingOS Phase IM-1 — Foundation Audit

**Date:** 2026-06-17  
**Scope:** Read-only audit of existing FI OS imaging / classification code before IM-1 foundation modules  
**Repository:** Follicle Intelligence (FI OS)

---

## Executive Summary

FI OS already has **three parallel imaging stacks** that IM-1 begins to unify:

| Layer | Location | Role |
|-------|----------|------|
| **Patient image storage** | `fi_patient_images`, upload API routes | Tenant-scoped clinical photo library |
| **ImagingOS UI/server (legacy path)** | `src/lib/imagingOs/*` | Guided protocol capture, scalp maps, annotations |
| **Hair Intelligence Engine (HLI)** | `src/lib/hair-intelligence/imageClassification/*` | OpenAI-backed classification + `hli_image_classifications` ledger |
| **HairAudit internal endpoint** | `POST /api/internal/hairaudit/image-classify` | External client stub/live classify (Phase 3F) |

Phase IM-1 adds **`src/lib/imaging-os/`** — pure contracts and stub evaluators — and wires the HairAudit stub path through it without schema changes, AI calls, or UI changes.

---

## Existing Image-Related Tables

| Table | Migration | Purpose |
|-------|-----------|---------|
| `fi_patient_images` | `20260613120001`, extended `20260624130001` | Primary FI OS patient photo metadata + ImagingOS axis/region/protocol fields + Stage 8A AI columns |
| `fi_imaging_protocol_templates` | `20260624130001_fi_imaging_os.sql` | Seeded protocol slot definitions (slug, slots JSON) |
| `fi_imaging_protocol_sessions` | same | Per-patient guided capture session progress |
| `fi_imaging_scalp_maps` | same | Interactive scalp map documents |
| `fi_imaging_image_region_links` | same | Links images to scalp map regions |
| `fi_imaging_annotation_sets` | same | Vector overlays (arrows, measurements) per image |
| `fi_imaging_ai_analysis_jobs` | same | Async AI analysis job queue |
| `hli_image_classifications` | `20260729120001_fi_os_stage8a_hli_ai_image_classification.sql` | Multi-product classification ledger (FI OS, HairAudit, Hair Longevity) |
| `fi_uploads` | earlier FI migrations | Case-level generic uploads (blood PDFs, legacy photos) — separate from patient library |
| `fi_media_assets` | foundation media | Unified media rollup source for Patient Twin |
| HLI photo protocol tables | `20260731120001_fi_os_stage8b_hli_photo_protocol.sql` | Protocol templates, slots, compliance analytics |

**View:** `v_fi_media_unified` unions `fi_uploads`, `fi_media_assets`, and active `fi_patient_images`.

---

## Existing Image Upload Routes

| Route | Module | Notes |
|-------|--------|-------|
| `POST /api/tenants/[tenantId]/patients/[patientId]/images` | `app/api/tenants/.../images/route.ts` | Primary FI OS patient image upload |
| `POST /api/tenants/[tenantId]/patient-directory/[patientId]/images` | patient-directory variant | CRM directory upload path |
| `PATCH .../images/[imageId]` | edit metadata | Category, caption, taken_at |
| `POST .../images/[imageId]/archive` | archive flow | Soft archive |
| `POST /api/tenants/[tenantId]/cases/[caseId]/uploads` | case uploads | `fi_uploads` + storage |
| `POST /api/fi/uploads` | legacy FI upload | Case-scoped |
| `POST /api/internal/hairaudit/image-classify` | HairAudit classify | **Internal only** — no upload, classification receive |

Server logic: `src/lib/patientImages/patientImagesServer.ts`, `patientImagePaths.ts`, `patientImagePolicy.ts`.

---

## Existing Clinical Image Logic

### FI OS patient images (`src/lib/patientImages/`)

- Manual categories: `consult`, `scalp`, `donor`, `hairline`, `trichoscopy`, `post_op`, `progress`, `before`, `after`, `other`
- ImagingOS metadata: `imaging_library_axis`, `anatomical_region`, protocol template/slot slugs
- Stage 8A AI review fields on row: `ai_image_category`, confidence, hair/shave/surgery stage, review status

### ImagingOS guided capture (`src/lib/imagingOs/`)

- `imagingOsConstants.ts` — library axes, anatomical regions, AI analysis kinds
- `imagingOsProtocol.ts` — slot parsing, progress, required completion helpers
- `imagingOsGuidedCapture.server.ts` — session CRUD against `fi_imaging_protocol_sessions`
- `imagingOsLoad.server.ts` / `imagingOsMutations.server.ts` — patient payload, annotations, scalp maps

### HLI photo protocols (`src/lib/hair-intelligence/photoProtocols/`)

- Stage 8B compliance engine using `ai_image_category` on patient images
- Slot matching via `protocolSlotMatching.ts` against HLI `FI_AI_IMAGE_CATEGORIES`

---

## Existing AI / Image Classification Logic

| Module | AI? | Notes |
|--------|-----|-------|
| `hair-intelligence/imageClassification/openAiHairImageClassifier.server.ts` | **Yes (OpenAI)** | Production classifier for FI OS patient images |
| `hair-intelligence/imageClassification/classifyClinicalHairImage.server.ts` | Wraps OpenAI | Signed URL → model |
| `hair-intelligence/imageClassification/adapters/*` | Per product | FI OS, HairAudit, Hair Longevity persistence adapters |
| `hairaudit/classifyClinicalHairImageFromModelUrl.ts` | **No (placeholder)** | Phase 3F hook — returns null until wired to ImagingOS live pipeline |
| `hairaudit/fiOsHairAuditImageClassifyService.ts` | Stub via ImagingOS IM-1 | HairAudit HTTP contract |
| `imaging/aiImageClassifier.server.ts` | Re-export | Points at HLI classifier |
| `imaging/fiImageAiReviewValidation.ts` | No | Staff review validation for AI fields |

**HLI categories** (`FI_AI_IMAGE_CATEGORIES`): `front`, `left_profile`, `right_profile`, `top`, `crown`, `donor`, `graft_tray`, `immediate_post_op`, `follow_up`, `microscopic`, `unknown`.

**ImagingOS canonical categories (IM-1)** supersede HLI naming for cross-product contracts: adds `left`/`right`, `recipient`, `hairline`, `temporal`, `vertex`, `other`; maps HLI aliases.

---

## Reusable Pieces

- **`fi_patient_images`** row shape and upload pipeline — primary FI OS intake surface
- **`imagingOsProtocol.ts`** slot/progress pure helpers — protocol evaluation (IM-3)
- **`imagingOsConstants.ts`** anatomical region vocabulary — maps to canonical categories
- **HLI classification adapters** — persistence patterns for `hli_image_classifications`
- **HairAudit Phase 3F endpoint + auth** — external client wire-up complete
- **`mapExternalCategoryToCanonical`** (IM-1) — central alias table for HairAudit + HLI + manual categories

---

## Missing Pieces (pre–IM-1)

| Gap | IM phase target |
|-----|-----------------|
| Unified cross-product category contract | **IM-1** ✅ |
| Shared intake / quality / protocol / classification result types | **IM-1** ✅ |
| Pixel-level quality scoring | IM-2 |
| Storage fetch + signed URL orchestration inside ImagingOS | IM-2 |
| Live AI classifier wired through ImagingOS (not direct OpenAI from HairAudit path) | IM-3 |
| Case-level protocol evaluation for HairAudit uploads | IM-3 |
| Persistence ledger for ImagingOS analysis snapshots | IM-4 |
| HairAudit repo migration to consume canonical categories only | IM-5 |

---

## Risks

1. **Category taxonomy drift** — HLI `FI_AI_IMAGE_CATEGORIES`, FI manual `PatientImageCategory`, HairAudit `patient_current_*` labels, and ImagingOS canonical categories coexist. IM-1 maps externally; IM-3+ should converge writes.
2. **Dual ImagingOS folders** — `src/lib/imagingOs/` (UI/server) vs `src/lib/imaging-os/` (shared engine). Naming is intentional short-term; document imports carefully.
3. **OpenAI path bypasses ImagingOS** — FI OS patient classify still calls HLI directly until IM-3 rewires adapters.
4. **Migration version skew** — `fi_imaging_os` remote timestamp mismatch documented in runbooks; no new migrations in IM-1.
5. **Stub vs live HairAudit response** — `canonical_photo_category` now returns ImagingOS canonical (`front`) while `category` retains HairAudit external label (`patient_current_front`).

---

## Recommended Architecture (IM-1 → IM-5)

```
External clients (HairAudit, HLI, IIOHR)
        │
        ▼
┌───────────────────────────────────────┐
│  ImagingOS intake contract (IM-1)     │
│  src/lib/imaging-os/intake.ts         │
└───────────────────────────────────────┘
        │
        ├──► quality (IM-1 stub → IM-2 heuristics)
        ├──► protocol (IM-1 pure → IM-3 case sets)
        └──► classification (IM-1 stub → IM-3 live model)
                    │
                    ▼
        HairAudit / FI OS / HLI adapters
                    │
                    ▼
        hli_image_classifications + fi_patient_images AI columns
```

**IM-1 deliverables:** pure modules under `src/lib/imaging-os/`, HairAudit stub wired, docs + tests, no schema/UI/AI changes.

See also: [imaging-os-architecture.md](./imaging-os-architecture.md).
