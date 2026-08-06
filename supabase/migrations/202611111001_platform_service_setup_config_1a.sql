-- FI-SERVICES-SETUP-UX-1A: structured service eligibility + allocation config on catalogue rows.

alter table fi_services
  add column if not exists setup_config jsonb not null default '{}'::jsonb;

alter table fi_services
  drop constraint if exists fi_services_setup_config_object;

alter table fi_services
  add constraint fi_services_setup_config_object
  check (jsonb_typeof(setup_config) = 'object');

comment on column fi_services.setup_config is
  'ClinicOS Services Setup UX: service-family template, eligible roles, staff allocation, competency, surgical team, and room allocation preferences. Empty object means legacy / unset.';
