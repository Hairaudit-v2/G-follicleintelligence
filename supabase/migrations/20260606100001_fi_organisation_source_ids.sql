-- Follicle Intelligence Foundation Layer (Stage 1E): organisation source resolution
-- Enables idempotent resolveOrCreateOrganisation() by (tenant_id, source_system, source_organisation_id).

create table if not exists fi_organisation_source_ids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  organisation_id uuid not null references fi_organisations (id) on delete cascade,
  source_system text not null,
  source_organisation_id text not null,
  created_at timestamptz not null default now(),
  constraint fi_organisation_source_ids_unique_mapping unique (tenant_id, source_system, source_organisation_id)
);

comment on table fi_organisation_source_ids is 'Follicle Intelligence Foundation Layer: maps producer organisation ids to fi_organisations.';

create index if not exists idx_fi_organisation_source_ids_org on fi_organisation_source_ids (organisation_id);
create index if not exists idx_fi_organisation_source_ids_lookup
  on fi_organisation_source_ids (tenant_id, source_system, source_organisation_id);

alter table fi_organisation_source_ids enable row level security;

drop policy if exists fi_organisation_source_ids_select_tenant_member on fi_organisation_source_ids;
create policy fi_organisation_source_ids_select_tenant_member
  on fi_organisation_source_ids for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_organisation_source_ids.tenant_id
    )
  );
