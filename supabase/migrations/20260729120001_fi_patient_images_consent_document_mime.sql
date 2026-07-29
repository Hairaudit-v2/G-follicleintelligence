-- FI-PATIENT-APP-2H.1B
-- patient-images is the shared private bucket for clinical photos AND patient
-- consent documents (fi_patient_documents.storage_bucket default).
-- The original bucket allowlist was image-only, which breaks:
--   - staff consent vault uploads (application/pdf, and image consent scans)
--   - patient gateway in-app attestation (text/plain)
-- Expand allowed MIME types without widening to arbitrary binary types.

update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
    'text/plain'
  ]::text[],
  updated_at = now()
where id = 'patient-images';
