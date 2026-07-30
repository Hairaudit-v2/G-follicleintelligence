-- FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.1
-- Canonical pilot programme + enrolment cohort (system of record for membership only).
-- Does not infer pilot participation from quotes, appointments, or clinical activity.
-- Readiness / blockers remain derived in application layer (1A.2+); no competing SoR.

-- ---------------------------------------------------------------------------
-- fi_pilot_programmes
-- ---------------------------------------------------------------------------
create table if not exists public.fi_pilot_programmes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  programme_key text not null,
  display_name text not null,
  description text,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'paused', 'completed', 'cancelled')),
  cohort_key text not null default 'default',
  starts_at timestamptz,
  ends_at timestamptz,
  -- Configurable escalation thresholds (hours unless noted). Fail-closed defaults in app contracts.
  escalation_thresholds jsonb not null default '{
    "patient_action_overdue_attention_hours": 24,
    "clinic_action_overdue_attention_business_days": 1,
    "patient_inactive_attention_days": 3,
    "unread_message_attention_business_hours": 4,
    "surgery_window_high_days": 7,
    "blocked_high_days": 3,
    "high_blocker_amber_limit": 5,
    "technical_completion_rate_green_min": 0.95
  }'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.fi_users (id) on delete set null,
  constraint fi_pilot_programmes_tenant_key_unique unique (tenant_id, programme_key),
  constraint fi_pilot_programmes_key_nonempty check (char_length(trim(programme_key)) > 0),
  constraint fi_pilot_programmes_name_nonempty check (char_length(trim(display_name)) > 0),
  constraint fi_pilot_programmes_cohort_nonempty check (char_length(trim(cohort_key)) > 0),
  constraint fi_pilot_programmes_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_pilot_programmes_thresholds_object check (jsonb_typeof(escalation_thresholds) = 'object')
);

comment on table public.fi_pilot_programmes is
  'FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A: tenant-scoped pilot programme definitions. Membership is via fi_pilot_enrolments only.';

create index if not exists idx_fi_pilot_programmes_tenant_status
  on public.fi_pilot_programmes (tenant_id, status);

-- ---------------------------------------------------------------------------
-- fi_pilot_enrolments
-- ---------------------------------------------------------------------------
create table if not exists public.fi_pilot_enrolments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  programme_id uuid not null references public.fi_pilot_programmes (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  pilot_programme_key text not null,
  pilot_cohort text not null default 'default',
  enrolment_status text not null default 'candidate'
    check (enrolment_status in (
      'candidate',
      'approved',
      'invited',
      'activated',
      'active',
      'paused',
      'completed',
      'withdrawn',
      'excluded'
    )),
  enrolled_at timestamptz,
  invited_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  withdrawn_at timestamptz,
  excluded_at timestamptz,
  enrolled_by uuid references public.fi_users (id) on delete set null,
  approved_by uuid references public.fi_users (id) on delete set null,
  operational_owner_user_id uuid references public.fi_users (id) on delete set null,
  operational_owner_role text,
  notes text,
  exclusion_reason text,
  withdrawal_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pilot_enrolments_patient_programme_unique unique (tenant_id, programme_id, patient_id),
  constraint fi_pilot_enrolments_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_pilot_enrolments_programme_key_nonempty check (char_length(trim(pilot_programme_key)) > 0),
  constraint fi_pilot_enrolments_cohort_nonempty check (char_length(trim(pilot_cohort)) > 0),
  constraint fi_pilot_enrolments_notes_length check (notes is null or char_length(notes) <= 4000),
  constraint fi_pilot_enrolments_exclusion_length check (exclusion_reason is null or char_length(exclusion_reason) <= 2000),
  constraint fi_pilot_enrolments_withdrawal_length check (withdrawal_reason is null or char_length(withdrawal_reason) <= 2000),
  constraint fi_pilot_enrolments_excluded_requires_reason check (
    enrolment_status <> 'excluded' or (exclusion_reason is not null and char_length(trim(exclusion_reason)) > 0)
  )
);

comment on table public.fi_pilot_enrolments is
  'FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A: explicit pilot cohort membership. No patient appears in the pilot without a row here.';

create index if not exists idx_fi_pilot_enrolments_tenant_status
  on public.fi_pilot_enrolments (tenant_id, enrolment_status);

create index if not exists idx_fi_pilot_enrolments_tenant_patient
  on public.fi_pilot_enrolments (tenant_id, patient_id);

create index if not exists idx_fi_pilot_enrolments_programme_status
  on public.fi_pilot_enrolments (programme_id, enrolment_status);

