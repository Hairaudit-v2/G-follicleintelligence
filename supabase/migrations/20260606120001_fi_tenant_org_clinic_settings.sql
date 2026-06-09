-- Follicle Intelligence Foundation Layer (Stage 1K): tenant / organisation / clinic settings & branding
-- Additive read models for multi-tenant white-label and future CRM configuration.
-- Conservative RLS: authenticated members of the tenant may SELECT; no INSERT/UPDATE policies yet (service role for admin seed).

-- ---------------------------------------------------------------------------
-- fi_tenant_settings — one logical row per tenant (enforced unique)
-- ---------------------------------------------------------------------------
create table if not exists fi_tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  brand_name text,
  logo_url text,
  primary_colour text,
  secondary_colour text,
  accent_colour text,
  support_email text,
  default_timezone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tenant_settings_tenant_unique unique (tenant_id)
);

comment on table fi_tenant_settings is 'Follicle Intelligence Foundation Layer (Stage 1K): tenant-level branding and defaults; optional CRM metadata.';

create index if not exists idx_fi_tenant_settings_tenant on fi_tenant_settings (tenant_id);

-- ---------------------------------------------------------------------------
-- fi_organisation_settings — per organisation within tenant
-- ---------------------------------------------------------------------------
create table if not exists fi_organisation_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  organisation_id uuid not null references fi_organisations (id) on delete cascade,
  brand_name text,
  logo_url text,
  primary_colour text,
  secondary_colour text,
  accent_colour text,
  website_url text,
  support_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_organisation_settings_tenant_org_unique unique (tenant_id, organisation_id)
);

comment on table fi_organisation_settings is 'Follicle Intelligence Foundation Layer (Stage 1K): organisation-level branding and web presence; inherits below tenant.';

create index if not exists idx_fi_organisation_settings_tenant on fi_organisation_settings (tenant_id);
create index if not exists idx_fi_organisation_settings_org on fi_organisation_settings (organisation_id);

-- ---------------------------------------------------------------------------
-- fi_clinic_settings — per clinic within tenant
-- ---------------------------------------------------------------------------
create table if not exists fi_clinic_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid not null references fi_clinics (id) on delete cascade,
  display_name text,
  booking_url text,
  public_intake_url text,
  phone text,
  email text,
  address text,
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_clinic_settings_tenant_clinic_unique unique (tenant_id, clinic_id)
);

comment on table fi_clinic_settings is 'Follicle Intelligence Foundation Layer (Stage 1K): clinic-level public and operational URLs and contact; branding colours typically inherited from organisation/tenant.';

create index if not exists idx_fi_clinic_settings_tenant on fi_clinic_settings (tenant_id);
create index if not exists idx_fi_clinic_settings_clinic on fi_clinic_settings (clinic_id);

-- ---------------------------------------------------------------------------
-- RLS (match fi_foundation_rls tenant-member SELECT pattern)
-- ---------------------------------------------------------------------------
alter table fi_tenant_settings enable row level security;
alter table fi_organisation_settings enable row level security;
alter table fi_clinic_settings enable row level security;

drop policy if exists fi_tenant_settings_select_tenant_member on fi_tenant_settings;
create policy fi_tenant_settings_select_tenant_member
  on fi_tenant_settings for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_tenant_settings.tenant_id
    )
  );

drop policy if exists fi_organisation_settings_select_tenant_member on fi_organisation_settings;
create policy fi_organisation_settings_select_tenant_member
  on fi_organisation_settings for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_organisation_settings.tenant_id
    )
  );

drop policy if exists fi_clinic_settings_select_tenant_member on fi_clinic_settings;
create policy fi_clinic_settings_select_tenant_member
  on fi_clinic_settings for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_clinic_settings.tenant_id
    )
  );

grant select on fi_tenant_settings to authenticated, service_role;
grant select on fi_organisation_settings to authenticated, service_role;
grant select on fi_clinic_settings to authenticated, service_role;
