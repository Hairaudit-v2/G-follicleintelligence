-- FI OS Stage 3: optional JSON metadata on schedulable staff (workspace profile, future extensions).
-- Mutations via service_role from trusted Next.js server actions (same pattern as fi_staff writes).

alter table public.fi_staff
  add column if not exists staff_metadata jsonb not null default '{}'::jsonb;

alter table public.fi_staff
  drop constraint if exists fi_staff_staff_metadata_object;

alter table public.fi_staff
  add constraint fi_staff_staff_metadata_object check (jsonb_typeof(staff_metadata) = 'object');

comment on column public.fi_staff.staff_metadata is
  'Clinic OS: non-HR staff metadata (e.g. workspace_profile for adaptive FI OS home).';
