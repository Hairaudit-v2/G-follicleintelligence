-- DoctorOS Pathology blood requests — Stage 2: clinical notes, PDF storage pointer, patient email audit.

alter table fi_pathology_requests add column if not exists clinical_notes text;

alter table fi_pathology_requests add column if not exists emailed_to_patient_at timestamptz;

alter table fi_pathology_requests add column if not exists cancelled_at timestamptz;

alter table fi_pathology_requests add column if not exists pdf_storage_bucket text;

alter table fi_pathology_requests add column if not exists pdf_storage_path text;

comment on column fi_pathology_requests.clinical_notes is
  'Optional clinician-facing indication / context for the pathology request (shown on PDF).';

comment on column fi_pathology_requests.emailed_to_patient_at is
  'When the request PDF was emailed to the patient via DoctorOS (Resend).';

comment on column fi_pathology_requests.cancelled_at is
  'When the request was voided; `status` becomes cancelled.';

comment on column fi_pathology_requests.pdf_storage_path is
  'Last stored PDF object key (private bucket, typically patient-images).';
