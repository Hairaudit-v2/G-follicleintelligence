-- Trial consent vault: traceable photography / treatment consent PDFs per patient.

create table if not exists fi_patient_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  person_id uuid references fi_persons (id) on delete set null,
  document_type text not null default 'consent',
  storage_bucket text not null default 'patient-images',
  storage_path text not null,
  original_filename text,
  content_type text,
  file_size_bytes bigint,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_documents_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_patient_documents_type_chk check (document_type in ('consent', 'other')),
  constraint fi_patient_documents_storage_path_unique unique (storage_path),
  constraint fi_patient_documents_notes_len check (notes is null or char_length (notes) <= 2000)
);

comment on table fi_patient_documents is 'FI trial consent vault: tenant-scoped patient document metadata (consent PDFs); private storage via service role.';

create index if not exists idx_fi_patient_documents_tenant_patient on fi_patient_documents (tenant_id, patient_id);

create index if not exists idx_fi_patient_documents_tenant_patient_type on fi_patient_documents (tenant_id, patient_id, document_type);

alter table fi_patient_documents enable row level security;

drop policy if exists fi_patient_documents_select_tenant_member on fi_patient_documents;
create policy fi_patient_documents_select_tenant_member on fi_patient_documents for select to authenticated using (
  exists (
    select 1
    from fi_users u
    where u.auth_user_id = auth.uid()
      and u.tenant_id = fi_patient_documents.tenant_id
  )
);