-- SA-1: Adaptive Staff Access & Entitlements Engine.
-- A flexible staff access layer: every staff member keeps a standard role template,
-- but may also receive optional module/tab access grants (tenant/clinic scoped,
-- read/edit/approve actions) without creating role explosion.
--
-- Tables:
--   fi_access_modules            — global catalog of FI OS modules/tabs (no tenant).
--   fi_role_permission_templates — baseline access per role per module (tenant_id NULL = global baseline).
--   fi_staff_access_grants       — explicit per-staff grants that override the template.
--   fi_staff_access_audit_log    — every access change (grant created/updated/revoked).
--
-- Mutations are expected from trusted Next.js server routes/actions using service_role
-- (mirrors fi_staff / fi_staff_feature_access writes). Authenticated tenant members may
-- read rows for navigation/coordination; route guards remain authoritative for security.

-- ---------------------------------------------------------------------------
-- Access modules (global catalog)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_access_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  label text not null,
  description text,
  category text,
  nav_path text,
  default_tab_keys jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_access_modules_default_tab_keys_array check (jsonb_typeof(default_tab_keys) = 'array')
);

comment on table public.fi_access_modules is
  'SA-1: global catalog of FI OS access modules (and their default tabs) for the staff entitlements engine.';

create index if not exists idx_fi_access_modules_sort on public.fi_access_modules (sort_order, module_key);

-- ---------------------------------------------------------------------------
-- Role permission templates (baseline defaults; tenant_id NULL = global baseline)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_role_permission_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  role_key text not null,
  module_key text not null,
  tab_key text,
  access_level text not null default 'none',
  scope text not null default 'tenant',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_role_permission_templates_access_level_chk
    check (access_level in ('none', 'read', 'edit', 'approve', 'admin')),
  constraint fi_role_permission_templates_scope_chk
    check (scope in ('tenant', 'clinic', 'own', 'assigned')),
  constraint fi_role_permission_templates_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_role_permission_templates_unique
    unique nulls not distinct (tenant_id, role_key, module_key, tab_key)
);

comment on table public.fi_role_permission_templates is
  'SA-1: baseline access for a role on a module/tab. tenant_id NULL = global baseline; a tenant row overrides the baseline.';

create index if not exists idx_fi_role_permission_templates_role
  on public.fi_role_permission_templates (role_key, module_key);
create index if not exists idx_fi_role_permission_templates_tenant
  on public.fi_role_permission_templates (tenant_id)
  where tenant_id is not null;

-- ---------------------------------------------------------------------------
-- Staff access grants (explicit per-staff overrides)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff (id) on delete cascade,
  role_key text,
  module_key text not null,
  tab_key text,
  access_level text not null default 'read',
  scope text not null default 'tenant',
  granted_by uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_access_grants_access_level_chk
    check (access_level in ('none', 'read', 'edit', 'approve', 'admin')),
  constraint fi_staff_access_grants_scope_chk
    check (scope in ('tenant', 'clinic', 'own', 'assigned')),
  constraint fi_staff_access_grants_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_access_grants is
  'SA-1: explicit per-staff module/tab access grants. Override the role template; revoked_at excludes a grant from effective access.';

create index if not exists idx_fi_staff_access_grants_tenant_staff
  on public.fi_staff_access_grants (tenant_id, staff_member_id);
create index if not exists idx_fi_staff_access_grants_tenant_module
  on public.fi_staff_access_grants (tenant_id, module_key);

