-- Follicle Intelligence: additive event ingestion foundation

create table if not exists fi_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  event_type text not null,
  source_system text not null,
  source_event_id text not null,
  occurred_at timestamptz not null default now(),
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  error_text text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_system, source_event_id)
);
create index if not exists idx_fi_events_tenant on fi_events(tenant_id);
create index if not exists idx_fi_events_event_type on fi_events(event_type);
create index if not exists idx_fi_events_created_at_desc on fi_events(created_at desc);

create table if not exists fi_global_patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  source_system text not null,
  source_patient_id text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_system, source_patient_id)
);
create index if not exists idx_fi_global_patients_tenant on fi_global_patients(tenant_id);

create table if not exists fi_global_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  source_system text not null,
  source_case_id text not null,
  global_patient_id uuid null references fi_global_patients(id) on delete set null,
  fi_case_id uuid null references fi_cases(id) on delete set null,
  status text not null default 'linked',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_system, source_case_id)
);
create index if not exists idx_fi_global_cases_tenant on fi_global_cases(tenant_id);
create index if not exists idx_fi_global_cases_fi_case_id on fi_global_cases(fi_case_id);

create table if not exists fi_event_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references fi_events(id) on delete cascade,
  global_case_id uuid null references fi_global_cases(id) on delete set null,
  fi_case_id uuid null references fi_cases(id) on delete set null,
  global_patient_id uuid null references fi_global_patients(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_fi_event_links_event_id on fi_event_links(event_id);
create index if not exists idx_fi_event_links_fi_case_id on fi_event_links(fi_case_id);
