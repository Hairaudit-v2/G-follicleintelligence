-- Stage 1L: allow service_role to upsert foundation settings (FI Admin server actions only).
-- Authenticated clients still have SELECT-only RLS; no INSERT/UPDATE policies for authenticated.

grant insert, update on fi_tenant_settings to service_role;
grant insert, update on fi_organisation_settings to service_role;
grant insert, update on fi_clinic_settings to service_role;