-- Only one active (non-revoked) grant per staff/module/tab(/clinic) scope.
create unique index if not exists idx_fi_staff_access_grants_active_unique
  on public.fi_staff_access_grants (
    tenant_id,
    staff_member_id,
    module_key,
    coalesce(tab_key, ''),
    coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Staff access audit log
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_access_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  staff_member_id uuid,
  changed_by uuid,
  action text not null,
  module_key text,
  tab_key text,
  previous_access jsonb,
  new_access jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_staff_access_audit_log_action_chk
    check (action in ('grant_created', 'grant_updated', 'grant_revoked', 'grant_reinstated')),
  constraint fi_staff_access_audit_log_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_access_audit_log is
  'SA-1: append-only audit of staff access changes (previous/new access, actor, reason).';

create index if not exists idx_fi_staff_access_audit_log_tenant_staff
  on public.fi_staff_access_audit_log (tenant_id, staff_member_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.fi_staff_access_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_access_modules_set_updated_at on public.fi_access_modules;
create trigger trg_fi_access_modules_set_updated_at
  before update on public.fi_access_modules
  for each row execute procedure public.fi_staff_access_set_updated_at();

drop trigger if exists trg_fi_role_permission_templates_set_updated_at on public.fi_role_permission_templates;
create trigger trg_fi_role_permission_templates_set_updated_at
  before update on public.fi_role_permission_templates
  for each row execute procedure public.fi_staff_access_set_updated_at();

drop trigger if exists trg_fi_staff_access_grants_set_updated_at on public.fi_staff_access_grants;
create trigger trg_fi_staff_access_grants_set_updated_at
  before update on public.fi_staff_access_grants
  for each row execute procedure public.fi_staff_access_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.fi_access_modules enable row level security;
alter table public.fi_role_permission_templates enable row level security;
alter table public.fi_staff_access_grants enable row level security;
alter table public.fi_staff_access_audit_log enable row level security;

-- Modules are a global catalog: any authenticated user may read.
drop policy if exists fi_access_modules_select_authenticated on public.fi_access_modules;
create policy fi_access_modules_select_authenticated
  on public.fi_access_modules for select to authenticated
  using (true);

-- Templates: global baseline (tenant_id NULL) readable by all; tenant rows by tenant members.
drop policy if exists fi_role_permission_templates_select on public.fi_role_permission_templates;
create policy fi_role_permission_templates_select
  on public.fi_role_permission_templates for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_role_permission_templates.tenant_id
    )
  );

drop policy if exists fi_staff_access_grants_select_tenant_member on public.fi_staff_access_grants;
create policy fi_staff_access_grants_select_tenant_member
  on public.fi_staff_access_grants for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_access_grants.tenant_id
    )
  );

drop policy if exists fi_staff_access_audit_log_select_tenant_member on public.fi_staff_access_audit_log;
create policy fi_staff_access_audit_log_select_tenant_member
  on public.fi_staff_access_audit_log for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_access_audit_log.tenant_id
    )
  );

grant select on public.fi_access_modules to authenticated, service_role;
grant select on public.fi_role_permission_templates to authenticated, service_role;
grant select on public.fi_staff_access_grants to authenticated, service_role;
grant select on public.fi_staff_access_audit_log to authenticated, service_role;

grant insert, update, delete on public.fi_access_modules to service_role;
grant insert, update, delete on public.fi_role_permission_templates to service_role;
grant insert, update, delete on public.fi_staff_access_grants to service_role;
grant insert, update, delete on public.fi_staff_access_audit_log to service_role;

