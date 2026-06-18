-- SurgeryOS Phase 2: Live graft intelligence (additive).
-- Graft session totals, count events, and timeline event kind extensions.

-- ---------------------------------------------------------------------------
-- fi_surgery_graft_sessions — running graft totals per live surgery
-- ---------------------------------------------------------------------------
create table if not exists public.fi_surgery_graft_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  surgery_id uuid not null references public.fi_surgeries (id) on delete cascade,

  phase text not null default 'extraction'
    check (phase in ('extraction', 'implantation', 'tray_count', 'reconciliation')),

  target_grafts integer check (target_grafts is null or target_grafts >= 0),
  extracted_grafts integer not null default 0 check (extracted_grafts >= 0),
  implanted_grafts integer not null default 0 check (implanted_grafts >= 0),
  discarded_grafts integer not null default 0 check (discarded_grafts >= 0),
  remaining_grafts integer not null default 0,

  singles integer not null default 0 check (singles >= 0),
  doubles integer not null default 0 check (doubles >= 0),
  triples integer not null default 0 check (triples >= 0),
  multiples integer not null default 0 check (multiples >= 0),

  total_hairs integer not null default 0 check (total_hairs >= 0),
  average_hairs_per_graft numeric(8, 2),

  reconciliation_status text not null default 'pending'
    check (reconciliation_status in ('pending', 'balanced', 'mismatch', 'completed')),

  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fi_surgery_graft_sessions is
  'SurgeryOS Phase 2: live graft count session totals per surgery. Writes via service role only.';

create unique index if not exists idx_fi_surgery_graft_sessions_surgery_unique
  on public.fi_surgery_graft_sessions (surgery_id);

create index if not exists idx_fi_surgery_graft_sessions_tenant
  on public.fi_surgery_graft_sessions (tenant_id);

alter table public.fi_surgery_graft_sessions enable row level security;

drop policy if exists fi_surgery_graft_sessions_select_tenant_member on public.fi_surgery_graft_sessions;
create policy fi_surgery_graft_sessions_select_tenant_member
  on public.fi_surgery_graft_sessions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_surgery_graft_sessions.tenant_id
    )
  );

grant select on public.fi_surgery_graft_sessions to authenticated, service_role;
grant insert, update, delete on public.fi_surgery_graft_sessions to service_role;

create or replace function public.fi_surgery_graft_sessions_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_surgery_graft_sessions_set_updated_at on public.fi_surgery_graft_sessions;
create trigger trg_fi_surgery_graft_sessions_set_updated_at
  before update on public.fi_surgery_graft_sessions
  for each row
  execute procedure public.fi_surgery_graft_sessions_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_surgery_graft_count_events — append-only graft count audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.fi_surgery_graft_count_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  surgery_id uuid not null references public.fi_surgeries (id) on delete cascade,
  session_id uuid not null references public.fi_surgery_graft_sessions (id) on delete cascade,

  event_type text not null
    check (event_type in (
      'count_update',
      'tray_count',
      'graft_reconciliation',
      'discard_logged',
      'correction'
    )),

  delta_extracted integer not null default 0,
  delta_implanted integer not null default 0,
  delta_discarded integer not null default 0,

  singles integer check (singles is null or singles >= 0),
  doubles integer check (doubles is null or doubles >= 0),
  triples integer check (triples is null or triples >= 0),
  multiples integer check (multiples is null or multiples >= 0),
  total_hairs integer check (total_hairs is null or total_hairs >= 0),

  note text,
  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.fi_surgery_graft_count_events is
  'SurgeryOS Phase 2: append-only graft count events for live surgical tracking.';

create index if not exists idx_fi_surgery_graft_count_events_tenant
  on public.fi_surgery_graft_count_events (tenant_id);

create index if not exists idx_fi_surgery_graft_count_events_surgery
  on public.fi_surgery_graft_count_events (surgery_id, created_at asc);

create index if not exists idx_fi_surgery_graft_count_events_session
  on public.fi_surgery_graft_count_events (session_id, created_at asc);

alter table public.fi_surgery_graft_count_events enable row level security;

drop policy if exists fi_surgery_graft_count_events_select_tenant_member on public.fi_surgery_graft_count_events;
create policy fi_surgery_graft_count_events_select_tenant_member
  on public.fi_surgery_graft_count_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_surgery_graft_count_events.tenant_id
    )
  );

grant select on public.fi_surgery_graft_count_events to authenticated, service_role;
grant insert, update, delete on public.fi_surgery_graft_count_events to service_role;

-- ---------------------------------------------------------------------------
-- fi_surgery_procedure_events — graft timeline event kinds
-- ---------------------------------------------------------------------------
alter table public.fi_surgery_procedure_events drop constraint if exists fi_surgery_procedure_events_event_kind_check;
alter table public.fi_surgery_procedure_events add constraint fi_surgery_procedure_events_event_kind_check
  check (event_kind in (
    'patient_arrived',
    'design_approved',
    'anaesthetic_complete',
    'extraction_started',
    'extraction_paused',
    'extraction_resumed',
    'break',
    'break_started',
    'break_ended',
    'site_making_started',
    'implantation_started',
    'procedure_completed',
    'phase_transition',
    'custom',
    'graft_count_update',
    'tray_count_recorded',
    'graft_reconciliation_completed',
    'graft_correction'
  ));
