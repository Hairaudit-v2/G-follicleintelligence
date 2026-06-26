-- ---------------------------------------------------------------------------
-- CRM/Data Import Integrity Patch 2
--
-- Reordered from 20260616204444 — requires stg_hubspot_contacts_imports (20260720120001).
--
-- 1. Add non_surgical column to stg_hubspot_contacts_imports staging table.
-- 2. Add missing performance indexes on fi_crm_leads.
-- 3. Add FK constraint on fi_crm_leads.primary_owner_user_id → fi_users.
--
-- Forward-only migration. No destructive changes.
-- ---------------------------------------------------------------------------

alter table stg_hubspot_contacts_imports
  add column if not exists non_surgical text default null;

comment on column stg_hubspot_contacts_imports.non_surgical is
  'HubSpot Non-Surgical custom property value. Null when column absent in the export CSV.';

create index if not exists idx_fi_crm_leads_tenant_status
  on fi_crm_leads (tenant_id, status);

create index if not exists idx_fi_crm_leads_tenant_updated_at
  on fi_crm_leads (tenant_id, updated_at desc);

create index if not exists idx_fi_crm_leads_primary_owner
  on fi_crm_leads (primary_owner_user_id)
  where primary_owner_user_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fi_crm_leads_primary_owner_fk'
  ) then
    alter table fi_crm_leads
      add constraint fi_crm_leads_primary_owner_fk
      foreign key (primary_owner_user_id)
      references fi_users (id)
      on delete set null
      not valid;

    alter table fi_crm_leads
      validate constraint fi_crm_leads_primary_owner_fk;
  end if;
end $$;

comment on column fi_crm_leads.primary_owner_user_id is
  'fi_users.id of the assigned CRM owner. On user deletion, set to null (lead preserved). '
  'Added FK in migration 20260720120002.';
