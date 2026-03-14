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

create table if not exists fi_uploads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  kind text not null check (kind in ('blood','photo','other')),
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);
create index if not exists idx_fi_uploads_case on fi_uploads(case_id);
create index if not exists idx_fi_uploads_kind on fi_uploads(case_id, kind);
