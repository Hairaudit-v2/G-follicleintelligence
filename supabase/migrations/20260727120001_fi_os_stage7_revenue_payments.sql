-- FI OS Stage 7: RevenueOS / PaymentsOS foundation (additive).
-- Invoicing, deposits, payment requests, deposit rules, webhook audit — separate from `fi_payment_records` (manual tracking).
-- Mutations: trusted Next.js service_role; authenticated: tenant-scoped SELECT.

-- ---------------------------------------------------------------------------
-- fi_invoices
-- ---------------------------------------------------------------------------
create table if not exists public.fi_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  consultation_id uuid references public.fi_consultations (id) on delete set null,
  invoice_kind text not null default 'other'
    check (
      invoice_kind in (
        'consultation_quote',
        'surgery_deposit',
        'surgery_balance',
        'adjustment',
        'other'
      )
    ),
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'issued',
        'partially_paid',
        'paid',
        'overdue',
        'cancelled',
        'refunded'
      )
    ),
  amount_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  amount_paid_cents bigint not null default 0,
  currency text not null default 'AUD',
  due_date date,
  issued_at timestamptz,
  invoice_number text,
  title text,
  internal_notes text,
  cancelled_at timestamptz,
  cancelled_reason text,
  -- Reminder / automation hints for future cron (no auto-send by default).
  automation_hints jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_invoices_amounts_nonnegative check (
    amount_cents >= 0
    and tax_cents >= 0
    and total_cents >= 0
    and amount_paid_cents >= 0
  ),
  constraint fi_invoices_metadata_object check (jsonb_typeof (metadata) = 'object'),
  constraint fi_invoices_automation_hints_object check (jsonb_typeof (automation_hints) = 'object')
);

comment on table public.fi_invoices is
  'FI OS Stage 7: tenant invoices (AUD-first cents; multi-currency via currency code). Service-role writes; explainable statuses.';

comment on column public.fi_invoices.automation_hints is
  'Optional structure for reminder automation (e.g. deposit_due_reminder_days, balance_due_reminder_days, overdue_reminder_enabled). Cron must respect templates and consent.';

create index if not exists idx_fi_invoices_tenant on public.fi_invoices (tenant_id);
create index if not exists idx_fi_invoices_tenant_patient on public.fi_invoices (tenant_id, patient_id)
  where patient_id is not null;
create index if not exists idx_fi_invoices_tenant_case on public.fi_invoices (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_invoices_tenant_status on public.fi_invoices (tenant_id, status);
create index if not exists idx_fi_invoices_tenant_due on public.fi_invoices (tenant_id, due_date)
  where due_date is not null;

create unique index if not exists uq_fi_invoices_tenant_number
  on public.fi_invoices (tenant_id, invoice_number)
  where invoice_number is not null;

alter table public.fi_invoices enable row level security;

drop policy if exists fi_invoices_select_tenant_member on public.fi_invoices;
create policy fi_invoices_select_tenant_member
  on public.fi_invoices for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_invoices.tenant_id
    )
  );

grant select on public.fi_invoices to authenticated, service_role;
grant insert, update, delete on public.fi_invoices to service_role;

drop trigger if exists trg_fi_invoices_set_updated_at on public.fi_invoices;
create trigger trg_fi_invoices_set_updated_at
  before update on public.fi_invoices
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_invoice_items
-- ---------------------------------------------------------------------------
create table if not exists public.fi_invoice_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  invoice_id uuid not null references public.fi_invoices (id) on delete cascade,
  sort_index integer not null default 0,
  description text not null,
  quantity numeric(12, 4) not null default 1,
  unit_amount_cents bigint not null default 0,
  line_tax_cents bigint not null default 0,
  line_total_cents bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_invoice_items_line_nonneg check (
    unit_amount_cents >= 0
    and line_tax_cents >= 0
    and line_total_cents >= 0
  ),
  constraint fi_invoice_items_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_invoice_items is 'FI OS Stage 7: invoice line items (tenant denormalized for indexing).';

create index if not exists idx_fi_invoice_items_tenant on public.fi_invoice_items (tenant_id);
create index if not exists idx_fi_invoice_items_invoice on public.fi_invoice_items (invoice_id, sort_index);

alter table public.fi_invoice_items enable row level security;

drop policy if exists fi_invoice_items_select_tenant_member on public.fi_invoice_items;
create policy fi_invoice_items_select_tenant_member
  on public.fi_invoice_items for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_invoice_items.tenant_id
    )
  );

grant select on public.fi_invoice_items to authenticated, service_role;
grant insert, update, delete on public.fi_invoice_items to service_role;

