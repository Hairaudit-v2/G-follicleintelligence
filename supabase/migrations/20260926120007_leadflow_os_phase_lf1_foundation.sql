-- LeadFlowOS Phase LF-1 — LeadFlow foundation (additive, backend-only).
-- Tables: fi_external_events (inbound provider events), fi_leads (LeadFlow anchor),
-- fi_lead_activity (append-only audit ledger).
-- Does not alter fi_crm_* tables; parallel LeadFlow-native schema for LF-1+ phases.
-- RLS: tenant members SELECT; service_role DML. fi_lead_activity is append-only.

-- ---------------------------------------------------------------------------
-- fi_external_events — inbound external provider events (HubSpot, Meta, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_external_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null,
  event_type text not null,
  external_id text,
  payload_json jsonb not null,
  status text not null default 'pending',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fi_external_events_payload_object check (jsonb_typeof (payload_json) = 'object'),
  constraint fi_external_events_status_chk check (
    status in ('pending', 'processing', 'processed', 'failed', 'skipped')
  )
);

comment on table public.fi_external_events is
  'LeadFlowOS LF-1: inbound external provider events awaiting deterministic processing. Status updates via service role; rows retained for audit.';

create index if not exists idx_fi_external_events_tenant
  on public.fi_external_events (tenant_id, created_at desc);

create index if not exists idx_fi_external_events_tenant_provider
  on public.fi_external_events (tenant_id, provider, created_at desc);

create index if not exists idx_fi_external_events_tenant_status
  on public.fi_external_events (tenant_id, status, created_at desc);

create unique index if not exists idx_fi_external_events_idempotency
  on public.fi_external_events (tenant_id, provider, external_id)
  where external_id is not null and external_id <> '';

alter table public.fi_external_events enable row level security;

drop policy if exists fi_external_events_select_tenant_member on public.fi_external_events;
create policy fi_external_events_select_tenant_member
  on public.fi_external_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_external_events.tenant_id
    )
  );

grant select on public.fi_external_events to authenticated, service_role;
grant insert, update on public.fi_external_events to service_role;
revoke delete on public.fi_external_events from service_role;

-- ---------------------------------------------------------------------------
-- fi_leads — LeadFlow-native lead anchor (mutable state + updated_at)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  hubspot_contact_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  lead_source text,
  procedure_interest text,
  country text,
  budget_range text,
  current_stage text not null default 'new',
  lead_score integer not null default 0,
  conversion_probability integer not null default 0,
  assigned_consultant uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_leads_lead_score_range check (lead_score >= 0 and lead_score <= 100),
  constraint fi_leads_conversion_probability_range check (
    conversion_probability >= 0 and conversion_probability <= 100
  )
);

comment on table public.fi_leads is
  'LeadFlowOS LF-1: tenant-scoped lead anchor for acquisition pipeline. Mutable profile; stage/score changes audited via fi_lead_activity.';

create index if not exists idx_fi_leads_tenant
  on public.fi_leads (tenant_id, updated_at desc);

create index if not exists idx_fi_leads_tenant_stage
  on public.fi_leads (tenant_id, current_stage);

create index if not exists idx_fi_leads_email
  on public.fi_leads (tenant_id, email)
  where email is not null and email <> '';

create index if not exists idx_fi_leads_phone
  on public.fi_leads (tenant_id, phone)
  where phone is not null and phone <> '';

create index if not exists idx_fi_leads_hubspot_contact_id
  on public.fi_leads (tenant_id, hubspot_contact_id)
  where hubspot_contact_id is not null and hubspot_contact_id <> '';

create unique index if not exists idx_fi_leads_tenant_hubspot_contact_unique
  on public.fi_leads (tenant_id, hubspot_contact_id)
  where hubspot_contact_id is not null and hubspot_contact_id <> '';

alter table public.fi_leads enable row level security;

drop policy if exists fi_leads_select_tenant_member on public.fi_leads;
create policy fi_leads_select_tenant_member
  on public.fi_leads for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_leads.tenant_id
    )
  );

grant select on public.fi_leads to authenticated, service_role;
grant insert, update on public.fi_leads to service_role;

create or replace function public.fi_leads_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_leads_set_updated_at on public.fi_leads;
create trigger trg_fi_leads_set_updated_at
  before update on public.fi_leads
  for each row
  execute procedure public.fi_leads_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_lead_activity — append-only lead audit ledger
-- ---------------------------------------------------------------------------
create table if not exists public.fi_lead_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.fi_leads (id) on delete cascade,
  activity_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_lead_activity_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_lead_activity is
  'LeadFlowOS LF-1: append-only lead activity audit ledger — no updates or deletes.';

create index if not exists idx_fi_lead_activity_lead_created
  on public.fi_lead_activity (lead_id, created_at desc);

create index if not exists idx_fi_lead_activity_type
  on public.fi_lead_activity (activity_type, created_at desc);

alter table public.fi_lead_activity enable row level security;

drop policy if exists fi_lead_activity_select_tenant_member on public.fi_lead_activity;
create policy fi_lead_activity_select_tenant_member
  on public.fi_lead_activity for select to authenticated
  using (
    exists (
      select 1
      from public.fi_users u
      inner join public.fi_leads l on l.id = fi_lead_activity.lead_id
      where u.auth_user_id = auth.uid()
        and u.tenant_id = l.tenant_id
    )
  );

grant select on public.fi_lead_activity to authenticated, service_role;
grant insert on public.fi_lead_activity to service_role;
revoke update, delete on public.fi_lead_activity from service_role;
