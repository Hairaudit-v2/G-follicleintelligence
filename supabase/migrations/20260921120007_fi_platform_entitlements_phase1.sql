-- Platform Entitlements Phase 1: shared FI OS module entitlement engine (HR OS and future add-ons).
-- RLS: service_role DML only — access checks run in Next.js server code via supabaseAdmin.

-- Tenant verification (onboarding / trust gate for paid modules).
alter table public.fi_tenants
  add column if not exists verification_status text not null default 'unverified';

alter table public.fi_tenants drop constraint if exists fi_tenants_verification_status_chk;
alter table public.fi_tenants
  add constraint fi_tenants_verification_status_chk check (
    verification_status in ('unverified', 'verified', 'enterprise_verified')
  );

comment on column public.fi_tenants.verification_status is
  'Tenant trust gate for paid FI OS modules: unverified | verified | enterprise_verified.';

-- ---------------------------------------------------------------------------
-- fi_modules — canonical FI OS module catalog
-- ---------------------------------------------------------------------------
create table if not exists public.fi_modules (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  display_name text not null,
  description text,
  is_active boolean not null default true,
  default_allowed_roles text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_modules_code_unique unique (code),
  constraint fi_modules_code_nonempty check (char_length(trim(code)) > 0),
  constraint fi_modules_display_name_nonempty check (char_length(trim(display_name)) > 0)
);

comment on table public.fi_modules is
  'FI OS paid add-on module catalog (reception_os, hr_os, etc.). Server-side entitlement engine only.';

create index if not exists idx_fi_modules_code on public.fi_modules (code);
create index if not exists idx_fi_modules_active_sort on public.fi_modules (is_active, sort_order, code);

-- ---------------------------------------------------------------------------
-- fi_subscription_plans — internal plan registry (no public price exposure)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_subscription_plans_code_unique unique (code),
  constraint fi_subscription_plans_code_nonempty check (char_length(trim(code)) > 0),
  constraint fi_subscription_plans_name_nonempty check (char_length(trim(name)) > 0),
  constraint fi_subscription_plans_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_subscription_plans is
  'Internal FI OS subscription plan registry. Billing integration (e.g. Stripe) attaches later; not exposed to clients.';

create index if not exists idx_fi_subscription_plans_code on public.fi_subscription_plans (code);

