-- SA-2B: Reception operational access calibration (SA-1 module ceiling).
--
-- Reception staff need to update patient demographic/contact information operationally.
-- The prior baseline capped patient_os at read, which clamped contact_details edit grants
-- down to read (field permission <= module permission). This patch raises ONLY the module
-- ceiling to edit; SA-2 field boundaries remain unchanged.
--
-- Applies to global baseline rows (tenant_id IS NULL) and any tenant-specific template rows
-- that mirror the seeded reception patient_os baseline.

update public.fi_role_permission_templates
set
  access_level = 'edit',
  updated_at = now()
where role_key = 'reception'
  and module_key = 'patient_os'
  and access_level = 'read';
