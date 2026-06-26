-- SA-2: Field-Level Permission Engine.
-- Extends SA-1 (module/tab access) into FIELD-LEVEL and sensitive-data access. SA-2 is a SECOND
-- gate INSIDE module access: it answers "inside a module this person can access, which fields,
-- sections, or data categories can they view, edit, approve, export, or hide?".
--
-- Field access never replaces module access — it is always clamped to it. If a person cannot
-- view a module (SA-1), they cannot view any field inside it (SA-2), regardless of any field
-- template or grant.
--
-- Tables:
--   fi_access_fields                   — global registry of protected fields / sections / data categories.
--   fi_role_field_permission_templates — baseline field permission per role (tenant_id NULL = global baseline).
--   fi_staff_field_access_grants       — explicit per-staff field overrides.
--   fi_staff_field_access_audit_log    — every field permission change.
--
-- Permission levels (weakest → strongest): hidden < masked < summary < read < edit < approve < export.
--   export is the highest, SEPARATE level — extracting a value out of the platform (CSV/PDF/API)
--   is gated independently of read/edit/approve.
--
-- Mutations are expected from trusted Next.js server routes/actions using service_role (mirrors
-- SA-1). Authenticated tenant members may read rows for coordination; route/field guards remain
-- authoritative for security.

-- ---------------------------------------------------------------------------
-- Protected field registry (global catalog)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_access_fields (
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  field_key text not null,
  label text not null,
  description text,
  sensitivity_level text not null default 'standard',
  default_masking_strategy text not null default 'visible',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_access_fields_sensitivity_chk
    check (sensitivity_level in ('standard', 'sensitive', 'clinical', 'financial', 'identity', 'governance')),
  constraint fi_access_fields_masking_chk
    check (default_masking_strategy in ('visible', 'hidden', 'masked', 'summary_only')),
  constraint fi_access_fields_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_access_fields_unique unique (module_key, field_key)
);

comment on table public.fi_access_fields is
  'SA-2: global catalog of protected fields/sections/data categories for the field-level permission engine.';

create index if not exists idx_fi_access_fields_module on public.fi_access_fields (module_key, field_key);

-- ---------------------------------------------------------------------------
-- Role field permission templates (baseline; tenant_id NULL = global baseline)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_role_field_permission_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  role_key text not null,
  module_key text not null,
  field_key text not null,
  permission_level text not null default 'hidden',
  scope text not null default 'tenant',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_role_field_permission_templates_level_chk
    check (permission_level in ('hidden', 'masked', 'summary', 'read', 'edit', 'approve', 'export')),
  constraint fi_role_field_permission_templates_scope_chk
    check (scope in ('tenant', 'clinic', 'own', 'assigned')),
  constraint fi_role_field_permission_templates_metadata_object check (jsonb_typeof(metadata) = 'object'),
  -- One template row per (tenant baseline, role, module, field). NULL tenant_id is the global
  -- baseline and is treated as distinct from tenant rows via the sentinel coalesce below.
  constraint fi_role_field_permission_templates_unique
    unique (tenant_id, role_key, module_key, field_key)
);

comment on table public.fi_role_field_permission_templates is
  'SA-2: baseline field permission for a role on a module/field. tenant_id NULL = global baseline; a tenant row overrides it.';

create index if not exists idx_fi_role_field_templates_role
  on public.fi_role_field_permission_templates (role_key, module_key, field_key);
create index if not exists idx_fi_role_field_templates_tenant
  on public.fi_role_field_permission_templates (tenant_id)
  where tenant_id is not null;

-- The unique constraint above does not constrain duplicate global rows because Postgres treats
-- NULLs as distinct by default. Enforce single global baseline rows with a partial unique index
-- over a sentinel tenant id.
create unique index if not exists idx_fi_role_field_templates_unique_norm
  on public.fi_role_field_permission_templates (
    coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    role_key,
    module_key,
    field_key
  );

-- ---------------------------------------------------------------------------
-- Staff field access grants (explicit per-staff overrides)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_field_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete cascade,
  staff_member_id uuid not null references public.fi_staff (id) on delete cascade,
  module_key text not null,
  field_key text not null,
  permission_level text not null,
  scope text not null default 'tenant',
  granted_by uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_field_access_grants_level_chk
    check (permission_level in ('hidden', 'masked', 'summary', 'read', 'edit', 'approve', 'export')),
  constraint fi_staff_field_access_grants_scope_chk
    check (scope in ('tenant', 'clinic', 'own', 'assigned')),
  constraint fi_staff_field_access_grants_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_field_access_grants is
  'SA-2: explicit per-staff field permission grants. Override the role field template; revoked_at excludes a grant from effective access.';

