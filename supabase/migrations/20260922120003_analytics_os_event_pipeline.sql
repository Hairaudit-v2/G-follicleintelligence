-- AnalyticsOS Phase A — unified intelligence event pipeline (fi_analytics_events).

create table if not exists public.fi_analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,
  module_name text not null,
  event_type text not null,
  entity_id uuid,
  entity_type text,
  event_value numeric,
  event_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint fi_analytics_events_module_name check (
    module_name in (
      'workforce_os',
      'surgery_os',
      'financial_os',
      'consultation_os',
      'patient_os',
      'clinic_os',
      'leadflow',
      'imaging_os',
      'audit_os'
    )
  )
);

comment on table public.fi_analytics_events is
  'AnalyticsOS: normalized intelligence events from every FI OS module. Append-only ingest via service role; tenant-scoped reads for authenticated members.';

create index if not exists idx_fi_analytics_events_tenant_id
  on public.fi_analytics_events (tenant_id);

create index if not exists idx_fi_analytics_events_tenant_module
  on public.fi_analytics_events (tenant_id, module_name);

create index if not exists idx_fi_analytics_events_tenant_event_type
  on public.fi_analytics_events (tenant_id, event_type);

create index if not exists idx_fi_analytics_events_tenant_occurred_at
  on public.fi_analytics_events (tenant_id, occurred_at desc);

create index if not exists idx_fi_analytics_events_entity_id
  on public.fi_analytics_events (entity_id)
  where entity_id is not null;

alter table public.fi_analytics_events enable row level security;

drop policy if exists fi_analytics_events_select_tenant_member on public.fi_analytics_events;
create policy fi_analytics_events_select_tenant_member
  on public.fi_analytics_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_analytics_events.tenant_id
    )
  );

grant select on public.fi_analytics_events to authenticated, service_role;
grant insert, update, delete on public.fi_analytics_events to service_role;
