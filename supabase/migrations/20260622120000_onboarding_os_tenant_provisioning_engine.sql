-- OnboardingOS Phase A: tenant provisioning engine foundation.
-- RLS: service_role DML only — platform admin flows run in Next.js via supabaseAdmin.

-- ---------------------------------------------------------------------------
-- fi_tenant_provisioning_templates — reusable role/module onboarding presets
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_provisioning_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  display_name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  role_template jsonb not null default '{}'::jsonb,
  module_template jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_provisioning_templates_code_unique unique (code),
  constraint fi_tenant_provisioning_templates_code_nonempty check (char_length(trim(code)) > 0),
  constraint fi_tenant_provisioning_templates_display_name_nonempty check (char_length(trim(display_name)) > 0),
  constraint fi_tenant_provisioning_templates_role_template_object check (jsonb_typeof(role_template) = 'object'),
  constraint fi_tenant_provisioning_templates_module_template_object check (jsonb_typeof(module_template) = 'object'),
  constraint fi_tenant_provisioning_templates_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_provisioning_templates is
  'OnboardingOS: reusable tenant provisioning presets (roles, modules). Service-role only.';

create index if not exists idx_fi_tenant_provisioning_templates_code
  on public.fi_tenant_provisioning_templates (code);

create index if not exists idx_fi_tenant_provisioning_templates_default_active
  on public.fi_tenant_provisioning_templates (is_default, is_active);

-- ---------------------------------------------------------------------------
-- fi_tenant_provisioning_sessions — platform admin onboarding session tracker
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_provisioning_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete set null,
  template_id uuid references public.fi_tenant_provisioning_templates (id) on delete set null,
  status text not null default 'draft',
  tenant_name text not null,
  tenant_slug text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  progress_percent integer not null default 0,
  current_step_code text,
  error_message text,
  retry_count integer not null default 0,
  actor_auth_user_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_provisioning_sessions_status_chk check (
    status in ('draft', 'in_progress', 'ready_for_review', 'completed', 'failed', 'cancelled')
  ),
  constraint fi_tenant_provisioning_sessions_tenant_name_nonempty check (char_length(trim(tenant_name)) > 0),
  constraint fi_tenant_provisioning_sessions_tenant_slug_nonempty check (char_length(trim(tenant_slug)) > 0),
  constraint fi_tenant_provisioning_sessions_progress_percent_chk check (
    progress_percent >= 0 and progress_percent <= 100
  ),
  constraint fi_tenant_provisioning_sessions_retry_count_nonneg check (retry_count >= 0),
  constraint fi_tenant_provisioning_sessions_input_snapshot_object check (jsonb_typeof(input_snapshot) = 'object'),
  constraint fi_tenant_provisioning_sessions_result_snapshot_object check (jsonb_typeof(result_snapshot) = 'object'),
  constraint fi_tenant_provisioning_sessions_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_provisioning_sessions is
  'OnboardingOS: platform-admin tenant provisioning sessions. tenant_id set after core provision step.';

create index if not exists idx_fi_tenant_provisioning_sessions_tenant_id
  on public.fi_tenant_provisioning_sessions (tenant_id)
  where tenant_id is not null;

create index if not exists idx_fi_tenant_provisioning_sessions_status
  on public.fi_tenant_provisioning_sessions (status);

create index if not exists idx_fi_tenant_provisioning_sessions_created_at
  on public.fi_tenant_provisioning_sessions (created_at desc);

create index if not exists idx_fi_tenant_provisioning_sessions_slug
  on public.fi_tenant_provisioning_sessions (tenant_slug);

-- ---------------------------------------------------------------------------
-- fi_tenant_provisioning_steps — ordered step execution within a session
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_provisioning_steps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.fi_tenant_provisioning_sessions (id) on delete cascade,
  step_code text not null,
  step_order integer not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_provisioning_steps_session_step_unique unique (session_id, step_code),
  constraint fi_tenant_provisioning_steps_step_code_nonempty check (char_length(trim(step_code)) > 0),
  constraint fi_tenant_provisioning_steps_step_order_positive check (step_order > 0),
  constraint fi_tenant_provisioning_steps_status_chk check (
    status in ('pending', 'running', 'completed', 'failed', 'skipped', 'retry_pending')
  ),
  constraint fi_tenant_provisioning_steps_attempt_count_nonneg check (attempt_count >= 0),
  constraint fi_tenant_provisioning_steps_max_attempts_positive check (max_attempts > 0),
  constraint fi_tenant_provisioning_steps_input_snapshot_object check (jsonb_typeof(input_snapshot) = 'object'),
  constraint fi_tenant_provisioning_steps_output_snapshot_object check (jsonb_typeof(output_snapshot) = 'object'),
  constraint fi_tenant_provisioning_steps_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_provisioning_steps is
  'OnboardingOS: per-session provisioning steps with retry/error snapshots.';

