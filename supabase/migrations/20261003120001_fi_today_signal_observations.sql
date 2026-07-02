-- FI-UX-REBUILD D6B.5: Today signal learning observations (operational memory only).

create table if not exists public.fi_today_signal_observations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  signal_key text not null,
  entity_kind text,
  entity_id text,
  signal_type text not null,
  priority_band text
    check (priority_band is null or priority_band in ('critical', 'high', 'medium', 'low')),
  priority_score integer
    check (priority_score is null or (priority_score >= 0 and priority_score <= 100)),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by_role text,
  resolved_by_user_id uuid references public.fi_users (id) on delete set null,
  occurrence_count integer not null default 1
    check (occurrence_count >= 1),
  resolution_seconds integer
    check (resolution_seconds is null or resolution_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_today_signal_observations_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_today_signal_observations is
  'FI-UX D6B.5: tenant-scoped Today signal observations and resolution metrics (no PHI, no clinical source duplication).';

create unique index if not exists idx_fi_today_signal_observations_open_key
  on public.fi_today_signal_observations (tenant_id, signal_key)
  where resolved_at is null;

create index if not exists idx_fi_today_signal_observations_tenant_last_seen
  on public.fi_today_signal_observations (tenant_id, last_seen_at desc);

create index if not exists idx_fi_today_signal_observations_tenant_type_last_seen
  on public.fi_today_signal_observations (tenant_id, signal_type, last_seen_at desc);

create index if not exists idx_fi_today_signal_observations_tenant_resolved
  on public.fi_today_signal_observations (tenant_id, resolved_at desc)
  where resolved_at is not null;

alter table public.fi_today_signal_observations enable row level security;

drop policy if exists fi_today_signal_observations_select_tenant_member
  on public.fi_today_signal_observations;
create policy fi_today_signal_observations_select_tenant_member
  on public.fi_today_signal_observations for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_today_signal_observations.tenant_id
    )
  );

grant select on public.fi_today_signal_observations to authenticated, service_role;
grant insert, update, delete on public.fi_today_signal_observations to service_role;
