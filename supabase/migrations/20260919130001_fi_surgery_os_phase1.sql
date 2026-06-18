-- SurgeryOS Phase 1 (additive): live surgical command centre tables.
-- Multi-tenant, RLS read for authenticated members, writes via service role only.

-- ---------------------------------------------------------------------------
-- fi_surgeries
-- ---------------------------------------------------------------------------
create table if not exists public.fi_surgeries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,

  surgeon_fi_user_id uuid references public.fi_users (id) on delete set null,

  status text not null default 'scheduled'
    check (status in ('scheduled', 'pre_op', 'in_progress', 'paused', 'completed', 'cancelled')),

  live_status text not null default 'waiting'
    check (live_status in ('waiting', 'active', 'break', 'delayed', 'blocked', 'completed')),

  procedure_phase text not null default 'pre_op'
    check (procedure_phase in (
      'pre_op',
      'patient_arrived',
      'design',
      'anaesthetic',
      'extraction',
      'extraction_paused',
      'break',
      'site_making',
      'implantation',
      'completed'
    )),

  target_grafts integer check (target_grafts is null or target_grafts >= 0),

  scheduled_date date not null,
  scheduled_start_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,

  readiness_percent smallint not null default 0
    check (readiness_percent >= 0 and readiness_percent <= 100),

  readiness_risk_level text not null default 'medium'
    check (readiness_risk_level in ('low', 'medium', 'high', 'blocked')),

  readiness_checklist jsonb not null default '{}'::jsonb,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_surgeries_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_surgeries_readiness_checklist_object check (jsonb_typeof (readiness_checklist) = 'object')
);

comment on table public.fi_surgeries is
  'SurgeryOS Phase 1: live surgery records for the surgical command centre. Writes via service role only.';

create index if not exists idx_fi_surgeries_tenant on public.fi_surgeries (tenant_id);
create index if not exists idx_fi_surgeries_tenant_scheduled_date on public.fi_surgeries (tenant_id, scheduled_date);
create index if not exists idx_fi_surgeries_tenant_status on public.fi_surgeries (tenant_id, status);
create index if not exists idx_fi_surgeries_tenant_live on public.fi_surgeries (tenant_id, live_status)
  where live_status in ('waiting', 'active', 'break', 'delayed', 'blocked');
create index if not exists idx_fi_surgeries_booking on public.fi_surgeries (booking_id)
  where booking_id is not null;
create index if not exists idx_fi_surgeries_case on public.fi_surgeries (case_id)
  where case_id is not null;

alter table public.fi_surgeries enable row level security;

drop policy if exists fi_surgeries_select_tenant_member on public.fi_surgeries;
create policy fi_surgeries_select_tenant_member
  on public.fi_surgeries for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_surgeries.tenant_id
    )
  );

grant select on public.fi_surgeries to authenticated, service_role;
grant insert, update, delete on public.fi_surgeries to service_role;

create or replace function public.fi_surgeries_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_surgeries_set_updated_at on public.fi_surgeries;
create trigger trg_fi_surgeries_set_updated_at
  before update on public.fi_surgeries
  for each row
  execute procedure public.fi_surgeries_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_surgery_procedure_events
-- ---------------------------------------------------------------------------
create table if not exists public.fi_surgery_procedure_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  surgery_id uuid not null references public.fi_surgeries (id) on delete cascade,

  event_kind text not null
    check (event_kind in (
      'patient_arrived',
      'design_approved',
      'anaesthetic_complete',
      'extraction_started',
      'extraction_paused',
      'break',
      'site_making_started',
      'implantation_started',
      'procedure_completed'
    )),

  occurred_at timestamptz not null default now(),
  recorded_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint fi_surgery_procedure_events_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_surgery_procedure_events is
  'SurgeryOS Phase 1: timestamped intra-operative procedure timeline events.';

