-- Follicle Intelligence Foundation Layer (Stage 1C): person_roles
-- See docs/design/07-foundation-migration-specification.md Section 2.5

create table if not exists fi_person_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  person_id uuid not null references fi_persons (id) on delete cascade,
  organisation_id uuid references fi_organisations (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete cascade,
  role text not null,
  source_system text,
  source_person_role_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_person_roles_scope_check check (
    organisation_id is not null
    or clinic_id is not null
    or role = 'tenant_admin'
  )
);

comment on table fi_person_roles is 'Follicle Intelligence Foundation Layer: binds fi_persons to organisations/clinics with a role.';

create index if not exists idx_fi_person_roles_tenant_person on fi_person_roles (tenant_id, person_id);
create index if not exists idx_fi_person_roles_tenant_clinic
  on fi_person_roles (tenant_id, clinic_id)
  where clinic_id is not null;
create index if not exists idx_fi_person_roles_tenant_org
  on fi_person_roles (tenant_id, organisation_id)
  where organisation_id is not null;
