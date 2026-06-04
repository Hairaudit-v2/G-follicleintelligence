-- Follicle Intelligence Foundation Layer (Stage 1C): organisations
-- See docs/design/07-foundation-migration-specification.md Section 2.1
-- Legal / governance container: clinic groups, partners-as-orgs, standards programs, etc.

create table if not exists fi_organisations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  name text not null,
  slug text,
  organisation_type text not null
    constraint fi_organisations_type_check
    check (organisation_type in (
      'clinical_network',
      'commercial_partner',
      'standards_program',
      'internal',
      'other'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_organisations is 'Follicle Intelligence Foundation Layer: tenant-scoped organisations (clinical networks, commercial partners, standards programs).';

create index if not exists idx_fi_organisations_tenant on fi_organisations (tenant_id);
create index if not exists idx_fi_organisations_tenant_type on fi_organisations (tenant_id, organisation_type);

-- Partial unique: slug optional but must be unique per tenant when set
create unique index if not exists idx_fi_organisations_tenant_slug_unique
  on fi_organisations (tenant_id, slug)
  where slug is not null;
