-- FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.3
-- Derived operational blocker register (not a clinical/financial SoR).
-- Ageing, acknowledgement, and escalation require persistence beyond stateless evaluation.

-- ---------------------------------------------------------------------------
-- fi_pilot_blockers
-- ---------------------------------------------------------------------------
create table if not exists public.fi_pilot_blockers (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.fi_pilot_programmes (id) on delete cascade,
  enrolment_id uuid not null references public.fi_pilot_enrolments (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  fingerprint text not null,
  category text not null,
  subcategory text,
  dimension text not null
    check (dimension in (
      'identity', 'clinical', 'financial', 'patient', 'operational', 'technical', 'governance'
    )),
  source_module text not null,
  source_record_id text,
  source_signal_key text,
  title text not null,
  summary text not null,
  recommended_next_action text not null,
  severity text not null
    check (severity in ('info', 'attention', 'high', 'critical')),
  state text not null default 'open'
    check (state in (
      'open', 'acknowledged', 'in_progress', 'resolved', 'superseded', 'dismissed'
    )),
  owner_type text not null,
  owner_user_id uuid references public.fi_users (id) on delete set null,
  owner_role text,
  assignment_source text not null
    check (assignment_source in (
      'canonical_record', 'programme_rule', 'module_default', 'escalation_rule', 'unresolved'
    )),
  ownership_reason text not null default '',
  first_detected_at timestamptz not null,
  last_confirmed_at timestamptz not null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.fi_users (id) on delete set null,
  resolved_at timestamptz,
  resolution_reason text,
  superseded_by text,
  escalation_level text not null default 'none'
    check (escalation_level in ('none', 'attention', 'high', 'critical')),
  escalated_at timestamptz,
  threshold_key text,
  requires_pilot_pause boolean not null default false,
  requires_immediate_review boolean not null default false,
  provenance_json jsonb not null default '[]'::jsonb,
  correlation_ids text[] not null default '{}',
  detected_by_version text not null default '1A.3.0',
  critical_integrity boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pilot_blockers_fingerprint_nonempty check (char_length(trim(fingerprint)) > 0),
  constraint fi_pilot_blockers_title_nonempty check (char_length(trim(title)) > 0),
  constraint fi_pilot_blockers_summary_nonempty check (char_length(trim(summary)) > 0),
  constraint fi_pilot_blockers_title_length check (char_length(title) <= 200),
  constraint fi_pilot_blockers_summary_length check (char_length(summary) <= 500),
  constraint fi_pilot_blockers_action_length check (char_length(recommended_next_action) <= 500),
  constraint fi_pilot_blockers_provenance_array check (jsonb_typeof(provenance_json) = 'array'),
  -- Tenant-safe: enrolment must belong to same tenant (enforced via trigger-friendly comment;
  -- app layer always filters tenant_id. FK cascade keeps referential integrity.)
  constraint fi_pilot_blockers_dismissed_requires_reason check (
    state <> 'dismissed'
    or (resolution_reason is not null and char_length(trim(resolution_reason)) > 0)
  )
);

comment on table public.fi_pilot_blockers is
  'FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.3: derived operational blockers. Not a clinical/financial system of record. No delete-on-resolution.';

-- Unique active fingerprint per programme + enrolment (recurrence = new occurrence after resolve)
create unique index if not exists uq_fi_pilot_blockers_active_fingerprint
  on public.fi_pilot_blockers (programme_id, enrolment_id, fingerprint)
  where state in ('open', 'acknowledged', 'in_progress');

create index if not exists idx_fi_pilot_blockers_tenant_state
  on public.fi_pilot_blockers (tenant_id, state, severity);

create index if not exists idx_fi_pilot_blockers_tenant_patient
  on public.fi_pilot_blockers (tenant_id, patient_id, state);

create index if not exists idx_fi_pilot_blockers_enrolment_active
  on public.fi_pilot_blockers (enrolment_id, state)
  where state in ('open', 'acknowledged', 'in_progress');

create index if not exists idx_fi_pilot_blockers_programme_pause
  on public.fi_pilot_blockers (programme_id, requires_pilot_pause)
  where requires_pilot_pause = true and state in ('open', 'acknowledged', 'in_progress');

-- ---------------------------------------------------------------------------
-- RLS — tenant member SELECT; writes service_role only
-- ---------------------------------------------------------------------------
alter table public.fi_pilot_blockers enable row level security;

drop policy if exists fi_pilot_blockers_select_tenant_member on public.fi_pilot_blockers;
create policy fi_pilot_blockers_select_tenant_member
  on public.fi_pilot_blockers for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pilot_blockers.tenant_id
    )
  );

grant select on public.fi_pilot_blockers to authenticated, service_role;
grant insert, update, delete on public.fi_pilot_blockers to service_role;
