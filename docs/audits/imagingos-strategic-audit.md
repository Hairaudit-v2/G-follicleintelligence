# ImagingOS Strategic Audit

**Date:** 2026-07-01  
**Scope:** Read-only audit of image/photo infrastructure across Follicle Intelligence, HairAudit integration, SurgeryOS, PatientOS, ConsultationOS, HLI, and VIE.  
**Repository:** `G:\follicleintelligence`  
**Constraint:** No schema changes, no redesign — audit and roadmap only.

---

## Executive Summary

Follicle Intelligence has **substantial imaging infrastructure** — more than a typical clinic SaaS — but it is **fragmented across parallel stacks** rather than unified under a single ImagingOS execution path.

| Stack | Maturity | Role |
|-------|----------|------|
| **FI OS patient image library** (`fi_patient_images`) | Production | Canonical tenant-scoped clinical photos |
| **ImagingOS guided capture** (`src/lib/imagingOs/`) | Production (staff) | Protocol sessions, scalp maps, annotations |
| **VIE (Visual Intelligence Engine)** | Partial–production | Protocol catalog, capture wizard, quality review, comparison pairs |
| **HLI photo protocols** (Stage 8B/8D) | Production | Smart clinical photography compliance + alerts |
| **HLI AI classification** (Stage 8A, 9A–9D) | Production (FI OS) | OpenAI vision: view, hair loss, donor, recipient |
| **ImagingOS contracts** (`src/lib/imaging-os/`) | Stub/contracts | Cross-product intake, metadata quality, stub classify |
| **HairAudit ingest** | Partial | Event ingest → `fi_uploads`; live classifier **503/unwired** |
| **Legacy case uploads** (`fi_uploads` / `fi-intakes`) | Legacy | HairAudit + old scalp/donor typed uploads |

### Audit score: **6.5 / 10** — Imaging readiness

**Rationale:** Strong data model, protocol UX, and FI OS AI classification exist. Gaps block audit-grade consistency, patient self-capture, unified longitudinal analytics, and predictive surgery modelling. Platform can support **guided staff capture** and **manual longitudinal comparison** today; cannot yet support **reliable AI-assisted best-image capture at scale** or **predictive outcome simulation** without Phase 1–4 consolidation.

---

## Current Architecture

FI OS runs **three ingestion surfaces** and **two AI paths**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INGESTION SURFACES                               │
├─────────────────────┬──────────────────────┬──────────────────────────┤
│ fi_patient_images   │ fi_uploads           │ HairAudit events         │
│ patient-images      │ fi-intakes           │ (external product)       │
│ bucket              │ bucket               │ → fi_uploads + media     │
└─────────┬───────────┴──────────┬───────────┴────────────┬─────────────┘
          │                      │                        │
          ▼                      ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ POST /api/tenants/.../patients/.../images  (canonical staff upload)      │
│ VIE / ImagingOS guided wizards             (protocol-enforced)         │
│ POST /api/fi/events (hairaudit.images.uploaded)                          │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Post-capture pipeline (sync)                                             │
│ quality (metadata) → optional block → OpenAI classify → watermark        │
│ protocol slot update → timeline/analytics events                         │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ├─► HLI path: OpenAI vision → fi_patient_images AI cols + hli ledger
          └─► ImagingOS path: stub quality/protocol/classify (HairAudit HTTP)
