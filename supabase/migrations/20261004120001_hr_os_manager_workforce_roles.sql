-- Allow clinic manager + HR manager roles on HR OS / roster surfaces (aligned with SA1 entitlements).
update public.fi_modules
set
  default_allowed_roles = array(
    select distinct unnest(
      default_allowed_roles
        || array['hr_manager', 'manager']::text[]
    )
  ),
  updated_at = now()
where code = 'hr_os';