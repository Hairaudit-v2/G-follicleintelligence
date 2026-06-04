-- Stage 4A: lightweight FI Admin patient fields (non-clinical).
-- admin_note: staff-only operational context; not for clinical documentation.

alter table fi_patients add column if not exists admin_note text;

alter table fi_patients add column if not exists patient_status text;

update fi_patients set patient_status = 'active' where patient_status is null;

alter table fi_patients alter column patient_status set default 'active';

alter table fi_patients alter column patient_status set not null;

alter table fi_patients drop constraint if exists fi_patients_patient_status_check;

alter table fi_patients
  add constraint fi_patients_patient_status_check check (
    patient_status in ('active', 'inactive', 'archived', 'deceased', 'duplicate')
  );

comment on column fi_patients.admin_note is 'FI Admin: non-clinical staff note (bounded in app).';
comment on column fi_patients.patient_status is 'FI Admin lifecycle flag (not a clinical diagnosis).';
