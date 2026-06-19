-- FinancialOS Phase 1B — operational hardening (additive, production-safe).

-- Ledger append-only: service_role may INSERT only (no UPDATE/DELETE).
revoke update, delete on public.fi_financial_transactions from service_role;
revoke update, delete on public.fi_financial_transaction_audit_events from service_role;

-- Reconciliation amount mismatch tracking.
alter table public.fi_payment_reconciliation add column if not exists expected_amount_cents bigint;
alter table public.fi_payment_reconciliation add column if not exists received_amount_cents bigint;

comment on column public.fi_payment_reconciliation.expected_amount_cents is
  'Invoice/payment-request amount expected at reconciliation time (cents).';
comment on column public.fi_payment_reconciliation.received_amount_cents is
  'Provider-reported settled amount (cents). Mismatch → reconciliation_status unmatched.';

update public.fi_payment_reconciliation
set
  expected_amount_cents = coalesce(expected_amount_cents, amount_cents),
  received_amount_cents = coalesce(received_amount_cents, amount_cents)
where expected_amount_cents is null or received_amount_cents is null;

alter table public.fi_payment_reconciliation drop constraint if exists fi_payment_reconciliation_expected_nonneg;
alter table public.fi_payment_reconciliation
  add constraint fi_payment_reconciliation_expected_nonneg check (
    expected_amount_cents is null or expected_amount_cents >= 0
  );

alter table public.fi_payment_reconciliation drop constraint if exists fi_payment_reconciliation_received_nonneg;
alter table public.fi_payment_reconciliation
  add constraint fi_payment_reconciliation_received_nonneg check (
    received_amount_cents is null or received_amount_cents >= 0
  );

-- Audit event kinds for reconciliation mismatches.
alter table public.fi_financial_transaction_audit_events
  alter column financial_transaction_id drop not null;

alter table public.fi_financial_transaction_audit_events drop constraint if exists fi_financial_transaction_audit_events_event_kind_check;
alter table public.fi_financial_transaction_audit_events drop constraint if exists fi_financial_transaction_audit_event_kind_chk;
alter table public.fi_financial_transaction_audit_events
  add constraint fi_financial_transaction_audit_event_kind_chk check (
    event_kind in (
      'ledger_appended',
      'reconciliation_linked',
      'reconciliation_mismatch'
    )
  );

create index if not exists idx_fi_payment_reconciliation_unmatched on public.fi_payment_reconciliation (tenant_id, created_at desc)
  where reconciliation_status = 'unmatched';
