-- FI OS Stage 6: outcome intelligence foundation (protocol capture, measurements, tenant + global aggregates).
-- Additive; no workflow automation; service_role writes; tenant-safe RLS.

-- ---------------------------------------------------------------------------
-- fi_outcome_protocols
-- ---------------------------------------------------------------------------
create table if not exists public.fi_outcome_protocols (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  case_id uuid references public.fi_cases (id) on delete cascade,
  patient_id uuid references public.fi_patients (id) on delete cascade,
  protocol_type text not null,
  protocol_key text not null,
  protocol_label text not null,
  protocol_details jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  source_table text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_outcome_protocols_protocol_details_object check (jsonb_typeof (protocol_details) = 'object'),
  constraint fi_outcome_protocols_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_outcome_protocols is
  'FI OS Stage 6: structured surgical / adjunct protocol capture (tenant-scoped; no cross-tenant linkage).';

create index if not exists idx_fi_outcome_protocols_tenant_patient on public.fi_outcome_protocols (tenant_id, patient_id);

create index if not exists idx_fi_outcome_protocols_tenant_case on public.fi_outcome_protocols (tenant_id, case_id);

create index if not exists idx_fi_outcome_protocols_tenant_protocol_key on public.fi_outcome_protocols (tenant_id, protocol_key);

create index if not exists idx_fi_outcome_protocols_protocol_type on public.fi_outcome_protocols (protocol_type);

alter table public.fi_outcome_protocols enable row level security;

grant select, insert, update, delete on public.fi_outcome_protocols to service_role;

drop policy if exists fi_outcome_protocols_select_tenant_or_platform on public.fi_outcome_protocols;
create policy fi_outcome_protocols_select_tenant_or_platform
  on public.fi_outcome_protocols
  for select
  to authenticated
  using (public.fi_os_can_select_clinical_intelligence_tenant_data(tenant_id));

grant select on public.fi_outcome_protocols to authenticated;

drop trigger if exists trg_fi_outcome_protocols_set_updated_at on public.fi_outcome_protocols;
create trigger trg_fi_outcome_protocols_set_updated_at
  before update on public.fi_outcome_protocols
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_patient_outcome_measurements
-- ---------------------------------------------------------------------------
create table if not exists public.fi_patient_outcome_measurements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  case_id uuid references public.fi_cases (id) on delete cascade,
  checkpoint_key text not null,
  measurement_date date,
  metric_values jsonb not null default '{}'::jsonb,
  imaging_refs jsonb not null default '[]'::jsonb,
  audit_refs jsonb not null default '[]'::jsonb,
  source_table text,
  source_id uuid,
  confidence_level text not null default 'unknown',
  visibility_scope text not null default 'tenant_clinical',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_outcome_measurements_metric_values_object check (jsonb_typeof (metric_values) = 'object'),
  constraint fi_patient_outcome_measurements_imaging_refs_array check (jsonb_typeof (imaging_refs) = 'array'),
  constraint fi_patient_outcome_measurements_audit_refs_array check (jsonb_typeof (audit_refs) = 'array'),
  constraint fi_patient_outcome_measurements_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_patient_outcome_measurements_confidence_chk check (
    confidence_level in ('unknown', 'low', 'medium', 'high')
  ),
  constraint fi_patient_outcome_measurements_visibility_chk check (
    visibility_scope in ('tenant_clinical', 'tenant_aggregate', 'anonymised_network_candidate')
  )
);

comment on table public.fi_patient_outcome_measurements is
  'FI OS Stage 6: structured outcome measurements per patient/case checkpoint (tenant-scoped; JSON metrics).';

create index if not exists idx_fi_patient_outcome_measurements_tenant_patient
  on public.fi_patient_outcome_measurements (tenant_id, patient_id);

create index if not exists idx_fi_patient_outcome_measurements_tenant_case
  on public.fi_patient_outcome_measurements (tenant_id, case_id);

create index if not exists idx_fi_patient_outcome_measurements_tenant_checkpoint
  on public.fi_patient_outcome_measurements (tenant_id, checkpoint_key);

create index if not exists idx_fi_patient_outcome_measurements_measurement_date
  on public.fi_patient_outcome_measurements (measurement_date);

-- Nullable-safe uniqueness (Postgres: multiple NULL case_id / measurement_date otherwise collide).
create unique index if not exists uq_fi_patient_outcome_m_dated_with_case
  on public.fi_patient_outcome_measurements (tenant_id, patient_id, case_id, checkpoint_key, measurement_date)
  where case_id is not null and measurement_date is not null;