-- ---------------------------------------------------------------------------
-- fi_tenant_billing_status — per-tenant subscription state (service-role only)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_billing_status (
  tenant_id uuid primary key references public.fi_tenants (id) on delete cascade,
  subscription_status text not null default 'inactive',
  subscription_plan_id uuid references public.fi_subscription_plans (id) on delete set null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_billing_status_subscription_status_chk check (
    subscription_status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')
  ),
  constraint fi_tenant_billing_status_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_billing_status is
  'Per-tenant subscription/billing state for module entitlements. Service-role reads only from server gates.';

create index if not exists idx_fi_tenant_billing_status_plan
  on public.fi_tenant_billing_status (subscription_plan_id)
  where subscription_plan_id is not null;

create index if not exists idx_fi_tenant_billing_status_status
  on public.fi_tenant_billing_status (subscription_status);

-- ---------------------------------------------------------------------------
-- fi_tenant_modules — per-tenant module enablement + role allow-list
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  module_id uuid not null references public.fi_modules (id) on delete cascade,
  enabled boolean not null default false,
  allowed_roles text[] not null default '{}'::text[],
  enabled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_modules_tenant_module_unique unique (tenant_id, module_id),
  constraint fi_tenant_modules_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_modules is
  'Per-tenant FI OS module enablement. allowed_roles overrides fi_modules.default_allowed_roles when non-empty.';

create index if not exists idx_fi_tenant_modules_tenant_enabled
  on public.fi_tenant_modules (tenant_id, enabled);

create index if not exists idx_fi_tenant_modules_module
  on public.fi_tenant_modules (module_id);

-- ---------------------------------------------------------------------------
-- fi_entitlement_audit_events — access-check audit (no billing internals)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_entitlement_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  fi_user_id uuid references public.fi_users (id) on delete set null,
  module_code text not null,
  outcome text not null,
  denial_reason text,
  source text not null default 'require_module_access',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_entitlement_audit_events_module_code_nonempty check (char_length(trim(module_code)) > 0),
  constraint fi_entitlement_audit_events_outcome_chk check (outcome in ('allowed', 'denied')),
  constraint fi_entitlement_audit_events_denial_reason_chk check (
    denial_reason is null
    or denial_reason in (
      'tenant_not_found',
      'tenant_unverified',
      'billing_inactive',
      'module_not_found',
      'module_disabled',
      'user_not_found',
      'role_not_allowed'
    )
  ),
  constraint fi_entitlement_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_entitlement_audit_events is
  'Append-only audit for FI OS module entitlement checks. Safe denial codes only — no billing internals.';

create index if not exists idx_fi_entitlement_audit_tenant_created
  on public.fi_entitlement_audit_events (tenant_id, created_at desc);

create index if not exists idx_fi_entitlement_audit_module_created
  on public.fi_entitlement_audit_events (module_code, created_at desc);

create index if not exists idx_fi_entitlement_audit_fi_user_created
  on public.fi_entitlement_audit_events (fi_user_id, created_at desc)
  where fi_user_id is not null;

-- updated_at triggers
create or replace function public.fi_entitlements_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_modules_set_updated_at on public.fi_modules;
create trigger trg_fi_modules_set_updated_at
  before update on public.fi_modules
  for each row execute procedure public.fi_entitlements_set_updated_at();

drop trigger if exists trg_fi_subscription_plans_set_updated_at on public.fi_subscription_plans;
create trigger trg_fi_subscription_plans_set_updated_at
  before update on public.fi_subscription_plans
  for each row execute procedure public.fi_entitlements_set_updated_at();

drop trigger if exists trg_fi_tenant_billing_status_set_updated_at on public.fi_tenant_billing_status;
create trigger trg_fi_tenant_billing_status_set_updated_at
  before update on public.fi_tenant_billing_status
  for each row execute procedure public.fi_entitlements_set_updated_at();

drop trigger if exists trg_fi_tenant_modules_set_updated_at on public.fi_tenant_modules;
create trigger trg_fi_tenant_modules_set_updated_at
  before update on public.fi_tenant_modules
  for each row execute procedure public.fi_entitlements_set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed core FI OS module codes
-- ---------------------------------------------------------------------------
insert into public.fi_modules (code, display_name, description, default_allowed_roles, sort_order)
values
  (
    'reception_os',
    'Reception OS',
    'Front-desk operations, arrivals, and reception workflows.',
    array['admin', 'fi_admin', 'owner', 'crm_operator', 'tenant_backend']::text[],
    10
  ),
  (
    'consultation_os',
    'Consultation OS',
    'Consultation workflows, forms, and conversion tooling.',
    array['admin', 'fi_admin', 'owner', 'crm_operator', 'tenant_backend', 'consultant']::text[],
    20
  ),
  (
    'patient_os',
    'Patient OS',
    'Patient records, journey, and clinical profile tooling.',
    array['admin', 'fi_admin', 'owner', 'tenant_backend', 'consultant', 'doctor', 'nurse']::text[],
    30
  ),
  (
    'surgery_os',
    'Surgery OS',
    'Surgical day operations, graft intelligence, and theatre workflows.',
    array['admin', 'fi_admin', 'owner', 'tenant_backend', 'doctor', 'nurse']::text[],
    40
  ),
  (
    'financial_os',
    'Financial OS',
    'Revenue, payments, invoicing, and finance operations.',
    array['admin', 'fi_admin', 'owner', 'tenant_backend', 'finance_admin']::text[],
    50
  ),
  (
    'imaging_os',
    'Imaging OS',
    'Clinical photography, imaging ingestion, and visual intelligence.',
    array['admin', 'fi_admin', 'owner', 'tenant_backend', 'consultant', 'doctor', 'nurse']::text[],
    60
  ),
  (
    'audit_os',
    'Audit OS',
    'Governance, audit trails, and compliance review surfaces.',
    array['admin', 'fi_admin', 'owner', 'tenant_backend', 'data_safety_admin']::text[],
    70
  ),
  (
    'academy_os',
    'Academy OS',
    'Training, certification, and academy content for clinic staff.',
    array['admin', 'fi_admin', 'owner', 'tenant_backend']::text[],
    80
  ),
  (
    'analytics_os',
    'Analytics OS',
    'Operational and clinical analytics dashboards.',
    array['admin', 'fi_admin', 'owner', 'tenant_backend', 'dashboard_viewer']::text[],
    90
  ),
  (
    'hr_os',
    'HR OS',
    'Staff readiness, HR sync health, and workforce operations.',
    array['admin', 'fi_admin', 'owner', 'tenant_backend', 'crm_operator']::text[],
    100
  )
on conflict (code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  default_allowed_roles = excluded.default_allowed_roles,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- RLS: service_role only
-- ---------------------------------------------------------------------------
alter table public.fi_modules enable row level security;
alter table public.fi_subscription_plans enable row level security;
alter table public.fi_tenant_billing_status enable row level security;
alter table public.fi_tenant_modules enable row level security;
alter table public.fi_entitlement_audit_events enable row level security;

revoke all on public.fi_modules from public;
revoke all on public.fi_subscription_plans from public;
revoke all on public.fi_tenant_billing_status from public;
revoke all on public.fi_tenant_modules from public;
revoke all on public.fi_entitlement_audit_events from public;

grant select, insert, update, delete on public.fi_modules to service_role;
grant select, insert, update, delete on public.fi_subscription_plans to service_role;
grant select, insert, update, delete on public.fi_tenant_billing_status to service_role;
grant select, insert, update, delete on public.fi_tenant_modules to service_role;
grant select, insert, update on public.fi_entitlement_audit_events to service_role;
