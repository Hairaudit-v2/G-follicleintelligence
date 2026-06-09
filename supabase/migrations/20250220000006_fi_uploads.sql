-- Follicle Intelligence: uploads (file metadata + storage_path + canonical type)
create table if not exists fi_uploads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  case_id uuid not null references fi_cases(id) on delete cascade,
  created_by uuid references fi_users(id) on delete set null,
  type text not null check (type in (
    'blood_pdf','blood_csv','scalp_preop_front','scalp_sides_left','scalp_sides_right',
    'scalp_crown','donor_rear','postop_day0','supporting_docs'
  )),
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);
create index if not exists idx_fi_uploads_case on fi_uploads(case_id);
create index if not exists idx_fi_uploads_tenant on fi_uploads(tenant_id);
create index if not exists idx_fi_uploads_type on fi_uploads(case_id, type);