create index if not exists idx_fi_surgery_procedure_events_tenant on public.fi_surgery_procedure_events (tenant_id);
create index if not exists idx_fi_surgery_procedure_events_surgery on public.fi_surgery_procedure_events (surgery_id, occurred_at asc);

alter table public.fi_surgery_procedure_events enable row level security;

drop policy if exists fi_surgery_procedure_events_select_tenant_member on public.fi_surgery_procedure_events;
create policy fi_surgery_procedure_events_select_tenant_member
  on public.fi_surgery_procedure_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_surgery_procedure_events.tenant_id
    )
  );

grant select on public.fi_surgery_procedure_events to authenticated, service_role;
grant insert, update, delete on public.fi_surgery_procedure_events to service_role;

-- ---------------------------------------------------------------------------
-- fi_surgery_team_assignments
-- ---------------------------------------------------------------------------
create table if not exists public.fi_surgery_team_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  surgery_id uuid not null references public.fi_surgeries (id) on delete cascade,
  fi_user_id uuid not null references public.fi_users (id) on delete cascade,

  role text not null
    check (role in ('surgeon', 'nurse', 'technician')),

  assignment_status text not null default 'assigned'
    check (assignment_status in ('assigned', 'confirmed', 'active', 'break', 'unavailable')),

  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint fi_surgery_team_assignments_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_surgery_team_assignments is
  'SurgeryOS Phase 1: surgical team roster and availability per live surgery.';

create index if not exists idx_fi_surgery_team_assignments_tenant on public.fi_surgery_team_assignments (tenant_id);
create index if not exists idx_fi_surgery_team_assignments_surgery on public.fi_surgery_team_assignments (surgery_id);
create unique index if not exists idx_fi_surgery_team_assignments_unique_role
  on public.fi_surgery_team_assignments (surgery_id, fi_user_id, role);

alter table public.fi_surgery_team_assignments enable row level security;

drop policy if exists fi_surgery_team_assignments_select_tenant_member on public.fi_surgery_team_assignments;
create policy fi_surgery_team_assignments_select_tenant_member
  on public.fi_surgery_team_assignments for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_surgery_team_assignments.tenant_id
    )
  );

grant select on public.fi_surgery_team_assignments to authenticated, service_role;
grant insert, update, delete on public.fi_surgery_team_assignments to service_role;

create or replace function public.fi_surgery_team_assignments_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_surgery_team_assignments_set_updated_at on public.fi_surgery_team_assignments;
create trigger trg_fi_surgery_team_assignments_set_updated_at
  before update on public.fi_surgery_team_assignments
  for each row
  execute procedure public.fi_surgery_team_assignments_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_surgery_operational_notes
-- ---------------------------------------------------------------------------
create table if not exists public.fi_surgery_operational_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  surgery_id uuid not null references public.fi_surgeries (id) on delete cascade,

  note_kind text not null
    check (note_kind in (
      'medication_administered',
      'patient_discomfort',
      'bleeding_event',
      'anaesthetic_top_up',
      'graft_issue',
      'complication_note',
      'general'
    )),

  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical', 'blocked')),

  body text not null,
  recorded_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint fi_surgery_operational_notes_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_surgery_operational_notes is
  'SurgeryOS Phase 1: intra-operative notes and clinical events during live surgery.';

create index if not exists idx_fi_surgery_operational_notes_tenant on public.fi_surgery_operational_notes (tenant_id);
create index if not exists idx_fi_surgery_operational_notes_surgery on public.fi_surgery_operational_notes (surgery_id, recorded_at desc);

alter table public.fi_surgery_operational_notes enable row level security;

drop policy if exists fi_surgery_operational_notes_select_tenant_member on public.fi_surgery_operational_notes;
create policy fi_surgery_operational_notes_select_tenant_member
  on public.fi_surgery_operational_notes for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_surgery_operational_notes.tenant_id
    )
  );

grant select on public.fi_surgery_operational_notes to authenticated, service_role;
grant insert, update, delete on public.fi_surgery_operational_notes to service_role;
