-- Partner / reseller model: strategic partners sending cases
-- Partners belong to a tenant. Cases can be attributed to a partner via referral.
-- Data isolation: partners and referrals are tenant-scoped.

create table if not exists fi_partners (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  name text not null,
  reference_code text not null,
  slug text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, reference_code)
);
create index if not exists idx_fi_partners_tenant on fi_partners(tenant_id);
create index if not exists idx_fi_partners_ref on fi_partners(tenant_id, reference_code);

-- Partner attribution on cases (must run before fi_referrals)
alter table fi_cases add column if not exists partner_id uuid references fi_partners(id) on delete set null;
create index if not exists idx_fi_cases_partner on fi_cases(partner_id) where partner_id is not null;

create table if not exists fi_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references fi_partners(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  referral_code text not null,
  created_at timestamptz default now(),
  unique(case_id)
);
create index if not exists idx_fi_referrals_partner on fi_referrals(partner_id);
create index if not exists idx_fi_referrals_case on fi_referrals(case_id);
