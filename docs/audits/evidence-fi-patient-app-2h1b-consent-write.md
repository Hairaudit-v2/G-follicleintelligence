# FI-PATIENT-APP-2H.1B — Patient consent write repair

## Root cause

`POST /api/patient/v1/consent` recorded photography consent by uploading a
`text/plain` attestation into the shared `patient-images` storage bucket, then
inserting a row in `fi_patient_documents`.

The `patient-images` bucket allowlist was still image-only
(`image/jpeg|png|webp|heic|heif`) from
`20260613120001_fi_patient_images.sql`. Supabase storage rejected the upload
with:

> mime type text/plain is not supported

`recordPatientGatewayConsent` swallowed the error and returned generic
`500 / misconfigured`. Auth, tenant re-derivation, patient linkage, and
`fi_patient_documents` schema were all healthy for the synthetic demo patient.

Affected:

| Layer | Detail |
| --- | --- |
| Service | `src/lib/patientPortal/patientGatewayConsent.server.ts` (`defaultRecordAttestation`) |
| Table | `fi_patient_documents` (canonical consent store — unchanged) |
| Storage | `storage.buckets` id `patient-images` |
| Migration | `20260729120001_fi_patient_images_consent_document_mime.sql` |

## Fix

1. Expand `patient-images` `allowed_mime_types` to include `application/pdf`
   (staff consent vault) and `text/plain` (gateway attestation).
2. Harden route payload parsing (reject unsupported type/version and
   client-supplied `patientId` / `tenantId`).
3. Persist consent type/version/actor on attestation metadata and log storage
   failures server-side.

No client bypass. No second consent store. No demo-only controller branch.

## Migration status

| Environment | Status |
| --- | --- |
| Production Supabase (`iqqvzgxoimxchhcnbzxl`) | Applied via MCP `apply_migration` `fi_patient_images_consent_document_mime` at 2026-07-29T09:26:33Z |
| Repo migration file | `supabase/migrations/20260729120001_fi_patient_images_consent_document_mime.sql` |

## Production verification (synthetic demo patient)

Patient: `e2e-patient-gateway-mobile@fi-demo.example`  
Auth user: `d51e1387-72b7-4044-b32a-07e8e82299ec`  
Patient id: `cb007f3d-2b91-4868-b3d4-88bc0667bc35`  
Tenant id: `c2615b95-b707-4485-aa5f-be8f78ec868a`

After MIME migration (before code deploy):

| Step | Result |
| --- | --- |
| GET consent | `200` `{ required: true, satisfied: false }` |
| POST consent (first) | `200` `{ required: true, satisfied: true }` |
| POST consent (repeat) | `200` idempotent |
| `fi_patient_documents` | row `72283978-0b4f-487f-abb9-c9f0684bc8db`, `document_type=consent`, `content_type=text/plain` |

Artifact: `.artifacts/repro-consent-500-result.json`

## Follow-on: upload complete (same ticket verification)

After consent worked, `POST /api/patient/v1/images/complete` still returned
`500 / misconfigured`. Root cause: gateway passed `actingUserId: authUserId`
into `fi_patient_images.uploaded_by_user_id`, which FKs `fi_users(id)`.
Patient portal auth users are not clinic `fi_users` rows
(`23503 fi_patient_images_uploaded_by_user_id_fkey`).

Fix: set `actingUserId: null` and record `actor_auth_user_id` in metadata.
Requires code deploy (not migration-only).

## Final production verification

| Check | Result |
| --- | --- |
| FiOS branch | `fix/fi-patient-app-2h1b-consent-write` (`e423ab12`, `0c2fc80e`) pushed |
| Production deploy | `dpl_59CSPczA7NFGwf4AQ2u3Be3QYUDA` → `https://follicleintelligence.ai` |
| `npm run test:authenticated-acceptance` | **PASS** |
| consent | already satisfied / POST path proven earlier |
| upload-intent | 200 |
| signed PUT | 200 to `…supabase.co/storage/v1/object/upload/sign/patient-images/…` |
| images/complete | 200 |
| journey reload after upload | 200 |

