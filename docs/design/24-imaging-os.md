# ImagingOS — clinical imaging platform (Follicle Intelligence)

**Status:** implemented (database + patient workspace + Patient Twin + API). Iteration expected for canvas editors, pagination at very large counts, and worker consumers for AI jobs.

## 1. Goals

- **Longitudinal record:** every capture is a `fi_patient_images` row scoped by `tenant_id` + `patient_id`, linked optionally to `fi_cases`, `fi_consultations`, bookings, and leads.
- **Patient Digital Twin:** twin loader aggregates active image counts by `imaging_library_axis` and links to `/fi-admin/[tenantId]/patients/[patientId]/imaging`.
- **Scale:** partial indexes on `(tenant_id, patient_id, imaging_library_axis)` and `(tenant_id, patient_id, anatomical_region)` for filter-heavy workloads; `v_fi_media_unified` includes active patient images so foundation media rollups stay coherent at high volume.
- **Audit:** originals remain immutable in private storage; annotations and scalp maps are separate tables; soft-archive still uses `fi_patient_images.image_status`.

## 2. Library axes (`imaging_library_axis`)

`consultation` · `surgery` · `follow_up` · `trichoscopy` · `pathology` · `general_clinical`

Orthogonal to legacy `image_category` (consult, donor, before, …) which stays for backwards compatibility.

## 3. Standard protocols

- Table `fi_imaging_protocol_templates` (global rows with `tenant_id is null`) defines **slots** (slug, label, required, suggested_region).
- Table `fi_imaging_protocol_sessions` tracks **progress** JSON (`slot_slug` → fulfilled `patient_image` id arrays).
- UI completion uses required slots only (`src/lib/imagingOs/imagingOsProtocol.ts`).

Seeded templates: Hair Loss Consultation, Hair Transplant Planning, Surgery Day, Follow-up Review, Trichoscopy Review.

## 4. Scalp mapping & annotations

- **`fi_imaging_scalp_maps`:** JSON document (`state_json`) for wireframe version, highlighted regions, vector paths, and notes. Edited via ImagingOS workspace (JSON MVP; canvas UI later).
- **`fi_imaging_image_region_links`:** optional many-to-many between images and anatomical regions (and optional `scalp_map_id`).
- **`fi_imaging_annotation_sets`:** one active vector layer per image (`unique (tenant_id, patient_image_id)`), schema version `imaging-annotation.v1`, payload `{ elements: [...] }` for arrow / circle / freepath / ruler / text tooling in future UI.

## 5. Compare & capture

- **Compare:** client workspace supports side-by-side and overlay slider; pairing is manual (presets documented in UI copy).
- **Mobile capture:** `capture="environment"` on file input + same upload API as desktop (`POST .../images`).

## 6. AI-ready jobs

- Table `fi_imaging_ai_analysis_jobs` with `analysis_kind` in (`density_estimate`, `norwood_grade`, `donor_assessment`, `outcome_score`) and lifecycle `status`.
- Server action `enqueueImagingAiJobAction` inserts `queued` rows for asynchronous workers (no inference in-app).

## 7. Integration map

| OS / surface | Integration |
| --- | --- |
| PatientOS | Patient profile actions + `PatientImagesCard`; dedicated `/patients/[id]/imaging` route |
| ConsultationOS | `consultation_id` on images; protocols can anchor to consultation |
| SurgeryOS | `case_id`, `visit_type`, `follow_up_interval` metadata |
| AuditOS | Images feed `v_fi_media_unified` alongside legacy uploads / `fi_media_assets` |
| HairIntel | AI job queue + future workers reading `fi_imaging_ai_analysis_jobs` |

## 8. API

Multipart `POST` and JSON `PATCH` on existing tenant patient image routes accept ImagingOS fields (`imaging_library_axis`, `anatomical_region`, `clinic_id`, `captured_by_staff_id`, `device_type`, `visit_type`, `follow_up_interval`, `consultation_id`, protocol slugs).

## 9. Follow-ups (not in this slice)

- Server-driven pagination for galleries beyond 50 signed thumbnails.
- Full canvas editors (scalp + annotations) with undo stacks and version history.
- Automatic protocol slot fulfilment when uploading with `imaging_protocol_slot_slug`.
- RLS `INSERT` policies for authenticated clinical roles if moving writes off service role.
