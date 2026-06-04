-- Follicle Intelligence Foundation Layer: fi_global_cases.foundation_patient_id
--
-- Primary DDL is inlined in 20260605140005_fi_patients_and_fi_patient_source_ids.sql
-- (immediately after fi_patients is created) so the FK cannot run before fi_patients exists.
--
-- This file remains idempotent for environments that already depend on this migration name:
-- ADD COLUMN / CREATE INDEX IF NOT EXISTS are safe no-ops when already applied from 40005.

alter table fi_global_cases add column if not exists foundation_patient_id uuid references fi_patients (id) on delete set null;

comment on column fi_global_cases.foundation_patient_id is 'Foundation Layer: canonical fi_patients link alongside legacy global_patient_id.';

create index if not exists idx_fi_global_cases_foundation_patient
  on fi_global_cases (tenant_id, foundation_patient_id)
  where foundation_patient_id is not null;
