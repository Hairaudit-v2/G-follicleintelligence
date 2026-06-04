-- Stage 5B: Surgery planning foundation (one plan row per case; tenant-scoped).
-- No procedure-day, live graft counts, audit, or outcome columns.

create table if not exists fi_case_surgery_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  case_id uuid not null references fi_cases (id) on delete cascade,
  planning_status text not null default 'draft',
  planned_procedure_type text,
  planned_session_type text,
  planned_zones jsonb not null default '[]'::jsonb,
  estimated_grafts_min integer,
  estimated_grafts_max integer,
  donor_strategy_notes text,
  recipient_strategy_notes text,
  medication_prep_notes text,
  planning_notes text,
  surgical_plan_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_case_surgery_plans_tenant_case_unique unique (tenant_id, case_id),
  constraint fi_case_surgery_plans_zones_array check (jsonb_typeof (planned_zones) = 'array'),
  constraint fi_case_surgery_plans_estimated_min_nonneg check (
    estimated_grafts_min is null or estimated_grafts_min >= 0
  ),
  constraint fi_case_surgery_plans_estimated_max_nonneg check (
    estimated_grafts_max is null or estimated_grafts_max >= 0
  ),
  constraint fi_case_surgery_plans_estimated_range check (
    estimated_grafts_min is null
    or estimated_grafts_max is null
    or estimated_grafts_max >= estimated_grafts_min
  )
);

comment on table fi_case_surgery_plans is
  'Stage 5B: surgical planning readiness (zones, graft range estimates, strategy notes). Not procedure-day or live counting.';

create index if not exists idx_fi_case_surgery_plans_tenant on fi_case_surgery_plans (tenant_id);
create index if not exists idx_fi_case_surgery_plans_case on fi_case_surgery_plans (case_id);
