-- ---------------------------------------------------------------------------
-- CRM/Data Import Integrity Patch 2
--
-- 1. Add non_surgical column to stg_hubspot_contacts_imports staging table.
-- 2. Add missing performance indexes on fi_crm_leads.
-- 3. Add FK constraint on fi_crm_leads.primary_owner_user_id → fi_users.
--
-- Forward-only migration. No destructive changes.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. stg_hubspot_contacts_imports: preserve Non-Surgical custom property
--
-- The Non-Surgical column is a HubSpot custom property that may be present in
-- contact exports. It is stored raw (text) alongside the other staging columns
-- and propagated into fi_persons.metadata.hubspot.non_surgical on commit.
-- ---------------------------------------------------------------------------

alter table stg_hubspot_contacts_imports
  add column if not exists non_surgical text default null;

comment on column stg_hubspot_contacts_imports.non_surgical is
  'HubSpot Non-Surgical custom property value. Null when column absent in the export CSV.';

-- ---------------------------------------------------------------------------
-- 2. fi_crm_leads: missing performance indexes
--
-- The shell-page function filters on (tenant_id, status) and (tenant_id,
-- updated_at) independently. The existing composite index
-- idx_fi_crm_leads_tenant_org_clinic_updated covers the 4-column case but
-- PostgreSQL will not use it for the 2-column case on a large tenant.
-- primary_owner_user_id is used in the FILTER clause and the JOIN to fi_users.
-- ---------------------------------------------------------------------------

-- (tenant_id, status): supports kanban and list filtering by lead status.
create index if not exists idx_fi_crm_leads_tenant_status
  on fi_crm_leads (tenant_id, status);

-- (tenant_id, updated_at DESC): supports default sort (most-recently-updated).
create index if not exists idx_fi_crm_leads_tenant_updated_at
  on fi_crm_leads (tenant_id, updated_at desc);

-- primary_owner_user_id: supports owner-filter queries and the LEFT JOIN to fi_users.
create index if not exists idx_fi_crm_leads_primary_owner
  on fi_crm_leads (primary_owner_user_id)
  where primary_owner_user_id is not null;

-- ---------------------------------------------------------------------------
-- 3. fi_crm_leads.primary_owner_user_id: FK guard → fi_users
--
-- The column was originally created without a FK (intentional placeholder).
-- Adding it now as ON DELETE SET NULL preserves the lead row when a user is
-- deleted; only the ownership reference is cleared, not the clinical record.
--
-- This is a non-blocking ADD CONSTRAINT on a nullable column and will not
-- fail on rows where primary_owner_user_id is null (most imported rows).
-- Rows with a non-null value that does not match fi_users will be rejected
-- by the constraint check — this is the correct safety behaviour.
-- ---------------------------------------------------------------------------

alter table fi_crm_leads
  add constraint fi_crm_leads_primary_owner_fk
  foreign key (primary_owner_user_id)
  references fi_users (id)
  on delete set null
  not valid;

-- Validate the constraint separately so existing rows are checked without
-- a full table lock (PostgreSQL shares-lock only during VALIDATE CONSTRAINT).
alter table fi_crm_leads
  validate constraint fi_crm_leads_primary_owner_fk;

comment on column fi_crm_leads.primary_owner_user_id is
  'fi_users.id of the assigned CRM owner. On user deletion, set to null (lead preserved). '
  'Added FK in migration 20260903120001.';
