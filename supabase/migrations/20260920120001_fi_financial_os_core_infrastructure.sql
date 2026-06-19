-- FinancialOS Phase 1 Core Infrastructure (additive, production-safe).
-- Master ledger, payment reconciliation, invoice lifecycle columns, deposit rule extensions.

-- ---------------------------------------------------------------------------
-- fi_invoices — lifecycle columns + expanded status model
-- ---------------------------------------------------------------------------
alter table public.fi_invoices add column if not exists sent_at timestamptz;
alter table public.fi_invoices add column if not exists paid_at timestamptz;
alter table public.fi_invoices add column if not exists remaining_balance_cents bigint;
alter table public.fi_invoices add column if not exists days_overdue integer not null default 0;
alter table public.fi_invoices add column if not exists last_reminder_sent_at timestamptz;

comment on column public.fi_invoices.sent_at is
  'When the invoice was sent/delivered to the patient (FinancialOS lifecycle).';
comment on column public.fi_invoices.paid_at is
  'When the invoice was fully settled (amount_paid_cents >= total_cents).';
comment on column public.fi_invoices.remaining_balance_cents is
  'Denormalized open balance (total_cents - amount_paid_cents, floored at 0). Maintained by application layer.';
comment on column public.fi_invoices.days_overdue is
  'Calendar days past due_date while balance remains open; 0 when not overdue.';
comment on column public.fi_invoices.last_reminder_sent_at is
  'Last automated or staff payment reminder timestamp.';

-- Drop legacy status check before normalising rows (demo/seed data may already use
-- `awaiting_payment`, which the old `issued`-era constraint rejects).
alter table public.fi_invoices drop constraint if exists fi_invoices_status_check;
alter table public.fi_invoices drop constraint if exists fi_invoices_status_chk;

-- Migrate legacy `issued` → `awaiting_payment` before adding the expanded status check.
update public.fi_invoices
set status = 'awaiting_payment'
where status = 'issued';

-- Backfill lifecycle denormalized fields from existing rows.
update public.fi_invoices
set
  remaining_balance_cents = greatest(0, total_cents - amount_paid_cents),
  days_overdue = case
    when status in ('awaiting_payment', 'sent', 'partially_paid', 'overdue')
      and due_date is not null
      and due_date < current_date
      and (total_cents - amount_paid_cents) > 0
    then (current_date - due_date)::integer
    else 0
  end,
  paid_at = case
    when status = 'paid' and paid_at is null then coalesce(updated_at, created_at)
    else paid_at
  end,
  sent_at = case
    when sent_at is null and issued_at is not null and status <> 'draft' then issued_at
    else sent_at
  end
where remaining_balance_cents is null
   or (status = 'paid' and paid_at is null)
   or (sent_at is null and issued_at is not null and status <> 'draft');

alter table public.fi_invoices
  add constraint fi_invoices_status_chk check (
    status in (
      'draft',
      'sent',
      'awaiting_payment',
      'partially_paid',
      'paid',
      'overdue',
      'cancelled',
      'refunded'
    )
  );

alter table public.fi_invoices drop constraint if exists fi_invoices_days_overdue_nonneg;
alter table public.fi_invoices
  add constraint fi_invoices_days_overdue_nonneg check (days_overdue >= 0);

create index if not exists idx_fi_invoices_tenant_paid_at on public.fi_invoices (tenant_id, paid_at desc)
  where paid_at is not null;
create index if not exists idx_fi_invoices_tenant_last_reminder on public.fi_invoices (tenant_id, last_reminder_sent_at desc)
  where last_reminder_sent_at is not null;

-- ---------------------------------------------------------------------------
-- fi_deposit_rules — procedure-scoped deposit policy extensions
-- ---------------------------------------------------------------------------
alter table public.fi_deposit_rules add column if not exists procedure_type text;
alter table public.fi_deposit_rules add column if not exists minimum_deposit_percentage integer;
alter table public.fi_deposit_rules add column if not exists deposit_due_days integer;
alter table public.fi_deposit_rules add column if not exists auto_release_slot boolean not null default false;
alter table public.fi_deposit_rules add column if not exists cancellation_fee_percentage integer;
alter table public.fi_deposit_rules add column if not exists allow_transfer boolean not null default true;

comment on column public.fi_deposit_rules.procedure_type is
  'Optional procedure type filter (e.g. FUE, FUT). Null matches all procedure types for the tenant/clinic.';
