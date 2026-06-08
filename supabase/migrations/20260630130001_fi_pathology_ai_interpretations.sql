-- DoctorOS Pathology Stage 4: AI blood interpretation drafts for clinician review.

create table if not exists fi_pathology_ai_interpretations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  pathology_result_id uuid not null references fi_pathology_results (id) on delete cascade,
  status text not null default 'draft',
  model_name text,
  interpretation_json jsonb not null default '{}'::jsonb,
  doctor_summary text,
  patient_friendly_summary text,
  clinical_flags jsonb not null default '[]'::jsonb,
  treatment_recommendations jsonb not null default '[]'::jsonb,
  surgical_readiness_score numeric,
  hair_loss_relevance_score numeric,
  reviewed_by_user_id uuid references fi_users (id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pathology_ai_interpretations_status_chk check (
    status in ('draft', 'doctor_reviewed', 'archived')
  ),
  constraint fi_pathology_ai_interpretations_json_object check (
    jsonb_typeof(interpretation_json) = 'object'
  ),
  constraint fi_pathology_ai_interpretations_flags_array check (
    jsonb_typeof(clinical_flags) = 'array'
  ),
  constraint fi_pathology_ai_interpretations_recs_array check (
    jsonb_typeof(treatment_recommendations) = 'array'
  ),
  constraint fi_pathology_ai_interpretations_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

comment on table fi_pathology_ai_interpretations is
  'DoctorOS Stage 4: AI-generated blood marker interpretation drafts for clinician review; clinical decision support only.';

create index if not exists idx_fi_pathology_ai_interpretations_tenant
  on fi_pathology_ai_interpretations (tenant_id);
create index if not exists idx_fi_pathology_ai_interpretations_result
  on fi_pathology_ai_interpretations (tenant_id, pathology_result_id);
create index if not exists idx_fi_pathology_ai_interpretations_patient
  on fi_pathology_ai_interpretations (tenant_id, patient_id);
create index if not exists idx_fi_pathology_ai_interpretations_latest
  on fi_pathology_ai_interpretations (tenant_id, patient_id, created_at desc);

create or replace function fi_pathology_ai_interpretations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_pathology_ai_interpretations_set_updated_at on fi_pathology_ai_interpretations;
create trigger trg_fi_pathology_ai_interpretations_set_updated_at
  before update on fi_pathology_ai_interpretations
  for each row
  execute procedure fi_pathology_ai_interpretations_set_updated_at();

alter table fi_pathology_ai_interpretations enable row level security;

create policy fi_pathology_ai_interpretations_select_tenant_member
  on fi_pathology_ai_interpretations for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_ai_interpretations.tenant_id
    )
  );

grant select on fi_pathology_ai_interpretations to authenticated, service_role;
grant insert, update, delete on fi_pathology_ai_interpretations to service_role;
