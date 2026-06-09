-- ConsultationOS: persist consultant_staff_id (nullable FK to fi_staff).
alter table fi_consultations
  add column if not exists consultant_staff_id uuid references fi_staff (id) on delete set null;

create index if not exists idx_fi_consultations_consultant_staff_id
  on fi_consultations (consultant_staff_id)
  where consultant_staff_id is not null;

comment on column fi_consultations.consultant_staff_id is
  'Optional linked fi_staff row for the consulting clinician; consultant_name remains for legacy/free-text.';
