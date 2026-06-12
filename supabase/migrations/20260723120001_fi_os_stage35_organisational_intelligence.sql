-- FI OS Stage 3.5: organisational intelligence (position types, feature templates, tenant operating modes).
-- Additive only: extends fi_staff with optional position_type_id; staff_role remains legacy fallback.

-- ---------------------------------------------------------------------------
-- fi_staff_position_types
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_position_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  code text not null,
  title text not null,
  department text not null,
  description text,
  default_workspace_profile text,
  default_feature_template_key text,
  clinical_access_level text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_position_types_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_position_types is
  'FI OS Stage 3.5: workforce position codes (global tenant_id null, or tenant-specific custom rows).';

create unique index if not exists idx_fi_staff_position_types_global_code_unique
  on public.fi_staff_position_types (code)
  where tenant_id is null;

create unique index if not exists idx_fi_staff_position_types_tenant_code_unique
  on public.fi_staff_position_types (tenant_id, code)
  where tenant_id is not null;

create index if not exists idx_fi_staff_position_types_tenant on public.fi_staff_position_types (tenant_id);

alter table public.fi_staff_position_types enable row level security;

drop policy if exists fi_staff_position_types_select_authenticated on public.fi_staff_position_types;
create policy fi_staff_position_types_select_authenticated
  on public.fi_staff_position_types for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_position_types.tenant_id
    )
  );

grant select on public.fi_staff_position_types to authenticated, service_role;
grant insert, update, delete on public.fi_staff_position_types to service_role;

-- ---------------------------------------------------------------------------
-- fi_staff_feature_templates
-- ---------------------------------------------------------------------------
create table if not exists public.fi_staff_feature_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  template_key text not null,
  label text not null,
  description text,
  feature_access jsonb not null default '{}'::jsonb,
  workspace_profile text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_staff_feature_templates_feature_access_object check (jsonb_typeof(feature_access) = 'object'),
  constraint fi_staff_feature_templates_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_staff_feature_templates is
  'FI OS Stage 3.5: default feature visibility maps keyed by template_key; per-staff fi_staff_feature_access overrides still win.';

create unique index if not exists idx_fi_staff_feature_templates_global_key_unique
  on public.fi_staff_feature_templates (template_key)
  where tenant_id is null;

create unique index if not exists idx_fi_staff_feature_templates_tenant_key_unique
  on public.fi_staff_feature_templates (tenant_id, template_key)
  where tenant_id is not null;

create index if not exists idx_fi_staff_feature_templates_tenant on public.fi_staff_feature_templates (tenant_id);

alter table public.fi_staff_feature_templates enable row level security;

drop policy if exists fi_staff_feature_templates_select_authenticated on public.fi_staff_feature_templates;
create policy fi_staff_feature_templates_select_authenticated
  on public.fi_staff_feature_templates for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_staff_feature_templates.tenant_id
    )
  );

grant select on public.fi_staff_feature_templates to authenticated, service_role;
grant insert, update, delete on public.fi_staff_feature_templates to service_role;

-- ---------------------------------------------------------------------------
-- fi_tenant_operating_modes
-- ---------------------------------------------------------------------------
create table if not exists public.fi_tenant_operating_modes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,
  mode_key text not null,
  label text not null,
  description text,
  default_features jsonb not null default '{}'::jsonb,
  default_workspace_profiles jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_operating_modes_default_features_object check (jsonb_typeof(default_features) = 'object'),
  constraint fi_tenant_operating_modes_default_workspace_profiles_object check (jsonb_typeof(default_workspace_profiles) = 'object'),
  constraint fi_tenant_operating_modes_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_tenant_operating_modes is
  'FI OS Stage 3.5: catalog of tenant operating modes (global rows). Optional fi_tenants.config_json.fi_os_operating_mode_key selects a mode in app code.';

create unique index if not exists idx_fi_tenant_operating_modes_global_key_unique
  on public.fi_tenant_operating_modes (mode_key)
  where tenant_id is null;

create unique index if not exists idx_fi_tenant_operating_modes_tenant_key_unique
  on public.fi_tenant_operating_modes (tenant_id, mode_key)
  where tenant_id is not null;

