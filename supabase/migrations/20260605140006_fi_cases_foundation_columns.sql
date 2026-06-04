-- Follicle Intelligence Foundation Layer (Stage 1C): additive FK columns on fi_cases
-- See docs/design/07-foundation-migration-specification.md Section 2.6
-- Does not rename or remove legacy fi_cases.patient_id (pre-foundation usage).

alter table fi_cases add column if not exists clinic_id uuid references fi_clinics (id) on delete set null;
alter table fi_cases add column if not exists organisation_id uuid references fi_organisations (id) on delete set null;
alter table fi_cases add column if not exists foundation_patient_id uuid references fi_patients (id) on delete set null;

comment on column fi_cases.clinic_id is 'Foundation Layer: optional link to fi_clinics.';
comment on column fi_cases.organisation_id is 'Foundation Layer: optional link to fi_organisations.';
comment on column fi_cases.foundation_patient_id is 'Foundation Layer: canonical fi_patients link; legacy patient_id column unchanged.';

create index if not exists idx_fi_cases_tenant_clinic on fi_cases (tenant_id, clinic_id) where clinic_id is not null;
create index if not exists idx_fi_cases_tenant_org on fi_cases (tenant_id, organisation_id) where organisation_id is not null;
create index if not exists idx_fi_cases_tenant_foundation_patient
  on fi_cases (tenant_id, foundation_patient_id)
  where foundation_patient_id is not null;
