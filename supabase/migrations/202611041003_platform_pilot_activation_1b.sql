-- FI-CONTROLLED-PILOT-ACTIVATION-1B
-- Activation state, activation decisions, cohort candidate reviews.
-- Applying this migration MUST NOT activate the programme, enable invites,
-- enrol real patients, or enable Stripe.

-- ---------------------------------------------------------------------------
-- Programme activation_state (governance model; distinct from coarse status)
-- ---------------------------------------------------------------------------
alter table public.fi_pilot_programmes
  add column if not exists activation_state text not null default 'planned';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fi_pilot_programmes_activation_state_check'
  ) then
    alter table public.fi_pilot_programmes
      add constraint fi_pilot_programmes_activation_state_check
      check (activation_state in (
        'planned',
        'technical_validation',
        'governance_review',
        'approved_for_initial_invites',
        'initial_cohort_active',
        'hold',
        'paused',
        'completed',
        'cancelled'
      ));
  end if;
end $$;

comment on column public.fi_pilot_programmes.activation_state is
  'FI-CONTROLLED-PILOT-ACTIVATION-1B: governance activation state. Software must not set approved_for_initial_invites or initial_cohort_active without an auditable human decision record.';

-- Preserve invite / stripe safeguards in metadata for Evolved seed (no activation).
update public.fi_pilot_programmes
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'phase_1b', 'FI-CONTROLLED-PILOT-ACTIVATION-1B',
    'real_patient_invites', false,
    'stripe_enabled', false,
    'initial_pathway_lock', 'quote_to_deposit',
    'activation_gate_version', '1B.0.0'
  ),
  updated_at = now()
where programme_key = 'evolved_controlled_pilot_1a'
  and activation_state = 'planned';

