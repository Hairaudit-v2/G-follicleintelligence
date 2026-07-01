-- Patient Journey State Engine — canonical clinic lifecycle per foundation patient.

create table if not exists fi_patient_journey_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  current_state text not null,
  previous_state text,
  last_transition_at timestamptz not null default now(),
  transition_reason text not null default 'initial',
  manually_overridden_by uuid references fi_users (id) on delete set null,
  override_expires_at timestamptz,
  derived_state text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_journey_states_unique_patient unique (tenant_id, patient_id),
  constraint fi_patient_journey_states_current_nonempty check (char_length(trim(current_state)) > 0),
  constraint fi_patient_journey_states_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_patient_journey_states is
  'Canonical patient clinic lifecycle state (Patient Journey State Engine). One row per tenant patient.';

create index if not exists idx_fi_patient_journey_states_tenant_state
  on fi_patient_journey_states (tenant_id, current_state);

create table if not exists fi_patient_journey_transition_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  from_state text,
  to_state text not null,
  transition_reason text not null,
  source text not null default 'automatic',
  actor_fi_user_id uuid references fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_patient_journey_transition_source check (source in ('automatic', 'manual')),
  constraint fi_patient_journey_transition_to_nonempty check (char_length(trim(to_state)) > 0),
  constraint fi_patient_journey_transition_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table fi_patient_journey_transition_log is
  'Append-only audit log for patient journey state transitions.';

create index if not exists idx_fi_patient_journey_transition_tenant_patient_ts
  on fi_patient_journey_transition_log (tenant_id, patient_id, created_at desc);

alter table fi_patient_journey_states enable row level security;
alter table fi_patient_journey_transition_log enable row level security;

drop policy if exists fi_patient_journey_states_select_tenant_member on fi_patient_journey_states;
create policy fi_patient_journey_states_select_tenant_member
  on fi_patient_journey_states for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_journey_states.tenant_id
    )
  );

drop policy if exists fi_patient_journey_transition_log_select_tenant_member on fi_patient_journey_transition_log;
create policy fi_patient_journey_transition_log_select_tenant_member
  on fi_patient_journey_transition_log for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_journey_transition_log.tenant_id
    )
  );

grant select on fi_patient_journey_states to authenticated, service_role;
grant insert, update, delete on fi_patient_journey_states to service_role;
grant select on fi_patient_journey_transition_log to authenticated, service_role;
grant insert on fi_patient_journey_transition_log to service_role;