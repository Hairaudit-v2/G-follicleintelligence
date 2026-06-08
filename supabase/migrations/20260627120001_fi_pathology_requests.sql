-- DoctorOS Stage 1: pathology / blood test requests (no external lab integration yet).

-- ---------------------------------------------------------------------------
-- Allow patient-scoped CRM activity without a lead anchor (pathology, etc.)
-- ---------------------------------------------------------------------------
alter table fi_crm_activity_events alter column lead_id drop not null;

alter table fi_crm_activity_events drop constraint if exists fi_crm_activity_events_lead_or_patient_chk;

alter table fi_crm_activity_events
  add constraint fi_crm_activity_events_lead_or_patient_chk
  check (lead_id is not null or patient_id is not null);

comment on column fi_crm_activity_events.lead_id is
  'CRM lead anchor when present; nullable for patient-native events (e.g. blood requests) that still use this append-only stream.';

-- ---------------------------------------------------------------------------
-- fi_pathology_requests
-- ---------------------------------------------------------------------------
create table if not exists fi_pathology_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  request_date date not null default (timezone('utc', now()))::date,
  doctor_user_id uuid references fi_users (id) on delete set null,
  template_used text not null,
  status text not null default 'saved',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_pathology_requests_template_chk check (
    template_used in (
      'hair_loss_investigation',
      'female_hair_loss_investigation',
      'hair_transplant_pre_op',
      'trt_monitoring',
      'custom_request'
    )
  ),
  constraint fi_pathology_requests_status_chk check (status in ('saved', 'cancelled'))
);

comment on table fi_pathology_requests is
  'DoctorOS Stage 1: staff-authored blood/pathology request header; line items in fi_pathology_request_items.';

create index if not exists idx_fi_pathology_requests_tenant on fi_pathology_requests (tenant_id);
create index if not exists idx_fi_pathology_requests_patient on fi_pathology_requests (tenant_id, patient_id);
create index if not exists idx_fi_pathology_requests_created_at on fi_pathology_requests (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- fi_pathology_request_items
-- ---------------------------------------------------------------------------
create table if not exists fi_pathology_request_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  request_id uuid not null references fi_pathology_requests (id) on delete cascade,
  sort_order int not null default 0,
  test_code text,
  test_label text not null,
  created_at timestamptz not null default now()
);

comment on table fi_pathology_request_items is
  'DoctorOS Stage 1: ordered tests for a pathology request (template + edits).';

create index if not exists idx_fi_pathology_request_items_request on fi_pathology_request_items (request_id, sort_order);
create index if not exists idx_fi_pathology_request_items_tenant on fi_pathology_request_items (tenant_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuse-style inline function name)
-- ---------------------------------------------------------------------------
create or replace function fi_pathology_requests_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_pathology_requests_set_updated_at on fi_pathology_requests;
create trigger trg_fi_pathology_requests_set_updated_at
  before update on fi_pathology_requests
  for each row
  execute procedure fi_pathology_requests_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_pathology_requests enable row level security;
alter table fi_pathology_request_items enable row level security;

create policy fi_pathology_requests_select_tenant_member
  on fi_pathology_requests for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_requests.tenant_id
    )
  );

create policy fi_pathology_request_items_select_tenant_member
  on fi_pathology_request_items for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_pathology_request_items.tenant_id
    )
  );

grant select on fi_pathology_requests to authenticated, service_role;
grant insert, update, delete on fi_pathology_requests to service_role;

grant select on fi_pathology_request_items to authenticated, service_role;
grant insert, update, delete on fi_pathology_request_items to service_role;
