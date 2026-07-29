-- FI-PATIENT-APP-P1 — Patient Journey Control foundation tables + quote/pathology extensions.
-- Patient gateway uses service_role after gate. Tenant members get SELECT via RLS.

-- ---------------------------------------------------------------------------
-- fi_patient_journey_milestones
-- ---------------------------------------------------------------------------
create table if not exists public.fi_patient_journey_milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  milestone_key text not null,
  status text not null default 'not_started',
  responsible_role text not null default 'system',
  due_at timestamptz,
  completed_at timestamptz,
  patient_label text,
  internal_note text,
  linked_resource_type text,
  linked_resource_id uuid,
  primary_action_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_journey_milestones_unique unique (tenant_id, patient_id, milestone_key),
  constraint fi_patient_journey_milestones_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_patient_journey_milestones_key_nonempty check (char_length(trim(milestone_key)) > 0)
);

comment on table public.fi_patient_journey_milestones is
  'FI-PATIENT-APP-P1: patient-visible journey milestone projection (event-written).';

create index if not exists idx_fi_patient_journey_milestones_patient
  on public.fi_patient_journey_milestones (tenant_id, patient_id);

-- ---------------------------------------------------------------------------
-- fi_patient_actions + history
-- ---------------------------------------------------------------------------
create table if not exists public.fi_patient_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  kind text not null,
  status text not null default 'open',
  priority int not null default 0,
  due_at timestamptz,
  completed_at timestamptz,
  title text not null,
  body text,
  deep_link_key text,
  resource_type text,
  resource_id uuid,
  milestone_key text,
  created_by_event text,
  completed_by_event text,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_actions_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_patient_actions_kind_nonempty check (char_length(trim(kind)) > 0),
  constraint fi_patient_actions_title_nonempty check (char_length(trim(title)) > 0)
);

comment on table public.fi_patient_actions is
  'FI-PATIENT-APP-P1: Action Centre SoR — patient + clinic shared task records.';

create index if not exists idx_fi_patient_actions_patient_status
  on public.fi_patient_actions (tenant_id, patient_id, status, priority desc);

create unique index if not exists uq_fi_patient_actions_open_dedupe
  on public.fi_patient_actions (tenant_id, patient_id, dedupe_key)
  where dedupe_key is not null
    and status in ('open', 'in_progress', 'waiting_on_clinic', 'blocked');

create table if not exists public.fi_patient_action_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  action_id uuid not null references public.fi_patient_actions (id) on delete cascade,
  event text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_patient_action_history_detail_object check (jsonb_typeof(detail) = 'object'),
  constraint fi_patient_action_history_event_nonempty check (char_length(trim(event)) > 0)
);

comment on table public.fi_patient_action_history is
  'FI-PATIENT-APP-P1: append-only patient action audit history.';

create index if not exists idx_fi_patient_action_history_action
  on public.fi_patient_action_history (tenant_id, action_id, created_at desc);

-- ---------------------------------------------------------------------------
-- fi_patient_notifications (in-app feed)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_patient_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  action_id uuid references public.fi_patient_actions (id) on delete set null,
  resource_type text,
  resource_id uuid,
  read_at timestamptz,
  action_completed_at timestamptz,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_patient_notifications_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_patient_notifications_event_nonempty check (char_length(trim(event_type)) > 0)
);

comment on table public.fi_patient_notifications is
  'FI-PATIENT-APP-P1: in-app patient notification feed (push via 2G dispatch).';

create index if not exists idx_fi_patient_notifications_patient_created
  on public.fi_patient_notifications (tenant_id, patient_id, created_at desc);

create unique index if not exists uq_fi_patient_notifications_dedupe
  on public.fi_patient_notifications (tenant_id, patient_id, dedupe_key)
  where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- Document packets + sections
-- ---------------------------------------------------------------------------
create table if not exists public.fi_patient_document_packets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  packet_key text not null,
  version int not null default 1,
  status text not null default 'draft',
  released_at timestamptz,
  signed_at timestamptz,
  signed_by_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_document_packets_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_patient_document_packets_key_nonempty check (char_length(trim(packet_key)) > 0)
);

comment on table public.fi_patient_document_packets is
  'FI-PATIENT-APP-P1: structured pre-surgery document packets.';

create index if not exists idx_fi_patient_document_packets_patient
  on public.fi_patient_document_packets (tenant_id, patient_id, updated_at desc);

create table if not exists public.fi_patient_document_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  packet_id uuid not null references public.fi_patient_document_packets (id) on delete cascade,
  section_key text not null,
  label text not null,
  status text not null default 'not_started',
  is_required boolean not null default true,
  sort_order int not null default 0,
  form_data jsonb not null default '{}'::jsonb,
  rejected_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_document_sections_unique unique (packet_id, section_key),
  constraint fi_patient_document_sections_form_object check (jsonb_typeof(form_data) = 'object'),
  constraint fi_patient_document_sections_key_nonempty check (char_length(trim(section_key)) > 0)
);

comment on table public.fi_patient_document_sections is
  'FI-PATIENT-APP-P1: document packet sections (save/continue + e-sign readiness).';

create index if not exists idx_fi_patient_document_sections_packet
  on public.fi_patient_document_sections (tenant_id, packet_id, sort_order);

