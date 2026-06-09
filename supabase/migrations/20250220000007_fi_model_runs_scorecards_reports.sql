-- Follicle Intelligence: model runs, scorecards, reports
create table if not exists fi_model_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  job_id uuid,
  status text not null default 'queued' check (status in ('queued','running','failed','complete')),
  stage text,
  attempts int not null default 0,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fi_model_runs_case on fi_model_runs(case_id);
create index if not exists idx_fi_model_runs_status on fi_model_runs(tenant_id, status);

create table if not exists fi_scorecards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  model_run_id uuid references fi_model_runs(id) on delete set null,
  domain_scores jsonb not null default '{}',
  overall_score numeric,
  risk_tier text,
  explainability jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_fi_scorecards_case on fi_scorecards(case_id);

create table if not exists fi_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  model_run_id uuid references fi_model_runs(id) on delete set null,
  version int not null default 1,
  report_json jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','changes_required','approved','released')),
  storage_path text,
  created_at timestamptz default now(),
  approved_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz default now()
);
create index if not exists idx_fi_reports_case on fi_reports(case_id);
create index if not exists idx_fi_reports_status on fi_reports(tenant_id, status);
