-- FinancialOS Phase 2 (additive): payment pathway engine.
-- Records how a patient intends to pay after quote/invoice acceptance.
-- Does not alter existing revenue tables, invoices, payment requests, or payments.

-- ---------------------------------------------------------------------------
-- fi_payment_pathways
-- ---------------------------------------------------------------------------
create table if not exists public.fi_payment_pathways (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  invoice_id uuid references public.fi_invoices (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,

  pathway_type text not null
    check (pathway_type in (
      'pay_in_full',
      'deposit_balance',
      'installment_plan',
      'medical_finance',
      'super_release',
      'international_transfer',
      'manual'
    )),

  status text not null default 'selected'
    check (status in (
      'draft',
      'selected',
      'pending_patient_action',
      'pending_clinic_action',
      'pending_provider',
      'approved',
      'rejected',
      'settlement_pending',
      'settled',
      'cancelled'
    )),

  provider text,
  provider_reference text,

  selected_at timestamptz default now(),
  expected_settlement_date date,
  actual_settlement_date date,

  currency_code text default 'AUD',
  expected_amount_cents integer,
  settled_amount_cents integer,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_payment_pathways_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_payment_pathways_amounts_nonneg check (
    (expected_amount_cents is null or expected_amount_cents >= 0)
    and (settled_amount_cents is null or settled_amount_cents >= 0)
  )
);

comment on table public.fi_payment_pathways is
  'FinancialOS Phase 2: how a patient intends to pay after quote/invoice acceptance (staff-recorded; does not drive Stripe checkout or auto-settle).';

create index if not exists idx_fi_payment_pathways_tenant on public.fi_payment_pathways (tenant_id);
create index if not exists idx_fi_payment_pathways_patient on public.fi_payment_pathways (patient_id);
create index if not exists idx_fi_payment_pathways_case on public.fi_payment_pathways (case_id);
create index if not exists idx_fi_payment_pathways_invoice on public.fi_payment_pathways (invoice_id);
create index if not exists idx_fi_payment_pathways_booking on public.fi_payment_pathways (booking_id);
create index if not exists idx_fi_payment_pathways_pathway_type on public.fi_payment_pathways (pathway_type);
create index if not exists idx_fi_payment_pathways_status on public.fi_payment_pathways (status);
create index if not exists idx_fi_payment_pathways_expected_settlement_date
  on public.fi_payment_pathways (expected_settlement_date)
  where expected_settlement_date is not null;

alter table public.fi_payment_pathways enable row level security;

drop policy if exists fi_payment_pathways_select_tenant_member on public.fi_payment_pathways;
create policy fi_payment_pathways_select_tenant_member
  on public.fi_payment_pathways for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payment_pathways.tenant_id
    )
  );

grant select on public.fi_payment_pathways to authenticated, service_role;
grant insert, update, delete on public.fi_payment_pathways to service_role;

create or replace function public.fi_payment_pathways_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_payment_pathways_set_updated_at on public.fi_payment_pathways;
create trigger trg_fi_payment_pathways_set_updated_at
  before update on public.fi_payment_pathways
  for each row
  execute procedure public.fi_payment_pathways_set_updated_at();
