-- DoctorOS: pathology PDF extraction jobs (OCR shell behind feature flag).

create table if not exists fi_pathology_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  inbound_document_id uuid references fi_pathology_inbound_documents (id) on delete set null,
  result_id uuid references fi_pathology_results (id) on delete set null,
  status text not null default 'queued',
  provider text,
  raw_extraction_json jsonb not null default '{}'::jsonb,
  normalized_items_json jsonb not null default '[]'::jsonb,
  error_message text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pathology_extraction_jobs_status_chk check (
    status in ('queued', 'running', 'succeeded', 'failed', 'needs_review')
  ),
  constraint fi_pathology_extraction_jobs_raw_object check (jsonb_typeof (raw_extraction_json) = 'object'),
  constraint fi_pathology_extraction_jobs_normalized_array check (
    jsonb_typeof (normalized_items_json) = 'array'
  ),
  constraint fi_pathology_extraction_jobs_idempotency_key_unique unique (idempotency_key)
);

comment on table fi_pathology_extraction_jobs is
  'Pathology PDF marker extraction jobs; provider stub until PATHOLOGY_EXTRACTION_ENABLED.';

create index if not exists idx_fi_pathology_extraction_jobs_tenant
  on fi_pathology_extraction_jobs (tenant_id);
create index if not exists idx_fi_pathology_extraction_jobs_inbound
  on fi_pathology_extraction_jobs (inbound_document_id)
  where inbound_document_id is not null;
create index if not exists idx_fi_pathology_extraction_jobs_result
  on fi_pathology_extraction_jobs (result_id)
  where result_id is not null;
create index if not exists idx_fi_pathology_extraction_jobs_status
  on fi_pathology_extraction_jobs (tenant_id, status);

create or replace function fi_pathology_extraction_jobs_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_pathology_extraction_jobs_set_updated_at on fi_pathology_extraction_jobs;
create trigger trg_fi_pathology_extraction_jobs_set_updated_at
  before update on fi_pathology_extraction_jobs
  for each row
  execute procedure fi_pathology_extraction_jobs_set_updated_at();

alter table fi_pathology_extraction_jobs enable row level security;

drop policy if exists fi_pathology_extraction_jobs_select_tenant_member on fi_pathology_extraction_jobs;
create policy fi_pathology_extraction_jobs_select_tenant_member
  on fi_pathology_extraction_jobs for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_extraction_jobs.tenant_id
    )
  );

grant select on fi_pathology_extraction_jobs to authenticated, service_role;
grant insert, update, delete on fi_pathology_extraction_jobs to service_role;