create index if not exists idx_fi_tenant_provisioning_steps_session_id
  on public.fi_tenant_provisioning_steps (session_id);

create index if not exists idx_fi_tenant_provisioning_steps_status
  on public.fi_tenant_provisioning_steps (status);

create index if not exists idx_fi_tenant_provisioning_steps_session_order
  on public.fi_tenant_provisioning_steps (session_id, step_order);

-- ---------------------------------------------------------------------------
-- fi_tenant_provisioning_audit_events — append-only provisioning audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_provisioning_audit_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.fi_tenant_provisioning_sessions (id) on delete cascade,
  tenant_id uuid references public.fi_tenants (id) on delete set null,
  event_kind text not null,
  actor_auth_user_id uuid,
  step_code text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_tenant_provisioning_audit_events_event_kind_nonempty check (char_length(trim(event_kind)) > 0),
  constraint fi_tenant_provisioning_audit_events_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_tenant_provisioning_audit_events is
  'OnboardingOS: append-only audit for tenant provisioning sessions and steps.';

create index if not exists idx_fi_tenant_provisioning_audit_session_id
  on public.fi_tenant_provisioning_audit_events (session_id);

create index if not exists idx_fi_tenant_provisioning_audit_tenant_id
  on public.fi_tenant_provisioning_audit_events (tenant_id)
  where tenant_id is not null;

create index if not exists idx_fi_tenant_provisioning_audit_created_at
  on public.fi_tenant_provisioning_audit_events (created_at desc);

-- updated_at triggers
create or replace function public.fi_onboarding_os_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_tenant_provisioning_templates_set_updated_at on public.fi_tenant_provisioning_templates;
create trigger trg_fi_tenant_provisioning_templates_set_updated_at
  before update on public.fi_tenant_provisioning_templates
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

drop trigger if exists trg_fi_tenant_provisioning_sessions_set_updated_at on public.fi_tenant_provisioning_sessions;
create trigger trg_fi_tenant_provisioning_sessions_set_updated_at
  before update on public.fi_tenant_provisioning_sessions
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

drop trigger if exists trg_fi_tenant_provisioning_steps_set_updated_at on public.fi_tenant_provisioning_steps;
create trigger trg_fi_tenant_provisioning_steps_set_updated_at
  before update on public.fi_tenant_provisioning_steps
  for each row execute procedure public.fi_onboarding_os_set_updated_at();

-- Seed default clinic provisioning template (Phase A — no billing/CRM connectors)
insert into public.fi_tenant_provisioning_templates (
  code,
  display_name,
  description,
  is_default,
  role_template,
  module_template,
  metadata
)
values (
  'standard_clinic',
  'Standard FI OS Clinic',
  'Default onboarding preset: clinic admin role and core FI OS modules (trialing — no Stripe).',
  true,
  jsonb_build_object(
    'primary_admin_role', 'clinic_admin',
    'additional_roles', '[]'::jsonb
  ),
  jsonb_build_object(
    'subscription_status', 'trialing',
    'verification_status', 'verified',
    'enabled_modules', jsonb_build_array(
      'reception_os',
      'consultation_os',
      'patient_os',
      'analytics_os'
    )
  ),
  jsonb_build_object('phase', 'A', 'billing_connector', 'none')
)
on conflict (code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  is_default = excluded.is_default,
  role_template = excluded.role_template,
  module_template = excluded.module_template,
  metadata = excluded.metadata,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS: service_role only
-- ---------------------------------------------------------------------------
alter table public.fi_tenant_provisioning_templates enable row level security;
alter table public.fi_tenant_provisioning_sessions enable row level security;
alter table public.fi_tenant_provisioning_steps enable row level security;
alter table public.fi_tenant_provisioning_audit_events enable row level security;

revoke all on public.fi_tenant_provisioning_templates from public;
revoke all on public.fi_tenant_provisioning_sessions from public;
revoke all on public.fi_tenant_provisioning_steps from public;
revoke all on public.fi_tenant_provisioning_audit_events from public;

grant select, insert, update, delete on public.fi_tenant_provisioning_templates to service_role;
grant select, insert, update, delete on public.fi_tenant_provisioning_sessions to service_role;
grant select, insert, update, delete on public.fi_tenant_provisioning_steps to service_role;
grant select, insert on public.fi_tenant_provisioning_audit_events to service_role;
