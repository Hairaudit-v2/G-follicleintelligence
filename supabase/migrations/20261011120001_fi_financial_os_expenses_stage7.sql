-- FinancialOS expenses Stage 7: chart of accounts (light), bank recon match persistence.
-- Additive only.

-- ---------------------------------------------------------------------------
-- fi_expense_gl_accounts — tenant chart of accounts (light)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_gl_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  code text not null,
  name text not null,
  account_type text not null default 'expense'
    check (account_type in ('revenue', 'expense', 'asset', 'liability', 'equity', 'cogs')),
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  external_quickbooks_id text,
  external_xero_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_expense_gl_accounts_code_nonempty check (length(trim(code)) > 0),
  constraint fi_expense_gl_accounts_name_nonempty check (length(trim(name)) > 0),
  constraint fi_expense_gl_accounts_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_expense_gl_accounts is
  'FinancialOS Stage 7: lightweight chart of accounts for expense mapping and multi-clinic P&L.';

create unique index if not exists uq_fi_expense_gl_accounts_tenant_code
  on public.fi_expense_gl_accounts (tenant_id, lower(code));
create index if not exists idx_fi_expense_gl_accounts_tenant
  on public.fi_expense_gl_accounts (tenant_id);

alter table public.fi_expense_gl_accounts enable row level security;

drop policy if exists fi_expense_gl_accounts_select_tenant_member on public.fi_expense_gl_accounts;
create policy fi_expense_gl_accounts_select_tenant_member
  on public.fi_expense_gl_accounts for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_gl_accounts.tenant_id
    )
  );

grant select on public.fi_expense_gl_accounts to authenticated, service_role;
grant insert, update, delete on public.fi_expense_gl_accounts to service_role;

drop trigger if exists trg_fi_expense_gl_accounts_set_updated_at on public.fi_expense_gl_accounts;
create trigger trg_fi_expense_gl_accounts_set_updated_at
  before update on public.fi_expense_gl_accounts
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- Link expense categories → GL accounts
alter table public.fi_expense_categories
  add column if not exists gl_account_id uuid
    references public.fi_expense_gl_accounts (id) on delete set null;

create index if not exists idx_fi_expense_categories_gl_account
  on public.fi_expense_categories (tenant_id, gl_account_id)
  where gl_account_id is not null;

-- Optional GL account on expense rows
alter table public.fi_expenses
  add column if not exists gl_account_id uuid
    references public.fi_expense_gl_accounts (id) on delete set null;

create index if not exists idx_fi_expenses_gl_account
  on public.fi_expenses (tenant_id, gl_account_id)
  where gl_account_id is not null;

-- ---------------------------------------------------------------------------
-- fi_expense_bank_recon_matches — suggested/confirmed bank line ↔ expense links
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_bank_recon_matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  import_line_id uuid not null references public.fi_expense_import_lines (id) on delete cascade,
  expense_id uuid not null references public.fi_expenses (id) on delete cascade,

  status text not null default 'suggested'
    check (status in ('suggested', 'confirmed', 'rejected')),
  confidence numeric,
  match_reason text,
  notes text,

  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  confirmed_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  confirmed_at timestamptz,
  rejected_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_expense_bank_recon_matches_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint fi_expense_bank_recon_matches_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_expense_bank_recon_matches is
  'FinancialOS Stage 7: persisted bank import line ↔ expense reconciliation matches.';

create unique index if not exists uq_fi_expense_bank_recon_line_expense
  on public.fi_expense_bank_recon_matches (tenant_id, import_line_id, expense_id);
create unique index if not exists uq_fi_expense_bank_recon_line_active
  on public.fi_expense_bank_recon_matches (tenant_id, import_line_id)
  where status in ('suggested', 'confirmed');
create index if not exists idx_fi_expense_bank_recon_tenant_status
  on public.fi_expense_bank_recon_matches (tenant_id, status);

alter table public.fi_expense_bank_recon_matches enable row level security;

drop policy if exists fi_expense_bank_recon_matches_select_tenant_member
  on public.fi_expense_bank_recon_matches;
create policy fi_expense_bank_recon_matches_select_tenant_member
  on public.fi_expense_bank_recon_matches for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_bank_recon_matches.tenant_id
    )
  );

grant select on public.fi_expense_bank_recon_matches to authenticated, service_role;
grant insert, update, delete on public.fi_expense_bank_recon_matches to service_role;

drop trigger if exists trg_fi_expense_bank_recon_matches_set_updated_at
  on public.fi_expense_bank_recon_matches;
create trigger trg_fi_expense_bank_recon_matches_set_updated_at
  before update on public.fi_expense_bank_recon_matches
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- External accounting correlation on expenses
alter table public.fi_expenses
  add column if not exists external_quickbooks_id text;
alter table public.fi_expenses
  add column if not exists external_xero_id text;
alter table public.fi_expenses
  add column if not exists last_accounting_export_at timestamptz;
alter table public.fi_expenses
  add column if not exists last_accounting_export_provider text;

comment on column public.fi_expenses.external_quickbooks_id is
  'Stage 7: QuickBooks purchase/expense Id when pushed or imported.';
comment on column public.fi_expenses.external_xero_id is
  'Stage 7: Xero bank transaction / purchase Id when pushed or imported.';

-- Allow QuickBooks provider on tenant external integrations CHECK
alter table public.fi_tenant_external_integrations
  drop constraint if exists fi_tenant_external_integrations_provider_chk;

alter table public.fi_tenant_external_integrations
  add constraint fi_tenant_external_integrations_provider_chk check (
    provider in (
      'pabau',
      'cliniko',
      'hubspot',
      'google_calendar',
      'microsoft_outlook',
      'stripe',
      'xero',
      'quickbooks',
      'meta_ads',
      'google_ads'
    )
  );
