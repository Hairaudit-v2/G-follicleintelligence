-- Follicle Intelligence Foundation Layer (Stage 1C): normalized media metadata
-- See docs/design/07-foundation-migration-specification.md Section 2.8
-- fi_uploads remains the legacy ingest table until dual-write / cutover.

create table if not exists fi_media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  case_id uuid references fi_cases (id) on delete cascade,
  patient_id uuid references fi_patients (id) on delete set null,
  asset_type text not null,
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  source_system text,
  source_asset_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_media_assets is 'Follicle Intelligence Foundation Layer: canonical file metadata (superset of fi_uploads types over time).';

create index if not exists idx_fi_media_assets_tenant_case on fi_media_assets (tenant_id, case_id) where case_id is not null;
create index if not exists idx_fi_media_assets_tenant_storage on fi_media_assets (tenant_id, storage_path);

create unique index if not exists idx_fi_media_assets_tenant_source_asset_unique
  on fi_media_assets (tenant_id, source_system, source_asset_id)
  where source_asset_id is not null and source_system is not null;