create index if not exists idx_fi_staff_field_grants_tenant_staff
  on public.fi_staff_field_access_grants (tenant_id, staff_member_id);
create index if not exists idx_fi_staff_field_grants_tenant_field
  on public.fi_staff_field_access_grants (tenant_id, module_key, field_key);

-- One active (non-revoked) grant per tenant/staff/clinic/module/field/scope.
create unique index if not exists idx_fi_staff_field_grants_active_unique
  on public.fi_staff_field_access_grants (
    tenant_id,
    staff_member_id,
    module_key,
    field_key,
    scope,
    coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Staff field access audit log
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_field_access_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete cascade,
  staff_member_id uuid not null,
  module_key text not null,
  field_key text not null,
  changed_by uuid,
  previous_permission jsonb,
  new_permission jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_staff_field_access_audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_field_access_audit_log is
  'SA-2: append-only audit of staff field permission changes (previous/new permission, actor, reason).';

create index if not exists idx_fi_staff_field_audit_tenant_staff
  on public.fi_staff_field_access_audit_log (tenant_id, staff_member_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse the SA-1 shared trigger function)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_fi_access_fields_set_updated_at on public.fi_access_fields;
create trigger trg_fi_access_fields_set_updated_at
  before update on public.fi_access_fields
  for each row execute procedure public.fi_staff_access_set_updated_at();

drop trigger if exists trg_fi_role_field_templates_set_updated_at on public.fi_role_field_permission_templates;
create trigger trg_fi_role_field_templates_set_updated_at
  before update on public.fi_role_field_permission_templates
  for each row execute procedure public.fi_staff_access_set_updated_at();

drop trigger if exists trg_fi_staff_field_grants_set_updated_at on public.fi_staff_field_access_grants;
create trigger trg_fi_staff_field_grants_set_updated_at
  before update on public.fi_staff_field_access_grants
  for each row execute procedure public.fi_staff_access_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security (mirrors SA-1)
-- ---------------------------------------------------------------------------
alter table public.fi_access_fields enable row level security;
alter table public.fi_role_field_permission_templates enable row level security;
alter table public.fi_staff_field_access_grants enable row level security;
alter table public.fi_staff_field_access_audit_log enable row level security;

-- Field registry is a global catalog: any authenticated user may read.
drop policy if exists fi_access_fields_select_authenticated on public.fi_access_fields;
create policy fi_access_fields_select_authenticated
  on public.fi_access_fields for select to authenticated
  using (true);

-- Templates: global baseline (tenant_id NULL) readable by all; tenant rows by tenant members.
drop policy if exists fi_role_field_templates_select on public.fi_role_field_permission_templates;
create policy fi_role_field_templates_select
  on public.fi_role_field_permission_templates for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_role_field_permission_templates.tenant_id
    )
  );

drop policy if exists fi_staff_field_grants_select_tenant_member on public.fi_staff_field_access_grants;
create policy fi_staff_field_grants_select_tenant_member
  on public.fi_staff_field_access_grants for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_field_access_grants.tenant_id
    )
  );

drop policy if exists fi_staff_field_audit_select_tenant_member on public.fi_staff_field_access_audit_log;
create policy fi_staff_field_audit_select_tenant_member
  on public.fi_staff_field_access_audit_log for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_field_access_audit_log.tenant_id
    )
  );

grant select on public.fi_access_fields to authenticated, service_role;
grant select on public.fi_role_field_permission_templates to authenticated, service_role;
grant select on public.fi_staff_field_access_grants to authenticated, service_role;
grant select on public.fi_staff_field_access_audit_log to authenticated, service_role;

grant insert, update, delete on public.fi_access_fields to service_role;
grant insert, update, delete on public.fi_role_field_permission_templates to service_role;
grant insert, update, delete on public.fi_staff_field_access_grants to service_role;
grant insert, update, delete on public.fi_staff_field_access_audit_log to service_role;

