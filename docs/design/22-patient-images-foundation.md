# Patient images foundation (Stage 4C)

## Purpose

Stage 4C introduces the **first private visual record layer** for foundation patients: staff can **upload**, **view** (via signed URLs), **categorise**, **annotate lightly** (caption, taken-at, JSON metadata), and **archive** images from the patient profile. This is intentionally **not** AI analysis, HairAudit scoring, surgery bulk upload, trichoscopy tooling, before/after engines, annotation, patient-facing galleries, or public sharing — those are later stages.

## Privacy model

- **Supabase Storage bucket:** `patient-images` (private, not public).
- **Path convention (server-owned):** `tenant/{tenantId}/patients/{patientId}/{imageId}-{safeFilename}`.
- **No public URLs** in the UI; thumbnails and previews use **short-lived signed URLs** generated server-side (service role) in the profile loader (latest active images) and on demand via API upload responses.
- **Uploads only through** `POST /api/tenants/.../images` with multipart form data — the client never supplies `storage_path`.
- **Database writes** (`INSERT` / `UPDATE` for mutations) use the **service role** from API routes and server actions; authenticated users have **SELECT-only RLS** on `fi_patient_images`.

## Table: `fi_patient_images`

| Column | Notes |
| --- | --- |
| `id` | UUID PK (also used in storage object prefix) |
| `tenant_id` | FK → `fi_tenants` |
| `patient_id` | FK → `fi_patients` |
| `person_id` | Optional FK → `fi_persons`; set from the patient row on upload |
| `case_id`, `booking_id`, `lead_id` | Optional contextual links; validated to belong to the tenant and to this patient |
| `image_category` | Enum-like text: consult, scalp, donor, hairline, trichoscopy, post_op, progress, before, after, other |
| `image_status` | `active` \| `archived` |
| `storage_bucket` | Default `patient-images` |
| `storage_path` | Unique; server-generated |
| `original_filename`, `content_type`, `file_size_bytes` | Audit / display |
| `caption`, `taken_at` | Optional staff context |
| `metadata` | JSON object only (`{}` default) |
| `uploaded_by_user_id` | Optional FK → `fi_users` |
| `archived_at`, `archived_by_user_id`, `archive_reason` | Set when status becomes `archived` |
| `created_at`, `updated_at` | Maintained on write |

**Constraints:** metadata JSON object CHECK; category/status CHECK lists; `storage_path` UNIQUE; coherent `archived_at` when `image_status = archived`; caption / archive_reason length CHECKs at rest.

**Indexes:** `(tenant_id, patient_id)`, `(tenant_id, person_id)`, `(tenant_id, case_id)`, `(tenant_id, booking_id)`, `(tenant_id, lead_id)`, `(tenant_id, image_category)`, `(tenant_id, image_status)`, `(tenant_id, taken_at desc)`, `(tenant_id, created_at desc)`.

**RLS:** authenticated tenant members **SELECT**; **no authenticated INSERT/UPDATE/DELETE** (service role only for writes).

## Allowed file types & limits

| Rule | Value |
| --- | --- |
| MIME allow-list | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif` |
| HEIC / octet-stream | Filename extension fallback when browsers omit MIME |
| Max size | 20 MB |
| Rejected | PDF, video, SVG, executables, unknown types |

## API routes

| Method | Path | Body |
| --- | --- | --- |
| `POST` | `/api/tenants/[tenantId]/patients/[patientId]/images` | `multipart/form-data`: `file`, `image_category`, optional `caption`, `taken_at`, `case_id`, `booking_id`, `lead_id`, `metadata` (JSON string) |
| `PATCH` | `/api/tenants/[tenantId]/patients/[patientId]/images/[imageId]` | JSON: `image_category`, `caption`, `taken_at`, `metadata` (same CRM write gate as other FI Admin mutators) |
| `POST` | `/api/tenants/[tenantId]/patients/[patientId]/images/[imageId]/archive` | JSON: optional `archive_reason` |

All mutating routes use `assertCrmTenantWriteAllowed` (admin key or CRM mutation role + session).

## Server actions

- `updatePatientImageDetailsAction` — wraps `updatePatientImageDetails` + `revalidatePath`.
- `archivePatientImageAction` — wraps `archivePatientImage` + `revalidatePath`.

**Upload** prefers the **POST API** with `FormData` from the client (same pattern as case uploads).

## Loader & UI

- `loadPatientProfile` includes `patientImages: PatientImagesProfileBundle`:
  - **Counts:** total / active / archived for the patient.
  - **Active:** up to **50** newest active rows each with a **signed URL** descriptor (`url`, `expiresAtIso`).
  - **Archived:** metadata list **without** signed URLs by default (Stage 4C).
- UI card **`PatientImagesCard`** on `/fi-admin/[tenantId]/patients/[patientId]` immediately after **Clinical details**: upload form, active grid with category badges, edit panel, archive control, collapsed archived list, and a short privacy note.

## Activity & audit

- **No writes** to `fi_crm_activity_events` from patient images in Stage 4C.
- Server responses include **`changed_keys`** where applicable for a future **patient-native activity** stream (deferred).

## System status

- Core table list includes **`fi_patient_images`**.
- Patients feature inventory row **Images** becomes **Ready** when the foundation patient schema exists and the images table is present; tenant metrics show total / active / archived image counts.

## Deferred (explicit)

- AI image analysis, HairAudit image scoring, surgery-specific upload workflows, trichoscopy measurement, before/after comparison engine, drawing/annotation layers, patient-facing gallery, public or shared links, bulk surgical photo import, patient activity table writer.

## Related code

| Area | Path |
| --- | --- |
| Migration | `supabase/migrations/20260613120001_fi_patient_images.sql` |
| Pure helpers | `src/lib/patientImages/*` |
| Server | `src/lib/patientImages/patientImagesServer.ts` |
| API | `app/api/tenants/[tenantId]/patients/[patientId]/images/**` |
| Actions | `lib/actions/fi-patient-actions.ts` |
| Loader | `src/lib/patients/patientProfileLoader.ts` |
| UI | `src/components/fi/patient-images/*`, `PatientProfilePage` |
| Unit tests | `src/lib/patientImages/stage4c.test.ts` |