-- ---------------------------------------------------------------------------
-- Seed: baseline modules
-- ---------------------------------------------------------------------------
insert into public.fi_access_modules (module_key, label, description, category, nav_path, sort_order)
values
  ('clinic_os',         'ClinicOS',          'Dashboard, bookings, calendar, daily operations.',        'operations',   '',                     10),
  ('lead_flow',         'LeadFlow',          'Enquiries, leads, pipeline, tasks, follow-ups.',          'growth',       'crm',                  20),
  ('patient_os',        'PatientOS',         'Patient records, profiles, and directory.',               'clinical',     'patients',             30),
  ('consultation_os',   'ConsultationOS',    'Consultation workspace and conversion funnel.',           'clinical',     'consultations',        40),
  ('surgery_os',        'SurgeryOS',         'Planning, procedure day, post-op, follow-up.',            'clinical',     'cases',                50),
  ('imaging_os',        'ImagingOS',         'Clinical imaging, protocols, and media workflows.',       'clinical',     'imaging',              60),
  ('audit_os',          'AuditOS',           'HairAudit queue, evidence, and outcome intelligence.',    'intelligence', 'audit',                70),
  ('academy_os',        'AcademyOS',         'Training and academy experiences.',                       'intelligence', 'academy',              80),
  ('analytics_os',      'AnalyticsOS',       'Executive KPIs and cross-module intelligence.',           'intelligence', 'analytics',            90),
  ('financial_os',      'FinancialOS',       'Revenue, invoices, payments, and finance reporting.',     'finance',      'financial',           100),
  ('workforce_os',      'WorkforceOS',       'Staff, rosters, HR, and workforce operations.',           'team',         'staff',               110),
  ('settings',          'Settings',          'Tenant, clinic, and system configuration.',               'system',       'configuration',       120),
  ('platform_progress', 'Platform Progress', 'Platform rollout, onboarding, and progress tracking.',    'system',       'platform-progress',   130),
  ('investor_dashboard','Investor Dashboard','Investor-facing performance and growth metrics.',         'finance',      'investor',            140)
