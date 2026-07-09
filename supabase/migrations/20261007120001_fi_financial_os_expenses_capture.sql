-- FinancialOS Expenses Capture Phase 1 (additive, production-safe).
-- Clinic opex capture: categories, imports, draft lines, expenses, documents, audit.
-- Does NOT modify fi_financial_transactions / revenue ledger invariants.

-- ---------------------------------------------------------------------------
-- fi_expense_categories
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  code text not null,
  label text not null,
  parent_id uuid references public.fi_expense_categories (id) on delete set null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_expense_categories_code_nonempty check (length(trim(code)) > 0),
  constraint fi_expense_categories_label_nonempty check (length(trim(label)) > 0),
  constraint fi_expense_categories_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_expense_categories is
  'FinancialOS expenses Phase 1: tenant expense category tree (system defaults seeded by application).';

create unique index if not exists uq_fi_expense_categories_tenant_code
  on public.fi_expense_categories (tenant_id, lower(code));
create index if not exists idx_fi_expense_categories_tenant
  on public.fi_expense_categories (tenant_id);
create index if not exists idx_fi_expense_categories_tenant_active
  on public.fi_expense_categories (tenant_id, is_active)
  where is_active = true;

alter table public.fi_expense_categories enable row level security;

drop policy if exists fi_expense_categories_select_tenant_member on public.fi_expense_categories;
create policy fi_expense_categories_select_tenant_member
  on public.fi_expense_categories for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_categories.tenant_id
    )
  );

grant select on public.fi_expense_categories to authenticated, service_role;
grant insert, update, delete on public.fi_expense_categories to service_role;

drop trigger if exists trg_fi_expense_categories_set_updated_at on public.fi_expense_categories;
create trigger trg_fi_expense_categories_set_updated_at
  before update on public.fi_expense_categories
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_expense_imports
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  source_type text not null
    check (source_type in ('bank_csv', 'card_csv', 'receipt_batch', 'manual_bulk', 'api')),
  status text not null default 'uploaded'
    check (
      status in (
        'uploaded',
        'parsing',
        'ready_for_review',
        'committed',
        'failed',
        'cancelled'
      )
    ),

  original_filename text,
  storage_bucket text,
  storage_path text,
  row_count integer not null default 0 check (row_count >= 0),
  error_summary text,

  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint fi_expense_imports_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_expense_imports is
  'FinancialOS expenses Phase 1: batch import container for bank/card CSVs and receipt batches.';

create index if not exists idx_fi_expense_imports_tenant
  on public.fi_expense_imports (tenant_id);
create index if not exists idx_fi_expense_imports_tenant_status
  on public.fi_expense_imports (tenant_id, status);
create index if not exists idx_fi_expense_imports_tenant_created
  on public.fi_expense_imports (tenant_id, created_at desc);

alter table public.fi_expense_imports enable row level security;

drop policy if exists fi_expense_imports_select_tenant_member on public.fi_expense_imports;
create policy fi_expense_imports_select_tenant_member
  on public.fi_expense_imports for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_imports.tenant_id
    )
  );

grant select on public.fi_expense_imports to authenticated, service_role;
grant insert, update, delete on public.fi_expense_imports to service_role;

drop trigger if exists trg_fi_expense_imports_set_updated_at on public.fi_expense_imports;
create trigger trg_fi_expense_imports_set_updated_at
  before update on public.fi_expense_imports
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_expense_import_lines
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_import_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  import_id uuid not null references public.fi_expense_imports (id) on delete cascade,

  line_index integer not null check (line_index >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'accepted', 'rejected', 'duplicate', 'committed')),

  transaction_date date,
  description_raw text,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null default 'AUD',
  external_ref text,
  merchant_hint text,

  category_id uuid references public.fi_expense_categories (id) on delete set null,
  suggested_category_id uuid references public.fi_expense_categories (id) on delete set null,
  confidence numeric,
  vendor_name text,

  clinic_id uuid references public.fi_clinics (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,

  receipt_storage_path text,
  parse_warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_expense_import_lines_parse_warnings_array
    check (jsonb_typeof(parse_warnings) = 'array'),
  constraint fi_expense_import_lines_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint fi_expense_import_lines_confidence_range
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

comment on table public.fi_expense_import_lines is
  'FinancialOS expenses Phase 1: draft lines from CSV/OCR awaiting review before fi_expenses commit.';

create unique index if not exists uq_fi_expense_import_lines_import_index
  on public.fi_expense_import_lines (tenant_id, import_id, line_index);
create index if not exists idx_fi_expense_import_lines_tenant_import
  on public.fi_expense_import_lines (tenant_id, import_id);
create index if not exists idx_fi_expense_import_lines_tenant_status
  on public.fi_expense_import_lines (tenant_id, status);
create unique index if not exists uq_fi_expense_import_lines_external_ref
  on public.fi_expense_import_lines (tenant_id, external_ref)
  where external_ref is not null and external_ref <> '';

alter table public.fi_expense_import_lines enable row level security;

drop policy if exists fi_expense_import_lines_select_tenant_member on public.fi_expense_import_lines;
create policy fi_expense_import_lines_select_tenant_member
  on public.fi_expense_import_lines for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_import_lines.tenant_id
    )
  );

grant select on public.fi_expense_import_lines to authenticated, service_role;
grant insert, update, delete on public.fi_expense_import_lines to service_role;

