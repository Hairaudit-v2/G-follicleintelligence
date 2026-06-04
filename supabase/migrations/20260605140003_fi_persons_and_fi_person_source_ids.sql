-- Follicle Intelligence Foundation Layer (Stage 1C): persons + non-patient identity mappings
-- See docs/design/07-foundation-migration-specification.md Section 2.3, 2.3a
-- PII remains on fi_intakes / envelopes until a vault strategy exists.

create table if not exists fi_persons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fi_persons is 'Follicle Intelligence Foundation Layer: canonical person row per tenant (pseudonymous core; no raw PII in v1).';

create index if not exists idx_fi_persons_tenant on fi_persons (tenant_id);

create table if not exists fi_person_source_ids (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  person_id uuid not null references fi_persons (id) on delete cascade,
  source_system text not null,
  source_person_id text not null,
  created_at timestamptz not null default now(),
  constraint fi_person_source_ids_unique_mapping unique (tenant_id, source_system, source_person_id)
);

comment on table fi_person_source_ids is 'Follicle Intelligence Foundation Layer: maps producer person ids (staff, doctor, etc.) to fi_persons.';

create index if not exists idx_fi_person_source_ids_person on fi_person_source_ids (person_id);
create index if not exists idx_fi_person_source_ids_lookup
  on fi_person_source_ids (tenant_id, source_system, source_person_id);