create index if not exists idx_fi_tenant_operating_modes_tenant on public.fi_tenant_operating_modes (tenant_id);

alter table public.fi_tenant_operating_modes enable row level security;

drop policy if exists fi_tenant_operating_modes_select_authenticated on public.fi_tenant_operating_modes;
create policy fi_tenant_operating_modes_select_authenticated
  on public.fi_tenant_operating_modes for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_tenant_operating_modes.tenant_id
    )
  );

grant select on public.fi_tenant_operating_modes to authenticated, service_role;
grant insert, update, delete on public.fi_tenant_operating_modes to service_role;

-- ---------------------------------------------------------------------------
-- fi_staff.position_type_id
-- ---------------------------------------------------------------------------
alter table public.fi_staff
  add column if not exists position_type_id uuid references public.fi_staff_position_types (id) on delete set null;

create index if not exists idx_fi_staff_position_type on public.fi_staff (position_type_id);

comment on column public.fi_staff.position_type_id is
  'FI OS Stage 3.5: optional structured position; staff_role remains legacy fallback when null or unmapped.';

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse simple pattern)
-- ---------------------------------------------------------------------------
create or replace function public.fi_os_stage35_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fi_staff_position_types_set_updated_at on public.fi_staff_position_types;
create trigger trg_fi_staff_position_types_set_updated_at
  before update on public.fi_staff_position_types
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

drop trigger if exists trg_fi_staff_feature_templates_set_updated_at on public.fi_staff_feature_templates;
create trigger trg_fi_staff_feature_templates_set_updated_at
  before update on public.fi_staff_feature_templates
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

