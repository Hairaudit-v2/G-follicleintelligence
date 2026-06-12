-- FI OS Stage 3.75: staff intelligence infrastructure (profiles + events). No automation; service_role writes.
-- Reads are expected from trusted Next.js server routes using service_role (RLS enabled, no authenticated grants).

-- ---------------------------------------------------------------------------
-- fi_staff_performance_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_performance_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_id uuid not null references public.fi_staff (id) on delete cascade,
  profile_period_start date not null,
  profile_period_end date not null,
  signal_summary jsonb not null default '{}'::jsonb,
  recommendation_summary jsonb not null default '{}'::jsonb,
  risk_flags jsonb not null default '{}'::jsonb,
  visibility_scope text not null default 'manager_only',
  computed_at timestamptz not null default now(),
  computed_by text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_performance_profiles_signal_summary_object check (jsonb_typeof(signal_summary) = 'object'),
  constraint fi_staff_performance_profiles_recommendation_summary_object check (jsonb_typeof(recommendation_summary) = 'object'),
  constraint fi_staff_performance_profiles_risk_flags_object check (jsonb_typeof(risk_flags) = 'object'),
  constraint fi_staff_performance_profiles_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_staff_performance_profiles_visibility_scope_chk check (
    visibility_scope in ('manager_only', 'director_only', 'staff_self')
  ),
  constraint fi_staff_performance_profiles_period_chk check (profile_period_end >= profile_period_start)
);

comment on table public.fi_staff_performance_profiles is
  'FI OS Stage 3.75: structured staff intelligence snapshots (manager-first; optional staff_self scope in app policy).';

create unique index if not exists idx_fi_staff_performance_profiles_period_unique
  on public.fi_staff_performance_profiles (tenant_id, staff_id, profile_period_start, profile_period_end);

create index if not exists idx_fi_staff_performance_profiles_tenant_staff
  on public.fi_staff_performance_profiles (tenant_id, staff_id);

create index if not exists idx_fi_staff_performance_profiles_tenant_period
  on public.fi_staff_performance_profiles (tenant_id, profile_period_start, profile_period_end);

create index if not exists idx_fi_staff_performance_profiles_computed_at
  on public.fi_staff_performance_profiles (computed_at desc);

alter table public.fi_staff_performance_profiles enable row level security;

grant select, insert, update, delete on public.fi_staff_performance_profiles to service_role;

drop trigger if exists trg_fi_staff_performance_profiles_set_updated_at on public.fi_staff_performance_profiles;
create trigger trg_fi_staff_performance_profiles_set_updated_at
  before update on public.fi_staff_performance_profiles
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_staff_intelligence_events
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_id uuid references public.fi_staff (id) on delete set null,
  event_type text not null,
  signal_key text,
  severity text not null default 'info',
  title text not null,
  description text,
  source_table text,
  source_id uuid,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_staff_intelligence_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_staff_intelligence_events_severity_chk check (severity in ('info', 'attention', 'critical'))
);

comment on table public.fi_staff_intelligence_events is
  'FI OS Stage 3.75: append-only style intelligence / support events for future AI and audit (no workflow automation in 3.75).';

create index if not exists idx_fi_staff_intelligence_events_tenant_staff
  on public.fi_staff_intelligence_events (tenant_id, staff_id);

create index if not exists idx_fi_staff_intelligence_events_tenant_signal
  on public.fi_staff_intelligence_events (tenant_id, signal_key);

create index if not exists idx_fi_staff_intelligence_events_tenant_severity
  on public.fi_staff_intelligence_events (tenant_id, severity);

create index if not exists idx_fi_staff_intelligence_events_occurred_at
  on public.fi_staff_intelligence_events (occurred_at desc);

alter table public.fi_staff_intelligence_events enable row level security;

grant select, insert, update, delete on public.fi_staff_intelligence_events to service_role;
