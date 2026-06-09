-- Stage 4B: structured clinical summary per foundation patient (not HLI / imaging / prescriptions).

create table if not exists fi_patient_clinical_details (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  person_id uuid references fi_persons (id) on delete set null,
  primary_hair_concern text,
  treatment_interest text,
  hair_loss_duration text,
  family_history text,
  relevant_medical_history text,
  current_medications text,
  allergies text,
  contraindications text,
  scalp_conditions text,
  previous_hair_treatments text,
  clinical_flags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references fi_users (id) on delete set null,
  updated_by_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_clinical_details_one_per_patient unique (tenant_id, patient_id),
  constraint fi_patient_clinical_details_clinical_flags_object check (jsonb_typeof (clinical_flags) = 'object'),
  constraint fi_patient_clinical_details_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_patient_clinical_details_primary_hair_concern_len check (
    primary_hair_concern is null or char_length(primary_hair_concern) <= 300
  ),
  constraint fi_patient_clinical_details_treatment_interest_len check (
    treatment_interest is null or char_length(treatment_interest) <= 300
  ),
  constraint fi_patient_clinical_details_hair_loss_duration_len check (
    hair_loss_duration is null or char_length(hair_loss_duration) <= 200
  ),
  constraint fi_patient_clinical_details_family_history_len check (
    family_history is null or char_length(family_history) <= 1000
  ),
  constraint fi_patient_clinical_details_relevant_medical_history_len check (
    relevant_medical_history is null or char_length(relevant_medical_history) <= 2000
  ),
  constraint fi_patient_clinical_details_current_medications_len check (
    current_medications is null or char_length(current_medications) <= 2000
  ),
  constraint fi_patient_clinical_details_allergies_len check (
    allergies is null or char_length(allergies) <= 1000
  ),
  constraint fi_patient_clinical_details_contraindications_len check (
    contraindications is null or char_length(contraindications) <= 1500
  ),
  constraint fi_patient_clinical_details_scalp_conditions_len check (
    scalp_conditions is null or char_length(scalp_conditions) <= 1500
  ),
  constraint fi_patient_clinical_details_previous_hair_treatments_len check (
    previous_hair_treatments is null or char_length(previous_hair_treatments) <= 1500
  )
);

comment on table fi_patient_clinical_details is 'FI OS Stage 4B: bounded structured clinical summary for staff; not diagnostics, imaging, or HLI engine output.';

create index if not exists idx_fi_patient_clinical_details_tenant_patient
  on fi_patient_clinical_details (tenant_id, patient_id);

create index if not exists idx_fi_patient_clinical_details_tenant_person
  on fi_patient_clinical_details (tenant_id, person_id);

create index if not exists idx_fi_patient_clinical_details_tenant_updated
  on fi_patient_clinical_details (tenant_id, updated_at desc);

alter table fi_patient_clinical_details enable row level security;

drop policy if exists fi_patient_clinical_details_select_tenant_member on fi_patient_clinical_details;
create policy fi_patient_clinical_details_select_tenant_member
  on fi_patient_clinical_details for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_clinical_details.tenant_id
    )
  );

-- Writes via service role (API routes / ingest); no authenticated INSERT/UPDATE/DELETE policies.