drop trigger if exists trg_fi_tenant_operating_modes_set_updated_at on public.fi_tenant_operating_modes;
create trigger trg_fi_tenant_operating_modes_set_updated_at
  before update on public.fi_tenant_operating_modes
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- Seeds: feature templates (global), idempotent
-- ---------------------------------------------------------------------------
insert into public.fi_staff_feature_templates (
  tenant_id, template_key, label, description, feature_access, workspace_profile, is_system, is_active
)
select null, v.template_key, v.label, v.description, v.feature_access, v.workspace_profile, true, true
from (
  values
  ('director_default', 'Director defaults', 'Broad operating visibility with emphasis on intelligence surfaces.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": true, "consultations": true, "cases": true, "procedure_day": true, "prescriptions": true, "pathology": true, "imaging": true, "patient_twin": true, "audit": true, "analytics": true, "academy": false, "staff": true, "settings": true, "quick_actions": true, "surgery_pipeline": true, "my_workspace": true, "attention_centre": true}'::jsonb,
    'director'),
  ('clinic_manager_default', 'Clinic manager defaults', 'Operations, scheduling, and team coordination.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": true, "consultations": true, "cases": true, "procedure_day": true, "prescriptions": true, "pathology": true, "imaging": true, "patient_twin": false, "audit": false, "analytics": false, "academy": false, "staff": true, "settings": true, "quick_actions": true, "surgery_pipeline": true, "my_workspace": true, "attention_centre": true}'::jsonb,
    'clinic_manager'),
  ('surgeon_default', 'Surgeon defaults', 'SurgeryOS, imaging, pathology, procedure day.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": false, "consultations": true, "cases": true, "procedure_day": true, "prescriptions": true, "pathology": true, "imaging": true, "patient_twin": true, "audit": true, "analytics": false, "academy": false, "staff": false, "settings": true, "quick_actions": true, "surgery_pipeline": true, "my_workspace": true, "attention_centre": true}'::jsonb,
    'surgeon'),
  ('doctor_default', 'Doctor defaults', 'Clinical care, diagnostics, longitudinal patients.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": false, "consultations": true, "cases": true, "procedure_day": true, "prescriptions": true, "pathology": true, "imaging": true, "patient_twin": true, "audit": false, "analytics": false, "academy": false, "staff": false, "settings": true, "quick_actions": true, "surgery_pipeline": true, "my_workspace": true, "attention_centre": true}'::jsonb,
    'doctor'),
  ('nurse_default', 'Nurse / RN defaults', 'Procedure preparation, patient flow, procedure day.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": false, "consultations": false, "cases": true, "procedure_day": true, "prescriptions": true, "pathology": true, "imaging": true, "patient_twin": false, "audit": false, "analytics": false, "academy": false, "staff": false, "settings": true, "quick_actions": true, "surgery_pipeline": true, "my_workspace": true, "attention_centre": true}'::jsonb,
    'nurse'),
  ('technician_default', 'Technician defaults', 'Imaging and procedure support workflows.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": false, "consultations": false, "cases": true, "procedure_day": true, "prescriptions": false, "pathology": true, "imaging": true, "patient_twin": false, "audit": false, "analytics": false, "academy": false, "staff": false, "settings": true, "quick_actions": true, "surgery_pipeline": false, "my_workspace": true, "attention_centre": true}'::jsonb,
    'nurse'),
  ('consultant_default', 'Consultant defaults', 'Leads, consultations, CRM, bookings.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": true, "consultations": true, "cases": false, "procedure_day": false, "prescriptions": false, "pathology": false, "imaging": false, "patient_twin": false, "audit": false, "analytics": false, "academy": false, "staff": false, "settings": true, "quick_actions": true, "surgery_pipeline": false, "my_workspace": true, "attention_centre": true}'::jsonb,
    'consultant'),
  ('reception_default', 'Reception defaults', 'Front desk, calendar, light CRM triage.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": true, "consultations": false, "cases": false, "procedure_day": false, "prescriptions": false, "pathology": false, "imaging": false, "patient_twin": false, "audit": false, "analytics": false, "academy": false, "staff": false, "settings": true, "quick_actions": true, "surgery_pipeline": false, "my_workspace": true, "attention_centre": true}'::jsonb,
    'reception'),
  ('academy_trainer_default', 'Academy trainer defaults', 'Academy and training delivery.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": false, "consultations": false, "cases": false, "procedure_day": false, "prescriptions": false, "pathology": false, "imaging": false, "patient_twin": false, "audit": false, "analytics": false, "academy": true, "staff": true, "settings": true, "quick_actions": true, "surgery_pipeline": false, "my_workspace": true, "attention_centre": true}'::jsonb,
    'academy_trainer'),
  ('auditor_default', 'Auditor defaults', 'Audit and safety review surfaces.',
    '{"dashboard": true, "calendar": false, "patients": true, "crm": false, "consultations": false, "cases": true, "procedure_day": false, "prescriptions": false, "pathology": false, "imaging": false, "patient_twin": false, "audit": true, "analytics": true, "academy": false, "staff": true, "settings": true, "quick_actions": true, "surgery_pipeline": false, "my_workspace": true, "attention_centre": true}'::jsonb,
    'auditor'),
  ('finance_admin_default', 'Finance admin defaults', 'Revenue, pipeline, and finance-friendly visibility.',
    '{"dashboard": true, "calendar": true, "patients": true, "crm": true, "consultations": true, "cases": true, "procedure_day": false, "prescriptions": false, "pathology": false, "imaging": false, "patient_twin": false, "audit": false, "analytics": true, "academy": false, "staff": true, "settings": true, "quick_actions": true, "surgery_pipeline": true, "my_workspace": true, "attention_centre": true}'::jsonb,
    'director'),
  ('data_safety_admin_default', 'Data safety admin defaults', 'Governance, audit, and access review.',
    '{"dashboard": true, "calendar": false, "patients": true, "crm": false, "consultations": false, "cases": false, "procedure_day": false, "prescriptions": false, "pathology": false, "imaging": false, "patient_twin": true, "audit": true, "analytics": true, "academy": false, "staff": true, "settings": true, "quick_actions": true, "surgery_pipeline": false, "my_workspace": true, "attention_centre": true}'::jsonb,
    'auditor')
) as v(template_key, label, description, feature_access, workspace_profile)
where not exists (
  select 1 from public.fi_staff_feature_templates t
  where t.tenant_id is null and t.template_key = v.template_key
);

