-- Follicle Intelligence Foundation Layer (Stage 1C): patients + patient source mappings
-- See docs/design/07-foundation-migration-specification.md Section 2.4, 2.4a
-- Complements fi_global_patients (legacy ingest); dual-write is a later stage.

create table if not exists fi_patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  person_id uuid not null references fi_persons (id) on delete restrict,
  primary_clinic_id uuid references fi_clinics (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patients_one_per_person_per_tenant unique (tenant_id, person_id)
);

comment on table fi_patients is 'Follicle Intelligence Foundation Layer: care-subject facet linked to fi_persons (canonical patient id for foundation FKs).';

create index if not exists idx_fi_patients_tenant on fi_patients (tenant_id);
create index if not exists idx_fi_patients_person on fi_patients (person_id);

create table if not exists fi_patient_source_ids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  source_system text not null,
  source_patient_id text not null,
  created_at timestamptz not null default now(),
  constraint fi_patient_source_ids_unique_mapping unique (tenant_id, source_system, source_patient_id)
);

comment on table fi_patient_source_ids is 'Follicle Intelligence Foundation Layer: maps identifiers.source_patient_id to fi_patients.';

create index if not exists idx_fi_patient_source_ids_patient on fi_patient_source_ids (patient_id);
create index if not exists idx_fi_patient_source_ids_lookup
  on fi_patient_source_ids (tenant_id, source_system, source_patient_id);

-- Bridge to fi_global_cases must run in the same migration as fi_patients creation so
-- `foundation_patient_id` is never applied before `fi_patients` exists (avoids 42P01 when
-- migrations are replayed or partially applied).

alter table fi_global_cases add column if not exists foundation_patient_id uuid references fi_patients (id) on delete set null;

comment on column fi_global_cases.foundation_patient_id is 'Foundation Layer: canonical fi_patients link alongside legacy global_patient_id.';

create index if not exists idx_fi_global_cases_foundation_patient
  on fi_global_cases (tenant_id, foundation_patient_id)
  where foundation_patient_id is not null;
