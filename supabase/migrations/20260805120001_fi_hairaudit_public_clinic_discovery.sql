-- FI-HAIRAUDIT-CLINIC-DISCOVERY-DATA-1 — opt-in public clinic discovery profiles.
-- No clinic becomes public by default; writes via service_role only.

create table if not exists fi_public_clinic_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references fi_tenants (id) on delete cascade,
  fi_clinic_id uuid references fi_clinics (id) on delete cascade,
  hairaudit_clinic_id text,
  clinic_name text not null,
  public_slug text not null,
  audit_source text not null default 'fi_os',
  audit_participation_status text not null default 'not_enrolled',
  audit_verified boolean not null default false,
  public_profile_enabled boolean not null default false,
  search_visible boolean not null default false,
  accepts_independent_hairaudit_enquiries boolean not null default false,
  city_suburb text,
  state_region text,
  country text,
  public_phone text,
  public_email text,
  public_website_url text,
  public_booking_url text,
  logo_brand_image_url text,
  services_offered jsonb not null default '[]'::jsonb,
  profile_summary text,
  profile_bio text,
  last_audit_activity_at timestamptz,
  link_origin text not null default 'fi_os',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_public_clinic_profiles_audit_source_chk check (
    audit_source in ('fi_os', 'hairaudit', 'hybrid')
  ),
  constraint fi_public_clinic_profiles_link_origin_chk check (
    link_origin in ('fi_os', 'hairaudit', 'hybrid', 'legacy')
  ),
  constraint fi_public_clinic_profiles_services_array check (
    jsonb_typeof(services_offered) = 'array'
  ),
  constraint fi_public_clinic_profiles_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

comment on table fi_public_clinic_profiles is
  'Opt-in HairAudit public clinic discovery profiles. Defaults keep clinics private until explicitly enabled.';

create unique index if not exists idx_fi_public_clinic_profiles_slug_unique
  on fi_public_clinic_profiles (public_slug);

create unique index if not exists idx_fi_public_clinic_profiles_tenant_clinic_unique
  on fi_public_clinic_profiles (tenant_id, fi_clinic_id)
  where tenant_id is not null and fi_clinic_id is not null;

create unique index if not exists idx_fi_public_clinic_profiles_hairaudit_clinic_unique
  on fi_public_clinic_profiles (hairaudit_clinic_id)
  where hairaudit_clinic_id is not null and btrim(hairaudit_clinic_id) <> '';

create index if not exists idx_fi_public_clinic_profiles_search_visible
  on fi_public_clinic_profiles (search_visible, public_profile_enabled)
  where search_visible = true and public_profile_enabled = true;

alter table fi_public_clinic_profiles enable row level security;

drop policy if exists fi_public_clinic_profiles_select_tenant_member on fi_public_clinic_profiles;
create policy fi_public_clinic_profiles_select_tenant_member
  on fi_public_clinic_profiles for select to authenticated
  using (
    tenant_id is not null
    and exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_public_clinic_profiles.tenant_id
    )
  );

grant select on fi_public_clinic_profiles to authenticated, service_role;
grant insert, update, delete on fi_public_clinic_profiles to service_role;

create table if not exists fi_public_clinic_discovery_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references fi_tenants (id) on delete cascade,
  public_clinic_profile_id uuid references fi_public_clinic_profiles (id) on delete set null,
  event_kind text not null,
  actor_fi_user_id uuid references fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_public_clinic_discovery_audit_kind_chk check (
    event_kind in (
      'discovery.profile.created',
      'discovery.profile.updated',
      'discovery.profile.published',
      'discovery.profile.unpublished',
      'discovery.profile.synced',
      'discovery.profile.sync_dry_run'
    )
  ),
  constraint fi_public_clinic_discovery_audit_detail_object check (
    jsonb_typeof(detail) = 'object'
  )
);

comment on table fi_public_clinic_discovery_audit_events is
  'Audit trail for public clinic discovery publish/unpublish/sync actions.';

create index if not exists idx_fi_public_clinic_discovery_audit_tenant_created
  on fi_public_clinic_discovery_audit_events (tenant_id, created_at desc);

alter table fi_public_clinic_discovery_audit_events enable row level security;

drop policy if exists fi_public_clinic_discovery_audit_select_tenant_member
  on fi_public_clinic_discovery_audit_events;
create policy fi_public_clinic_discovery_audit_select_tenant_member
  on fi_public_clinic_discovery_audit_events for select to authenticated
  using (
    tenant_id is not null
    and exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_public_clinic_discovery_audit_events.tenant_id
    )
  );

grant select on fi_public_clinic_discovery_audit_events to authenticated, service_role;
grant insert on fi_public_clinic_discovery_audit_events to service_role;