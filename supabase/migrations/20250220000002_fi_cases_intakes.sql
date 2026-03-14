-- Follicle Intelligence: cases (umbrella audit case) + intakes
create table if not exists fi_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  patient_id uuid,
  created_by uuid references fi_users(id) on delete set null,
  external_id text,
  status text not null default 'draft' check (status in ('draft','submitted','processing','complete','failed')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, external_id)
);
create index if not exists idx_fi_cases_tenant on fi_cases(tenant_id);
create index if not exists idx_fi_cases_status on fi_cases(tenant_id, status);
create index if not exists idx_fi_cases_case on fi_cases(id);
create index if not exists idx_fi_cases_external on fi_cases(tenant_id, external_id) where external_id is not null;
create index if not exists idx_fi_cases_patient on fi_cases(patient_id) where patient_id is not null;

create table if not exists fi_intakes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  created_by uuid references fi_users(id) on delete set null,
  full_name text not null,
  email text not null,
  dob text not null,
  sex text not null,
  country text,
  primary_concern text,
  selections jsonb default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(case_id)
);
create index if not exists idx_fi_intakes_case on fi_intakes(case_id);
create index if not exists idx_fi_intakes_tenant on fi_intakes(tenant_id);
