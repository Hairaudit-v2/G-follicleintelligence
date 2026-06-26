-- SA-2B: Reception operational field calibration (SA-2 field boundaries).
--
-- Canonical reception PatientOS field model:
--   patient.identity          → read
--   patient.contact_details   → edit
--   patient.photos            → read
--   patient.documents         → read
--   patient.audit_reports     → hidden  (default is summary_only; force hidden)
--   patient.medical_history   → hidden  (field default; no row needed)
--   patient.medications       → hidden  (field default; no row needed)
--   patient.financial_summary → hidden  (financial sensitivity default; no row needed)
--   patient.internal_notes    → hidden  (field default; no row needed)
--
-- Module ceiling (patient_os → edit) is applied in 20260927120003_sa2b_reception_access_calibration.sql.

insert into public.fi_role_field_permission_templates (tenant_id, role_key, module_key, field_key, permission_level, scope)
values
  (null, 'reception', 'patient_os', 'patient.photos',       'read',   'tenant'),
  (null, 'reception', 'patient_os', 'patient.audit_reports','hidden', 'tenant')
on conflict (tenant_id, role_key, module_key, field_key) do update
set
  permission_level = excluded.permission_level,
  scope = excluded.scope,
  updated_at = now();

-- Align tenant-specific reception rows that still mirror the old global baseline.
update public.fi_role_field_permission_templates
set
  permission_level = 'read',
  updated_at = now()
where role_key = 'reception'
  and module_key = 'patient_os'
  and field_key = 'patient.photos'
  and permission_level <> 'read';

update public.fi_role_field_permission_templates
set
  permission_level = 'hidden',
  updated_at = now()
where role_key = 'reception'
  and module_key = 'patient_os'
  and field_key = 'patient.audit_reports'
  and permission_level not in ('hidden');
