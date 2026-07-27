-- FI-PATIENT-APP-1F — Patient gateway messaging store (additive).
-- Justified gap: fi_crm_messages is preview/metadata-only and not a patient inbox.
-- Staff visibility is via CRM activity + patient timeline + CRM message preview rows
-- created by the gateway send path (does not replace CRM messaging).

create table if not exists public.fi_patient_gateway_message_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  category text not null
    check (category in ('general', 'appointment', 'post_op', 'medication', 'billing')),
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_patient_gateway_message_threads_metadata_object
    check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_patient_gateway_message_threads is
  'FI-PATIENT-APP-1F: patient-safe message threads for /api/patient/v1/messages. Not a CRM replacement.';

create unique index if not exists uq_fi_pg_msg_threads_tenant_patient_category
  on public.fi_patient_gateway_message_threads (tenant_id, patient_id, category)
  where status = 'open';

create index if not exists idx_fi_pg_msg_threads_tenant_patient
  on public.fi_patient_gateway_message_threads (tenant_id, patient_id, last_message_at desc nulls last);

create table if not exists public.fi_patient_gateway_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid not null references public.fi_patients (id) on delete cascade,
  thread_id uuid not null
    references public.fi_patient_gateway_message_threads (id) on delete cascade,
  direction text not null
    check (direction in ('patient_to_clinic', 'clinic_to_patient')),
  body text not null,
  sender_label text not null,
  status text not null default 'sent'
    check (status in ('sent', 'delivered', 'read', 'failed')),
  sent_at timestamptz not null default now(),
  patient_read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_patient_gateway_messages_metadata_object
    check (jsonb_typeof (metadata) = 'object'),
  constraint fi_patient_gateway_messages_body_nonempty
    check (char_length(trim(body)) > 0),
  constraint fi_patient_gateway_messages_body_max
    check (char_length(body) <= 4000)
);

comment on table public.fi_patient_gateway_messages is
  'FI-PATIENT-APP-1F: patient-safe messages for the patient gateway inbox.';

create index if not exists idx_fi_pg_messages_thread_sent
  on public.fi_patient_gateway_messages (tenant_id, thread_id, sent_at asc);

create index if not exists idx_fi_pg_messages_patient_sent
  on public.fi_patient_gateway_messages (tenant_id, patient_id, sent_at desc);

alter table public.fi_patient_gateway_message_threads enable row level security;
alter table public.fi_patient_gateway_messages enable row level security;

-- Staff members may read for operational visibility; writes are service-role only
-- (patient gateway uses service role after requirePatientGatewayContext).
drop policy if exists fi_pg_msg_threads_select_tenant_member
  on public.fi_patient_gateway_message_threads;
create policy fi_pg_msg_threads_select_tenant_member
  on public.fi_patient_gateway_message_threads for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_gateway_message_threads.tenant_id
    )
  );

drop policy if exists fi_pg_messages_select_tenant_member
  on public.fi_patient_gateway_messages;
create policy fi_pg_messages_select_tenant_member
  on public.fi_patient_gateway_messages for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_gateway_messages.tenant_id
    )
  );

grant select on public.fi_patient_gateway_message_threads to authenticated, service_role;
grant select on public.fi_patient_gateway_messages to authenticated, service_role;
grant insert, update, delete on public.fi_patient_gateway_message_threads to service_role;
grant insert, update, delete on public.fi_patient_gateway_messages to service_role;
