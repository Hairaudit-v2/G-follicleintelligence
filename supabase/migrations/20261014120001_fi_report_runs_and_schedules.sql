-- Reports Library Phase 3: persisted report runs (snapshots) + optional schedules.

create table if not exists public.fi_report_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  report_id text not null,
  title text not null,
  period_start date not null,
  period_end date not null,
  params jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  status text not null default 'completed',
  source text not null default 'manual',
  created_by_fi_user_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint fi_report_runs_status_chk check (
    status in ('pending', 'completed', 'failed')
  ),
  constraint fi_report_runs_source_chk check (
    source in ('manual', 'schedule', 'cron')
  ),
  constraint fi_report_runs_params_object check (jsonb_typeof(params) = 'object'),
  constraint fi_report_runs_result_object check (jsonb_typeof(result_json) = 'object'),
  constraint fi_report_runs_title_nonempty check (char_length(trim(title)) > 0),
  constraint fi_report_runs_report_id_nonempty check (char_length(trim(report_id)) > 0)
);

comment on table public.fi_report_runs is
  'Persisted Reports Library snapshots (manual save or scheduled generation).';

create index if not exists idx_fi_report_runs_tenant_created
  on public.fi_report_runs (tenant_id, created_at desc);

create index if not exists idx_fi_report_runs_tenant_report
  on public.fi_report_runs (tenant_id, report_id, created_at desc);

alter table public.fi_report_runs enable row level security;

drop policy if exists fi_report_runs_select_tenant_member on public.fi_report_runs;
create policy fi_report_runs_select_tenant_member
  on public.fi_report_runs for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_report_runs.tenant_id
    )
  );

grant select on public.fi_report_runs to authenticated, service_role;
grant insert, update, delete on public.fi_report_runs to service_role;

create table if not exists public.fi_report_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  report_id text not null,
  period_preset text not null default '30d',
  filters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  last_run_id uuid references public.fi_report_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_report_schedules_preset_chk check (
    period_preset in ('30d', '90d', 'ytd')
  ),
  constraint fi_report_schedules_filters_object check (jsonb_typeof(filters) = 'object'),
  constraint fi_report_schedules_report_id_nonempty check (char_length(trim(report_id)) > 0),
  constraint fi_report_schedules_tenant_report_unique unique (tenant_id, report_id)
);

comment on table public.fi_report_schedules is
  'Optional per-tenant scheduled report generation for the Reports Library cron.';

create index if not exists idx_fi_report_schedules_active
  on public.fi_report_schedules (is_active, tenant_id)
  where is_active = true;

alter table public.fi_report_schedules enable row level security;

drop policy if exists fi_report_schedules_select_tenant_member on public.fi_report_schedules;
create policy fi_report_schedules_select_tenant_member
  on public.fi_report_schedules for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_report_schedules.tenant_id
    )
  );

grant select on public.fi_report_schedules to authenticated, service_role;
grant insert, update, delete on public.fi_report_schedules to service_role;

create or replace function public.fi_report_schedules_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_report_schedules_set_updated_at on public.fi_report_schedules;
create trigger trg_fi_report_schedules_set_updated_at
  before update on public.fi_report_schedules
  for each row
  execute procedure public.fi_report_schedules_set_updated_at();
