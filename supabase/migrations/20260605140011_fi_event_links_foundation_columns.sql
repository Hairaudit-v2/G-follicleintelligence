-- Follicle Intelligence Foundation Layer (Stage 1C follow-up): event links → foundation entities
-- See docs/design/07-foundation-migration-specification.md (fi_event_links extensions)
-- Retains global_patient_id, global_case_id, fi_case_id.

alter table fi_event_links add column if not exists patient_id uuid references fi_patients (id) on delete set null;
alter table fi_event_links add column if not exists clinic_id uuid references fi_clinics (id) on delete set null;

comment on column fi_event_links.patient_id is 'Foundation Layer: optional fi_patients link for resolved ingest.';
comment on column fi_event_links.clinic_id is 'Foundation Layer: optional fi_clinics link for resolved ingest.';

create index if not exists idx_fi_event_links_patient on fi_event_links (patient_id) where patient_id is not null;
create index if not exists idx_fi_event_links_clinic on fi_event_links (clinic_id) where clinic_id is not null;
