-- Which staff roles or members may deliver each service.

create table if not exists fi_service_staff_eligibility (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  service_id uuid not null references fi_services (id) on delete cascade,
  staff_id uuid references fi_staff (id) on delete cascade,
  staff_role text,
  is_required boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_service_staff_eligibility_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_service_staff_eligibility_staff_or_role check (
    staff_id is not null or (staff_role is not null and length(trim(staff_role)) > 0)
  )
);

comment on table fi_service_staff_eligibility is
  'ClinicOS: eligible staff roles or specific staff members per service.';

create index if not exists idx_fi_service_staff_eligibility_service
  on fi_service_staff_eligibility (tenant_id, service_id, is_active);

alter table fi_service_staff_eligibility enable row level security;

drop policy if exists fi_service_staff_eligibility_select_tenant_member on fi_service_staff_eligibility;
create policy fi_service_staff_eligibility_select_tenant_member
  on fi_service_staff_eligibility for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_service_staff_eligibility.tenant_id
    )
  );

grant select on fi_service_staff_eligibility to authenticated, service_role;
grant insert, update, delete on fi_service_staff_eligibility to service_role;