-- ---------------------------------------------------------------------------
-- fi_pilot_activation_decisions
-- ---------------------------------------------------------------------------
create table if not exists public.fi_pilot_activation_decisions (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.fi_pilot_programmes (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  decision_type text not null
    check (decision_type in (
      'governance_review',
      'initial_invite_approval',
      'cohort_activation',
      'hold',
      'pause',
      'restart',
      'cancel',
      'defer'
    )),
  decision_state text not null
    check (decision_state in (
      'planned',
      'technical_validation',
      'governance_review',
      'approved_for_initial_invites',
      'initial_cohort_active',
      'hold',
      'paused',
      'completed',
      'cancelled'
    )),
  decision_version integer not null default 1
    check (decision_version >= 1),
  requested_at timestamptz not null default now(),
  requested_by uuid references public.fi_users (id) on delete set null,
  clinical_approved boolean not null default false,
  clinical_approved_by uuid references public.fi_users (id) on delete set null,
  clinical_approved_at timestamptz,
  privacy_approved boolean not null default false,
  privacy_approved_by uuid references public.fi_users (id) on delete set null,
  privacy_approved_at timestamptz,
  operations_approved boolean not null default false,
  operations_approved_by uuid references public.fi_users (id) on delete set null,
  operations_approved_at timestamptz,
  technical_approved boolean not null default false,
  technical_approved_by uuid references public.fi_users (id) on delete set null,
  technical_approved_at timestamptz,
  director_approved boolean not null default false,
  director_approved_by uuid references public.fi_users (id) on delete set null,
  director_approved_at timestamptz,
  cohort_approved boolean not null default false,
  cohort_approved_by uuid references public.fi_users (id) on delete set null,
  cohort_approved_at timestamptz,
  support_confirmed boolean not null default false,
  rollback_confirmed boolean not null default false,
  incident_response_confirmed boolean not null default false,
  staff_training_confirmed boolean not null default false,
  decision text not null default 'pending'
    check (decision in ('pending', 'approved', 'rejected', 'deferred', 'withdrawn')),
  decision_reason text,
  blockers_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pilot_activation_decisions_version_unique
    unique (tenant_id, programme_id, decision_type, decision_version),
  constraint fi_pilot_activation_decisions_blockers_array
    check (jsonb_typeof(blockers_json) = 'array'),
  constraint fi_pilot_activation_decisions_reason_length
    check (decision_reason is null or char_length(decision_reason) <= 4000),
  constraint fi_pilot_activation_decisions_final_reason
    check (decision = 'pending' or (decision_reason is not null and char_length(trim(decision_reason)) > 0))
);

comment on table public.fi_pilot_activation_decisions is
  'FI-CONTROLLED-PILOT-ACTIVATION-1B: auditable human activation decisions. Approvals name real actors; never inferred from roles or test results. Rejected/deferred rows remain in history.';

create index if not exists idx_fi_pilot_activation_decisions_tenant_programme
  on public.fi_pilot_activation_decisions (tenant_id, programme_id, decision_version desc);

create index if not exists idx_fi_pilot_activation_decisions_tenant_decision
  on public.fi_pilot_activation_decisions (tenant_id, decision, created_at desc);

-- ---------------------------------------------------------------------------
-- fi_pilot_cohort_candidate_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.fi_pilot_cohort_candidate_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  programme_id uuid not null references public.fi_pilot_programmes (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  pathway text not null
    check (pathway in (
      'consultation_to_quote',
      'quote_to_deposit',
      'pre_procedure_readiness',
      'postoperative_follow_up'
    )),
  status text not null default 'candidate'
    check (status in (
      'candidate',
      'preflight_in_progress',
      'eligible_for_clinical_review',
      'eligible_for_governance_review',
      'approved',
      'enrolled',
      'deferred',
      'excluded',
      'withdrawn'
    )),
  identity_preflight_eligible boolean,
  finance_preflight_eligible boolean,
  consent_preflight_eligible boolean,
  clinical_review_passed boolean,
  operational_review_passed boolean,
  support_owner_user_id uuid references public.fi_users (id) on delete set null,
  clinical_owner_user_id uuid references public.fi_users (id) on delete set null,
  operational_owner_user_id uuid references public.fi_users (id) on delete set null,
  decision text
    check (decision is null or decision in ('pending', 'approved', 'rejected', 'deferred', 'withdrawn')),
  decision_reason text,
  approved_by uuid references public.fi_users (id) on delete set null,
  decided_at timestamptz,
  preflight_json jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pilot_cohort_candidate_patient_programme_unique
    unique (tenant_id, programme_id, patient_id),
  constraint fi_pilot_cohort_candidate_preflight_object
    check (jsonb_typeof(preflight_json) = 'object'),
  constraint fi_pilot_cohort_candidate_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint fi_pilot_cohort_candidate_reason_length
    check (decision_reason is null or char_length(decision_reason) <= 4000)
);

comment on table public.fi_pilot_cohort_candidate_reviews is
  'FI-CONTROLLED-PILOT-ACTIVATION-1B: per-patient candidate review. No bulk approval. Synthetic/smoke fixtures must not be approved for live cohort.';

create index if not exists idx_fi_pilot_cohort_candidate_tenant_status
  on public.fi_pilot_cohort_candidate_reviews (tenant_id, status);

create index if not exists idx_fi_pilot_cohort_candidate_programme_status
  on public.fi_pilot_cohort_candidate_reviews (programme_id, status);

-- ---------------------------------------------------------------------------
-- RLS — tenant member SELECT; writes service_role only
-- ---------------------------------------------------------------------------
alter table public.fi_pilot_activation_decisions enable row level security;
alter table public.fi_pilot_cohort_candidate_reviews enable row level security;

drop policy if exists fi_pilot_activation_decisions_select_tenant_member
  on public.fi_pilot_activation_decisions;
create policy fi_pilot_activation_decisions_select_tenant_member
  on public.fi_pilot_activation_decisions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pilot_activation_decisions.tenant_id
    )
  );

drop policy if exists fi_pilot_cohort_candidate_reviews_select_tenant_member
  on public.fi_pilot_cohort_candidate_reviews;
create policy fi_pilot_cohort_candidate_reviews_select_tenant_member
  on public.fi_pilot_cohort_candidate_reviews for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pilot_cohort_candidate_reviews.tenant_id
    )
  );

grant select on public.fi_pilot_activation_decisions to authenticated, service_role;
grant insert, update, delete on public.fi_pilot_activation_decisions to service_role;

grant select on public.fi_pilot_cohort_candidate_reviews to authenticated, service_role;
grant insert, update, delete on public.fi_pilot_cohort_candidate_reviews to service_role;

-- ---------------------------------------------------------------------------
-- Activation decision history must never be hard-deleted by authenticated roles
-- (service_role may soft-archive via decision=withdrawn; prefer retain rows)
-- ---------------------------------------------------------------------------
comment on column public.fi_pilot_activation_decisions.decision is
  'Final outcome. Rejected and deferred decisions remain auditable; do not delete rows.';
