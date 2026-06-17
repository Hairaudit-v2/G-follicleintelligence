-- FinancialOS Phase 2C (additive): operational inbox for non-standard payment pathway follow-up.
-- Does not alter existing pathway, invoice, payment, or checkout behaviour.

-- ---------------------------------------------------------------------------
-- fi_payment_pathway_tasks
-- ---------------------------------------------------------------------------
create table if not exists public.fi_payment_pathway_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  payment_pathway_id uuid not null references public.fi_payment_pathways (id) on delete cascade,

  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,

  task_type text not null
    check (task_type in (
      'finance_review',
      'super_release_review',
      'international_transfer_review',
      'installment_review',
      'manual_payment_review',
      'follow_up_required'
    )),

  status text not null default 'open'
    check (status in (
      'open',
      'in_progress',
      'waiting_patient',
      'waiting_provider',
      'completed',
      'cancelled'
    )),

  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),

  assigned_to uuid references public.fi_users (id) on delete set null,
  due_date date,
  notes text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_payment_pathway_tasks_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_payment_pathway_tasks is
  'FinancialOS Phase 2C: staff operational tasks for non-standard payment pathways requiring manual follow-up before financial clearance.';

create index if not exists idx_fi_payment_pathway_tasks_tenant on public.fi_payment_pathway_tasks (tenant_id);
create index if not exists idx_fi_payment_pathway_tasks_payment_pathway on public.fi_payment_pathway_tasks (payment_pathway_id);
create index if not exists idx_fi_payment_pathway_tasks_status on public.fi_payment_pathway_tasks (status);
create index if not exists idx_fi_payment_pathway_tasks_priority on public.fi_payment_pathway_tasks (priority);
create index if not exists idx_fi_payment_pathway_tasks_assigned_to on public.fi_payment_pathway_tasks (assigned_to);
create index if not exists idx_fi_payment_pathway_tasks_due_date on public.fi_payment_pathway_tasks (due_date)
  where due_date is not null;

alter table public.fi_payment_pathway_tasks enable row level security;

drop policy if exists fi_payment_pathway_tasks_select_tenant_member on public.fi_payment_pathway_tasks;
create policy fi_payment_pathway_tasks_select_tenant_member
  on public.fi_payment_pathway_tasks for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payment_pathway_tasks.tenant_id
    )
  );

grant select on public.fi_payment_pathway_tasks to authenticated, service_role;
grant insert, update, delete on public.fi_payment_pathway_tasks to service_role;

create or replace function public.fi_payment_pathway_tasks_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_payment_pathway_tasks_set_updated_at on public.fi_payment_pathway_tasks;
create trigger trg_fi_payment_pathway_tasks_set_updated_at
  before update on public.fi_payment_pathway_tasks
  for each row
  execute procedure public.fi_payment_pathway_tasks_set_updated_at();
