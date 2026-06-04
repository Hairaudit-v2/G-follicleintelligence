-- Follicle Intelligence Foundation Layer (Stage 1C follow-up): intakes → persons / patients
-- See docs/design/07-foundation-migration-specification.md (fi_intakes optional FKs)
-- Demographic PII columns unchanged; these FKs are optional for future joins after dual-write.

alter table fi_intakes add column if not exists person_id uuid references fi_persons (id) on delete set null;
alter table fi_intakes add column if not exists patient_id uuid references fi_patients (id) on delete set null;

comment on column fi_intakes.person_id is 'Foundation Layer: optional link to fi_persons.';
comment on column fi_intakes.patient_id is 'Foundation Layer: optional link to fi_patients (foundation).';

create index if not exists idx_fi_intakes_person on fi_intakes (person_id) where person_id is not null;
create index if not exists idx_fi_intakes_patient on fi_intakes (patient_id) where patient_id is not null;
