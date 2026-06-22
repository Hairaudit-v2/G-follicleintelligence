-- AcademyOS Phase B — competency projection store + import audit trail.
-- IIOHR exports sanitized competency intelligence; FI OS stores operational projections only.

create table if not exists public.fi_staff_competency_projections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_id uuid not null references public.fi_staff (id) on delete cascade,
  source_system text not null default 'iiohr_academy',
  global_professional_id text,
  iiohr_user_id text,
  academy_profile_id text,
  competency_key text not null,
  competency_status text not null,
  readiness_band text,
  certification_level text,
  evidence_count integer not null default 0,
  latest_certificate text,
  source_export_event_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_competency_projections_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_staff_competency_projections_status check (
    competency_status in ('active', 'expiring', 'expired', 'restricted', 'suspended')
  ),
  constraint fi_staff_competency_projections_readiness_band check (
    readiness_band is null
    or readiness_band in ('early', 'developing', 'supervised', 'advanced')
  ),
  constraint fi_staff_competency_projections_evidence_count_nonneg check (evidence_count >= 0)
);

comment on table public.fi_staff_competency_projections is
  'AcademyOS: operational competency projections exported from IIOHR. Not the educational system of record.';

create unique index if not exists idx_fi_staff_competency_projections_tenant_staff_key
  on public.fi_staff_competency_projections (tenant_id, staff_id, competency_key);

create index if not exists idx_fi_staff_competency_projections_tenant_id
  on public.fi_staff_competency_projections (tenant_id);

create index if not exists idx_fi_staff_competency_projections_staff_id
  on public.fi_staff_competency_projections (staff_id);

create index if not exists idx_fi_staff_competency_projections_global_professional_id
  on public.fi_staff_competency_projections (global_professional_id)
  where global_professional_id is not null;

create index if not exists idx_fi_staff_competency_projections_competency_key
  on public.fi_staff_competency_projections (competency_key);

create index if not exists idx_fi_staff_competency_projections_tenant_status
  on public.fi_staff_competency_projections (tenant_id, competency_status);

alter table public.fi_staff_competency_projections enable row level security;

drop policy if exists fi_staff_competency_projections_select_tenant_member
  on public.fi_staff_competency_projections;
create policy fi_staff_competency_projections_select_tenant_member
  on public.fi_staff_competency_projections for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_competency_projections.tenant_id
    )
  );

grant select on public.fi_staff_competency_projections to authenticated, service_role;
grant insert, update, delete on public.fi_staff_competency_projections to service_role;

-- Inbound export processing audit trail.

create table if not exists public.fi_competency_import_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete set null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  failure_reason text,
  processed_at timestamptz not null default now(),
  constraint fi_competency_import_events_status check (
    status in ('processed', 'failed', 'unresolved_staff', 'validation_failed')
  ),
  constraint fi_competency_import_events_payload_object check (jsonb_typeof(payload) = 'object')
);

comment on table public.fi_competency_import_events is
  'AcademyOS: audit log for inbound IIOHR competency export processing.';

create index if not exists idx_fi_competency_import_events_status
  on public.fi_competency_import_events (status);

create index if not exists idx_fi_competency_import_events_processed_at
  on public.fi_competency_import_events (processed_at desc);

alter table public.fi_competency_import_events enable row level security;

drop policy if exists fi_competency_import_events_select_tenant_member on public.fi_competency_import_events;
create policy fi_competency_import_events_select_tenant_member
  on public.fi_competency_import_events for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_competency_import_events.tenant_id
    )
  );

grant select on public.fi_competency_import_events to authenticated, service_role;
grant insert, update, delete on public.fi_competency_import_events to service_role;

-- AnalyticsOS: allow academy_os module events (only when fi_analytics_events exists).

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'fi_analytics_events'
  ) then
    alter table public.fi_analytics_events drop constraint if exists fi_analytics_events_module_name;

    alter table public.fi_analytics_events add constraint fi_analytics_events_module_name check (
      module_name in (
        'workforce_os',
        'surgery_os',
        'financial_os',
        'consultation_os',
        'patient_os',
        'clinic_os',
        'leadflow',
        'imaging_os',
        'audit_os',
        'academy_os'
      )
    );
  end if;
end $$;
