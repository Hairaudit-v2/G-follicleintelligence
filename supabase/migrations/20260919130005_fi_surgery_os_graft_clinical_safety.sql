-- SurgeryOS Phase 2C: Graft counting clinical safety — session locks, reconciliation audit, idempotency.

alter table public.fi_surgery_graft_sessions
  add column if not exists extraction_lock_device_id text,
  add column if not exists extraction_lock_held_at timestamptz,
  add column if not exists extraction_lock_held_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  add column if not exists implantation_lock_device_id text,
  add column if not exists implantation_lock_held_at timestamptz,
  add column if not exists implantation_lock_held_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  add column if not exists reconciled_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  add column if not exists reconciled_at timestamptz;

comment on column public.fi_surgery_graft_sessions.extraction_lock_device_id is
  'Theatre tablet/device id holding the active extraction count session lock.';
comment on column public.fi_surgery_graft_sessions.implantation_lock_device_id is
  'Theatre tablet/device id holding the active implantation count session lock.';

alter table public.fi_surgery_graft_count_events
  add column if not exists client_submission_id text;

create unique index if not exists idx_fi_surgery_graft_count_events_idempotent
  on public.fi_surgery_graft_count_events (session_id, client_submission_id)
  where client_submission_id is not null;
