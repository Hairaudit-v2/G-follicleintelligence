-- DoctorOS: tenant-level pathology results inbox (inbound PDFs before patient match).

-- ---------------------------------------------------------------------------
-- fi_pathology_inbound_documents
-- ---------------------------------------------------------------------------
create table if not exists fi_pathology_inbound_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  source_channel text not null default 'manual_upload',
  storage_bucket text,
  storage_path text,
  original_filename text,
  content_type text,
  match_status text not null default 'pending',
  suggested_patient_id uuid references fi_patients (id) on delete set null,
  confirmed_patient_id uuid references fi_patients (id) on delete set null,
  match_confidence numeric,
  match_evidence jsonb not null default '{}'::jsonb,
  extracted_patient_name text,
  extracted_dob date,
  extracted_mrn text,
  promoted_result_id uuid references fi_pathology_results (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pathology_inbound_documents_source_channel_chk check (
    source_channel in ('manual_upload', 'email', 'api')
  ),
  constraint fi_pathology_inbound_documents_match_status_chk check (
    match_status in ('pending', 'matched', 'rejected', 'promoted')
  ),
  constraint fi_pathology_inbound_documents_match_evidence_object check (
    jsonb_typeof (match_evidence) = 'object'
  )
);

comment on table fi_pathology_inbound_documents is
  'DoctorOS pathology inbox: tenant-scoped inbound lab PDFs awaiting patient match and promotion to fi_pathology_results.';

create index if not exists idx_fi_pathology_inbound_documents_tenant
  on fi_pathology_inbound_documents (tenant_id);
create index if not exists idx_fi_pathology_inbound_documents_tenant_status
  on fi_pathology_inbound_documents (tenant_id, match_status);
create index if not exists idx_fi_pathology_inbound_documents_tenant_created
  on fi_pathology_inbound_documents (tenant_id, created_at desc);
create index if not exists idx_fi_pathology_inbound_documents_suggested_patient
  on fi_pathology_inbound_documents (tenant_id, suggested_patient_id)
  where suggested_patient_id is not null;

-- ---------------------------------------------------------------------------
-- fi_pathology_inbound_document_events
-- ---------------------------------------------------------------------------
create table if not exists fi_pathology_inbound_document_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  inbound_document_id uuid not null references fi_pathology_inbound_documents (id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_pathology_inbound_document_events_type_chk check (
    event_type in (
      'created',
      'match_suggested',
      'match_confirmed',
      'match_rejected',
      'promoted',
      'extraction_queued'
    )
  ),
  constraint fi_pathology_inbound_document_events_detail_object check (
    jsonb_typeof (detail) = 'object'
  )
);

comment on table fi_pathology_inbound_document_events is
  'Append-only audit trail for pathology inbox document lifecycle.';

create index if not exists idx_fi_pathology_inbound_document_events_document
  on fi_pathology_inbound_document_events (inbound_document_id, created_at desc);
create index if not exists idx_fi_pathology_inbound_document_events_tenant
  on fi_pathology_inbound_document_events (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function fi_pathology_inbound_documents_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_pathology_inbound_documents_set_updated_at on fi_pathology_inbound_documents;
create trigger trg_fi_pathology_inbound_documents_set_updated_at
  before update on fi_pathology_inbound_documents
  for each row
  execute procedure fi_pathology_inbound_documents_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_pathology_inbound_documents enable row level security;
alter table fi_pathology_inbound_document_events enable row level security;

drop policy if exists fi_pathology_inbound_documents_select_tenant_member on fi_pathology_inbound_documents;
create policy fi_pathology_inbound_documents_select_tenant_member
  on fi_pathology_inbound_documents for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_inbound_documents.tenant_id
    )
  );

drop policy if exists fi_pathology_inbound_document_events_select_tenant_member
  on fi_pathology_inbound_document_events for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_inbound_document_events.tenant_id
    )
  );

grant select on fi_pathology_inbound_documents to authenticated, service_role;
grant insert, update, delete on fi_pathology_inbound_documents to service_role;

grant select on fi_pathology_inbound_document_events to authenticated, service_role;
grant insert, update, delete on fi_pathology_inbound_document_events to service_role;
