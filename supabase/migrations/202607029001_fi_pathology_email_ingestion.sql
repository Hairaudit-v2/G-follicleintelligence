-- Sprint H: pathology inbound email ingestion (tenant routes + message audit + inbox linkage).

-- ---------------------------------------------------------------------------
-- fi_pathology_email_routes — inbound address → tenant routing
-- ---------------------------------------------------------------------------
create table if not exists fi_pathology_email_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  inbound_email text not null,
  route_status text not null default 'active',
  source_label text,
  default_source_channel text not null default 'email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pathology_email_routes_status_chk check (
    route_status in ('active', 'disabled')
  ),
  constraint fi_pathology_email_routes_source_channel_chk check (
    default_source_channel in ('manual_upload', 'email', 'api')
  )
);

comment on table fi_pathology_email_routes is
  'Maps dedicated pathology inbound email addresses to FI OS tenants for webhook ingestion.';

create unique index if not exists idx_fi_pathology_email_routes_inbound_email_lower
  on fi_pathology_email_routes (lower(trim(inbound_email)));

create index if not exists idx_fi_pathology_email_routes_tenant
  on fi_pathology_email_routes (tenant_id);

-- ---------------------------------------------------------------------------
-- fi_pathology_inbound_email_messages — provider webhook audit + dedup
-- ---------------------------------------------------------------------------
create table if not exists fi_pathology_inbound_email_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  provider text not null,
  provider_message_id text,
  from_email text,
  to_email text not null,
  subject text,
  received_at timestamptz,
  raw_headers jsonb not null default '{}'::jsonb,
  attachment_count integer not null default 0,
  accepted_attachment_count integer not null default 0,
  rejected_attachment_count integer not null default 0,
  dedup_hash text not null,
  status text not null default 'received',
  failure_reason text,
  created_inbound_document_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  constraint fi_pathology_inbound_email_messages_status_chk check (
    status in ('received', 'processed', 'duplicate', 'rejected', 'failed')
  ),
  constraint fi_pathology_inbound_email_messages_headers_object check (
    jsonb_typeof (raw_headers) = 'object'
  )
);

comment on table fi_pathology_inbound_email_messages is
  'Audit trail for pathology inbound email webhooks before/after inbox document creation.';

create index if not exists idx_fi_pathology_inbound_email_messages_tenant_received
  on fi_pathology_inbound_email_messages (tenant_id, received_at desc nulls last);

create index if not exists idx_fi_pathology_inbound_email_messages_provider_message_id
  on fi_pathology_inbound_email_messages (provider_message_id)
  where provider_message_id is not null;

create unique index if not exists idx_fi_pathology_inbound_email_messages_tenant_dedup
  on fi_pathology_inbound_email_messages (tenant_id, dedup_hash);

-- ---------------------------------------------------------------------------
-- fi_pathology_inbound_documents — email metadata for inbox UI
-- ---------------------------------------------------------------------------
alter table fi_pathology_inbound_documents
  add column if not exists inbound_email_message_id uuid references fi_pathology_inbound_email_messages (id) on delete set null,
  add column if not exists email_from text,
  add column if not exists email_subject text,
  add column if not exists email_source_label text,
  add column if not exists email_attachment_dedup_hash text;

create index if not exists idx_fi_pathology_inbound_documents_email_message
  on fi_pathology_inbound_documents (inbound_email_message_id)
  where inbound_email_message_id is not null;

create unique index if not exists idx_fi_pathology_inbound_documents_email_attachment_dedup
  on fi_pathology_inbound_documents (tenant_id, email_attachment_dedup_hash)
  where email_attachment_dedup_hash is not null;

-- ---------------------------------------------------------------------------
-- fi_pathology_inbound_document_events — email ingestion audit events
-- ---------------------------------------------------------------------------
alter table fi_pathology_inbound_document_events
  drop constraint if exists fi_pathology_inbound_document_events_type_chk;

alter table fi_pathology_inbound_document_events
  add constraint fi_pathology_inbound_document_events_type_chk check (
    event_type in (
      'created',
      'match_suggested',
      'match_confirmed',
      'match_rejected',
      'promoted',
      'extraction_queued',
      'extraction_started',
      'extraction_succeeded',
      'extraction_failed',
      'draft_result_created',
      'ready_for_review',
      'email_received',
      'email_attachment_accepted',
      'email_attachment_rejected',
      'email_duplicate_detected'
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at trigger for email routes
-- ---------------------------------------------------------------------------
create or replace function fi_pathology_email_routes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_pathology_email_routes_set_updated_at on fi_pathology_email_routes;
create trigger trg_fi_pathology_email_routes_set_updated_at
  before update on fi_pathology_email_routes
  for each row
  execute procedure fi_pathology_email_routes_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_pathology_email_routes enable row level security;
alter table fi_pathology_inbound_email_messages enable row level security;

drop policy if exists fi_pathology_email_routes_select_tenant_member on fi_pathology_email_routes;
create policy fi_pathology_email_routes_select_tenant_member
  on fi_pathology_email_routes for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_email_routes.tenant_id
    )
  );

drop policy if exists fi_pathology_inbound_email_messages_select_tenant_member
  on fi_pathology_inbound_email_messages;
create policy fi_pathology_inbound_email_messages_select_tenant_member
  on fi_pathology_inbound_email_messages for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_inbound_email_messages.tenant_id
    )
  );

grant select on fi_pathology_email_routes to authenticated, service_role;
grant insert, update, delete on fi_pathology_email_routes to service_role;

grant select on fi_pathology_inbound_email_messages to authenticated, service_role;
grant insert, update, delete on fi_pathology_inbound_email_messages to service_role;
