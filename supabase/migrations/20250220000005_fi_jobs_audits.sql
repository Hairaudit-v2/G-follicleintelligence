-- Follicle Intelligence: job runner and auditor approval
create table if not exists fi_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','failed','complete')),
  stage text,
  attempts int not null default 0,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fi_jobs_tenant_status on fi_jobs(tenant_id, status);
create index if not exists idx_fi_jobs_case on fi_jobs(case_id);

create table if not exists fi_audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  report_id uuid not null references fi_reports(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  author text,
  note text,
  status text check (status in ('changes_required','approved')),
  created_at timestamptz default now()
);
create index if not exists idx_fi_audits_report on fi_audits(report_id);
create index if not exists idx_fi_audits_tenant on fi_audits(tenant_id);

-- Add latest_report_id to fi_cases for convenience
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='fi_cases' and column_name='latest_report_id') then
    alter table fi_cases add column latest_report_id uuid references fi_reports(id);
  end if;
end $$;
