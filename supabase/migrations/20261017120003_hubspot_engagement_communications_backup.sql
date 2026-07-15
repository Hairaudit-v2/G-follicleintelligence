-- FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1
-- Additive, tenant-isolated, read-only staging for HubSpot engagements and communications.
-- Restricted staging only: no promotion into FI timelines, patients, CRM, or documents.

alter table public.fi_external_hubspot_sync_runs
  add column if not exists engagement_checkpoints jsonb not null default '{}'::jsonb,
  add column if not exists engagement_counters jsonb not null default '{}'::jsonb,
  add column if not exists engagement_capabilities jsonb not null default '{}'::jsonb,
  add column if not exists engagement_complete boolean not null default false;

-- Notes (CRM notes objects)
create table if not exists public.fi_external_hubspot_note_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_record_id text not null check (char_length(trim(hubspot_record_id)) > 0),
  hubspot_created_at timestamptz,
  hubspot_updated_at timestamptz,
  archived boolean not null default false,
  owner_id text,
  activity_timestamp timestamptz,
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  payload_checksum text not null,
  content_checksum text,
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','ignored')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, hubspot_record_id)
);

-- CRM email engagement objects (not marketing campaigns)
create table if not exists public.fi_external_hubspot_email_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_record_id text not null check (char_length(trim(hubspot_record_id)) > 0),
  hubspot_created_at timestamptz,
  hubspot_updated_at timestamptz,
  archived boolean not null default false,
  owner_id text,
  activity_timestamp timestamptz,
  direction text,
  status text,
  thread_id text,
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  payload_checksum text not null,
  content_checksum text,
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','ignored')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, hubspot_record_id)
);

-- Conversation threads
create table if not exists public.fi_external_hubspot_conversation_thread_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_thread_id text not null check (char_length(trim(hubspot_thread_id)) > 0),
  hubspot_created_at timestamptz,
  hubspot_updated_at timestamptz,
  archived boolean not null default false,
  thread_status text,
  source_channel text,
  inbox_id text,
  owner_id text,
  closed_at timestamptz,
  first_message_at timestamptz,
  last_message_at timestamptz,
  message_count integer,
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  payload_checksum text not null,
  content_checksum text,
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','ignored')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, hubspot_thread_id)
);

-- Conversation messages (compound HubSpot identity)
create table if not exists public.fi_external_hubspot_conversation_message_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_thread_id text not null check (char_length(trim(hubspot_thread_id)) > 0),
  hubspot_message_id text not null check (char_length(trim(hubspot_message_id)) > 0),
  hubspot_created_at timestamptz,
  hubspot_updated_at timestamptz,
  archived boolean not null default false,
  direction text,
  message_type text,
  sender_role text,
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  payload_checksum text not null,
  content_checksum text,
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','ignored')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, hubspot_thread_id, hubspot_message_id)
);

-- File / attachment inventory (metadata-first; no automatic content download)
create table if not exists public.fi_external_hubspot_file_inventory (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_file_id text not null check (char_length(trim(hubspot_file_id)) > 0),
  source_object_type text,
  source_object_id text,
  mime_type text,
  size_bytes bigint,
  hubspot_created_at timestamptz,
  hubspot_updated_at timestamptz,
  archived boolean not null default false,
  inventory_status text not null default 'metadata_backed_up'
    check (inventory_status in (
      'metadata_backed_up','content_backed_up','access_denied',
      'expired_reference','unsupported','failed_validation'
    )),
  secure_download_status text,
  retrieval_failure_reason text,
  malware_validation_status text,
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  payload_checksum text not null,
  content_checksum text,
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','ignored')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, hubspot_file_id)
);

-- Form definitions
create table if not exists public.fi_external_hubspot_form_definition_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_form_id text not null check (char_length(trim(hubspot_form_id)) > 0),
  hubspot_created_at timestamptz,
  hubspot_updated_at timestamptz,
  archived boolean not null default false,
  form_name_hash text,
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  payload_checksum text not null,
  content_checksum text,
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','ignored')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, hubspot_form_id)
);

-- Form submissions (event-preserving; compound identity)
create table if not exists public.fi_external_hubspot_form_submission_staging (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  integration_id uuid not null references public.fi_tenant_external_integrations (id) on delete cascade,
  sync_run_id uuid references public.fi_external_hubspot_sync_runs (id) on delete set null,
  hubspot_form_id text not null check (char_length(trim(hubspot_form_id)) > 0),
  hubspot_submission_id text not null check (char_length(trim(hubspot_submission_id)) > 0),
  hubspot_created_at timestamptz,
  hubspot_updated_at timestamptz,
  archived boolean not null default false,
  linked_contact_id text,
  page_url_hash text,
  content_classification text not null default 'standard'
    check (content_classification in ('standard','restricted_clinical_intake')),
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  payload_checksum text not null,
  content_checksum text,
  review_status text not null default 'pending' check (review_status in ('pending','reviewed','ignored')),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, hubspot_form_id, hubspot_submission_id)
);

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'fi_external_hubspot_note_staging',
    'fi_external_hubspot_email_staging',
    'fi_external_hubspot_conversation_thread_staging',
    'fi_external_hubspot_conversation_message_staging',
    'fi_external_hubspot_file_inventory',
    'fi_external_hubspot_form_definition_staging',
    'fi_external_hubspot_form_submission_staging'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
    execute format(
      'create index if not exists %I on public.%I (sync_run_id)',
      'idx_' || table_name || '_run',
      table_name
    );
  end loop;
end
$migration$;

create index if not exists idx_fi_external_hubspot_conversation_message_thread
  on public.fi_external_hubspot_conversation_message_staging (tenant_id, integration_id, hubspot_thread_id);

create index if not exists idx_fi_external_hubspot_form_submission_form
  on public.fi_external_hubspot_form_submission_staging (tenant_id, integration_id, hubspot_form_id);

create index if not exists idx_fi_external_hubspot_file_inventory_source
  on public.fi_external_hubspot_file_inventory (tenant_id, integration_id, source_object_type, source_object_id);

alter table public.fi_external_hubspot_association_staging
  drop constraint if exists fi_external_hubspot_association_staging_from_object_type_check,
  drop constraint if exists fi_external_hubspot_association_staging_to_object_type_check;

alter table public.fi_external_hubspot_association_staging
  add constraint fi_external_hubspot_association_staging_from_object_type_check
    check (from_object_type in (
      'contact','deal','company','ticket','call','task','meeting',
      'note','email','conversation','message','file','form','form_submission'
    )),
  add constraint fi_external_hubspot_association_staging_to_object_type_check
    check (to_object_type in (
      'contact','deal','company','ticket','conversation','form','note','email','message','file'
    ));

-- Rollback after application rollback:
-- 1. Restore association checks to secondary-only object types
-- 2. Drop the seven engagement staging/inventory tables
-- 3. Drop engagement_checkpoints, engagement_counters, engagement_capabilities, engagement_complete
