-- FinancialOS Phase 3C (additive): international transfer workflow framework.
-- Provider-neutral cross-border bank transfer workflow for overseas patients.
-- Does not alter existing pathway, invoice, payment, checkout, finance application, super release, or Stripe behaviour.

-- ---------------------------------------------------------------------------
-- fi_international_transfer_applications
-- ---------------------------------------------------------------------------
create table if not exists public.fi_international_transfer_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,

  payment_pathway_id uuid not null references public.fi_payment_pathways (id) on delete cascade,

  transfer_method text not null default 'bank_transfer'
    check (transfer_method in (
      'bank_transfer',
      'wise',
      'swift',
      'paypal',
      'other'
    )),

  transfer_status text not null default 'instructions_required'
    check (transfer_status in (
      'instructions_required',
      'instructions_sent',
      'awaiting_transfer',
      'proof_received',
      'under_reconciliation',
      'settlement_pending',
      'partially_settled',
      'settled',
      'variance_review',
      'rejected',
      'cancelled'
    )),

  source_country_code text,
  source_currency_code text,
  settlement_currency_code text not null default 'AUD',

  expected_amount_cents integer check (expected_amount_cents is null or expected_amount_cents >= 0),
  expected_settlement_amount_cents integer check (expected_settlement_amount_cents is null or expected_settlement_amount_cents >= 0),
  received_amount_cents integer check (received_amount_cents is null or received_amount_cents >= 0),

  expected_exchange_rate numeric,
  actual_exchange_rate numeric,
  fx_fee_cents integer check (fx_fee_cents is null or fx_fee_cents >= 0),
  settlement_variance_cents integer,

  expected_settlement_date date,
  actual_settlement_date date,

  payment_reference text,
  transfer_instructions text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_international_transfer_applications_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_international_transfer_applications is
  'FinancialOS Phase 3C: international transfer application workflow linked to international_transfer payment pathways. No live Wise/bank/SWIFT APIs.';

create index if not exists idx_fi_international_transfer_applications_tenant on public.fi_international_transfer_applications (tenant_id);
create index if not exists idx_fi_international_transfer_applications_payment_pathway on public.fi_international_transfer_applications (payment_pathway_id);
create index if not exists idx_fi_international_transfer_applications_transfer_status on public.fi_international_transfer_applications (transfer_status);
create index if not exists idx_fi_international_transfer_applications_expected_settlement_date on public.fi_international_transfer_applications (expected_settlement_date)
  where expected_settlement_date is not null;
create index if not exists idx_fi_international_transfer_applications_source_country on public.fi_international_transfer_applications (source_country_code)
  where source_country_code is not null;
create index if not exists idx_fi_international_transfer_applications_source_currency on public.fi_international_transfer_applications (source_currency_code)
  where source_currency_code is not null;
create index if not exists idx_fi_international_transfer_applications_settlement_currency on public.fi_international_transfer_applications (settlement_currency_code);

alter table public.fi_international_transfer_applications enable row level security;

drop policy if exists fi_international_transfer_applications_select_tenant_member on public.fi_international_transfer_applications;
create policy fi_international_transfer_applications_select_tenant_member
  on public.fi_international_transfer_applications for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_international_transfer_applications.tenant_id
    )
  );

grant select on public.fi_international_transfer_applications to authenticated, service_role;
grant insert, update, delete on public.fi_international_transfer_applications to service_role;

create or replace function public.fi_international_transfer_applications_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_international_transfer_applications_set_updated_at on public.fi_international_transfer_applications;
create trigger trg_fi_international_transfer_applications_set_updated_at
  before update on public.fi_international_transfer_applications
  for each row
  execute procedure public.fi_international_transfer_applications_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_international_transfer_proofs
-- ---------------------------------------------------------------------------
create table if not exists public.fi_international_transfer_proofs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  international_transfer_application_id uuid not null references public.fi_international_transfer_applications (id) on delete cascade,

  proof_type text not null default 'payment_receipt'
    check (proof_type in (
      'payment_receipt',
      'bank_confirmation',
      'wise_receipt',
      'swift_confirmation',
      'custom'
    )),

  status text not null default 'pending'
    check (status in (
      'pending',
      'requested',
      'received',
      'verified',
      'rejected'
    )),

  file_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_international_transfer_proofs_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_international_transfer_proofs is
  'FinancialOS Phase 3C: proof of payment collection and verification for international transfer applications.';

create index if not exists idx_fi_international_transfer_proofs_tenant on public.fi_international_transfer_proofs (tenant_id);
create index if not exists idx_fi_international_transfer_proofs_application on public.fi_international_transfer_proofs (international_transfer_application_id);
create index if not exists idx_fi_international_transfer_proofs_status on public.fi_international_transfer_proofs (status);

alter table public.fi_international_transfer_proofs enable row level security;

drop policy if exists fi_international_transfer_proofs_select_tenant_member on public.fi_international_transfer_proofs;
create policy fi_international_transfer_proofs_select_tenant_member
  on public.fi_international_transfer_proofs for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_international_transfer_proofs.tenant_id
    )
  );

grant select on public.fi_international_transfer_proofs to authenticated, service_role;
grant insert, update, delete on public.fi_international_transfer_proofs to service_role;

create or replace function public.fi_international_transfer_proofs_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_international_transfer_proofs_set_updated_at on public.fi_international_transfer_proofs;
create trigger trg_fi_international_transfer_proofs_set_updated_at
  before update on public.fi_international_transfer_proofs
  for each row
  execute procedure public.fi_international_transfer_proofs_set_updated_at();