drop trigger if exists trg_fi_invoice_items_set_updated_at on public.fi_invoice_items;
create trigger trg_fi_invoice_items_set_updated_at
  before update on public.fi_invoice_items
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_payments
-- ---------------------------------------------------------------------------
create table if not exists public.fi_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  consultation_id uuid references public.fi_consultations (id) on delete set null,
  invoice_id uuid not null references public.fi_invoices (id) on delete cascade,
  payment_request_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'refunded', 'manually_recorded')),
  amount_cents bigint not null,
  tax_cents bigint not null default 0,
  total_cents bigint not null,
  currency text not null default 'AUD',
  provider text,
  provider_ref text,
  provider_payment_intent_id text,
  recorded_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_payments_amounts_nonneg check (amount_cents >= 0 and tax_cents >= 0 and total_cents >= 0),
  constraint fi_payments_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_payments is 'FI OS Stage 7: payments allocated to invoices (gateway or manual).';

create index if not exists idx_fi_payments_tenant on public.fi_payments (tenant_id);
create index if not exists idx_fi_payments_tenant_invoice on public.fi_payments (tenant_id, invoice_id);
create index if not exists idx_fi_payments_tenant_status on public.fi_payments (tenant_id, status);
create index if not exists idx_fi_payments_tenant_patient on public.fi_payments (tenant_id, patient_id)
  where patient_id is not null;
create index if not exists idx_fi_payments_tenant_case on public.fi_payments (tenant_id, case_id)
  where case_id is not null;

alter table public.fi_payments enable row level security;

drop policy if exists fi_payments_select_tenant_member on public.fi_payments;
create policy fi_payments_select_tenant_member
  on public.fi_payments for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payments.tenant_id
    )
  );

grant select on public.fi_payments to authenticated, service_role;
grant insert, update, delete on public.fi_payments to service_role;

drop trigger if exists trg_fi_payments_set_updated_at on public.fi_payments;
create trigger trg_fi_payments_set_updated_at
  before update on public.fi_payments
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_payment_requests (fi_payments.payment_request_id FK added below)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_payment_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  consultation_id uuid references public.fi_consultations (id) on delete set null,
  invoice_id uuid not null references public.fi_invoices (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'paid', 'expired', 'cancelled')),
  amount_cents bigint not null,
  tax_cents bigint not null default 0,
  total_cents bigint not null,
  currency text not null default 'AUD',
  sent_at timestamptz,
  viewed_at timestamptz,
  expires_at timestamptz,
  provider text,
  provider_checkout_session_id text,
  checkout_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_payment_requests_amounts_nonneg check (amount_cents >= 0 and tax_cents >= 0 and total_cents >= 0),
  constraint fi_payment_requests_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_payment_requests is 'FI OS Stage 7: payment links / checkout requests for invoices.';

create index if not exists idx_fi_payment_requests_tenant on public.fi_payment_requests (tenant_id);
create index if not exists idx_fi_payment_requests_tenant_invoice on public.fi_payment_requests (tenant_id, invoice_id);
create index if not exists idx_fi_payment_requests_tenant_status on public.fi_payment_requests (tenant_id, status);

alter table public.fi_payment_requests enable row level security;

drop policy if exists fi_payment_requests_select_tenant_member on public.fi_payment_requests;
create policy fi_payment_requests_select_tenant_member
  on public.fi_payment_requests for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payment_requests.tenant_id
    )
  );

grant select on public.fi_payment_requests to authenticated, service_role;
grant insert, update, delete on public.fi_payment_requests to service_role;

drop trigger if exists trg_fi_payment_requests_set_updated_at on public.fi_payment_requests;
create trigger trg_fi_payment_requests_set_updated_at
  before update on public.fi_payment_requests
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- FK from fi_payments → fi_payment_requests (created after both tables exist).
-- Idempotent: DBs that already applied this FK out-of-band (or partial push) must not fail here.
alter table public.fi_payments
  drop constraint if exists fi_payments_payment_request_fk;

alter table public.fi_payments
  add constraint fi_payments_payment_request_fk
  foreign key (payment_request_id) references public.fi_payment_requests (id) on delete set null;

-- ---------------------------------------------------------------------------
-- fi_deposit_rules
-- ---------------------------------------------------------------------------
create table if not exists public.fi_deposit_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,
  name text not null,
  priority integer not null default 0,
  rule_kind text not null default 'manual_only'
    check (rule_kind in ('percent_of_procedure_fee', 'fixed_cents', 'manual_only')),
  percent_bp integer,
  fixed_amount_cents bigint,
  -- When true, unpaid deposit invoice surfaces as a soft readiness signal (staff-overridable).
  blocks_surgery_readiness_when_unpaid boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_deposit_rules_percent_bp check (percent_bp is null or (percent_bp >= 0 and percent_bp <= 10000)),
  constraint fi_deposit_rules_fixed_nonneg check (fixed_amount_cents is null or fixed_amount_cents >= 0),
  constraint fi_deposit_rules_metadata_object check (jsonb_typeof (metadata) = 'object')
);