```

**Parallel protocol systems (not unified):**

1. **VIE catalog** — `src/lib/vie/vieProtocolCatalog.ts` (baseline, surgery_day, follow_up, etc.)
2. **ImagingOS DB templates** — `fi_imaging_protocol_templates` + `fi_imaging_protocol_sessions`
3. **HLI photo protocols** — `hli_photo_protocol_*` tables + Patient Twin attach flow

**Product touchpoints:**

| Product | Upload | Display | AI |
|---------|--------|---------|-----|
| **PatientOS** | Protocol wizards; generic upload disabled in UI | Gallery, progress compare, completeness | Auto-classify on capture (FI OS) |
| **ImagingOS** | `ImagingGuidedCaptureWizard` | Workspace: gallery, timeline, compare, scalp map | Job queue table exists; live AI gated |
| **SurgeryOS** | `VieCaptureWizard` via `surgery_day` template + `procedure_day_id` | Evidence panel on dashboard | Same post-capture pipeline |
| **HairAudit** | External → FI events ingest | Classify endpoint only; no FI upload UI | Stub OK; live returns 503 |
| **ConsultationOS** | None (SVG wireframe assessment only) | Visual assessment diagrams | Indirect via patient images |
| **Patient portal** | **Not implemented** | Sign-in/meds only | — |

---

## Database and Storage Map

### Storage buckets

| Bucket | Visibility | MIME / limit | Primary use |
|--------|------------|--------------|-------------|
| **`patient-images`** | Private | JPEG/PNG/WebP/HEIC; 20 MB (migration) | `fi_patient_images`, consent PDFs, pathology |
| **`fi-intakes`** | Private (manual setup) | Legacy scalp uploads: JPEG/PNG, 10 MB | `fi_uploads` case files |
| **`case-files`** | — | HairAudit tests only | External HairAudit product (not FI migration) |

**Object-level RLS:** Not defined in migrations. Access via **service role + signed URLs** (application layer).

### Core tables

#### `fi_patient_images` — canonical clinical photo metadata

**Migration:** `20260613120001_fi_patient_images.sql` (+ extensions)

| Field group | Fields | Structured clinical context? |
|-------------|--------|---------------------------|
| Identity | `tenant_id`, `patient_id`, optional `person_id`, `case_id`, `booking_id`, `lead_id`, `consultation_id` | Yes — multi-anchor |
| Category | `image_category`: consult, scalp, donor, hairline, trichoscopy, post_op, progress, **before**, **after**, other | Partial — manual + AI |
| ImagingOS | `imaging_library_axis`, `anatomical_region`, `visit_type`, `follow_up_interval`, `imaging_protocol_template_slug`, `imaging_protocol_slot_slug`, `clinic_id`, `captured_by_staff_id`, `device_type` | **Yes** |
| AI (Stage 8A) | `ai_image_category`, confidence, hair/shave/surgery stage, review status, classifier version | **Yes** |
| Storage | `storage_bucket`, `storage_path`, `content_type`, `file_size_bytes`, `metadata` JSON | Yes |

**View types stored today:**

| Mechanism | Views supported |
|-----------|-----------------|
| `image_category` / `anatomical_region` | front-like via consult/scalp/hairline; donor; crown; post_op; before/after |
| HLI `ai_image_category` | front, left/right profile, top, crown, donor, graft_tray, immediate_post_op, follow_up, microscopic |
| ImagingOS canonical (IM-1) | front, top, crown, left, right, donor, recipient, hairline, temporal, vertex, graft_tray, immediate_post_op, follow_up, microscopic |
| Legacy `fi_uploads.type` | scalp_preop_front, scalp_sides_left/right, scalp_crown, donor_rear, postop_day0 |

**Session types stored today:**

| Field | Values |
|-------|--------|
| `visit_type` / protocol template slug | baseline consultation, surgery_day, post_op_review, follow_up_review, trichoscopy, hair_transplant_planning |
| `follow_up_interval` | ImagingOS field — supports interval tagging |
| HLI `clinical_context` on protocol templates | consultation, surgery_pre_op, hairaudit_case, follow_up, etc. |

**Not stored (or metadata-only hints):**

| Capability | Status |
|------------|--------|
| Image quality score (pixel) | Metadata hints only (`blur_score`, `lighting_score` in JSON); no CV pipeline |
| Classification confidence | Yes on `fi_patient_images` + `hli_image_classifications` |
| Protocol version | Template slug; no explicit version semver on row |
| Device/capture metadata | `device_type`, width/height via post-capture; limited EXIF |
| Lighting/blur/framing indicators | Evaluated from metadata in `imaging-os/quality.ts`; not from pixels |
| AI analysis output (density, Norwood) | Separate HIE tables; ImagingOS `fi_imaging_ai_analysis_jobs` queue |

#### `fi_uploads` — legacy case uploads

Typed scalp/donor/postop enums. **No patient_id**. HairAudit ingest lands here.

#### `fi_media_assets` — foundation normalized media

Dedup via `source_system` + `source_asset_id`. Bridges HairAudit → unified view.

#### `v_fi_media_unified` — compat view

Unions `fi_uploads`, `fi_media_assets`, active `fi_patient_images`.

### ImagingOS tables (`20260624130001_fi_imaging_os.sql`)

| Table | Purpose |
|-------|---------|
| `fi_imaging_protocol_templates` | Slot JSON definitions (global + tenant) |
| `fi_imaging_protocol_sessions` | Per-patient slot progress |
| `fi_imaging_scalp_maps` | Scalp wireframe state |
| `fi_imaging_image_region_links` | Image ↔ anatomical region |
| `fi_imaging_annotation_sets` | Vector overlays (1 per image) |
| `fi_imaging_ai_analysis_jobs` | AI job queue (`density_estimate`, `norwood_grade`, `donor_assessment`, `outcome_score`) |

### HLI photo protocol (Stage 8B/8D)

| Table | Purpose |
|-------|---------|
| `hli_photo_protocol_templates` / `_slots` | Required views per clinical context |
| `hli_photo_protocol_sessions` / `_session_slots` | Slot status: missing, captured, accepted, needs_retake |
| `hli_photo_protocol_alert_events` | missing_required_images, needs_retake, hairaudit_not_ready |

### HLI / HIE classification chain

| Table | Links |
|-------|-------|
| `hli_image_classifications` | Ledger: `source_system`, `source_record_id`, storage path, category, confidence |
| `hair_intelligence_hair_loss_classifications` | Norwood/Ludwig via `image_classification_id` |
| `hair_intelligence_donor_assessments` | Donor region, quality, capacity |
| `hair_intelligence_recipient_candidacy_reviews` | Recipient assessment |

### VIE longitudinal (`20260926130001` – `20260926170001`)

| Table | Purpose |
|-------|---------|
| `fi_vie_capture_intelligence` | Per-capture quality/acceptance/retake |
| `fi_vie_comparison_pairs` | **before_image_id** + **after_image_id**; domains: baseline_vs_follow_up, pre_op_vs_post_op, donor_before_vs_after_extraction |
| `fi_vie_alignment_results` | Same-angle alignment metadata |
| `fi_vie_outcome_summaries` | Outcome rollup; `audit_ready` flag |

### Surgery / journey links

| Table | Image relationship |
|-------|-------------------|
| `fi_case_follow_ups` | `linked_image_ids` JSON array → `fi_patient_images.id` |
| `fi_case_post_op_tracking` | Notes only (donor/recipient recovery); no image FK |
| VieCaptureWizard | Injects `procedure_day_id`, `case_id`, `booking_id` into upload metadata |

**Missing for predictive modelling:** No FK from images to graft counts, punch size, implantation method, complication events, or staff team assignments beyond optional `captured_by_staff_id` and surgery metadata JSON.

### RLS summary

- **Pattern:** Authenticated tenant members get **SELECT** on media tables; **writes via service_role** only.
- **Exceptions:** HLI protocol templates/slots readable by all authenticated; alert events have clinical intelligence gate.
- **Storage objects:** No bucket object policies in repo — relies on signed URLs + server-side auth.
- **Risk:** `fi_case_follow_ups` / post-op tracking lack RLS in migrations (service-role assumed).

---

## Upload Flow Map

| Entry point | Actor | Enforcement | Resumable | Quality gate |
|-------------|-------|-------------|-----------|--------------|
| `POST .../patients/[patientId]/images` | Staff (+ adminKey) | MIME 20MB; category; protocol if `capture_source` set | No | Metadata quality; optional tenant `block_upload_on_poor_quality` |
| `VieCaptureWizard` | Staff | VIE protocol session + slot; surgery_os requires session | No | VIE instant intelligence + accept/retake |
| `ImagingGuidedCaptureWizard` | Staff | ImagingOS DB session + slots; camera/library | No (30s timeout) | Same post-capture pipeline |
| `StartCaptureProtocolButton` | Staff | Launches VIE wizard | No | Protocol-first |
| `SurgeryOsCaptureEvidenceButton` | Staff | `surgery_day` VIE session | No | Same |
| `AppointmentProcedurePhotosPanel` | Staff | **Bypass:** no `capture_source` → skips protocol enforcement | No | Category dropdown only |
| `PatientImageUploadForm` | Staff | **Disabled** — redirects to protocol capture | — | — |
| `POST /api/fi/uploads` | Legacy API | Typed scalp/donor enums; 10MB JPEG/PNG | No | Minimal |
| HairAudit `hairaudit.images.uploaded` | External event | Maps view → `fi_uploads` type | Unknown | None at ingest |
| Patient portal | Patient | **Not implemented** | — | — |
| ConsultationOS | — | No upload | — | — |
| Patient Twin photo protocol | Staff | Attach **existing** images to slots | — | Slot accept/retake |

### Protocol / view enforcement

**Strong (when used):** VIE and ImagingOS wizards enforce slot order, instructions, framing guides, optional vs required tiers, skip for optional slots.

**Weak:** Appointment direct upload; legacy `fi_uploads`; HairAudit ingest (type mapping only, no quality).

### Patient-facing copy

Guided wizards include per-slot `instruction`, `capture_guide`, framing/distance hints (`vieProtocolCatalog.ts`). No patient self-service upload copy exists.

---

## AI Image Intelligence Status

### Implemented

| Capability | Path | Notes |
|------------|------|-------|
| View classification | HLI OpenAI (`openAiHairImageClassifier.server.ts`) | 11 categories; auto on FI OS capture |
| Hair loss classification | HIE Stage 9A | Manual action; Norwood/Ludwig |
| Donor assessment | HIE Stage 9C | Manual action; region + capacity bands |
| Recipient candidacy | HIE Stage 9D | Manual action; longitudinal context |
| Metadata quality scoring | `imaging-os/quality.ts` + `fiImageAttributionCore.ts` | 0–100 score; blockers; category rules |
| Staff AI review | `fi-image-ai-actions.ts` | Review status write-back |
| Classification ledger | `hli_image_classifications` | Multi-product append-only |
| HairAudit classify HTTP (stub) | `image-classify/route.ts` | Deterministic stub via ImagingOS pipeline |

### Partial

| Capability | Gap |
|------------|-----|
| Blur detection | Consumes `blur_score` metadata hint only; no pixel algorithm |
| Exposure / lighting | Metadata hints + VIE heuristics; no CV |
| Angle/framing | `angle_deviation_degrees` hint; guide overlay in UI |
| Scalp region detection | Classification includes donor/crown/etc.; no segmentation mask |
| Before/after comparison | `fi_vie_comparison_pairs` + `PatientProgressCompare` UI; not auto-paired at scale |
| Outcome progression | IM-5–IM-7 contracts + tests; limited production UI wiring |
| ImagingOS live AI | IM-12 stub provider; OpenAI/Anthropic throw "not implemented" |
| HairAudit live classifier | `classifyClinicalHairImageFromModelUrl` returns null → **503** |
| Async AI jobs | `fi_imaging_ai_analysis_jobs` table exists; no worker/cron |
| Photo protocol alerts | Delivery gate stubbed (`protocolAlertDelivery.ts`) |

### Missing

| Capability | Notes |
|------------|-------|
| Pixel-level blur/sharpness (Laplacian, etc.) | No implementation |
| Duplicate photo detection | Not found |
| Predictive surgery simulation | No model, features, or UI |
| Patient self-capture AI coaching | No patient upload path |
| Replicate / secondary vision provider | Not integrated |
| FI legacy `image_extract` pipeline stage | Explicitly NOT IMPLEMENTED |
| HairAudit classification DB write-back | Adapter exists; tables not wired |
| Cross-tenant global imaging analytics | Documented IM-5 only |

---

## Patient Journey / Longitudinal Tracking

### Current capability

| Comparison | Supported? | Mechanism |
|------------|------------|-----------|
| Baseline vs pre-surgery | Partial | Manual categories + protocol templates; VIE comparison domain `pre_op_vs_post_op` |
| Pre-surgery vs immediate post-op | Partial | `surgery_day` protocol phases; comparison pairs schema |
| Post-op vs 3/6/12 month | Partial | `follow_up_interval` field + follow_up_review protocol; not auto-scheduled |
| Donor recovery over time | Partial | `donor_before_vs_after_extraction` comparison domain; manual pairing |
| Recipient growth over time | Partial | HIE recipient reviews + progress category images |
| Auto longitudinal pairing | **No** | Suggestions exist (`VieComparisonSuggestionsPanel`); not fully automated |

### Gaps

- No unified **timeline axis** tying all images to `{session_type, interval_months, protocol_version}` on every row.
- HairAudit images in `fi_uploads` are **not** in `fi_patient_images` unless dual-written — breaks single-patient journey view.
- Patient portal cannot contribute follow-up photos.
- `fi_case_follow_ups.linked_image_ids` is manual JSON, not protocol-driven.

---

## SurgeryOS / Predictive Modelling Readiness

### What links today

| Surgery data | Image link |
|--------------|------------|
| `case_id` | Optional on `fi_patient_images` |
| `booking_id` / `procedure_day_id` | Injected via VieCaptureWizard metadata |
| `surgery_day` protocol | Pre-op / intra-op / post-op slot phases |
| `captured_by_staff_id` | Staff attribution on image row |
| Graft counts / punch / method | **Not linked** to images |
| Complications / medications | Case tracking tables; no image FK |
| Donor/recipient zones | `anatomical_region` + scalp maps; not surgery-stage granular |

### Predictive surgery simulation readiness: **Low (2/10)**

**Available foundations:** classified views, donor/recipient AI assessments, comparison pair schema, outcome summary table, graft analytics events elsewhere in platform.

**Missing for modelling:** labelled outcome dataset pipeline, feature store linking `{pre_op_images, surgery_parameters, staff, follow_up_images, outcome_score}`, train/validate governance, and guarded patient-facing simulation UI. Architecture docs (IM-9–IM-12) define contracts and tests but not production models.

---

## UI/UX Findings

### Strengths

- **Protocol-first capture** with slot checklists, on-screen framing guides (`VieCaptureGuideOverlay`), camera vs library choice.
- **ImagingOS workspace** — gallery, timeline, compare (side/overlay), scalp map, annotations.
- **PatientProgressCompare** — before/after slider overlay.
- **Quality retake loop** — VIE accept/retake panel; server 400 on poor quality when blocking enabled.
- **Signed URL tiles** — private bucket handled correctly in grids.
- **Patient Twin** — imaging completeness KPIs, sectioned gallery, protocol attach flow.
- **Mobile capture actions** — `PatientPhotoCaptureActions` with 44px touch targets.

### Weaknesses

- **Three protocol systems** confuse operators (VIE vs ImagingOS DB vs HLI photo protocol).
- **Generic upload disabled** but appointment panel still allows protocol bypass.
- **CaseImagesCard** — metadata list without inline previews.
- **No zoom/lightbox** called out as first-class component in audit paths (may exist in tiles — limited).
- **HairAudit** — no in-FI upload/review UI for audit photos.
- **Missing images** — completeness summaries exist; empty states vary by surface.
- **AI confidence** — visible in Twin/admin cards; not uniform on all galleries.
- **Patient portal** — no self-upload journey.

---

## Security Findings

| Control | Status | Notes |
|---------|--------|-------|
| Bucket privacy | ✅ | `patient-images` private |
| Signed URLs | ✅ | Time-limited for display |
| Tenant isolation | ✅ | RLS SELECT by tenant membership on core tables |
| Patient access boundaries | ⚠️ | Portal has no image access/upload yet; staff-only capture |
| Admin/staff permissions | ✅ | `assertCrmTenantWriteAllowed`; imaging_os module entitlement (SA1) |
| Service-role writes | ✅ | All mutations via server; no authenticated INSERT on images |
| Storage path leakage | ✅ | Paths not exposed in public routes; signed URLs only |
| Archive handling | ✅ | Soft archive on `fi_patient_images` |
| Audit logging | Partial | Analytics events (`publishImagingEvent`); no dedicated image access audit table |
| HairAudit classify endpoint | ✅ | Bearer token (`HAIRAUDIT_IMAGE_CLASSIFIER_TOKEN`) |
| Cross-product ingest | ⚠️ | HairAudit events trusted at API boundary — validate event auth |

**Risks:** No storage object RLS in migrations; appointment upload bypass weakens protocol guarantees; `fi_case_follow_ups` RLS gap.

---

## Gap Matrix

| Capability | Current Status | Risk | Priority |
| ---------- | -------------- | ---- | -------- |
| Structured photo protocols | **Partial** — 3 parallel systems | Operator confusion; incomplete sessions | P0 |
| AI image quality scoring | **Partial** — metadata only | Poor clinical photos accepted | P0 |
| Guided patient upload | **Missing** — staff-only | No remote follow-up capture | P1 |
| View classification | **Implemented** (FI OS OpenAI) | HairAudit live path unwired | P0 |
| Clinical image tagging | **Partial** — category + AI + protocol slots | Inconsistent across ingest paths | P1 |
| Longitudinal comparison | **Partial** — schema + some UI | Manual pairing; split storage | P1 |
| Donor recovery tracking | **Partial** — HIE 9C + comparison domain | Not automated longitudinally | P2 |
| Recipient growth tracking | **Partial** — HIE 9D + progress category | No interval automation | P2 |
| Before/after comparison | **Partial** — `PatientProgressCompare`, VIE pairs | Not workflow-integrated everywhere | P1 |
| Predictive surgery simulation readiness | **Missing** | Future revenue/clinical claim risk if rushed | P3 |
| Storage security | **Implemented** (app-layer) | No object RLS in migrations | P2 |
| Tenant isolation | **Implemented** | — | — |
| Audit logging | **Partial** | Forensics gap for image access | P2 |
| HairAudit ↔ FI OS unify | **Partial** — ingest to legacy table | Broken patient journey | P0 |
| Pixel blur/lighting detection | **Missing** | Retake guidance unreliable | P1 |
| Async AI job processing | **Missing** — table only | Timeouts on heavy workloads | P2 |
| Patient portal imaging | **Missing** | Follow-up gap | P1 |

---

## Recommended Roadmap

### Phase 1 — ImagingOS Foundation (audit-driven fixes only)

**Goal:** Single source of truth for clinical photos without breaking HairAudit or FI OS flows.

1. **Unify ingest path** — HairAudit `hairaudit.images.uploaded` dual-write (or migrate) to `fi_patient_images` + retain `fi_uploads` compat view.
2. **Protocol consolidation plan** — Map VIE catalog ↔ ImagingOS DB templates ↔ HLI photo protocols; one operator-facing entry point.
3. **Close upload bypass** — Require `capture_source` + protocol on `AppointmentProcedurePhotosPanel`.
4. **Wire HairAudit live classifier** — Connect `classifyClinicalHairImageFromModelUrl` to HLI OpenAI path (behind feature flag).
5. **Diagnostics dashboard** — Surface `hli_photo_protocol_alert_events` + imaging completeness on HR/command centre.
6. **Document canonical session taxonomy** — `{session_type, interval, view, protocol_version}` on every new upload.

### Phase 2 — AI Image Quality Engine

1. Client-side capture hints (blur, exposure, framing) → metadata JSON.
2. Server-side sharpness heuristic (optional lightweight CV).
3. Duplicate detection (perceptual hash within session).
4. Retake prompts integrated into VIE + ImagingOS wizards.
5. Tenant policy: default `block_upload_on_poor_quality` for audit contexts.

### Phase 3 — Clinical Image Intelligence

1. Wire ImagingOS IM-12 live provider to HLI OpenAI (single orchestration point).
2. Async worker for `fi_imaging_ai_analysis_jobs` + batch classification retries.
3. Auto-run donor/recipient assessment when classified view matches.
4. Scalp region links enforced on donor/recipient slots.
5. Staff review queue for low-confidence classifications.

### Phase 4 — Longitudinal Outcome Intelligence

1. Auto-suggest comparison pairs from `{patient, view, session_type, interval}`.
2. Unified patient imaging timeline (merge `fi_uploads` into unified view).
3. Donor/recipient recovery tracks with interval reminders.
4. Outcome summaries populated from VIE measurement contracts (IM-7–IM-9).
5. Patient portal guided follow-up upload (Phase 1 portal imaging).

### Phase 5 — Predictive Surgery Simulation

1. Feature store: `{pre_op_imaging_set, surgery_parameters, staff, intervals, outcome_labels}`.
2. Governance: no patient-facing simulation without clinician review flag.
3. Model training pipeline (offline); display as "illustrative" until validated.
4. Link to SurgeryOS graft integrity + procedure staffing data.
5. Audit trail for simulation views shown to patients.

---

## Files Reviewed

### Migrations / schema
- `supabase/migrations/20260613120001_fi_patient_images.sql`
- `supabase/migrations/20260624130001_fi_imaging_os.sql`
- `supabase/migrations/20260729120001_fi_os_stage8a_hli_ai_image_classification.sql`
- `supabase/migrations/20260731120001_fi_os_stage8b_hli_photo_protocol.sql`
- `supabase/migrations/20260801120001_fi_os_stage8d_photo_protocol_alert_events.sql`
- `supabase/migrations/20260812120001_hie_stage9a_hair_loss_classification.sql`
- `supabase/migrations/20260813120002_hie_stage9c_donor_intelligence.sql`
- `supabase/migrations/20260814120001_hie_stage9d_recipient_candidacy_review.sql`
- `supabase/migrations/20260926130001_vie_phase1_foundation.sql` through `20260926170001_vie_phase7_outcome_summaries.sql`
- `supabase/migrations/20250220000006_fi_uploads.sql`

### Upload / API
- `app/api/tenants/[tenantId]/patients/[patientId]/images/route.ts`
- `app/api/fi/uploads/route.ts`
- `app/api/fi/events/route.ts`
- `lib/fi/events/handlers/hairauditImagesUploaded.ts`
- `app/api/internal/hairaudit/image-classify/route.ts`

### Server / pipeline
- `src/lib/patientImages/patientImagesServer.ts`
- `src/lib/patientImages/patientImagePostCapturePipeline.server.ts`
- `src/lib/patientImages/patientImagePolicy.ts`
- `src/lib/patientImages/fiImageAttributionCore.ts`
- `src/lib/imagingOs/imagingOsLoad.server.ts`
- `src/lib/imagingOs/imagingOsGuidedCapture.server.ts`
- `src/lib/imaging-os/pipeline.ts`, `quality.ts`, `classification.ts`, `liveAi.ts`
- `src/lib/vie/vieCapturePolicy.server.ts`
- `src/lib/vie/vieProtocolCatalog.ts`

### AI / classification
- `src/lib/hair-intelligence/imageClassification/openAiHairImageClassifier.server.ts`
- `src/lib/hair-intelligence/imageClassification/adapters/fiOsPatientImageClassification.server.ts`
- `src/lib/hair-intelligence/donorIntelligence/`, `recipientCandidacy/`, `hairLossClassification/`
- `src/lib/hairaudit/fiOsHairAuditImageClassifyService.ts`
- `src/lib/hairaudit/classifyClinicalHairImageFromModelUrl.ts`
- `src/lib/actions/fi-image-ai-actions.ts`

### UI
- `src/components/fi-admin/imaging/ImagingOsWorkspace.tsx`
- `src/components/fi-admin/imaging/ImagingGuidedCaptureWizard.tsx`
- `src/components/fi/vie/VieCaptureWizard.tsx`
- `src/components/fi/patient-images/PatientImageUploadForm.tsx`
- `src/components/fi/patients/progress/PatientProgressCompare.tsx`
- `src/components/fi-admin/surgery-os/SurgeryOsCaptureEvidenceButton.tsx`
- `src/components/fi-admin/patientTwin/PatientTwinPhotoProtocolCard.tsx`

### Docs (prior phases)
- `docs/imaging-os-architecture.md`
- `docs/imaging-os-phase-im1-foundation-audit.md` through `im12-live-ai.md`
- `docs/design/24-imaging-os.md`
- `docs/runbooks/fi-os-stage8b-smart-clinical-photography-protocol.md`

### Tests
- `tests/imagingOsPhaseIm1.test.ts` through `imagingOsPhaseIm12.test.ts`
- `tests/hairauditImageClassifyEndpoint.test.ts`

---

## Implementation Candidates (first practical build tasks)

1. **HairAudit → `fi_patient_images` bridge** in `hairauditImagesUploaded.ts` (additive dual-write).
2. **Fix appointment upload bypass** — add `capture_source` + protocol session requirement.
3. **Wire HairAudit live classifier** to HLI OpenAI behind `HAIRAUDIT_IMAGE_CLASSIFIER_MODE=live`.
4. **Protocol unification spec** — single slug map across VIE / ImagingOS / HLI.
5. **Imaging completeness operator card** — unlinked alerts + missing slot counts per patient.
6. **Client capture metadata** — pass `blur_score` / `lighting_score` from wizard to upload API.
7. **Async job runner** — cron/worker for `fi_imaging_ai_analysis_jobs` (read-only queue processor first).

---

## Constraints observed

- No existing functionality removed.
- No schema changes made in this audit.
- RLS and storage security preserved in recommendations (additive only).
- No speculative AI claims recommended for patient UI.
- HairAudit and FI OS flows preserved via dual-write / compat views.