-- Stage 2K: lead contact log / communications metadata (`fi_crm_lead_communications`).
-- Preview/subject only — no full message bodies. RLS: authenticated SELECT; service_role DML.

create table if not exists fi_crm_lead_communications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid not null references fi_crm_leads (id) on delete cascade,
  actor_user_id uuid references fi_users (id) on delete set null,
  communication_type text not null,
  direction text not null,
  outcome text,
  subject text,
  preview text,
  external_message_id text,
  external_thread_id text,
  contact_at timestamptz not null default now(),
  next_follow_up_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_crm_lead_communications_type_allowed check (
    communication_type in (
      'phone',
      'email',
      'sms',
      'whatsapp',
      'in_person',
      'video_call',
      'other'
    )
  ),
  constraint fi_crm_lead_communications_direction_allowed check (
    direction in ('inbound', 'outbound', 'internal')
  ),
  constraint fi_crm_lead_communications_outcome_allowed check (
    outcome is null
    or outcome in (
      'connected',
      'voicemail',
      'no_answer',
      'replied',
      'booked',
      'not_interested',
      'follow_up_required',
      'other'
    )
  ),
  constraint fi_crm_lead_communications_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_crm_lead_communications is
  'CRM Stage 2K: lead contact log entries (metadata/preview); full message storage is a later phase.';

create index if not exists idx_fi_crm_lead_comm_tenant_lead on fi_crm_lead_communications (tenant_id, lead_id);
create index if not exists idx_fi_crm_lead_comm_tenant_lead_contact on fi_crm_lead_communications (tenant_id, lead_id, contact_at desc);
create index if not exists idx_fi_crm_lead_comm_tenant_lead_followup on fi_crm_lead_communications (tenant_id, lead_id, next_follow_up_at);
create index if not exists idx_fi_crm_lead_comm_tenant_lead_archived on fi_crm_lead_communications (tenant_id, lead_id, archived_at);

create unique index if not exists uq_fi_crm_lead_comm_external_message
  on fi_crm_lead_communications (tenant_id, lead_id, external_message_id)
  where external_message_id is not null;

create index if not exists idx_fi_crm_lead_comm_external_thread
  on fi_crm_lead_communications (tenant_id, lead_id, external_thread_id)
  where external_thread_id is not null;

alter table fi_crm_lead_communications enable row level security;

drop policy if exists fi_crm_lead_communications_select_tenant_member on fi_crm_lead_communications;
create policy fi_crm_lead_communications_select_tenant_member
  on fi_crm_lead_communications for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_crm_lead_communications.tenant_id
    )
  );

grant select on fi_crm_lead_communications to authenticated, service_role;
grant insert, update, delete on fi_crm_lead_communications to service_role;
