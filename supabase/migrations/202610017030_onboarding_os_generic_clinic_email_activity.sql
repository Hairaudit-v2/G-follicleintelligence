-- Generic clinic email activity projection (isolated from pathology email ingestion).

-- ---------------------------------------------------------------------------
-- fi_generic_clinic_email_routes — tenant inbound address configuration
-- ---------------------------------------------------------------------------
create table if not exists fi_generic_clinic_email_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  inbound_email text not null,
  route_status text not null default 'active',
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_generic_clinic_email_routes_status_chk check (
    route_status in ('active', 'disabled')
  )
);

comment on table fi_generic_clinic_email_routes is
  'Maps dedicated generic clinic inbound email addresses to FI OS tenants for activity ingestion.';

create unique index if not exists idx_fi_generic_clinic_email_routes_inbound_email_lower
  on fi_generic_clinic_email_routes (lower(trim(inbound_email)));

create index if not exists idx_fi_generic_clinic_email_routes_tenant
  on fi_generic_clinic_email_routes (tenant_id);

-- ---------------------------------------------------------------------------
-- fi_generic_clinic_email_activities — metadata-only activity projection
-- ---------------------------------------------------------------------------
create table if not exists fi_generic_clinic_email_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  source text not null,
  external_message_id text not null,
  external_thread_id text,
  direction text not null,
  from_email text,
  to_email_hashes text[] not null default '{}'::text[],
  to_email_preview text,
  subject_preview text,
  body_preview text,
  received_at timestamptz,
  sent_at timestamptz,
  matched_lead_id uuid references fi_crm_leads (id) on delete set null,
  matched_patient_id uuid references fi_patients (id) on delete set null,
  match_confidence numeric,
  match_reason text,
  match_status text not null default 'unmatched',
  crm_activity_event_id uuid references fi_crm_activity_events (id) on delete set null,
  match_audit jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_generic_clinic_email_activities_direction_chk check (
    direction in ('inbound', 'outbound')
  ),
  constraint fi_generic_clinic_email_activities_match_status_chk check (
    match_status in ('unmatched', 'matched', 'ambiguous')
  ),
  constraint fi_generic_clinic_email_activities_match_audit_object check (
    jsonb_typeof (match_audit) = 'object'
  )
);

comment on table fi_generic_clinic_email_activities is
  'Tenant-scoped generic clinic email activity metadata (not pathology). Projects to fi_crm_activity_events when confidently matched.';

create unique index if not exists idx_fi_generic_clinic_email_activities_tenant_source_message
  on fi_generic_clinic_email_activities (tenant_id, source, external_message_id);

create index if not exists idx_fi_generic_clinic_email_activities_tenant_created
  on fi_generic_clinic_email_activities (tenant_id, created_at desc);

create index if not exists idx_fi_generic_clinic_email_activities_tenant_match_status
  on fi_generic_clinic_email_activities (tenant_id, match_status);

create index if not exists idx_fi_generic_clinic_email_activities_matched_lead
  on fi_generic_clinic_email_activities (matched_lead_id)
  where matched_lead_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at trigger for routes
-- ---------------------------------------------------------------------------
create or replace function fi_generic_clinic_email_routes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_generic_clinic_email_routes_set_updated_at on fi_generic_clinic_email_routes;
create trigger trg_fi_generic_clinic_email_routes_set_updated_at
  before update on fi_generic_clinic_email_routes
  for each row
  execute procedure fi_generic_clinic_email_routes_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_generic_clinic_email_routes enable row level security;
alter table fi_generic_clinic_email_activities enable row level security;

drop policy if exists fi_generic_clinic_email_routes_select_tenant_member on fi_generic_clinic_email_routes;
create policy fi_generic_clinic_email_routes_select_tenant_member
  on fi_generic_clinic_email_routes for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_generic_clinic_email_routes.tenant_id
    )
  );

drop policy if exists fi_generic_clinic_email_activities_select_tenant_member on fi_generic_clinic_email_activities;
create policy fi_generic_clinic_email_activities_select_tenant_member
  on fi_generic_clinic_email_activities for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_generic_clinic_email_activities.tenant_id
    )
  );

grant select on fi_generic_clinic_email_routes to authenticated, service_role;
grant insert, update, delete on fi_generic_clinic_email_routes to service_role;

grant select on fi_generic_clinic_email_activities to authenticated, service_role;
grant insert, update, delete on fi_generic_clinic_email_activities to service_role;
