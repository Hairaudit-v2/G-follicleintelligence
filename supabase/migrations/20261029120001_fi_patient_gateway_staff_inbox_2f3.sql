-- FI-PATIENT-APP-2F.3 — Front Desk staff unread/handled state (additive).
-- Canonical bodies remain in fi_patient_gateway_messages; this does not create a second inbox store.
-- patient_read_at remains patient-side only; staff state is separate.

alter table public.fi_patient_gateway_messages
  add column if not exists staff_read_at timestamptz;

comment on column public.fi_patient_gateway_messages.staff_read_at is
  'FI-PATIENT-APP-2F.3: when clinic staff opened/acknowledged this incoming patient_to_clinic message. Independent of patient_read_at.';

alter table public.fi_patient_gateway_message_threads
  add column if not exists staff_handled_at timestamptz,
  add column if not exists staff_handled_by uuid references public.fi_users (id) on delete set null;

comment on column public.fi_patient_gateway_message_threads.staff_handled_at is
  'FI-PATIENT-APP-2F.3: explicit staff handled timestamp. New patient activity after this reopens as Read/Unread work.';

comment on column public.fi_patient_gateway_message_threads.staff_handled_by is
  'FI-PATIENT-APP-2F.3: fi_users id of staff who marked the thread handled (optional).';

create index if not exists idx_fi_pg_messages_staff_unread
  on public.fi_patient_gateway_messages (tenant_id, thread_id, sent_at desc)
  where direction = 'patient_to_clinic' and staff_read_at is null;

create index if not exists idx_fi_pg_msg_threads_staff_handled
  on public.fi_patient_gateway_message_threads (tenant_id, staff_handled_at desc nulls last);
