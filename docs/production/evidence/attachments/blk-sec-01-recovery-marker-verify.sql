-- BLK-SEC-01 E4 — recovery marker verify (staging SQL editor only after restore)
-- Marker: SMOKETEST-JOURNEY-001-20260630 / fi_crm_leads 66b47348-bf0e-48b7-a188-accbee0db4a3
-- Do not run as a production write. Read-only checks.

SELECT id, tenant_id, left(summary, 80) AS summary_prefix, created_at
FROM public.fi_crm_leads
WHERE id = '66b47348-bf0e-48b7-a188-accbee0db4a3';

SELECT 'fi_patients' AS t, id::text AS id, created_at FROM public.fi_patients
WHERE id = '51a44cf6-e4de-4282-960c-be220909f9a0'
UNION ALL
SELECT 'fi_cases', id::text, created_at FROM public.fi_cases
WHERE id = 'efa25110-9dbc-4599-8fbd-3670e8921efd'
UNION ALL
SELECT 'fi_bookings', id::text, created_at FROM public.fi_bookings
WHERE id = 'f53f63aa-3d8a-4e36-9646-f26dd5e16af9';