-- ---------------------------------------------------------------------------
-- Seed: protected field registry
-- ---------------------------------------------------------------------------
insert into public.fi_access_fields (module_key, field_key, label, description, sensitivity_level, default_masking_strategy)
values
  -- patient_os
  ('patient_os', 'patient.identity',          'Patient identity',  'Name, date of birth, identifiers.',           'identity',   'hidden'),
  ('patient_os', 'patient.contact_details',   'Contact details',   'Email, phone, address.',                      'sensitive',  'visible'),
  ('patient_os', 'patient.medical_history',   'Medical history',   'Past conditions, history, intake answers.',   'clinical',   'hidden'),
  ('patient_os', 'patient.medications',       'Medications',       'Current and historical medications.',         'clinical',   'hidden'),
  ('patient_os', 'patient.photos',            'Clinical photos',   'Patient photography and clinical imaging.',    'clinical',   'hidden'),
  ('patient_os', 'patient.documents',         'Documents',         'Uploaded documents and files.',               'sensitive',  'hidden'),
  ('patient_os', 'patient.audit_reports',     'Audit reports',     'HairAudit reports and outcome intelligence.',  'clinical',   'summary_only'),
  ('patient_os', 'patient.financial_summary', 'Financial summary', 'Balance, invoice totals, payment status.',    'financial',  'hidden'),
  ('patient_os', 'patient.internal_notes',    'Internal notes',    'Staff-only internal notes.',                  'governance', 'hidden'),
  -- consultation_os
  ('consultation_os', 'consultation.clinical_notes',             'Clinical notes',             'Consultation clinical notes.',        'clinical',   'hidden'),
  ('consultation_os', 'consultation.diagnosis',                  'Diagnosis',                  'Diagnosis and assessment.',           'clinical',   'hidden'),
  ('consultation_os', 'consultation.treatment_plan',             'Treatment plan',             'Proposed treatment plan.',            'clinical',   'visible'),
  ('consultation_os', 'consultation.quote',                      'Quote',                      'Quoted pricing.',                     'financial',  'hidden'),
  ('consultation_os', 'consultation.consent',                    'Consent',                    'Consent capture and status.',         'governance', 'visible'),
  ('consultation_os', 'consultation.private_practitioner_notes', 'Private practitioner notes', 'Practitioner-only private notes.',     'governance', 'hidden'),
  -- surgery_os
  ('surgery_os', 'surgery.graft_count',      'Graft count',          'Number of grafts.',            'clinical',  'visible'),
  ('surgery_os', 'surgery.hair_count',       'Hair count',           'Number of hairs.',             'clinical',  'visible'),
  ('surgery_os', 'surgery.punch_size',       'Punch size',           'Punch size used.',             'clinical',  'visible'),
  ('surgery_os', 'surgery.transection_rate', 'Transection rate',     'Transection rate metric.',     'clinical',  'summary_only'),
  ('surgery_os', 'surgery.team_members',     'Team members',         'Surgical team roster.',        'sensitive', 'visible'),
  ('surgery_os', 'surgery.medications',      'Surgical medications', 'Intra-operative medications.', 'clinical',  'hidden'),
  ('surgery_os', 'surgery.surgical_notes',   'Surgical notes',       'Operative notes.',             'clinical',  'hidden'),
  ('surgery_os', 'surgery.complications',    'Complications',        'Recorded complications.',      'clinical',  'hidden'),
  ('surgery_os', 'surgery.outcome_metrics',  'Outcome metrics',      'Outcome and yield metrics.',   'clinical',  'summary_only'),
  -- financial_os
  ('financial_os', 'financial.invoice',                 'Invoice',                 'Invoice line items and totals.', 'financial', 'hidden'),
  ('financial_os', 'financial.payment_status',          'Payment status',          'Paid / outstanding status.',     'financial', 'hidden'),
  ('financial_os', 'financial.refunds',                 'Refunds',                 'Refund records.',                'financial', 'hidden'),
  ('financial_os', 'financial.revenue',                 'Revenue',                 'Revenue figures.',               'financial', 'hidden'),
  ('financial_os', 'financial.margin',                  'Margin',                  'Margin and profitability.',      'financial', 'hidden'),
  ('financial_os', 'financial.practitioner_commission', 'Practitioner commission', 'Per-practitioner commission.',   'financial', 'hidden'),
  -- analytics_os
  ('analytics_os', 'analytics.revenue',            'Revenue analytics',    'Revenue analytics.',              'financial', 'hidden'),
  ('analytics_os', 'analytics.conversion',         'Conversion analytics', 'Conversion funnel metrics.',      'standard',  'visible'),
  ('analytics_os', 'analytics.marketing_roi',      'Marketing ROI',        'Marketing return on investment.', 'financial', 'hidden'),
  ('analytics_os', 'analytics.staff_productivity', 'Staff productivity',   'Per-staff productivity metrics.', 'sensitive', 'summary_only'),
  ('analytics_os', 'analytics.clinical_outcomes',  'Clinical outcomes',    'Aggregate clinical outcomes.',    'clinical',  'summary_only'),
  ('analytics_os', 'analytics.investor_summary',   'Investor summary',     'Investor-safe analytics summary.', 'financial', 'summary_only'),
  -- workforce_os
  ('workforce_os', 'workforce.personal_details', 'Personal details', 'Staff personal / identity details.', 'identity',   'hidden'),
  ('workforce_os', 'workforce.documents',        'Staff documents',  'Staff documents and files.',         'sensitive',  'hidden'),
  ('workforce_os', 'workforce.training',         'Training',         'Training records.',                  'standard',   'visible'),
  ('workforce_os', 'workforce.certifications',   'Certifications',   'Certifications and licences.',       'standard',   'visible'),
  ('workforce_os', 'workforce.performance',      'Performance',      'Performance reviews and ratings.',   'sensitive',  'hidden'),
  ('workforce_os', 'workforce.payroll',          'Payroll',          'Payroll and compensation.',          'financial',  'hidden'),
  -- settings
  ('settings', 'settings.billing',      'Billing settings', 'Subscription and billing configuration.', 'financial',  'hidden'),
  ('settings', 'settings.users',        'User management',  'User accounts and membership.',           'governance', 'hidden'),
  ('settings', 'settings.permissions',  'Permissions',      'Access and permission configuration.',    'governance', 'hidden'),
  ('settings', 'settings.integrations', 'Integrations',     'Third-party integrations and secrets.',   'governance', 'hidden'),
  ('settings', 'settings.security',     'Security',         'Security and compliance configuration.',  'governance', 'hidden'),
  -- investor_dashboard
  ('investor_dashboard', 'investor.financial_summary',    'Investor financial summary', 'Investor-facing financial summary.',       'financial', 'summary_only'),
  ('investor_dashboard', 'investor.growth_metrics',       'Growth metrics',             'Investor-facing growth metrics.',          'financial', 'summary_only'),
  ('investor_dashboard', 'investor.clinic_performance',   'Clinic performance',         'Investor-facing clinic performance.',      'sensitive', 'summary_only'),
  ('investor_dashboard', 'investor.deidentified_outcomes','De-identified outcomes',     'De-identified clinical outcomes.',         'clinical',  'summary_only')