-- Older DBs may already have `fi_deposit_rules` from a partial apply; `CREATE TABLE IF NOT EXISTS` skips
-- every column. Bring the table up to this migration's shape before indexes / checks.
alter table public.fi_deposit_rules add column if not exists clinic_id uuid references public.fi_clinics (id) on delete set null;
alter table public.fi_deposit_rules add column if not exists name text not null default '';
alter table public.fi_deposit_rules add column if not exists priority integer not null default 0;
alter table public.fi_deposit_rules add column if not exists rule_kind text not null default 'manual_only';
alter table public.fi_deposit_rules add column if not exists percent_bp integer;
alter table public.fi_deposit_rules add column if not exists fixed_amount_cents bigint;
alter table public.fi_deposit_rules add column if not exists blocks_surgery_readiness_when_unpaid boolean not null default false;
alter table public.fi_deposit_rules add column if not exists is_active boolean not null default true;
alter table public.fi_deposit_rules add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.fi_deposit_rules add column if not exists created_at timestamptz not null default now();
alter table public.fi_deposit_rules add column if not exists updated_at timestamptz not null default now();

alter table public.fi_deposit_rules drop constraint if exists fi_deposit_rules_percent_bp;
alter table public.fi_deposit_rules
  add constraint fi_deposit_rules_percent_bp check (percent_bp is null or (percent_bp >= 0 and percent_bp <= 10000));

alter table public.fi_deposit_rules drop constraint if exists fi_deposit_rules_fixed_nonneg;
alter table public.fi_deposit_rules
  add constraint fi_deposit_rules_fixed_nonneg check (fixed_amount_cents is null or fixed_amount_cents >= 0);

alter table public.fi_deposit_rules drop constraint if exists fi_deposit_rules_metadata_object;
alter table public.fi_deposit_rules
  add constraint fi_deposit_rules_metadata_object check (jsonb_typeof (metadata) = 'object');

alter table public.fi_deposit_rules drop constraint if exists fi_deposit_rules_rule_kind_check;
alter table public.fi_deposit_rules drop constraint if exists fi_deposit_rules_rule_kind_chk;
alter table public.fi_deposit_rules
  add constraint fi_deposit_rules_rule_kind_chk check (
    rule_kind in ('percent_of_procedure_fee', 'fixed_cents', 'manual_only')
  );

comment on table public.fi_deposit_rules is
  'FI OS Stage 7: configurable deposit hints (percent/fixed/manual). Staff may override; never auto-charges.';

create index if not exists idx_fi_deposit_rules_tenant on public.fi_deposit_rules (tenant_id);
create index if not exists idx_fi_deposit_rules_tenant_priority on public.fi_deposit_rules (tenant_id, priority desc);
create index if not exists idx_fi_deposit_rules_tenant_active on public.fi_deposit_rules (tenant_id, is_active)
  where is_active = true;

alter table public.fi_deposit_rules enable row level security;

drop policy if exists fi_deposit_rules_select_tenant_member on public.fi_deposit_rules;
create policy fi_deposit_rules_select_tenant_member
  on public.fi_deposit_rules for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_deposit_rules.tenant_id
    )
  );

grant select on public.fi_deposit_rules to authenticated, service_role;
grant insert, update, delete on public.fi_deposit_rules to service_role;

drop trigger if exists trg_fi_deposit_rules_set_updated_at on public.fi_deposit_rules;
create trigger trg_fi_deposit_rules_set_updated_at
  before update on public.fi_deposit_rules
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_payment_webhook_events
-- ---------------------------------------------------------------------------
create table if not exists public.fi_payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete set null,
  provider text not null,
  provider_event_id text,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'ignored', 'error')),
  error_message text,
  related_payment_id uuid references public.fi_payments (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_payment_webhook_events_payload_object check (jsonb_typeof (payload) = 'object'),
  constraint fi_payment_webhook_events_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_payment_webhook_events is
  'FI OS Stage 7: raw provider webhook audit (insert via service_role only).';

create index if not exists idx_fi_payment_webhook_events_tenant on public.fi_payment_webhook_events (tenant_id)
  where tenant_id is not null;
create index if not exists idx_fi_payment_webhook_events_provider on public.fi_payment_webhook_events (provider, created_at desc);
create unique index if not exists uq_fi_payment_webhook_events_provider_event
  on public.fi_payment_webhook_events (provider, provider_event_id)
  where provider_event_id is not null;

alter table public.fi_payment_webhook_events enable row level security;

-- Webhook audit is server-only (no broad authenticated reads of raw provider payloads).
revoke all on public.fi_payment_webhook_events from authenticated;

grant select, insert, update, delete on public.fi_payment_webhook_events to service_role;

drop trigger if exists trg_fi_payment_webhook_events_set_updated_at on public.fi_payment_webhook_events;
create trigger trg_fi_payment_webhook_events_set_updated_at
  before update on public.fi_payment_webhook_events
  for each row
  execute procedure public.fi_os_stage35_set_updated_at();
