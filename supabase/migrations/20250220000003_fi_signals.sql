-- Follicle Intelligence: blood and image signals (extraction outputs)
create table if not exists fi_blood_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  payload jsonb not null default '{}',
  confidence jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_fi_blood_signals_case on fi_blood_signals(case_id);

create table if not exists fi_image_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  payload jsonb not null default '{}',
  confidence jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_fi_image_signals_case on fi_image_signals(case_id);