on conflict (module_key, field_key) do update
set
  label = excluded.label,
  description = excluded.description,
  sensitivity_level = excluded.sensitivity_level,
  default_masking_strategy = excluded.default_masking_strategy,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Seed: baseline global role field permission templates (tenant_id = NULL)
-- Only entries that RAISE access above the field default are seeded; absence = field default.
-- Owner / platform_admin are intentionally omitted from the seed: they hold module-admin
-- everywhere, so the engine grants them export on every field automatically.
-- ---------------------------------------------------------------------------
insert into public.fi_role_field_permission_templates (tenant_id, role_key, module_key, field_key, permission_level, scope)
values
  -- doctor
  (null, 'doctor', 'patient_os', 'patient.identity',                       'read',    'tenant'),
  (null, 'doctor', 'patient_os', 'patient.contact_details',                'read',    'tenant'),
  (null, 'doctor', 'patient_os', 'patient.medical_history',                'edit',    'tenant'),
  (null, 'doctor', 'patient_os', 'patient.medications',                    'edit',    'tenant'),
  (null, 'doctor', 'patient_os', 'patient.photos',                         'edit',    'tenant'),
  (null, 'doctor', 'patient_os', 'patient.documents',                      'read',    'tenant'),
  (null, 'doctor', 'patient_os', 'patient.audit_reports',                  'read',    'tenant'),
  (null, 'doctor', 'patient_os', 'patient.internal_notes',                 'read',    'tenant'),
  (null, 'doctor', 'consultation_os', 'consultation.clinical_notes',             'edit',    'tenant'),
  (null, 'doctor', 'consultation_os', 'consultation.diagnosis',                  'edit',    'tenant'),
  (null, 'doctor', 'consultation_os', 'consultation.treatment_plan',             'edit',    'tenant'),
  (null, 'doctor', 'consultation_os', 'consultation.quote',                      'read',    'tenant'),
  (null, 'doctor', 'consultation_os', 'consultation.consent',                    'approve', 'tenant'),
  (null, 'doctor', 'consultation_os', 'consultation.private_practitioner_notes', 'edit',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.graft_count',      'edit',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.hair_count',       'edit',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.punch_size',       'edit',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.transection_rate', 'edit',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.team_members',     'read',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.medications',      'edit',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.surgical_notes',   'edit',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.complications',    'edit',    'tenant'),
  (null, 'doctor', 'surgery_os', 'surgery.outcome_metrics',  'approve', 'tenant'),
  -- nurse
  (null, 'nurse', 'patient_os', 'patient.identity',        'read', 'assigned'),
  (null, 'nurse', 'patient_os', 'patient.contact_details', 'read', 'assigned'),
  (null, 'nurse', 'patient_os', 'patient.medical_history', 'read', 'assigned'),
  (null, 'nurse', 'patient_os', 'patient.medications',     'edit', 'assigned'),
  (null, 'nurse', 'patient_os', 'patient.photos',          'edit', 'assigned'),
  (null, 'nurse', 'patient_os', 'patient.audit_reports',   'read', 'assigned'),
  (null, 'nurse', 'consultation_os', 'consultation.clinical_notes', 'read', 'assigned'),
  (null, 'nurse', 'consultation_os', 'consultation.treatment_plan', 'read', 'assigned'),
  (null, 'nurse', 'surgery_os', 'surgery.graft_count',    'edit', 'assigned'),
  (null, 'nurse', 'surgery_os', 'surgery.hair_count',     'edit', 'assigned'),
  (null, 'nurse', 'surgery_os', 'surgery.punch_size',     'read', 'assigned'),
  (null, 'nurse', 'surgery_os', 'surgery.team_members',   'read', 'assigned'),
  (null, 'nurse', 'surgery_os', 'surgery.medications',    'edit', 'assigned'),
  (null, 'nurse', 'surgery_os', 'surgery.surgical_notes', 'edit', 'assigned'),
  (null, 'nurse', 'surgery_os', 'surgery.complications',  'read', 'assigned'),
  (null, 'nurse', 'surgery_os', 'surgery.outcome_metrics','read', 'assigned'),
  -- reception
  (null, 'reception', 'patient_os', 'patient.identity',        'read', 'tenant'),
  (null, 'reception', 'patient_os', 'patient.contact_details', 'edit', 'tenant'),
  (null, 'reception', 'patient_os', 'patient.documents',       'read', 'tenant'),
  (null, 'reception', 'consultation_os', 'consultation.quote',  'read', 'tenant'),
  (null, 'reception', 'financial_os', 'financial.payment_status','read', 'tenant'),
  -- consultant
  (null, 'consultant', 'patient_os', 'patient.identity',        'read', 'tenant'),
  (null, 'consultant', 'patient_os', 'patient.contact_details', 'read', 'tenant'),
  (null, 'consultant', 'patient_os', 'patient.audit_reports',   'read', 'tenant'),
  (null, 'consultant', 'consultation_os', 'consultation.clinical_notes',             'read', 'tenant'),
  (null, 'consultant', 'consultation_os', 'consultation.diagnosis',                  'read', 'tenant'),
  (null, 'consultant', 'consultation_os', 'consultation.treatment_plan',             'edit', 'tenant'),
  (null, 'consultant', 'consultation_os', 'consultation.quote',                      'edit', 'tenant'),
  (null, 'consultant', 'consultation_os', 'consultation.consent',                    'edit', 'tenant'),
  (null, 'consultant', 'consultation_os', 'consultation.private_practitioner_notes', 'read', 'tenant'),
  (null, 'consultant', 'analytics_os', 'analytics.conversion', 'read', 'tenant'),
  -- manager
  (null, 'manager', 'patient_os', 'patient.identity',          'read', 'tenant'),
  (null, 'manager', 'patient_os', 'patient.contact_details',   'read', 'tenant'),
  (null, 'manager', 'patient_os', 'patient.financial_summary', 'read', 'tenant'),
  (null, 'manager', 'patient_os', 'patient.audit_reports',     'read', 'tenant'),
  (null, 'manager', 'consultation_os', 'consultation.quote',   'read', 'tenant'),
  (null, 'manager', 'consultation_os', 'consultation.consent', 'read', 'tenant'),
  (null, 'manager', 'financial_os', 'financial.invoice',        'read', 'tenant'),
  (null, 'manager', 'financial_os', 'financial.payment_status', 'read', 'tenant'),
  (null, 'manager', 'financial_os', 'financial.refunds',        'read', 'tenant'),
  (null, 'manager', 'financial_os', 'financial.revenue',        'read', 'tenant'),
  (null, 'manager', 'analytics_os', 'analytics.revenue',           'read', 'tenant'),
  (null, 'manager', 'analytics_os', 'analytics.conversion',        'read', 'tenant'),
  (null, 'manager', 'analytics_os', 'analytics.staff_productivity','read', 'tenant'),
  (null, 'manager', 'workforce_os', 'workforce.personal_details', 'read', 'tenant'),
  (null, 'manager', 'workforce_os', 'workforce.documents',        'read', 'tenant'),
  (null, 'manager', 'workforce_os', 'workforce.training',         'read', 'tenant'),
  (null, 'manager', 'workforce_os', 'workforce.certifications',   'read', 'tenant'),
  (null, 'manager', 'workforce_os', 'workforce.performance',      'read', 'tenant'),
  (null, 'manager', 'settings', 'settings.users', 'read', 'tenant'),
  -- investor
  (null, 'investor', 'analytics_os', 'analytics.revenue',          'read', 'tenant'),
  (null, 'investor', 'analytics_os', 'analytics.conversion',       'read', 'tenant'),
  (null, 'investor', 'analytics_os', 'analytics.investor_summary', 'read', 'tenant'),
  (null, 'investor', 'investor_dashboard', 'investor.financial_summary',     'read', 'tenant'),
  (null, 'investor', 'investor_dashboard', 'investor.growth_metrics',        'read', 'tenant'),
  (null, 'investor', 'investor_dashboard', 'investor.clinic_performance',    'read', 'tenant'),
  (null, 'investor', 'investor_dashboard', 'investor.deidentified_outcomes', 'read', 'tenant'),
  -- trainer
  (null, 'trainer', 'patient_os', 'patient.identity',      'read', 'tenant'),
  (null, 'trainer', 'patient_os', 'patient.audit_reports', 'read', 'tenant'),
  -- auditor
  (null, 'auditor', 'patient_os', 'patient.identity',        'read', 'tenant'),
  (null, 'auditor', 'patient_os', 'patient.contact_details', 'read', 'tenant'),
  (null, 'auditor', 'patient_os', 'patient.medical_history', 'read', 'tenant'),
  (null, 'auditor', 'patient_os', 'patient.medications',     'read', 'tenant'),
  (null, 'auditor', 'patient_os', 'patient.photos',          'read', 'tenant'),
  (null, 'auditor', 'patient_os', 'patient.audit_reports',   'read', 'tenant'),
  (null, 'auditor', 'consultation_os', 'consultation.clinical_notes', 'read', 'tenant'),
  (null, 'auditor', 'consultation_os', 'consultation.diagnosis',      'read', 'tenant'),
  (null, 'auditor', 'consultation_os', 'consultation.treatment_plan', 'read', 'tenant'),
  (null, 'auditor', 'consultation_os', 'consultation.consent',        'read', 'tenant'),
  (null, 'auditor', 'surgery_os', 'surgery.surgical_notes',  'read', 'tenant'),
  (null, 'auditor', 'surgery_os', 'surgery.complications',   'read', 'tenant'),
  (null, 'auditor', 'surgery_os', 'surgery.outcome_metrics', 'read', 'tenant'),
  (null, 'auditor', 'analytics_os', 'analytics.clinical_outcomes', 'read', 'tenant')
on conflict (tenant_id, role_key, module_key, field_key) do update
set
  permission_level = excluded.permission_level,
  scope = excluded.scope,
  updated_at = now();
