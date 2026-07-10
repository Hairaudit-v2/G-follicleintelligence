-- FinancialOS expenses Stage 8: double-entry journals + accounting push audit.
-- Additive only.

-- ---------------------------------------------------------------------------
-- fi_expense_journal_entries — balanced journal headers
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  expense_id uuid references public.fi_expenses (id) on delete set null,
  entry_date date not null,
  memo text,
  source text not null default 'expense_post'
    check (source in ('expense_post', 'expense_void', 'manual', 'import')),
  status text not null default 'posted'
    check (status in ('draft', 'posted', 'void')),
  currency text not null default 'AUD',
  total_debit_cents bigint not null default 0 check (total_debit_cents >= 0),
  total_credit_cents bigint not null default 0 check (total_credit_cents >= 0),

  idempotency_key text,
  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_expense_journal_entries_balanced check (total_debit_cents = total_credit_cents),
  constraint fi_expense_journal_entries_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_expense_journal_entries is
  'FinancialOS Stage 8: double-entry journal headers for posted/voided expenses (balanced).';

create unique index if not exists uq_fi_expense_journal_entries_idempotency
  on public.fi_expense_journal_entries (tenant_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';
create index if not exists idx_fi_expense_journal_entries_tenant_date
  on public.fi_expense_journal_entries (tenant_id, entry_date desc);
create index if not exists idx_fi_expense_journal_entries_expense
  on public.fi_expense_journal_entries (tenant_id, expense_id)
  where expense_id is not null;

alter table public.fi_expense_journal_entries enable row level security;

drop policy if exists fi_expense_journal_entries_select_tenant_member on public.fi_expense_journal_entries;
create policy fi_expense_journal_entries_select_tenant_member
  on public.fi_expense_journal_entries for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_journal_entries.tenant_id
    )
  );

grant select on public.fi_expense_journal_entries to authenticated, service_role;
grant insert, update, delete on public.fi_expense_journal_entries to service_role;

drop trigger if exists trg_fi_expense_journal_entries_set_updated_at on public.fi_expense_journal_entries;
create trigger trg_fi_expense_journal_entries_set_updated_at
  before update on public.fi_expense_journal_entries
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_expense_journal_lines
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_journal_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  journal_entry_id uuid not null references public.fi_expense_journal_entries (id) on delete cascade,
  gl_account_id uuid references public.fi_expense_gl_accounts (id) on delete set null,
  gl_account_code text,
  gl_account_name text,
  side text not null check (side in ('debit', 'credit')),
  amount_cents bigint not null check (amount_cents > 0),
  line_memo text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint fi_expense_journal_lines_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_expense_journal_lines is
  'FinancialOS Stage 8: debit/credit lines for expense journal entries.';

create index if not exists idx_fi_expense_journal_lines_entry
  on public.fi_expense_journal_lines (tenant_id, journal_entry_id);
create index if not exists idx_fi_expense_journal_lines_gl
  on public.fi_expense_journal_lines (tenant_id, gl_account_id)
  where gl_account_id is not null;

alter table public.fi_expense_journal_lines enable row level security;

drop policy if exists fi_expense_journal_lines_select_tenant_member on public.fi_expense_journal_lines;
create policy fi_expense_journal_lines_select_tenant_member
  on public.fi_expense_journal_lines for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_journal_lines.tenant_id
    )
  );

grant select on public.fi_expense_journal_lines to authenticated, service_role;
grant insert, update, delete on public.fi_expense_journal_lines to service_role;

-- Link expenses to journals
alter table public.fi_expenses
  add column if not exists journal_entry_id uuid
    references public.fi_expense_journal_entries (id) on delete set null;
alter table public.fi_expenses
  add column if not exists journal_void_entry_id uuid
    references public.fi_expense_journal_entries (id) on delete set null;

-- Accounting push audit runs
create table if not exists public.fi_expense_accounting_push_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  provider text not null check (provider in ('quickbooks', 'xero')),
  mode text not null default 'dry_run' check (mode in ('dry_run', 'live')),
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed', 'partial')),
  period_start date,
  period_end date,
  attempted_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint fi_expense_accounting_push_runs_detail_object check (jsonb_typeof(detail) = 'object')
);

comment on table public.fi_expense_accounting_push_runs is
  'FinancialOS Stage 8: audit log of accounting export/push attempts (dry-run or live).';

create index if not exists idx_fi_expense_accounting_push_runs_tenant
  on public.fi_expense_accounting_push_runs (tenant_id, created_at desc);

alter table public.fi_expense_accounting_push_runs enable row level security;

drop policy if exists fi_expense_accounting_push_runs_select_tenant_member
  on public.fi_expense_accounting_push_runs;
create policy fi_expense_accounting_push_runs_select_tenant_member
  on public.fi_expense_accounting_push_runs for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_accounting_push_runs.tenant_id
    )
  );

grant select on public.fi_expense_accounting_push_runs to authenticated, service_role;
grant insert on public.fi_expense_accounting_push_runs to service_role;