drop trigger if exists trg_fi_expense_import_lines_set_updated_at on public.fi_expense_import_lines;
create trigger trg_fi_expense_import_lines_set_updated_at
  before update on public.fi_expense_import_lines
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_expenses
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'posted', 'void')),

  expense_date date not null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'AUD',
  vendor_name text,
  description text,

  category_id uuid references public.fi_expense_categories (id) on delete set null,
  payment_method text
    check (
      payment_method is null
      or payment_method in ('card', 'bank', 'cash', 'direct_debit', 'other')
    ),

  source_import_line_id uuid references public.fi_expense_import_lines (id) on delete set null,

  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,
  consultation_id uuid references public.fi_consultations (id) on delete set null,

  campaign_key text,
  procedure_type text,

  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  reviewed_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  posted_at timestamptz,
  voided_at timestamptz,

  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_expense_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.fi_expenses is
  'FinancialOS expenses Phase 1: clinic opex records (draft → reviewed → posted). No revenue ledger write yet.';

create index if not exists idx_fi_expenses_tenant on public.fi_expenses (tenant_id);
create index if not exists idx_fi_expenses_tenant_status on public.fi_expenses (tenant_id, status);
create index if not exists idx_fi_expenses_tenant_date on public.fi_expenses (tenant_id, expense_date desc);
create index if not exists idx_fi_expenses_tenant_category on public.fi_expenses (tenant_id, category_id)
  where category_id is not null;
create index if not exists idx_fi_expenses_tenant_campaign on public.fi_expenses (tenant_id, campaign_key)
  where campaign_key is not null and campaign_key <> '';
create unique index if not exists uq_fi_expenses_idempotency
  on public.fi_expenses (tenant_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';
create unique index if not exists uq_fi_expenses_source_import_line
  on public.fi_expenses (tenant_id, source_import_line_id)
  where source_import_line_id is not null;

alter table public.fi_expenses enable row level security;

drop policy if exists fi_expenses_select_tenant_member on public.fi_expenses;
create policy fi_expenses_select_tenant_member
  on public.fi_expenses for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expenses.tenant_id
    )
  );

grant select on public.fi_expenses to authenticated, service_role;
grant insert, update, delete on public.fi_expenses to service_role;

drop trigger if exists trg_fi_expenses_set_updated_at on public.fi_expenses;
create trigger trg_fi_expenses_set_updated_at
  before update on public.fi_expenses
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_expense_documents
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  expense_id uuid references public.fi_expenses (id) on delete set null,
  import_id uuid references public.fi_expense_imports (id) on delete set null,

  doc_kind text not null
    check (doc_kind in ('receipt', 'invoice', 'bank_csv', 'other')),
  storage_bucket text not null,
  storage_path text not null,
  content_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),

  ocr_status text not null default 'none'
    check (ocr_status in ('none', 'pending', 'processing', 'succeeded', 'failed', 'skipped')),
  ocr_provider text,
  ocr_payload jsonb not null default '{}'::jsonb,

  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint fi_expense_documents_ocr_payload_object check (jsonb_typeof(ocr_payload) = 'object'),
  constraint fi_expense_documents_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint fi_expense_documents_storage_nonempty check (
    length(trim(storage_bucket)) > 0 and length(trim(storage_path)) > 0
  )
);

comment on table public.fi_expense_documents is
  'FinancialOS expenses Phase 1: receipt/invoice/CSV blobs and OCR job state.';

create index if not exists idx_fi_expense_documents_tenant on public.fi_expense_documents (tenant_id);
create index if not exists idx_fi_expense_documents_expense on public.fi_expense_documents (tenant_id, expense_id)
  where expense_id is not null;
create index if not exists idx_fi_expense_documents_import on public.fi_expense_documents (tenant_id, import_id)
  where import_id is not null;
create index if not exists idx_fi_expense_documents_ocr_pending
  on public.fi_expense_documents (tenant_id, ocr_status)
  where ocr_status in ('pending', 'processing');

alter table public.fi_expense_documents enable row level security;

drop policy if exists fi_expense_documents_select_tenant_member on public.fi_expense_documents;
create policy fi_expense_documents_select_tenant_member
  on public.fi_expense_documents for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_documents.tenant_id
    )
  );

grant select on public.fi_expense_documents to authenticated, service_role;
grant insert, update, delete on public.fi_expense_documents to service_role;

-- ---------------------------------------------------------------------------
-- fi_expense_audit_events (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_expense_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  expense_id uuid references public.fi_expenses (id) on delete set null,
  import_id uuid references public.fi_expense_imports (id) on delete set null,
  import_line_id uuid references public.fi_expense_import_lines (id) on delete set null,

  action text not null,
  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  previous jsonb not null default '{}'::jsonb,
  next jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint fi_expense_audit_events_action_nonempty check (length(trim(action)) > 0),
  constraint fi_expense_audit_events_previous_object check (jsonb_typeof(previous) = 'object'),
  constraint fi_expense_audit_events_next_object check (jsonb_typeof(next) = 'object')
);

comment on table public.fi_expense_audit_events is
  'FinancialOS expenses Phase 1: append-only audit for expense/import lifecycle events.';

create index if not exists idx_fi_expense_audit_events_tenant_created
  on public.fi_expense_audit_events (tenant_id, created_at desc);
create index if not exists idx_fi_expense_audit_events_expense
  on public.fi_expense_audit_events (tenant_id, expense_id)
  where expense_id is not null;

alter table public.fi_expense_audit_events enable row level security;

drop policy if exists fi_expense_audit_events_select_tenant_member on public.fi_expense_audit_events;
create policy fi_expense_audit_events_select_tenant_member
  on public.fi_expense_audit_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_expense_audit_events.tenant_id
    )
  );

grant select on public.fi_expense_audit_events to authenticated, service_role;
grant insert on public.fi_expense_audit_events to service_role;
-- No UPDATE/DELETE grants — append-only at the privilege layer.
