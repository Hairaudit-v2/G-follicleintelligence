-- Follicle Intelligence Foundation Layer (Stage 1C): clinics + source resolution
-- See docs/design/07-foundation-migration-specification.md Section 2.2, 2.2a

create table if not exists fi_clinics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  organisation_id uuid references fi_organisations (id) on delete set null,
  display_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_clinics is 'Follicle Intelligence Foundation Layer: operational sites (HairAudit clinic, HLI-affiliated site).';

create index if not exists idx_fi_clinics_tenant on fi_clinics (tenant_id);
create index if not exists idx_fi_clinics_tenant_org
  on fi_clinics (tenant_id, organisation_id)
  where organisation_id is not null;

create table if not exists fi_clinic_source_ids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  clinic_id uuid not null references fi_clinics (id) on delete cascade,
  source_system text not null,
  source_clinic_id text not null,
  created_at timestamptz not null default now(),
  constraint fi_clinic_source_ids_unique_mapping unique (tenant_id, source_system, source_clinic_id)
);

comment on table fi_clinic_source_ids is 'Follicle Intelligence Foundation Layer: maps producer clinic ids (per source_system) to fi_clinics.';

create index if not exists idx_fi_clinic_source_ids_clinic on fi_clinic_source_ids (clinic_id);
create index if not exists idx_fi_clinic_source_ids_lookup
  on fi_clinic_source_ids (tenant_id, source_system, source_clinic_id);