-- ---------------------------------------------------------------------------
-- Seeds: position types (global), idempotent
-- ---------------------------------------------------------------------------
insert into public.fi_staff_position_types (
  tenant_id, code, title, department, description, default_workspace_profile, default_feature_template_key, clinical_access_level, is_system, is_active
)
select null, v.code, v.title, v.department, v.description, v.default_workspace_profile, v.default_feature_template_key, v.clinical_access_level, true, true
from (
  values
  ('DIRECTOR', 'Director', 'leadership', 'Executive and multi-clinic oversight.', 'director', 'director_default', 'administrative'),
  ('CLINIC_MANAGER', 'Clinic manager', 'operations', 'Day-to-day clinic operations and staffing.', 'clinic_manager', 'clinic_manager_default', 'administrative'),
  ('SURGEON', 'Surgeon', 'clinical_surgical', 'Surgical planning and procedure leadership.', 'surgeon', 'surgeon_default', 'full_clinical'),
  ('DOCTOR', 'Doctor', 'clinical', 'Clinical care and diagnostics.', 'doctor', 'doctor_default', 'full_clinical'),
  ('RN', 'Registered nurse', 'clinical', 'Nursing care and procedure support.', 'nurse', 'nurse_default', 'full_clinical'),
  ('TECHNICIAN', 'Technician', 'clinical_support', 'Technical and imaging support.', 'nurse', 'technician_default', 'limited_clinical'),
  ('CONSULTANT', 'Consultant', 'clinical_consulting', 'Consultations, quotes, and conversion.', 'consultant', 'consultant_default', 'limited_clinical'),
  ('RECEPTION', 'Reception', 'front_of_house', 'Front desk and scheduling.', 'reception', 'reception_default', 'non_clinical'),
  ('ACADEMY_TRAINER', 'Academy trainer', 'training', 'Training delivery and academy programmes.', 'academy_trainer', 'academy_trainer_default', 'non_clinical'),
  ('AUDITOR', 'Auditor', 'governance', 'Audit and compliance review.', 'auditor', 'auditor_default', 'governance'),
  ('FINANCE_ADMIN', 'Finance administrator', 'finance', 'Finance operations and reporting.', 'director', 'finance_admin_default', 'financial'),
  ('DATA_SAFETY_ADMIN', 'Data safety administrator', 'governance', 'Data protection and safety oversight.', 'auditor', 'data_safety_admin_default', 'data_safety')
) as v(code, title, department, description, default_workspace_profile, default_feature_template_key, clinical_access_level)
where not exists (
  select 1 from public.fi_staff_position_types p
  where p.tenant_id is null and p.code = v.code
);

-- ---------------------------------------------------------------------------
-- Seeds: tenant operating modes (global catalog), idempotent
-- ---------------------------------------------------------------------------
insert into public.fi_tenant_operating_modes (
  tenant_id, mode_key, label, description, default_features, default_workspace_profiles, is_system, is_active
)
select null, v.mode_key, v.label, v.description, v.default_features, v.default_workspace_profiles, true, true
from (
  values
  ('hair_transplant_clinic', 'Hair transplant clinic', 'Surgery-forward FI OS: cases, procedure day, imaging, audit, patient twin.',
    '{"academy": false, "crm": false}'::jsonb,
    '{"primary_persona": "surgeon"}'::jsonb),
  ('medical_hair_clinic', 'Medical hair clinic', 'Consultation and medical hair workflows: consultations, prescriptions, pathology, patients, CRM.',
    '{"cases": false, "procedure_day": false, "surgery_pipeline": false}'::jsonb,
    '{"primary_persona": "doctor"}'::jsonb),
  ('training_academy', 'Training academy', 'Academy and staff training focus.',
    '{"cases": false, "procedure_day": false, "pathology": false, "imaging": false, "prescriptions": false}'::jsonb,
    '{"primary_persona": "academy_trainer"}'::jsonb),
  ('audit_partner', 'Audit partner', 'Partner org focused on audit and analytics.',
    '{"calendar": false, "crm": false, "consultations": false, "procedure_day": false}'::jsonb,
    '{"primary_persona": "auditor"}'::jsonb),
  ('full_fi_os', 'Full FI OS', 'All modules enabled at tenant-default layer (still subject to per-staff overrides).',
    '{}'::jsonb,
    '{}'::jsonb)
) as v(mode_key, label, description, default_features, default_workspace_profiles)
where not exists (
  select 1 from public.fi_tenant_operating_modes m
  where m.tenant_id is null and m.mode_key = v.mode_key
);
