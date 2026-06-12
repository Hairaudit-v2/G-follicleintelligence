-- FI OS Stage 5: clinical intelligence events + patient snapshots (additive; no workflow automation).

-- ---------------------------------------------------------------------------
-- fi_clinical_intelligence_events
-- ---------------------------------------------------------------------------
create table if not exists public.fi_clinical_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  consultation_id uuid references public.fi_consultations (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,
  staff_id uuid references public.fi_staff (id) on delete set null,
  signal_key text not null,
  event_type text not null default 'clinical_signal',
  severity text not null default 'info',
  title text not null,
  description text,
  source_table text,
  source_id uuid,
  status text not null default 'open',
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_clinical_intelligence_events_severity_chk check (severity in ('info', 'attention', 'critical')),
  constraint fi_clinical_intelligence_events_status_chk check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  constraint fi_clinical_intelligence_events_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_clinical_intelligence_events is
  'FI OS Stage 5: structured clinical journey signals for tenant-scoped review (no auto medical advice; service_role writes).';

create index if not exists idx_fi_clinical_intelligence_events_tenant_patient
  on public.fi_clinical_intelligence_events (tenant_id, patient_id);

create index if not exists idx_fi_clinical_intelligence_events_tenant_case
  on public.fi_clinical_intelligence_events (tenant_id, case_id);

create index if not exists idx_fi_clinical_intelligence_events_tenant_signal
  on public.fi_clinical_intelligence_events (tenant_id, signal_key);

create index if not exists idx_fi_clinical_intelligence_events_tenant_severity
  on public.fi_clinical_intelligence_events (tenant_id, severity);

create index if not exists idx_fi_clinical_intelligence_events_tenant_status
  on public.fi_clinical_intelligence_events (tenant_id, status);

create index if not exists idx_fi_clinical_intelligence_events_occurred_at
  on public.fi_clinical_intelligence_events (occurred_at desc);

alter table public.fi_clinical_intelligence_events enable row level security;

grant select, insert, update, delete on public.fi_clinical_intelligence_events to service_role;

create or replace function public.fi_os_can_select_clinical_intelligence_tenant_data(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = p_tenant_id
    )
    or exists (
      select 1
      from public.fi_os_identities o
      where o.auth_user_id = auth.uid()
        and lower(trim(o.os_role)) in ('fi_platform_admin', 'fi_admin', 'fi_auditor')
    );
$$;

revoke all on function public.fi_os_can_select_clinical_intelligence_tenant_data(uuid) from public;
grant execute on function public.fi_os_can_select_clinical_intelligence_tenant_data(uuid) to authenticated;

drop policy if exists fi_clinical_intelligence_events_select_tenant_or_platform on public.fi_clinical_intelligence_events;
create policy fi_clinical_intelligence_events_select_tenant_or_platform
  on public.fi_clinical_intelligence_events
  for select
  to authenticated
  using (public.fi_os_can_select_clinical_intelligence_tenant_data(tenant_id));

grant select on public.fi_clinical_intelligence_events to authenticated;

drop trigger if exists trg_fi_clinical_intelligence_events_set_updated_at on public.fi_clinical_intelligence_events;
create trigger trg_fi_clinical_intelligence_events_set_updated_at
  before update on public.fi_clinical_intelligence_events
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_patient_clinical_intelligence_snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.fi_patient_clinical_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  snapshot_period_start date,
  snapshot_period_end date,
  signal_summary jsonb not null default '{}'::jsonb,
  patient_twin_integrity jsonb not null default '{}'::jsonb,
  treatment_journey_summary jsonb not null default '{}'::jsonb,
  surgery_journey_summary jsonb not null default '{}'::jsonb,
  outcome_summary jsonb not null default '{}'::jsonb,
  recommendation_summary jsonb not null default '{}'::jsonb,
  visibility_scope text not null default 'clinician',
  computed_at timestamptz not null default now(),
  computed_by text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_clinical_intel_snapshots_signal_summary_object check (jsonb_typeof (signal_summary) = 'object'),
  constraint fi_patient_clinical_intel_snapshots_twin_object check (jsonb_typeof (patient_twin_integrity) = 'object'),
  constraint fi_patient_clinical_intel_snapshots_treatment_object check (jsonb_typeof (treatment_journey_summary) = 'object'),
  constraint fi_patient_clinical_intel_snapshots_surgery_object check (jsonb_typeof (surgery_journey_summary) = 'object'),
  constraint fi_patient_clinical_intel_snapshots_outcome_object check (jsonb_typeof (outcome_summary) = 'object'),
  constraint fi_patient_clinical_intel_snapshots_recommendation_object check (jsonb_typeof (recommendation_summary) = 'object'),
  constraint fi_patient_clinical_intel_snapshots_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_patient_clinical_intel_snapshots_visibility_chk check (
    visibility_scope in ('clinician', 'manager', 'director')
  )
);

comment on table public.fi_patient_clinical_intelligence_snapshots is
  'FI OS Stage 5: append-friendly patient-level clinical intelligence summaries (no cross-tenant benchmarking).';

create index if not exists idx_fi_patient_clinical_intel_snapshots_tenant_patient
  on public.fi_patient_clinical_intelligence_snapshots (tenant_id, patient_id);

create index if not exists idx_fi_patient_clinical_intel_snapshots_computed_at
  on public.fi_patient_clinical_intelligence_snapshots (computed_at desc);

alter table public.fi_patient_clinical_intelligence_snapshots enable row level security;

grant select, insert, update, delete on public.fi_patient_clinical_intelligence_snapshots to service_role;

drop policy if exists fi_patient_clinical_intel_snapshots_select_tenant_or_platform
  on public.fi_patient_clinical_intelligence_snapshots;
create policy fi_patient_clinical_intel_snapshots_select_tenant_or_platform
  on public.fi_patient_clinical_intelligence_snapshots
  for select
  to authenticated
  using (public.fi_os_can_select_clinical_intelligence_tenant_data(tenant_id));

grant select on public.fi_patient_clinical_intelligence_snapshots to authenticated;

drop trigger if exists trg_fi_patient_clinical_intel_snapshots_set_updated_at
  on public.fi_patient_clinical_intelligence_snapshots;
create trigger trg_fi_patient_clinical_intel_snapshots_set_updated_at
  before update on public.fi_patient_clinical_intelligence_snapshots
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();