-- ---------------------------------------------------------------------------
-- Alter fi_crm_quotes — delivery / decline telemetry + patient link
-- ---------------------------------------------------------------------------
alter table public.fi_crm_quotes add column if not exists delivered_at timestamptz;
alter table public.fi_crm_quotes add column if not exists first_viewed_at timestamptz;
alter table public.fi_crm_quotes add column if not exists last_viewed_at timestamptz;
alter table public.fi_crm_quotes add column if not exists declined_at timestamptz;
alter table public.fi_crm_quotes add column if not exists decline_reason text;
alter table public.fi_crm_quotes add column if not exists patient_id uuid references public.fi_patients (id) on delete set null;

create index if not exists idx_fi_crm_quotes_patient
  on public.fi_crm_quotes (tenant_id, patient_id)
  where patient_id is not null;

comment on column public.fi_crm_quotes.delivered_at is
  'FI-PATIENT-APP-P1: when quote was delivered to the patient app.';
comment on column public.fi_crm_quotes.patient_id is
  'FI-PATIENT-APP-P1: direct patient ownership for gateway quote lists.';

-- ---------------------------------------------------------------------------
-- Alter fi_pathology_results — patient-safe summary + clearance
-- ---------------------------------------------------------------------------
alter table public.fi_pathology_results add column if not exists patient_safe_summary text;
alter table public.fi_pathology_results add column if not exists patient_summary_approved_at timestamptz;
alter table public.fi_pathology_results add column if not exists patient_summary_approved_by uuid references public.fi_users (id) on delete set null;
alter table public.fi_pathology_results add column if not exists clearance_status text;
alter table public.fi_pathology_results add column if not exists surgery_impact text;
alter table public.fi_pathology_results add column if not exists follow_up_required boolean not null default false;

comment on column public.fi_pathology_results.patient_safe_summary is
  'FI-PATIENT-APP-P1: clinician-approved patient-visible summary only.';

-- ---------------------------------------------------------------------------
-- Alter fi_pathology_requests — issue workflow fields
-- (patient_id already exists on foundation table; IF NOT EXISTS is safe)
-- ---------------------------------------------------------------------------
alter table public.fi_pathology_requests add column if not exists issued_at timestamptz;
alter table public.fi_pathology_requests add column if not exists recommended_completion_date date;
alter table public.fi_pathology_requests add column if not exists fasting_instructions text;
alter table public.fi_pathology_requests add column if not exists provider_instructions text;
alter table public.fi_pathology_requests add column if not exists patient_id uuid references public.fi_patients (id) on delete cascade;
alter table public.fi_pathology_requests add column if not exists workflow_status text;

comment on column public.fi_pathology_requests.workflow_status is
  'FI-PATIENT-APP-P1: prepared | issued | awaiting_results | results_received | …';

-- ---------------------------------------------------------------------------
-- RLS (tenant member SELECT) + service_role write grants
-- ---------------------------------------------------------------------------
alter table public.fi_patient_journey_milestones enable row level security;
alter table public.fi_patient_actions enable row level security;
alter table public.fi_patient_action_history enable row level security;
alter table public.fi_patient_notifications enable row level security;
alter table public.fi_patient_document_packets enable row level security;
alter table public.fi_patient_document_sections enable row level security;

drop policy if exists fi_patient_journey_milestones_select_tenant_member on public.fi_patient_journey_milestones;
create policy fi_patient_journey_milestones_select_tenant_member
  on public.fi_patient_journey_milestones for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_journey_milestones.tenant_id
    )
  );

drop policy if exists fi_patient_actions_select_tenant_member on public.fi_patient_actions;
create policy fi_patient_actions_select_tenant_member
  on public.fi_patient_actions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_actions.tenant_id
    )
  );

drop policy if exists fi_patient_action_history_select_tenant_member on public.fi_patient_action_history;
create policy fi_patient_action_history_select_tenant_member
  on public.fi_patient_action_history for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_action_history.tenant_id
    )
  );

drop policy if exists fi_patient_notifications_select_tenant_member on public.fi_patient_notifications;
create policy fi_patient_notifications_select_tenant_member
  on public.fi_patient_notifications for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_notifications.tenant_id
    )
  );

drop policy if exists fi_patient_document_packets_select_tenant_member on public.fi_patient_document_packets;
create policy fi_patient_document_packets_select_tenant_member
  on public.fi_patient_document_packets for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_document_packets.tenant_id
    )
  );

drop policy if exists fi_patient_document_sections_select_tenant_member on public.fi_patient_document_sections;
create policy fi_patient_document_sections_select_tenant_member
  on public.fi_patient_document_sections for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_document_sections.tenant_id
    )
  );

grant select on public.fi_patient_journey_milestones to authenticated, service_role;
grant insert, update, delete on public.fi_patient_journey_milestones to service_role;

grant select on public.fi_patient_actions to authenticated, service_role;
grant insert, update, delete on public.fi_patient_actions to service_role;

grant select on public.fi_patient_action_history to authenticated, service_role;
grant insert on public.fi_patient_action_history to service_role;

grant select on public.fi_patient_notifications to authenticated, service_role;
grant insert, update, delete on public.fi_patient_notifications to service_role;

grant select on public.fi_patient_document_packets to authenticated, service_role;
grant insert, update, delete on public.fi_patient_document_packets to service_role;

grant select on public.fi_patient_document_sections to authenticated, service_role;
grant insert, update, delete on public.fi_patient_document_sections to service_role;