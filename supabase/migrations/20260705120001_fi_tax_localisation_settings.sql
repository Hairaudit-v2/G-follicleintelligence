-- Tenant / clinic tax, currency, invoice, and receipt settings (finance & compliance).
-- JSONB payloads are validated in application code; see src/lib/taxLocalisation/*.

create table if not exists fi_tax_localisation_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete cascade,
  effective_from timestamptz not null default now(),
  country_region text not null default 'AU',
  currency text not null default 'AUD',
  tax_profile jsonb not null default '{}'::jsonb,
  invoice_settings jsonb not null default '{}'::jsonb,
  receipt_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_tax_loc_country_chk check (
    country_region in ('AU', 'IN', 'NZ', 'GB', 'US', 'OTHER')
  ),
  constraint fi_tax_loc_currency_chk check (currency in ('AUD', 'INR', 'NZD', 'GBP', 'USD')),
  constraint fi_tax_loc_tax_profile_object check (jsonb_typeof(tax_profile) = 'object'),
  constraint fi_tax_loc_invoice_object check (jsonb_typeof(invoice_settings) = 'object'),
  constraint fi_tax_loc_receipt_object check (jsonb_typeof(receipt_settings) = 'object')
);

comment on table fi_tax_localisation_settings is
  'Per-tenant or per-clinic tax, currency, invoice, and receipt configuration. clinic_id null = tenant default.';

create index if not exists idx_fi_tax_loc_tenant on fi_tax_localisation_settings (tenant_id);
create index if not exists idx_fi_tax_loc_tenant_clinic on fi_tax_localisation_settings (tenant_id, clinic_id);

-- One tenant-level row (clinic_id is null).
create unique index if not exists idx_fi_tax_loc_tenant_default_unique
  on fi_tax_localisation_settings (tenant_id)
  where clinic_id is null;

-- One row per clinic under tenant.
create unique index if not exists idx_fi_tax_loc_tenant_clinic_unique
  on fi_tax_localisation_settings (tenant_id, clinic_id)
  where clinic_id is not null;

alter table fi_tax_localisation_settings enable row level security;

create policy fi_tax_loc_settings_select_tenant_member
  on fi_tax_localisation_settings for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_tax_localisation_settings.tenant_id
    )
  );

grant select on fi_tax_localisation_settings to authenticated, service_role;
grant insert, update, delete on fi_tax_localisation_settings to service_role;

create table if not exists fi_tax_localisation_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete set null,
  event_kind text not null,
  actor_fi_user_id uuid references fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_tax_loc_audit_kind_chk check (
    event_kind in (
      'tax_settings.created',
      'tax_settings.updated',
      'invoice_settings.updated'
    )
  ),
  constraint fi_tax_loc_audit_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table fi_tax_localisation_audit_events is
  'Audit trail for fi_tax_localisation_settings changes (tax + invoice sections).';

create index if not exists idx_fi_tax_loc_audit_tenant_created
  on fi_tax_localisation_audit_events (tenant_id, created_at desc);

alter table fi_tax_localisation_audit_events enable row level security;

grant select on fi_tax_localisation_audit_events to service_role;
grant insert on fi_tax_localisation_audit_events to service_role;
