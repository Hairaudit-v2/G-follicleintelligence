-- FinancialOS expenses Stage 4: allow expense_posted / expense_void_reversal on master ledger.
-- Additive only — expands transaction_kind CHECK; no row rewrites.

alter table public.fi_financial_transactions
  drop constraint if exists fi_financial_transactions_transaction_kind_check;

alter table public.fi_financial_transactions
  drop constraint if exists fi_financial_transactions_transaction_kind_chk;

-- Postgres may have auto-named the check; drop any check that constrains transaction_kind.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'fi_financial_transactions'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%transaction_kind%'
  loop
    execute format('alter table public.fi_financial_transactions drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.fi_financial_transactions
  add constraint fi_financial_transactions_transaction_kind_chk check (
    transaction_kind in (
      'invoice_created',
      'payment_received',
      'refund_processed',
      'deposit_paid',
      'balance_paid',
      'cancellation_fee',
      'expense_posted',
      'expense_void_reversal'
    )
  );

comment on table public.fi_financial_transactions is
  'FinancialOS master financial ledger (append-only). Includes expense_posted (debit opex) and expense_void_reversal (credit compensating entry).';

-- Optional convenience column on expenses for post ledger link (nullable, additive).
alter table public.fi_expenses
  add column if not exists ledger_post_transaction_id uuid
    references public.fi_financial_transactions (id) on delete set null;

alter table public.fi_expenses
  add column if not exists ledger_void_transaction_id uuid
    references public.fi_financial_transactions (id) on delete set null;

comment on column public.fi_expenses.ledger_post_transaction_id is
  'Stage 4: fi_financial_transactions.id for expense_posted debit when status=posted.';
comment on column public.fi_expenses.ledger_void_transaction_id is
  'Stage 4: compensating credit transaction when a posted expense is voided.';

create index if not exists idx_fi_expenses_ledger_post
  on public.fi_expenses (tenant_id, ledger_post_transaction_id)
  where ledger_post_transaction_id is not null;
