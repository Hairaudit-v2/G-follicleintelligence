-- Follicle Intelligence: tenants (multi-tenant root)
create table if not exists fi_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_fi_tenants_slug on fi_tenants(slug);