on conflict (module_key) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  nav_path = excluded.nav_path,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Seed: baseline global role permission templates (tenant_id = NULL)
-- Only granted (non-'none') module access is seeded; absence = no access.
-- ---------------------------------------------------------------------------
insert into public.fi_role_permission_templates (tenant_id, role_key, module_key, access_level, scope)
values
  -- doctor
  (null, 'doctor', 'clinic_os',       'read',    'tenant'),
  (null, 'doctor', 'patient_os',      'edit',    'tenant'),
  (null, 'doctor', 'consultation_os', 'edit',    'tenant'),
  (null, 'doctor', 'surgery_os',      'approve', 'tenant'),
  (null, 'doctor', 'imaging_os',      'edit',    'tenant'),
  (null, 'doctor', 'academy_os',      'read',    'tenant'),
  -- nurse (assigned-case scope for clinical work)
  (null, 'nurse', 'clinic_os',        'read',    'tenant'),
  (null, 'nurse', 'patient_os',       'edit',    'assigned'),
  (null, 'nurse', 'consultation_os',  'read',    'assigned'),
  (null, 'nurse', 'surgery_os',       'edit',    'assigned'),
  (null, 'nurse', 'imaging_os',       'edit',    'assigned'),
  (null, 'nurse', 'academy_os',       'read',    'tenant'),
  -- reception (no financial access)
  (null, 'reception', 'clinic_os',       'edit', 'tenant'),
  (null, 'reception', 'lead_flow',       'edit', 'tenant'),
  (null, 'reception', 'patient_os',      'read', 'tenant'),
  (null, 'reception', 'consultation_os', 'read', 'tenant'),
  (null, 'reception', 'academy_os',      'read', 'tenant'),
  -- consultant
  (null, 'consultant', 'clinic_os',       'read', 'tenant'),
  (null, 'consultant', 'lead_flow',       'edit', 'tenant'),
  (null, 'consultant', 'patient_os',      'read', 'tenant'),
  (null, 'consultant', 'consultation_os', 'edit', 'tenant'),
  (null, 'consultant', 'analytics_os',    'read', 'tenant'),
  (null, 'consultant', 'academy_os',      'read', 'tenant'),
  -- manager
  (null, 'manager', 'clinic_os',         'edit',    'tenant'),
  (null, 'manager', 'lead_flow',         'edit',    'tenant'),
  (null, 'manager', 'patient_os',        'edit',    'tenant'),
  (null, 'manager', 'consultation_os',   'edit',    'tenant'),
  (null, 'manager', 'surgery_os',        'edit',    'tenant'),
  (null, 'manager', 'imaging_os',        'read',    'tenant'),
  (null, 'manager', 'audit_os',          'read',    'tenant'),
  (null, 'manager', 'academy_os',        'edit',    'tenant'),
  (null, 'manager', 'analytics_os',      'read',    'tenant'),
  (null, 'manager', 'financial_os',      'read',    'tenant'),
  (null, 'manager', 'workforce_os',      'edit',    'tenant'),
  (null, 'manager', 'settings',          'edit',    'tenant'),
  (null, 'manager', 'platform_progress', 'read',    'tenant'),
  -- owner (full tenant access)
  (null, 'owner', 'clinic_os',         'admin', 'tenant'),
  (null, 'owner', 'lead_flow',         'admin', 'tenant'),
  (null, 'owner', 'patient_os',        'admin', 'tenant'),
  (null, 'owner', 'consultation_os',   'admin', 'tenant'),
  (null, 'owner', 'surgery_os',        'admin', 'tenant'),
  (null, 'owner', 'imaging_os',        'admin', 'tenant'),
  (null, 'owner', 'audit_os',          'admin', 'tenant'),
  (null, 'owner', 'academy_os',        'admin', 'tenant'),
  (null, 'owner', 'analytics_os',      'admin', 'tenant'),
  (null, 'owner', 'financial_os',      'admin', 'tenant'),
  (null, 'owner', 'workforce_os',      'admin', 'tenant'),
  (null, 'owner', 'settings',          'admin', 'tenant'),
  (null, 'owner', 'platform_progress', 'admin', 'tenant'),
  (null, 'owner', 'investor_dashboard','admin', 'tenant'),
  -- investor
  (null, 'investor', 'analytics_os',       'read', 'tenant'),
  (null, 'investor', 'financial_os',       'read', 'tenant'),
  (null, 'investor', 'investor_dashboard', 'read', 'tenant'),
  -- trainer
  (null, 'trainer', 'clinic_os',  'read',  'tenant'),
  (null, 'trainer', 'patient_os', 'read',  'tenant'),
  (null, 'trainer', 'academy_os', 'admin', 'tenant'),
  -- auditor
  (null, 'auditor', 'clinic_os',       'read',    'tenant'),
  (null, 'auditor', 'patient_os',      'read',    'tenant'),
  (null, 'auditor', 'consultation_os', 'read',    'tenant'),
  (null, 'auditor', 'imaging_os',      'read',    'tenant'),
  (null, 'auditor', 'audit_os',        'approve', 'tenant'),
  (null, 'auditor', 'analytics_os',    'read',    'tenant'),
  -- platform_admin (full)
  (null, 'platform_admin', 'clinic_os',         'admin', 'tenant'),
  (null, 'platform_admin', 'lead_flow',         'admin', 'tenant'),
  (null, 'platform_admin', 'patient_os',        'admin', 'tenant'),
  (null, 'platform_admin', 'consultation_os',   'admin', 'tenant'),
  (null, 'platform_admin', 'surgery_os',        'admin', 'tenant'),
  (null, 'platform_admin', 'imaging_os',        'admin', 'tenant'),
  (null, 'platform_admin', 'audit_os',          'admin', 'tenant'),
  (null, 'platform_admin', 'academy_os',        'admin', 'tenant'),
  (null, 'platform_admin', 'analytics_os',      'admin', 'tenant'),
  (null, 'platform_admin', 'financial_os',      'admin', 'tenant'),
  (null, 'platform_admin', 'workforce_os',      'admin', 'tenant'),
  (null, 'platform_admin', 'settings',          'admin', 'tenant'),
  (null, 'platform_admin', 'platform_progress', 'admin', 'tenant'),
  (null, 'platform_admin', 'investor_dashboard','admin', 'tenant')
on conflict (tenant_id, role_key, module_key, tab_key) do update
set
  access_level = excluded.access_level,
  scope = excluded.scope,
  updated_at = now();
