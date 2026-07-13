-- FI OS: finance workspace profile for finance_admin / FINANCE_ADMIN (not director chrome).

update public.fi_staff_feature_templates
set workspace_profile = 'finance',
    updated_at = now()
where tenant_id is null
  and template_key = 'finance_admin_default'
  and workspace_profile = 'director';

update public.fi_staff_position_types
set default_workspace_profile = 'finance',
    updated_at = now()
where tenant_id is null
  and code = 'FINANCE_ADMIN'
  and default_workspace_profile = 'director';
