-- Procedure Day Board Sprint 5B — live surgical session workflow (additive).

create table if not exists fi_procedure_day_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  booking_id uuid not null references fi_bookings (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  case_id uuid references fi_cases (id) on delete set null,
  current_stage text not null default 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_procedure_day_sessions_unique_booking unique (tenant_id, booking_id),
  constraint fi_procedure_day_sessions_stage_nonempty check (char_length(trim(current_stage)) > 0),
  constraint fi_procedure_day_sessions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_procedure_day_sessions is
  'Live Procedure Day Board session — one row per today surgery booking when workflow is started.';

create index if not exists idx_fi_procedure_day_sessions_tenant_stage
  on fi_procedure_day_sessions (tenant_id, current_stage);

create index if not exists idx_fi_procedure_day_sessions_tenant_patient
  on fi_procedure_day_sessions (tenant_id, patient_id);

create table if not exists fi_procedure_day_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  session_id uuid not null references fi_procedure_day_sessions (id) on delete cascade,
  booking_id uuid not null references fi_bookings (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  event_type text not null,
  from_stage text,
  to_stage text,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fi_procedure_day_events_type_nonempty check (char_length(trim(event_type)) > 0),
  constraint fi_procedure_day_events_payload_object check (jsonb_typeof(payload) = 'object')
);

comment on table fi_procedure_day_events is
  'Append-only Procedure Day workflow audit trail (stage transitions, metrics, completion).';

create index if not exists idx_fi_procedure_day_events_session_ts
  on fi_procedure_day_events (session_id, created_at desc);

create index if not exists idx_fi_procedure_day_events_tenant_booking_ts
  on fi_procedure_day_events (tenant_id, booking_id, created_at desc);

alter table fi_procedure_day_sessions enable row level security;
alter table fi_procedure_day_events enable row level security;

drop policy if exists fi_procedure_day_sessions_select_tenant_member on fi_procedure_day_sessions;
create policy fi_procedure_day_sessions_select_tenant_member
  on fi_procedure_day_sessions for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_procedure_day_sessions.tenant_id
    )
  );

drop policy if exists fi_procedure_day_events_select_tenant_member on fi_procedure_day_events;
create policy fi_procedure_day_events_select_tenant_member
  on fi_procedure_day_events for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_procedure_day_events.tenant_id
    )
  );

grant select on fi_procedure_day_sessions to authenticated, service_role;
grant insert, update, delete on fi_procedure_day_sessions to service_role;
grant select on fi_procedure_day_events to authenticated, service_role;
grant insert on fi_procedure_day_events to service_role;