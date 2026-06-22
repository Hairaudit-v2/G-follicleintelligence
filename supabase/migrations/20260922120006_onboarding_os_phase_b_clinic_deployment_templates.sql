-- OnboardingOS Phase B: clinic deployment templates (role packs, module bundles,
-- service/workflow templates, AcademyOS assignments, sandbox seed).
-- RLS: service_role DML only — unchanged from Phase A.

alter table public.fi_tenant_provisioning_templates
  add column if not exists deployment_template jsonb not null default '{}'::jsonb;

alter table public.fi_tenant_provisioning_templates
  drop constraint if exists fi_tenant_provisioning_templates_deployment_template_object;

alter table public.fi_tenant_provisioning_templates
  add constraint fi_tenant_provisioning_templates_deployment_template_object
  check (jsonb_typeof(deployment_template) = 'object');

comment on column public.fi_tenant_provisioning_templates.deployment_template is
  'OnboardingOS Phase B: service/workflow/academy/sandbox deployment preset (template-only CRM).';

alter table public.fi_tenant_provisioning_sessions
  add column if not exists deployment_snapshot jsonb not null default '{}'::jsonb;

alter table public.fi_tenant_provisioning_sessions
  drop constraint if exists fi_tenant_provisioning_sessions_deployment_snapshot_object;

alter table public.fi_tenant_provisioning_sessions
  add constraint fi_tenant_provisioning_sessions_deployment_snapshot_object
  check (jsonb_typeof(deployment_snapshot) = 'object');

comment on column public.fi_tenant_provisioning_sessions.deployment_snapshot is
  'OnboardingOS Phase B: resolved deployment plan + readiness applied at session creation.';

-- ---------------------------------------------------------------------------
-- Phase B deployment templates (upsert by code)
-- ---------------------------------------------------------------------------