comment on column public.fi_deposit_rules.minimum_deposit_percentage is
  'Minimum deposit as whole percent (0–100). When set with percent_of_procedure_fee, syncs to percent_bp.';
comment on column public.fi_deposit_rules.deposit_due_days is
  'Days after invoice issue when deposit is due (informative; due_date set at invoice creation).';
comment on column public.fi_deposit_rules.auto_release_slot is
  'When true, unpaid deposit past due may release the reserved surgery slot (staff-configurable signal).';
comment on column public.fi_deposit_rules.cancellation_fee_percentage is
  'Cancellation fee as basis points (0–10000) of procedure fee when patient cancels after deposit window.';
comment on column public.fi_deposit_rules.allow_transfer is
  'When true, deposit may transfer to a rescheduled surgery date per clinic policy.';

-- Backfill minimum_deposit_percentage from percent_bp where applicable.
update public.fi_deposit_rules
set minimum_deposit_percentage = round(percent_bp / 100.0)::integer
where minimum_deposit_percentage is null
  and percent_bp is not null
  and rule_kind = 'percent_of_procedure_fee';

alter table public.fi_deposit_rules drop constraint if exists fi_deposit_rules_minimum_deposit_pct;
alter table public.fi_deposit_rules
  add constraint fi_deposit_rules_minimum_deposit_pct check (
    minimum_deposit_percentage is null
    or (minimum_deposit_percentage >= 0 and minimum_deposit_percentage <= 100)
  );

alter table public.fi_deposit_rules drop constraint if exists fi_deposit_rules_deposit_due_days;
alter table public.fi_deposit_rules
  add constraint fi_deposit_rules_deposit_due_days check (
    deposit_due_days is null or deposit_due_days >= 0
  );

alter table public.fi_deposit_rules drop constraint if exists fi_deposit_rules_cancellation_fee_bp;
alter table public.fi_deposit_rules
  add constraint fi_deposit_rules_cancellation_fee_bp check (
    cancellation_fee_percentage is null
    or (cancellation_fee_percentage >= 0 and cancellation_fee_percentage <= 10000)
  );

create index if not exists idx_fi_deposit_rules_procedure_type on public.fi_deposit_rules (tenant_id, procedure_type)
  where procedure_type is not null;

-- ---------------------------------------------------------------------------
-- fi_financial_transactions — append-only master financial ledger
-- ---------------------------------------------------------------------------
create table if not exists public.fi_financial_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  transaction_kind text not null
    check (
      transaction_kind in (
        'invoice_created',
        'payment_received',
        'refund_processed',
        'deposit_paid',
        'balance_paid',
        'cancellation_fee'
      )
    ),

  amount_cents bigint not null,
  currency text not null default 'AUD',

  -- Signed convention: positive = revenue/credit to clinic; negative = refund/fee reversal.
  direction text not null default 'credit'
    check (direction in ('credit', 'debit')),

  invoice_id uuid references public.fi_invoices (id) on delete set null,
  payment_id uuid references public.fi_payments (id) on delete set null,
  payment_reconciliation_id uuid,

  patient_id uuid references public.fi_patients (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  consultation_id uuid references public.fi_consultations (id) on delete set null,

  source_module text not null default 'financial_os'
    check (
      source_module in (
        'consultation_os',
        'surgery_os',
        'leadflow',
        'revenue_os',
        'financial_os',
        'system'
      )
    ),

  description text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,

  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint fi_financial_transactions_amount_nonneg check (amount_cents >= 0),
  constraint fi_financial_transactions_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_financial_transactions is
  'FinancialOS Phase 1: append-only master financial ledger. Every revenue event writes one row; no updates/deletes in application code.';

create index if not exists idx_fi_financial_transactions_tenant on public.fi_financial_transactions (tenant_id);
create index if not exists idx_fi_financial_transactions_tenant_created on public.fi_financial_transactions (tenant_id, created_at desc);
create index if not exists idx_fi_financial_transactions_tenant_kind on public.fi_financial_transactions (tenant_id, transaction_kind);
create index if not exists idx_fi_financial_transactions_invoice on public.fi_financial_transactions (tenant_id, invoice_id)
  where invoice_id is not null;
create index if not exists idx_fi_financial_transactions_payment on public.fi_financial_transactions (tenant_id, payment_id)
  where payment_id is not null;
create index if not exists idx_fi_financial_transactions_lead on public.fi_financial_transactions (tenant_id, lead_id)
  where lead_id is not null;
create unique index if not exists uq_fi_financial_transactions_idempotency
  on public.fi_financial_transactions (tenant_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

alter table public.fi_financial_transactions enable row level security;

drop policy if exists fi_financial_transactions_select_tenant_member on public.fi_financial_transactions;
create policy fi_financial_transactions_select_tenant_member
  on public.fi_financial_transactions for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_financial_transactions.tenant_id
    )
  );

