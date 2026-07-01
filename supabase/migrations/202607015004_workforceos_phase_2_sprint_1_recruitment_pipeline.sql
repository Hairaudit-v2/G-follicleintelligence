-- WorkforceOS Phase 2 Sprint 1: recruitment pipeline engine (commercial intelligence foundation).

create table if not exists public.fi_workforce_role_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  role_code text not null,
  display_name text not null,
  description text,
  requirements_json jsonb not null default '{}'::jsonb,
  onboarding_template_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_workforce_role_requirements_role_code_nonempty check (char_length(trim(role_code)) > 0),
  constraint fi_workforce_role_requirements_display_name_nonempty check (char_length(trim(display_name)) > 0),
  constraint fi_workforce_role_requirements_requirements_object check (jsonb_typeof(requirements_json) = 'object')
);

comment on table public.fi_workforce_role_requirements is
  'WorkforceOS Phase 2: tenant role hiring requirements linked to onboarding templates.';

create unique index if not exists idx_fi_workforce_role_requirements_tenant_role
  on public.fi_workforce_role_requirements (tenant_id, lower(role_code))
  where is_active = true;

create index if not exists idx_fi_workforce_role_requirements_tenant_active
  on public.fi_workforce_role_requirements (tenant_id, is_active);

create table if not exists public.fi_workforce_recruitment_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  role_requirement_id uuid references public.fi_workforce_role_requirements (id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  source text not null default 'direct',
  pipeline_stage text not null default 'applied',
  offer_status text not null default 'none',
  onboarding_template_code text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  assigned_to_user_id uuid references public.fi_users (id) on delete set null,
  hired_staff_member_id uuid references public.fi_staff_members (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_workforce_recruitment_candidates_full_name_nonempty check (char_length(trim(full_name)) > 0),
  constraint fi_workforce_recruitment_candidates_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_workforce_recruitment_candidates_pipeline_stage_chk check (
    pipeline_stage in (
      'applied',
      'screening',
      'interview',
      'clinical_assessment',
      'reference_check',
      'offer',
      'hired',
      'withdrawn'
    )
  ),
  constraint fi_workforce_recruitment_candidates_offer_status_chk check (
    offer_status in ('none', 'draft', 'extended', 'accepted', 'declined', 'expired')
  ),
  constraint fi_workforce_recruitment_candidates_source_chk check (
    source in ('direct', 'referral', 'agency', 'linkedin', 'internal', 'other')
  )
);

comment on table public.fi_workforce_recruitment_candidates is
  'WorkforceOS Phase 2: recruitment candidates with pipeline stage and offer tracking.';

create index if not exists idx_fi_workforce_recruitment_candidates_tenant_stage
  on public.fi_workforce_recruitment_candidates (tenant_id, pipeline_stage)
  where archived_at is null;

create index if not exists idx_fi_workforce_recruitment_candidates_tenant_role
  on public.fi_workforce_recruitment_candidates (tenant_id, role_requirement_id)
  where archived_at is null;

create table if not exists public.fi_workforce_recruitment_stage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  candidate_id uuid not null references public.fi_workforce_recruitment_candidates (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  offer_status text,
  notes text,
  recorded_by_user_id uuid references public.fi_users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint fi_workforce_recruitment_stage_events_to_stage_chk check (
    to_stage in (
      'applied',
      'screening',
      'interview',
      'clinical_assessment',
      'reference_check',
      'offer',
      'hired',
      'withdrawn'
    )
  )
);

comment on table public.fi_workforce_recruitment_stage_events is
  'WorkforceOS Phase 2: auditable recruitment stage transitions per candidate.';

create index if not exists idx_fi_workforce_recruitment_stage_events_candidate
  on public.fi_workforce_recruitment_stage_events (tenant_id, candidate_id, recorded_at desc);

alter table public.fi_workforce_role_requirements enable row level security;
alter table public.fi_workforce_recruitment_candidates enable row level security;
alter table public.fi_workforce_recruitment_stage_events enable row level security;

grant select, insert, update, delete on public.fi_workforce_role_requirements to service_role;
grant select, insert, update, delete on public.fi_workforce_recruitment_candidates to service_role;
grant select, insert, update, delete on public.fi_workforce_recruitment_stage_events to service_role;