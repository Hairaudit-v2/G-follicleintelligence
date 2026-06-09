-- Follicle Intelligence: tenants + users (multi-tenant)
create table if not exists fi_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fi_tenants_slug on fi_tenants(slug);

create table if not exists fi_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  auth_user_id uuid,
  email text,
  role text default 'member',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, auth_user_id)
);
create index if not exists idx_fi_users_tenant on fi_users(tenant_id);
create index if not exists idx_fi_users_auth on fi_users(auth_user_id) where auth_user_id is not null;