grant select on public.fi_financial_transactions to authenticated, service_role;
grant insert on public.fi_financial_transactions to service_role;

-- ---------------------------------------------------------------------------
-- fi_payment_reconciliation — provider settlement matching
-- ---------------------------------------------------------------------------
create table if not exists public.fi_payment_reconciliation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  payment_id uuid references public.fi_payments (id) on delete set null,
  invoice_id uuid references public.fi_invoices (id) on delete set null,

  provider text not null,
  provider_transaction_id text,

  reconciliation_status text not null default 'pending'
    check (
      reconciliation_status in (
        'pending',
        'matched',
        'unmatched',
        'failed',
        'disputed'
      )
    ),

  failure_reason text,

  amount_cents bigint not null default 0,
  currency text not null default 'AUD',

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_payment_reconciliation_amount_nonneg check (amount_cents >= 0),
  constraint fi_payment_reconciliation_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_payment_reconciliation is
  'FinancialOS Phase 1: payment provider reconciliation (success/failure matching against fi_payments).';

create index if not exists idx_fi_payment_reconciliation_tenant on public.fi_payment_reconciliation (tenant_id);
create index if not exists idx_fi_payment_reconciliation_tenant_status on public.fi_payment_reconciliation (tenant_id, reconciliation_status);
create index if not exists idx_fi_payment_reconciliation_provider on public.fi_payment_reconciliation (tenant_id, provider, provider_transaction_id)
  where provider_transaction_id is not null;
create unique index if not exists uq_fi_payment_reconciliation_provider_tx
  on public.fi_payment_reconciliation (tenant_id, provider, provider_transaction_id)
  where provider_transaction_id is not null and provider_transaction_id <> '';

alter table public.fi_payment_reconciliation enable row level security;

drop policy if exists fi_payment_reconciliation_select_tenant_member on public.fi_payment_reconciliation;
create policy fi_payment_reconciliation_select_tenant_member
  on public.fi_payment_reconciliation for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payment_reconciliation.tenant_id
    )
  );

grant select on public.fi_payment_reconciliation to authenticated, service_role;
grant insert, update, delete on public.fi_payment_reconciliation to service_role;

drop trigger if exists trg_fi_payment_reconciliation_set_updated_at on public.fi_payment_reconciliation;
create trigger trg_fi_payment_reconciliation_set_updated_at
  before update on public.fi_payment_reconciliation
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- FK from ledger → reconciliation (deferred until reconciliation table exists).
alter table public.fi_financial_transactions drop constraint if exists fi_financial_transactions_reconciliation_fk;
alter table public.fi_financial_transactions
  add constraint fi_financial_transactions_reconciliation_fk
  foreign key (payment_reconciliation_id) references public.fi_payment_reconciliation (id) on delete set null;

-- ---------------------------------------------------------------------------
-- fi_financial_transaction_audit_events — append-only audit trail per ledger write
-- ---------------------------------------------------------------------------
create table if not exists public.fi_financial_transaction_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  financial_transaction_id uuid not null references public.fi_financial_transactions (id) on delete cascade,
  event_kind text not null default 'ledger_appended'
    check (event_kind in ('ledger_appended', 'reconciliation_linked')),
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_financial_transaction_audit_payload_object check (jsonb_typeof (payload) = 'object')
);

comment on table public.fi_financial_transaction_audit_events is
  'FinancialOS Phase 1: immutable audit log for every fi_financial_transactions append.';

create index if not exists idx_fi_financial_tx_audit_tenant on public.fi_financial_transaction_audit_events (tenant_id);
create index if not exists idx_fi_financial_tx_audit_tx on public.fi_financial_transaction_audit_events (financial_transaction_id);

alter table public.fi_financial_transaction_audit_events enable row level security;

drop policy if exists fi_financial_transaction_audit_select_tenant_member on public.fi_financial_transaction_audit_events;
create policy fi_financial_transaction_audit_select_tenant_member
  on public.fi_financial_transaction_audit_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_financial_transaction_audit_events.tenant_id
    )
  );

grant select on public.fi_financial_transaction_audit_events to authenticated, service_role;
grant insert on public.fi_financial_transaction_audit_events to service_role;