insert into public.fi_tenant_provisioning_templates (
  code,
  display_name,
  description,
  is_default,
  role_template,
  module_template,
  deployment_template,
  metadata
)
values
  (
    'standard_hair_restoration',
    'Standard Hair Restoration Clinic',
    'Core reception, consultation, and patient workflows for a single-site hair restoration clinic.',
    true,
    jsonb_build_object(
      'role_pack_code', 'standard_clinic_roles',
      'primary_admin_role', 'clinic_admin',
      'additional_roles', jsonb_build_array('operations_admin', 'dashboard_viewer')
    ),
    jsonb_build_object(
      'module_bundle_code', 'core_clinic',
      'subscription_status', 'trialing',
      'verification_status', 'verified',
      'enabled_modules', jsonb_build_array(
        'reception_os', 'consultation_os', 'patient_os', 'analytics_os'
      )
    ),
    jsonb_build_object(
      'template_code', 'standard_hair_restoration',
      'role_pack_code', 'standard_clinic_roles',
      'module_bundle_code', 'core_clinic',
      'service_template_codes', jsonb_build_array('consultation', 'follow_up', 'prp'),
      'workflow_template_codes', jsonb_build_array('crm_pipeline_standard', 'reminder_24h', 'reminder_48h'),
      'academy_track_codes', jsonb_build_array('fi_clinical_foundations', 'reception_excellence'),
      'sandbox_seed', jsonb_build_object(
        'enabled', true,
        'include_demo_patients', true,
        'include_demo_bookings', true,
        'include_demo_staff', true
      )
    ),
    jsonb_build_object('phase', 'B', 'billing_connector', 'none')
  ),
  (
    'surgical_hair_restoration',
    'Surgical Hair Restoration Clinic',
    'Full surgical stack with theatre workflows, imaging, financial clearance, and AcademyOS privileges.',
    false,
    jsonb_build_object(
      'role_pack_code', 'surgical_clinic_roles',
      'primary_admin_role', 'clinic_admin',
      'additional_roles', jsonb_build_array('operations_admin', 'finance_admin', 'data_safety_admin')
    ),
    jsonb_build_object(
      'module_bundle_code', 'surgical_clinic',
      'subscription_status', 'trialing',
      'verification_status', 'verified',
      'enabled_modules', jsonb_build_array(
        'reception_os', 'consultation_os', 'patient_os', 'surgery_os',
        'imaging_os', 'financial_os', 'analytics_os', 'academy_os'
      )
    ),
    jsonb_build_object(
      'template_code', 'surgical_hair_restoration',
      'role_pack_code', 'surgical_clinic_roles',
      'module_bundle_code', 'surgical_clinic',
      'service_template_codes', jsonb_build_array(
        'consultation', 'follow_up', 'ht_consultation', 'surgery', 'prp'
      ),
      'workflow_template_codes', jsonb_build_array(
        'crm_pipeline_standard', 'reminder_24h', 'reminder_48h',
        'surgery_clearance_checklist', 'surgery_day_workflow'
      ),
      'academy_track_codes', jsonb_build_array(
        'fi_clinical_foundations', 'reception_excellence',
        'theatre_privileges_fue', 'graft_counting_competency'
      ),
      'sandbox_seed', jsonb_build_object(
        'enabled', false,
        'include_demo_patients', false,
        'include_demo_bookings', false,
        'include_demo_staff', false
      )
    ),
    jsonb_build_object('phase', 'B', 'billing_connector', 'none')
  ),
  (
    'growth_consultation',
    'Growth / Consultation Clinic',
    'Consultation-led growth clinic with trichology and non-surgical treatment pathways.',
    false,
    jsonb_build_object(
      'role_pack_code', 'growth_clinic_roles',
      'primary_admin_role', 'clinic_admin',
      'additional_roles', jsonb_build_array('finance_admin', 'dashboard_viewer')
    ),
    jsonb_build_object(
      'module_bundle_code', 'growth_clinic',
      'subscription_status', 'trialing',
      'verification_status', 'verified',
      'enabled_modules', jsonb_build_array(
        'reception_os', 'consultation_os', 'patient_os', 'financial_os', 'analytics_os'
      )
    ),
    jsonb_build_object(
      'template_code', 'growth_consultation',
      'role_pack_code', 'growth_clinic_roles',
      'module_bundle_code', 'growth_clinic',
      'service_template_codes', jsonb_build_array(
        'consultation', 'follow_up', 'trichology', 'prp', 'mesotherapy'
      ),
      'workflow_template_codes', jsonb_build_array(
        'crm_pipeline_standard', 'reminder_24h', 'reminder_48h', 'consultation_nurture'
      ),
      'academy_track_codes', jsonb_build_array('consultation_mastery', 'trichology_basics'),
      'sandbox_seed', jsonb_build_object(
        'enabled', true,
        'include_demo_patients', true,
        'include_demo_bookings', false,
        'include_demo_staff', true
      )
    ),
    jsonb_build_object('phase', 'B', 'billing_connector', 'none')
  ),
  (
    'enterprise_multi_clinic',
    'Enterprise Multi-Clinic Group',
    'Enterprise verification, HR OS, audit, and multi-clinic routing for clinic groups.',
    false,
    jsonb_build_object(
      'role_pack_code', 'enterprise_group_roles',
      'primary_admin_role', 'clinic_admin',
      'additional_roles', jsonb_build_array(
        'finance_admin', 'operations_admin', 'data_safety_admin', 'dashboard_viewer'
      )
    ),
    jsonb_build_object(
      'module_bundle_code', 'enterprise_group',
      'subscription_status', 'trialing',
      'verification_status', 'enterprise_verified',
      'enabled_modules', jsonb_build_array(
        'reception_os', 'consultation_os', 'patient_os', 'surgery_os',
        'financial_os', 'imaging_os', 'audit_os', 'academy_os', 'analytics_os', 'hr_os'
      )
    ),
    jsonb_build_object(
      'template_code', 'enterprise_multi_clinic',
      'role_pack_code', 'enterprise_group_roles',
      'module_bundle_code', 'enterprise_group',
      'service_template_codes', jsonb_build_array(
        'consultation', 'follow_up', 'ht_consultation', 'surgery', 'prp'
      ),
      'workflow_template_codes', jsonb_build_array(
        'crm_pipeline_standard', 'reminder_24h', 'reminder_48h',
        'surgery_clearance_checklist', 'surgery_day_workflow', 'multi_clinic_routing'
      ),
      'academy_track_codes', jsonb_build_array(
        'fi_clinical_foundations', 'reception_excellence',
        'theatre_privileges_fue', 'graft_counting_competency',
        'multi_clinic_ops', 'data_safety_compliance'
      ),
      'sandbox_seed', jsonb_build_object(
        'enabled', false,
        'include_demo_patients', false,
        'include_demo_bookings', false,
        'include_demo_staff', false
      )
    ),
    jsonb_build_object('phase', 'B', 'billing_connector', 'none')
  )
on conflict (code) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  is_default = excluded.is_default,
  role_template = excluded.role_template,
  module_template = excluded.module_template,
  deployment_template = excluded.deployment_template,
  metadata = excluded.metadata,
  is_active = true,
  updated_at = now();

-- Retire legacy Phase A code as default (map via app layer)
update public.fi_tenant_provisioning_templates
set is_default = false, updated_at = now()
where code = 'standard_clinic';

update public.fi_tenant_provisioning_templates
set is_default = true, updated_at = now()
where code = 'standard_hair_restoration';
