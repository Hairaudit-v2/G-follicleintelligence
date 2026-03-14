-- Follicle Intelligence: extracted signals (blood + image)
create table if not exists fi_signals_blood (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  created_by uuid references fi_users(id) on delete set null,
  payload jsonb not null default '{}',
  confidence jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_fi_signals_blood_case on fi_signals_blood(case_id);
create index if not exists idx_fi_signals_blood_tenant on fi_signals_blood(tenant_id);

create table if not exists fi_signals_image (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  created_by uuid references fi_users(id) on delete set null,
  payload jsonb not null default '{}',
  confidence jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_fi_signals_image_case on fi_signals_image(case_id);
create index if not exists idx_fi_signals_image_tenant on fi_signals_image(tenant_id);
