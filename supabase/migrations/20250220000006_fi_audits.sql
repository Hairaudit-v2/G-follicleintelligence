-- Follicle Intelligence: auditor approval + notes
create table if not exists fi_audits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  report_id uuid not null references fi_reports(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  reviewer_id uuid references fi_users(id) on delete set null,
  note text,
  status text check (status in ('changes_required','approved')),
  created_at timestamptz default now()
);
create index if not exists idx_fi_audits_report on fi_audits(report_id);
create index if not exists idx_fi_audits_tenant on fi_audits(tenant_id);
create index if not exists idx_fi_audits_case on fi_audits(case_id);

-- Add latest_report_id to fi_cases
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='fi_cases' and column_name='latest_report_id') then
    alter table fi_cases add column latest_report_id uuid references fi_reports(id);
  end if;
end $$;
