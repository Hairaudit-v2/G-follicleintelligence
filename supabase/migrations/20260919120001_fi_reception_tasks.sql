-- ReceptionOS Phase 2 (additive): tenant-scoped front-desk task inbox + append-only audit trail.
-- Does not alter ClinicOS loaders, fi_crm_tasks, or legacy reception board behaviour.

-- ---------------------------------------------------------------------------
-- fi_reception_tasks
-- ---------------------------------------------------------------------------
create table if not exists public.fi_reception_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  title text not null,
  description text,

  source_type text not null
    check (source_type in (
      'booking',
      'patient',
      'case',
      'lead',
      'payment',
      'consultation',
      'surgery',
      'system'
    )),

  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical', 'blocked')),

  status text not null default 'open'
    check (status in ('open', 'in_progress', 'snoozed', 'resolved', 'dismissed')),

  owner_fi_user_id uuid references public.fi_users (id) on delete set null,
  due_at timestamptz,

  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,
  payment_id uuid references public.fi_payment_records (id) on delete set null,
  consultation_id uuid references public.fi_consultations (id) on delete set null,

  source_alert_kind text,
  source_ref_id text,

  resolution_notes text,
  internal_notes text,
  snoozed_until timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  resolved_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  dismissed_by_fi_user_id uuid references public.fi_users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  dismissed_at timestamptz,

  constraint fi_reception_tasks_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_reception_tasks is
  'ReceptionOS Phase 2: actionable front-desk tasks (booking/patient/case anchored). Writes via service role only.';

create index if not exists idx_fi_reception_tasks_tenant on public.fi_reception_tasks (tenant_id);
create index if not exists idx_fi_reception_tasks_tenant_status on public.fi_reception_tasks (tenant_id, status);
create index if not exists idx_fi_reception_tasks_tenant_severity on public.fi_reception_tasks (tenant_id, severity);
create index if not exists idx_fi_reception_tasks_owner on public.fi_reception_tasks (owner_fi_user_id)
  where owner_fi_user_id is not null;
create index if not exists idx_fi_reception_tasks_due_at on public.fi_reception_tasks (due_at)
  where due_at is not null;
create unique index if not exists idx_fi_reception_tasks_source_ref
  on public.fi_reception_tasks (tenant_id, source_ref_id)
  where source_ref_id is not null and source_ref_id <> '';

alter table public.fi_reception_tasks enable row level security;

drop policy if exists fi_reception_tasks_select_tenant_member on public.fi_reception_tasks;
create policy fi_reception_tasks_select_tenant_member
  on public.fi_reception_tasks for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reception_tasks.tenant_id
    )
  );

grant select on public.fi_reception_tasks to authenticated, service_role;
grant insert, update, delete on public.fi_reception_tasks to service_role;

create or replace function public.fi_reception_tasks_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_reception_tasks_set_updated_at on public.fi_reception_tasks;
create trigger trg_fi_reception_tasks_set_updated_at
  before update on public.fi_reception_tasks
  for each row
  execute procedure public.fi_reception_tasks_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_reception_task_audit_events (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_reception_task_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  reception_task_id uuid not null references public.fi_reception_tasks (id) on delete cascade,
  event_kind text not null
    check (event_kind in (
      'created',
      'assigned',
      'snoozed',
      'status_changed',
      'resolved',
      'dismissed',
      'note_added'
    )),
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_reception_task_audit_events_detail_object check (jsonb_typeof (detail) = 'object')
);

comment on table public.fi_reception_task_audit_events is
  'ReceptionOS Phase 2: append-only audit trail for reception task lifecycle actions.';

create index if not exists idx_fi_reception_task_audit_tenant_created
  on public.fi_reception_task_audit_events (tenant_id, created_at desc);
create index if not exists idx_fi_reception_task_audit_task
  on public.fi_reception_task_audit_events (reception_task_id, created_at desc);

alter table public.fi_reception_task_audit_events enable row level security;

grant select, insert on public.fi_reception_task_audit_events to service_role;
