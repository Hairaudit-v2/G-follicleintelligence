-- Follicle Intelligence Foundation Layer (Stage 1C follow-up): partners ↔ organisations
-- See docs/design/07-foundation-migration-specification.md (fi_partners.organisation_id)
-- Optional FK when a commercial partner row maps to an fi_organisations (e.g. commercial_partner type).

alter table fi_partners add column if not exists organisation_id uuid references fi_organisations (id) on delete set null;

comment on column fi_partners.organisation_id is 'Foundation Layer: links fi_partners to fi_organisations when they represent the same entity.';

create index if not exists idx_fi_partners_organisation on fi_partners (organisation_id) where organisation_id is not null;