create unique index if not exists uq_fi_patient_outcome_m_dated_no_case
  on public.fi_patient_outcome_measurements (tenant_id, patient_id, checkpoint_key, measurement_date)
  where case_id is null and measurement_date is not null;

create unique index if not exists uq_fi_patient_outcome_m_undated_with_case
  on public.fi_patient_outcome_measurements (tenant_id, patient_id, case_id, checkpoint_key)
  where measurement_date is null and case_id is not null;

create unique index if not exists uq_fi_patient_outcome_m_undated_no_case
  on public.fi_patient_outcome_measurements (tenant_id, patient_id, checkpoint_key)
  where measurement_date is null and case_id is null;

alter table public.fi_patient_outcome_measurements enable row level security;

grant select, insert, update, delete on public.fi_patient_outcome_measurements to service_role;

drop policy if exists fi_patient_outcome_measurements_select_tenant_or_platform
  on public.fi_patient_outcome_measurements;
create policy fi_patient_outcome_measurements_select_tenant_or_platform
  on public.fi_patient_outcome_measurements
  for select
  to authenticated
  using (public.fi_os_can_select_clinical_intelligence_tenant_data(tenant_id));

grant select on public.fi_patient_outcome_measurements to authenticated;

drop trigger if exists trg_fi_patient_outcome_measurements_set_updated_at
  on public.fi_patient_outcome_measurements;
create trigger trg_fi_patient_outcome_measurements_set_updated_at
  before update on public.fi_patient_outcome_measurements
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_tenant_outcome_aggregates
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_outcome_aggregates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  aggregate_period_start date not null,
  aggregate_period_end date not null,
  cohort_key text not null,
  cohort_description text,
  metric_summary jsonb not null default '{}'::jsonb,
  protocol_mix jsonb not null default '{}'::jsonb,
  sample_size integer not null default 0,
  confidence_level text not null default 'unknown',
  visibility_scope text not null default 'tenant_only',
  computed_at timestamptz not null default now(),
  computed_by text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_outcome_aggregates_metric_summary_object check (jsonb_typeof (metric_summary) = 'object'),
  constraint fi_tenant_outcome_aggregates_protocol_mix_object check (jsonb_typeof (protocol_mix) = 'object'),
  constraint fi_tenant_outcome_aggregates_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_tenant_outcome_aggregates_sample_nonneg check (sample_size >= 0),
  constraint fi_tenant_outcome_aggregates_confidence_chk check (
    confidence_level in ('unknown', 'low', 'medium', 'high')
  ),
  constraint fi_tenant_outcome_aggregates_visibility_chk check (
    visibility_scope in ('tenant_only', 'anonymised_network_candidate')
  ),
  constraint fi_tenant_outcome_aggregates_period_chk check (aggregate_period_end >= aggregate_period_start),
  constraint fi_tenant_outcome_aggregates_cohort_key_nonempty check (char_length(trim(cohort_key)) > 0)
);

comment on table public.fi_tenant_outcome_aggregates is
  'FI OS Stage 6: tenant-level outcome summaries (no patient identifiers in metric_summary contract; app-enforced).';

create unique index if not exists uq_fi_tenant_outcome_aggregates_period_cohort
  on public.fi_tenant_outcome_aggregates (tenant_id, aggregate_period_start, aggregate_period_end, cohort_key);

create index if not exists idx_fi_tenant_outcome_aggregates_tenant on public.fi_tenant_outcome_aggregates (tenant_id);

create index if not exists idx_fi_tenant_outcome_aggregates_cohort_key on public.fi_tenant_outcome_aggregates (cohort_key);

create index if not exists idx_fi_tenant_outcome_aggregates_computed_at
  on public.fi_tenant_outcome_aggregates (computed_at desc);

alter table public.fi_tenant_outcome_aggregates enable row level security;

grant select, insert, update, delete on public.fi_tenant_outcome_aggregates to service_role;

