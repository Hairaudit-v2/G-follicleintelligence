-- PROJECT NEXUS Phase 9A: IIOHR → FI OS external professional provisioning contract.
-- RLS: service_role DML only (Next.js signed webhook routes). No public/anon access.

create table if not exists public.fi_nexus_external_professionals (
  id uuid primary key default gen_random_uuid(),
  global_professional_id text not null,
  source_system text not null default 'iiohr',
  email text not null,
  name text,
  professional_type text not null,
  certification_level text,
  deployment_ready boolean not null default false,
  nexus_created boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_nexus_external_professionals_global_id_unique unique (global_professional_id),
  constraint fi_nexus_external_professionals_global_id_nonempty check (char_length(trim(global_professional_id)) > 0),
  constraint fi_nexus_external_professionals_email_nonempty check (char_length(trim(email)) > 0),
  constraint fi_nexus_external_professionals_professional_type_nonempty check (char_length(trim(professional_type)) > 0)
);

comment on table public.fi_nexus_external_professionals is
  'Nexus: certified professionals provisioned from IIOHR (global id is cross-system key).';

create index if not exists idx_fi_nexus_external_professionals_global_id
  on public.fi_nexus_external_professionals (global_professional_id);

create table if not exists public.fi_nexus_tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  global_professional_id text not null,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  site_id uuid references public.fi_clinics (id) on delete set null,
  membership_status text not null default 'pending',
  nexus_created boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_nexus_tenant_memberships_global_tenant_unique unique (global_professional_id, tenant_id),
  constraint fi_nexus_tenant_memberships_global_id_nonempty check (char_length(trim(global_professional_id)) > 0),
  constraint fi_nexus_tenant_memberships_status_nonempty check (char_length(trim(membership_status)) > 0)
);

comment on table public.fi_nexus_tenant_memberships is
  'Nexus: FI OS tenant membership for an external professional (pending until FI OS activation).';

create index if not exists idx_fi_nexus_tenant_memberships_global_id
  on public.fi_nexus_tenant_memberships (global_professional_id);

create index if not exists idx_fi_nexus_tenant_memberships_tenant_id
  on public.fi_nexus_tenant_memberships (tenant_id);

create table if not exists public.fi_nexus_staff_profiles (
  id uuid primary key default gen_random_uuid(),
  global_professional_id text not null,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  site_id uuid references public.fi_clinics (id) on delete set null,
  staff_type text not null,
  display_name text,
  email text not null,
  active boolean not null default false,
  nexus_created boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_nexus_staff_profiles_global_tenant_unique unique (global_professional_id, tenant_id),
  constraint fi_nexus_staff_profiles_global_id_nonempty check (char_length(trim(global_professional_id)) > 0),
  constraint fi_nexus_staff_profiles_staff_type_nonempty check (char_length(trim(staff_type)) > 0),
  constraint fi_nexus_staff_profiles_email_nonempty check (char_length(trim(email)) > 0)
);

comment on table public.fi_nexus_staff_profiles is
  'Nexus: FI OS staff profile shell for external professional; inactive until FI OS activation.';

create index if not exists idx_fi_nexus_staff_profiles_global_id
  on public.fi_nexus_staff_profiles (global_professional_id);

create index if not exists idx_fi_nexus_staff_profiles_tenant_id
  on public.fi_nexus_staff_profiles (tenant_id);

create table if not exists public.fi_nexus_role_assignments (
  id uuid primary key default gen_random_uuid(),
  global_professional_id text not null,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  role_code text not null,
  assigned_by text not null default 'nexus',
  active boolean not null default true,
  nexus_created boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint fi_nexus_role_assignments_global_id_nonempty check (char_length(trim(global_professional_id)) > 0),
  constraint fi_nexus_role_assignments_role_code_nonempty check (char_length(trim(role_code)) > 0)
);

comment on table public.fi_nexus_role_assignments is
  'Nexus: approved FI OS role assignments for external professionals (idempotent per tenant+role).';

create index if not exists idx_fi_nexus_role_assignments_global_id
  on public.fi_nexus_role_assignments (global_professional_id);

create index if not exists idx_fi_nexus_role_assignments_tenant_id
  on public.fi_nexus_role_assignments (tenant_id);

create index if not exists idx_fi_nexus_role_assignments_role_code
  on public.fi_nexus_role_assignments (role_code);

create unique index if not exists idx_fi_nexus_role_assignments_active_unique
  on public.fi_nexus_role_assignments (global_professional_id, tenant_id, role_code)
  where active = true;

create table if not exists public.fi_nexus_provisioning_audit (
  id uuid primary key default gen_random_uuid(),
  global_professional_id text not null,
  action_type text not null,
  payload jsonb,
  before_state jsonb,
  after_state jsonb,
  result text not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  constraint fi_nexus_provisioning_audit_global_id_nonempty check (char_length(trim(global_professional_id)) > 0),
  constraint fi_nexus_provisioning_audit_action_type_nonempty check (char_length(trim(action_type)) > 0),
  constraint fi_nexus_provisioning_audit_result_nonempty check (char_length(trim(result)) > 0)
);

comment on table public.fi_nexus_provisioning_audit is
  'Nexus: provisioning/rollback audit trail (no PHI beyond professional ids and role codes).';

create index if not exists idx_fi_nexus_provisioning_audit_global_id
  on public.fi_nexus_provisioning_audit (global_professional_id);

create index if not exists idx_fi_nexus_provisioning_audit_created_at
  on public.fi_nexus_provisioning_audit (created_at desc);

-- updated_at triggers
create or replace function public.fi_nexus_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_nexus_external_professionals_set_updated_at on public.fi_nexus_external_professionals;
create trigger trg_fi_nexus_external_professionals_set_updated_at
  before update on public.fi_nexus_external_professionals
  for each row execute procedure public.fi_nexus_set_updated_at();

drop trigger if exists trg_fi_nexus_tenant_memberships_set_updated_at on public.fi_nexus_tenant_memberships;
create trigger trg_fi_nexus_tenant_memberships_set_updated_at
  before update on public.fi_nexus_tenant_memberships
  for each row execute procedure public.fi_nexus_set_updated_at();

drop trigger if exists trg_fi_nexus_staff_profiles_set_updated_at on public.fi_nexus_staff_profiles;
create trigger trg_fi_nexus_staff_profiles_set_updated_at
  before update on public.fi_nexus_staff_profiles
  for each row execute procedure public.fi_nexus_set_updated_at();

-- RLS: service_role only (signed server routes)
alter table public.fi_nexus_external_professionals enable row level security;
alter table public.fi_nexus_tenant_memberships enable row level security;
alter table public.fi_nexus_staff_profiles enable row level security;
alter table public.fi_nexus_role_assignments enable row level security;
alter table public.fi_nexus_provisioning_audit enable row level security;

revoke all on public.fi_nexus_external_professionals from public;
revoke all on public.fi_nexus_tenant_memberships from public;
revoke all on public.fi_nexus_staff_profiles from public;
revoke all on public.fi_nexus_role_assignments from public;
revoke all on public.fi_nexus_provisioning_audit from public;

grant select, insert, update, delete on public.fi_nexus_external_professionals to service_role;
grant select, insert, update, delete on public.fi_nexus_tenant_memberships to service_role;
grant select, insert, update, delete on public.fi_nexus_staff_profiles to service_role;
grant select, insert, update, delete on public.fi_nexus_role_assignments to service_role;
grant select, insert, update, delete on public.fi_nexus_provisioning_audit to service_role;
