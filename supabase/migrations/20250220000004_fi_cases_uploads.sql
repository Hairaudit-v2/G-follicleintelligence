-- Follicle Intelligence: cases and uploads
create table if not exists fi_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  external_id text,
  full_name text not null,
  email text not null,
  dob text not null,
  sex text not null,
  country text,
  primary_concern text,
  metadata jsonb default '{}',
  status text not null default 'draft' check (status in ('draft','submitted','processing','complete','failed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, external_id)
);
create index if not exists idx_fi_cases_tenant on fi_cases(tenant_id);
create index if not exists idx_fi_cases_status on fi_cases(tenant_id, status);
create index if not exists idx_fi_cases_external on fi_cases(tenant_id, external_id) where external_id is not null;

-- fi_uploads canonical schema is defined in 20250220000006_fi_uploads.sql (type column, not kind).
