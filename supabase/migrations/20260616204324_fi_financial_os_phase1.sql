-- FinancialOS Phase 1 (additive): installment plans, booking financial overlay, automation idempotency.
-- Does not alter existing revenue tables beyond additive columns on fi_bookings.

-- ---------------------------------------------------------------------------
-- fi_installment_plans
-- ---------------------------------------------------------------------------
create table if not exists public.fi_installment_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  invoice_id uuid not null references public.fi_invoices (id) on delete cascade,
  patient_id uuid references public.fi_patients (id) on delete set null,
  total_amount bigint not null,
  currency text not null default 'AUD',
  frequency text not null
    check (frequency in ('weekly', 'biweekly', 'monthly')),
  installment_amount bigint not null,
  remaining_balance bigint not null,
  next_payment_date date,
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_installment_plans_amounts_nonneg check (
    total_amount >= 0
    and installment_amount >= 0
    and remaining_balance >= 0
  ),
  constraint fi_installment_plans_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_installment_plans is
  'FinancialOS: installment schedule for an invoice (staff-managed; does not auto-charge).';

create index if not exists idx_fi_installment_plans_tenant on public.fi_installment_plans (tenant_id);
create index if not exists idx_fi_installment_plans_tenant_invoice on public.fi_installment_plans (tenant_id, invoice_id);
create index if not exists idx_fi_installment_plans_tenant_status on public.fi_installment_plans (tenant_id, status);
create index if not exists idx_fi_installment_plans_tenant_next on public.fi_installment_plans (tenant_id, next_payment_date)
  where next_payment_date is not null;

alter table public.fi_installment_plans enable row level security;

drop policy if exists fi_installment_plans_select_tenant_member on public.fi_installment_plans;
create policy fi_installment_plans_select_tenant_member
  on public.fi_installment_plans for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_installment_plans.tenant_id
    )
  );

grant select on public.fi_installment_plans to authenticated, service_role;
grant insert, update, delete on public.fi_installment_plans to service_role;

drop trigger if exists trg_fi_installment_plans_set_updated_at on public.fi_installment_plans;
create trigger trg_fi_installment_plans_set_updated_at
  before update on public.fi_installment_plans
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_bookings.financial_os_status (parallel to operational booking_status)
-- ---------------------------------------------------------------------------
alter table public.fi_bookings
  add column if not exists financial_os_status text;

alter table public.fi_bookings drop constraint if exists fi_bookings_financial_os_status_chk;
alter table public.fi_bookings
  add constraint fi_bookings_financial_os_status_chk check (
    financial_os_status is null
    or financial_os_status in (
      'tentative',
      'deposit_pending',
      'confirmed',
      'paid_in_full'
    )
  );

comment on column public.fi_bookings.financial_os_status is
  'FinancialOS lifecycle overlay (nullable = not tracked). Does not replace operational booking_status.';

create index if not exists idx_fi_bookings_tenant_financial_os_status
  on public.fi_bookings (tenant_id, financial_os_status)
  where financial_os_status is not null;

-- ---------------------------------------------------------------------------
-- fi_financial_automation_runs (cron idempotency for FinancialOS jobs)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_financial_automation_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  automation_kind text not null,
  entity_kind text not null,
  entity_id uuid not null,
  run_date date not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_financial_automation_runs_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint uq_fi_financial_automation_runs_identity unique (tenant_id, automation_kind, entity_kind, entity_id, run_date)
);

comment on table public.fi_financial_automation_runs is
  'FinancialOS: idempotency ledger for financial automation cron (CRM signals until outbound senders exist).';

create index if not exists idx_fi_financial_automation_runs_tenant_run
  on public.fi_financial_automation_runs (tenant_id, run_date desc);

alter table public.fi_financial_automation_runs enable row level security;

revoke all on public.fi_financial_automation_runs from authenticated;

grant select, insert, update, delete on public.fi_financial_automation_runs to service_role;
