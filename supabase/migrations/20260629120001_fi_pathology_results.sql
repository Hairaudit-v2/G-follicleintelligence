-- DoctorOS Stage 3: pathology blood results (manual entry + optional PDF; no OCR/provider integration).

-- ---------------------------------------------------------------------------
-- fi_pathology_results
-- ---------------------------------------------------------------------------
create table if not exists fi_pathology_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  pathology_request_id uuid references fi_pathology_requests (id) on delete set null,
  result_date date not null default (timezone('utc', now()))::date,
  provider_name text,
  source_type text not null,
  uploaded_file_bucket text,
  uploaded_file_path text,
  status text not null default 'draft',
  clinical_summary text,
  reviewed_by_user_id uuid references fi_users (id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pathology_results_source_type_chk check (
    source_type in ('uploaded_pdf', 'manual_entry', 'imported')
  ),
  constraint fi_pathology_results_status_chk check (status in ('draft', 'reviewed', 'archived')),
  constraint fi_pathology_results_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table fi_pathology_results is
  'DoctorOS Stage 3: blood/pathology result header; line markers in fi_pathology_result_items.';

create index if not exists idx_fi_pathology_results_tenant on fi_pathology_results (tenant_id);
create index if not exists idx_fi_pathology_results_patient on fi_pathology_results (tenant_id, patient_id);
create index if not exists idx_fi_pathology_results_request on fi_pathology_results (pathology_request_id)
  where pathology_request_id is not null;
create index if not exists idx_fi_pathology_results_created on fi_pathology_results (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- fi_pathology_result_items
-- ---------------------------------------------------------------------------
create table if not exists fi_pathology_result_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  result_id uuid not null references fi_pathology_results (id) on delete cascade,
  test_code text,
  test_label text not null,
  result_value text not null,
  result_unit text,
  reference_range text,
  flag text not null default 'unknown',
  sort_order int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_pathology_result_items_flag_chk check (
    flag in ('low', 'normal', 'high', 'critical', 'unknown')
  ),
  constraint fi_pathology_result_items_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table fi_pathology_result_items is
  'DoctorOS Stage 3: structured marker rows for a pathology result.';

create index if not exists idx_fi_pathology_result_items_result on fi_pathology_result_items (result_id, sort_order);
create index if not exists idx_fi_pathology_result_items_tenant on fi_pathology_result_items (tenant_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function fi_pathology_results_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_pathology_results_set_updated_at on fi_pathology_results;
create trigger trg_fi_pathology_results_set_updated_at
  before update on fi_pathology_results
  for each row
  execute procedure fi_pathology_results_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_pathology_results enable row level security;
alter table fi_pathology_result_items enable row level security;

create policy fi_pathology_results_select_tenant_member
  on fi_pathology_results for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_results.tenant_id
    )
  );

create policy fi_pathology_result_items_select_tenant_member
  on fi_pathology_result_items for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_result_items.tenant_id
    )
  );

grant select on fi_pathology_results to authenticated, service_role;
grant insert, update, delete on fi_pathology_results to service_role;

grant select on fi_pathology_result_items to authenticated, service_role;
grant insert, update, delete on fi_pathology_result_items to service_role;