create index if not exists idx_fi_pilot_enrolments_tenant_cohort_status
  on public.fi_pilot_enrolments (tenant_id, pilot_cohort, enrolment_status);

-- Active operational membership (excludes terminal withdrawn/excluded; completed kept for history queries separately)
create index if not exists idx_fi_pilot_enrolments_active_ops
  on public.fi_pilot_enrolments (tenant_id, programme_id)
  where enrolment_status in ('approved', 'invited', 'activated', 'active', 'paused');

-- ---------------------------------------------------------------------------
-- fi_pilot_control_events (adoption / operational telemetry — no clinical content)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_pilot_control_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  programme_id uuid references public.fi_pilot_programmes (id) on delete set null,
  enrolment_id uuid references public.fi_pilot_enrolments (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,
  pilot_cohort text,
  event_kind text not null,
  actor_type text not null default 'system'
    check (actor_type in ('system', 'staff', 'patient', 'integration')),
  actor_id uuid,
  source_module text not null,
  source_record_type text,
  source_record_id uuid,
  correlation_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_pilot_control_events_kind_nonempty check (char_length(trim(event_kind)) > 0),
  constraint fi_pilot_control_events_source_nonempty check (char_length(trim(source_module)) > 0),
  constraint fi_pilot_control_events_payload_object check (jsonb_typeof(payload) = 'object')
);

comment on table public.fi_pilot_control_events is
  'FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A: operational pilot telemetry. Must not store clinical findings or message bodies.';

create index if not exists idx_fi_pilot_control_events_tenant_created
  on public.fi_pilot_control_events (tenant_id, created_at desc);

create index if not exists idx_fi_pilot_control_events_tenant_kind_created
  on public.fi_pilot_control_events (tenant_id, event_kind, created_at desc);

create index if not exists idx_fi_pilot_control_events_tenant_patient_created
  on public.fi_pilot_control_events (tenant_id, patient_id, created_at desc)
  where patient_id is not null;

-- ---------------------------------------------------------------------------
-- RLS — tenant member SELECT; writes service_role only (staff mutations via API later)
-- ---------------------------------------------------------------------------
alter table public.fi_pilot_programmes enable row level security;
alter table public.fi_pilot_enrolments enable row level security;
alter table public.fi_pilot_control_events enable row level security;

drop policy if exists fi_pilot_programmes_select_tenant_member on public.fi_pilot_programmes;
create policy fi_pilot_programmes_select_tenant_member
  on public.fi_pilot_programmes for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pilot_programmes.tenant_id
    )
  );

drop policy if exists fi_pilot_enrolments_select_tenant_member on public.fi_pilot_enrolments;
create policy fi_pilot_enrolments_select_tenant_member
  on public.fi_pilot_enrolments for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pilot_enrolments.tenant_id
    )
  );

drop policy if exists fi_pilot_control_events_select_tenant_member on public.fi_pilot_control_events;
create policy fi_pilot_control_events_select_tenant_member
  on public.fi_pilot_control_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pilot_control_events.tenant_id
    )
  );

grant select on public.fi_pilot_programmes to authenticated, service_role;
grant insert, update, delete on public.fi_pilot_programmes to service_role;

grant select on public.fi_pilot_enrolments to authenticated, service_role;
grant insert, update, delete on public.fi_pilot_enrolments to service_role;

grant select on public.fi_pilot_control_events to authenticated, service_role;
grant insert on public.fi_pilot_control_events to service_role;

-- ---------------------------------------------------------------------------
-- Seed Evolved Hair Restoration controlled-pilot programme (no patient enrolments).
-- Patient rows must be approved explicitly — never inferred from activity.
-- ---------------------------------------------------------------------------
insert into public.fi_pilot_programmes (
  tenant_id,
  programme_key,
  display_name,
  description,
  status,
  cohort_key,
  starts_at,
  metadata
)
select
  t.id,
  'evolved_controlled_pilot_1a',
  'Evolved Hair Restoration — Controlled Pilot',
  'Read-only operational command centre cohort for Evolved Hair Restoration. Membership is explicit via fi_pilot_enrolments only.',
  'planned',
  'evolved_hr_1a',
  now(),
  jsonb_build_object(
    'phase', 'FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A',
    'clinic_slug', 'evolved-hair',
    'real_patient_invites', false,
    'stripe_enabled', false,
    'generative_imaging_enabled', false
  )
from public.fi_tenants t
where t.id = 'c2615b95-b707-4485-aa5f-be8f78ec868a'::uuid
   or t.slug = 'evolved-hair'
on conflict (tenant_id, programme_key) do nothing;
