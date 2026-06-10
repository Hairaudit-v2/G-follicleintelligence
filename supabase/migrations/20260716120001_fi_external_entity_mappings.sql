-- External system → FI entity mappings (Zapier / integrations). Service role writes; tenant members read.

create table if not exists fi_external_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  source_system text not null,
  entity_type text not null,
  external_id text not null,
  internal_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_external_entity_mappings_source_system_check check (
    source_system in ('timely', 'hubspot', 'cliniko', 'pabau', 'fresha')
  ),
  constraint fi_external_entity_mappings_entity_type_check check (
    entity_type in ('patient', 'booking', 'lead', 'staff', 'service')
  ),
  constraint fi_external_entity_mappings_external_id_nonempty check (char_length(trim(external_id)) > 0),
  constraint fi_external_entity_mappings_unique_external unique (tenant_id, source_system, entity_type, external_id)
);

comment on table fi_external_entity_mappings is
  'Maps external integration identifiers (per tenant and source_system) to internal FI UUIDs (bookings, patients, etc.).';

create index if not exists idx_fi_external_entity_mappings_tenant
  on fi_external_entity_mappings (tenant_id);

create index if not exists idx_fi_external_entity_mappings_lookup
  on fi_external_entity_mappings (tenant_id, source_system, entity_type, external_id);

create or replace function fi_external_entity_mappings_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_external_entity_mappings_set_updated_at on fi_external_entity_mappings;
create trigger trg_fi_external_entity_mappings_set_updated_at
  before update on fi_external_entity_mappings
  for each row
  execute procedure fi_external_entity_mappings_set_updated_at();

alter table fi_external_entity_mappings enable row level security;

drop policy if exists fi_external_entity_mappings_select_tenant_member on fi_external_entity_mappings;
create policy fi_external_entity_mappings_select_tenant_member
  on fi_external_entity_mappings for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_entity_mappings.tenant_id
    )
  );

grant select on fi_external_entity_mappings to authenticated, service_role;
grant insert, update, delete on fi_external_entity_mappings to service_role;
