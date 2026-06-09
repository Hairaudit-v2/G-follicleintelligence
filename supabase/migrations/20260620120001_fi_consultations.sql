-- ConsultationOS Stage 3C: persisted consultations (draft / in-progress workspace).
-- Writes are service-role only (Next.js server actions). Authenticated tenant members: SELECT.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists fi_consultations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  person_id uuid references fi_persons (id) on delete set null,
  patient_id uuid references fi_patients (id) on delete set null,
  lead_id uuid references fi_crm_leads (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  consultation_type text not null,
  status text not null default 'draft',
  consultant_name text,
  consultation_date date,
  structured_data jsonb not null default '{}'::jsonb,
  live_notes text,
  recommendation_notes text,
  quote_data jsonb not null default '{}'::jsonb,
  created_by uuid references fi_users (id) on delete set null,
  updated_by uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint fi_consultations_status_chk check (
    status in (
      'draft',
      'in_progress',
      'completed',
      'quoted',
      'accepted',
      'converted_to_case',
      'archived'
    )
  ),
  constraint fi_consultations_type_chk check (
    consultation_type in (
      'scalp_hair_transplant',
      'eyebrow_transplant',
      'beard_transplant',
      'body_hair_transplant',
      'prp_prf',
      'exosomes',
      'mesotherapy',
      'medical_hair_loss'
    )
  )
);

comment on table fi_consultations is
  'ConsultationOS workspace rows; RLS allows tenant-member SELECT; mutations via service role only.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_fi_consultations_tenant_id on fi_consultations (tenant_id);
create index if not exists idx_fi_consultations_patient_id on fi_consultations (patient_id);
create index if not exists idx_fi_consultations_lead_id on fi_consultations (lead_id);
create index if not exists idx_fi_consultations_case_id on fi_consultations (case_id);
create index if not exists idx_fi_consultations_status on fi_consultations (status);
create index if not exists idx_fi_consultations_consultation_type on fi_consultations (consultation_type);
create index if not exists idx_fi_consultations_consultation_date on fi_consultations (consultation_date desc);
create index if not exists idx_fi_consultations_created_at on fi_consultations (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function fi_consultations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_consultations_set_updated_at on fi_consultations;
create trigger trg_fi_consultations_set_updated_at
  before update on fi_consultations
  for each row
  execute procedure fi_consultations_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_consultations enable row level security;

drop policy if exists fi_consultations_select_tenant_member on fi_consultations;
create policy fi_consultations_select_tenant_member
  on fi_consultations for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_consultations.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges: authenticated read-only; service_role full DML for server actions
-- ---------------------------------------------------------------------------
grant select on fi_consultations to authenticated, service_role;
grant insert, update, delete on fi_consultations to service_role;