create or replace function public.fi_os_can_select_tenant_outcome_aggregate(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.fi_os_identities o
      where o.auth_user_id = auth.uid()
        and lower(trim(o.os_role)) in ('fi_platform_admin', 'fi_admin', 'fi_auditor')
    )
    or exists (
      select 1
      from public.fi_users u
      inner join public.fi_tenant_admin_users tau
        on tau.fi_user_id = u.id
        and tau.tenant_id = p_tenant_id
      where u.auth_user_id = auth.uid()
        and tau.status = 'active'
    )
    or exists (
      select 1
      from public.fi_users u
      inner join public.fi_staff s on s.fi_user_id = u.id and s.tenant_id = p_tenant_id
      where u.auth_user_id = auth.uid()
        and coalesce(s.is_active, true) is true
        and (
          lower(coalesce(s.staff_role, '')) like '%director%'
          or lower(coalesce(s.staff_role, '')) like '%manager%'
          or lower(coalesce(s.staff_role, '')) like '%operations%'
        )
    );
$$;

revoke all on function public.fi_os_can_select_tenant_outcome_aggregate(uuid) from public;
grant execute on function public.fi_os_can_select_tenant_outcome_aggregate(uuid) to authenticated;

drop policy if exists fi_tenant_outcome_aggregates_select_privileged on public.fi_tenant_outcome_aggregates;
create policy fi_tenant_outcome_aggregates_select_privileged
  on public.fi_tenant_outcome_aggregates
  for select
  to authenticated
  using (public.fi_os_can_select_tenant_outcome_aggregate(tenant_id));

grant select on public.fi_tenant_outcome_aggregates to authenticated;

drop trigger if exists trg_fi_tenant_outcome_aggregates_set_updated_at on public.fi_tenant_outcome_aggregates;
create trigger trg_fi_tenant_outcome_aggregates_set_updated_at
  before update on public.fi_tenant_outcome_aggregates
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_global_outcome_aggregates (no tenant / patient / case / staff / clinic ids)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_global_outcome_aggregates (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null,
  cohort_description text,
  aggregate_period_start date not null,
  aggregate_period_end date not null,
  metric_summary jsonb not null default '{}'::jsonb,
  protocol_mix jsonb not null default '{}'::jsonb,
  contributing_tenant_count integer not null default 0,
  sample_size integer not null default 0,
  confidence_level text not null default 'unknown',
  anonymisation_threshold_met boolean not null default false,
  computed_at timestamptz not null default now(),
  computed_by text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_global_outcome_aggregates_metric_summary_object check (jsonb_typeof (metric_summary) = 'object'),
  constraint fi_global_outcome_aggregates_protocol_mix_object check (jsonb_typeof (protocol_mix) = 'object'),
  constraint fi_global_outcome_aggregates_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_global_outcome_aggregates_sample_nonneg check (sample_size >= 0),
  constraint fi_global_outcome_aggregates_tenant_count_nonneg check (contributing_tenant_count >= 0),
  constraint fi_global_outcome_aggregates_confidence_chk check (
    confidence_level in ('unknown', 'low', 'medium', 'high')
  ),
  constraint fi_global_outcome_aggregates_period_chk check (aggregate_period_end >= aggregate_period_start),
  constraint fi_global_outcome_aggregates_cohort_key_nonempty check (char_length(trim(cohort_key)) > 0)
);

comment on table public.fi_global_outcome_aggregates is
  'FI OS Stage 6: anonymised multi-tenant outcome rollups (identifiers forbidden in payload; threshold-gated reads).';

create unique index if not exists uq_fi_global_outcome_aggregates_cohort_period
  on public.fi_global_outcome_aggregates (cohort_key, aggregate_period_start, aggregate_period_end);

create index if not exists idx_fi_global_outcome_aggregates_cohort_key on public.fi_global_outcome_aggregates (cohort_key);

create index if not exists idx_fi_global_outcome_aggregates_computed_at on public.fi_global_outcome_aggregates (computed_at desc);

alter table public.fi_global_outcome_aggregates enable row level security;

grant select, insert, update, delete on public.fi_global_outcome_aggregates to service_role;

drop policy if exists fi_global_outcome_aggregates_select_threshold on public.fi_global_outcome_aggregates;
create policy fi_global_outcome_aggregates_select_threshold
  on public.fi_global_outcome_aggregates
  for select
  to authenticated
  using (anonymisation_threshold_met is true and auth.uid() is not null);

grant select on public.fi_global_outcome_aggregates to authenticated;

drop trigger if exists trg_fi_global_outcome_aggregates_set_updated_at on public.fi_global_outcome_aggregates;
create trigger trg_fi_global_outcome_aggregates_set_updated_at
  before update on public.fi_global_outcome_aggregates
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();
