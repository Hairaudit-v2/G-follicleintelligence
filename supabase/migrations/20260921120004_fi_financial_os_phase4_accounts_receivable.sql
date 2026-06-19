-- FinancialOS Phase 4 (additive, production-safe): Accounts Receivable + Collections Intelligence.
-- Tenant-scoped AR cases with append-only event ledger. No destructive writes on events.

-- ---------------------------------------------------------------------------
-- fi_accounts_receivable_cases
-- ---------------------------------------------------------------------------
create table if not exists public.fi_accounts_receivable_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  invoice_id uuid references public.fi_invoices (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  assigned_fi_user_id uuid references public.fi_users (id) on delete set null,

  receivable_type text not null
    check (receivable_type in (
      'consultation_invoice',
      'surgery_deposit',
      'surgery_balance',
      'treatment_package',
      'subscription',
      'cancellation_fee'
    )),

  original_amount_cents integer not null check (original_amount_cents >= 0),
  outstanding_amount_cents integer not null check (outstanding_amount_cents >= 0),
  days_overdue integer not null default 0 check (days_overdue >= 0),

  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),

  status text not null default 'open'
    check (status in (
      'open',
      'reminder_sent',
      'call_required',
      'payment_plan',
      'escalated',
      'resolved',
      'written_off'
    )),

  next_action_at timestamptz,
  last_contacted_at timestamptz,

  source_metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint fi_accounts_receivable_cases_source_metadata_object
    check (jsonb_typeof (source_metadata) = 'object')
);

comment on table public.fi_accounts_receivable_cases is
  'FinancialOS Phase 4: tenant-scoped accounts receivable / collections cases. Mutable status; audit via fi_accounts_receivable_events.';

create index if not exists idx_fi_ar_cases_tenant on public.fi_accounts_receivable_cases (tenant_id);
create index if not exists idx_fi_ar_cases_tenant_status on public.fi_accounts_receivable_cases (tenant_id, status);
create index if not exists idx_fi_ar_cases_tenant_risk on public.fi_accounts_receivable_cases (tenant_id, risk_level);
create index if not exists idx_fi_ar_cases_tenant_type on public.fi_accounts_receivable_cases (tenant_id, receivable_type);
create index if not exists idx_fi_ar_cases_assigned on public.fi_accounts_receivable_cases (assigned_fi_user_id)
  where assigned_fi_user_id is not null;
create index if not exists idx_fi_ar_cases_next_action on public.fi_accounts_receivable_cases (tenant_id, next_action_at)
  where next_action_at is not null;
create index if not exists idx_fi_ar_cases_case on public.fi_accounts_receivable_cases (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_ar_cases_invoice on public.fi_accounts_receivable_cases (tenant_id, invoice_id)
  where invoice_id is not null;

-- Prevent duplicate open AR cases for the same invoice + receivable type.
create unique index if not exists idx_fi_ar_cases_open_invoice_type
  on public.fi_accounts_receivable_cases (tenant_id, invoice_id, receivable_type)
  where invoice_id is not null
    and status not in ('resolved', 'written_off');

alter table public.fi_accounts_receivable_cases enable row level security;

drop policy if exists fi_ar_cases_select_tenant_member on public.fi_accounts_receivable_cases;
create policy fi_ar_cases_select_tenant_member
  on public.fi_accounts_receivable_cases for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_accounts_receivable_cases.tenant_id
    )
  );

grant select on public.fi_accounts_receivable_cases to authenticated, service_role;
grant insert, update on public.fi_accounts_receivable_cases to service_role;

create or replace function public.fi_accounts_receivable_cases_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_ar_cases_set_updated_at on public.fi_accounts_receivable_cases;
create trigger trg_fi_ar_cases_set_updated_at
  before update on public.fi_accounts_receivable_cases
  for each row
  execute procedure public.fi_accounts_receivable_cases_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_accounts_receivable_events (append-only)
-- ---------------------------------------------------------------------------
create table if not exists public.fi_accounts_receivable_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  ar_case_id uuid not null references public.fi_accounts_receivable_cases (id) on delete cascade,

  event_kind text not null
    check (event_kind in (
      'ar_case_opened',
      'reminder_sent',
      'sms_sent',
      'call_logged',
      'payment_plan_created',
      'patient_replied',
      'escalated',
      'resolved',
      'written_off'
    )),

  actor_fi_user_id uuid references public.fi_users (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint fi_accounts_receivable_events_detail_object check (jsonb_typeof (detail) = 'object')
);

comment on table public.fi_accounts_receivable_events is
  'FinancialOS Phase 4: append-only AR case event ledger — no updates or deletes.';

create index if not exists idx_fi_ar_events_tenant_created
  on public.fi_accounts_receivable_events (tenant_id, created_at desc);
create index if not exists idx_fi_ar_events_case
  on public.fi_accounts_receivable_events (ar_case_id, created_at desc);

alter table public.fi_accounts_receivable_events enable row level security;

drop policy if exists fi_ar_events_select_tenant_member on public.fi_accounts_receivable_events;
create policy fi_ar_events_select_tenant_member
  on public.fi_accounts_receivable_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_accounts_receivable_events.tenant_id
    )
  );

grant select, insert on public.fi_accounts_receivable_events to service_role;
revoke update, delete on public.fi_accounts_receivable_events from service_role;
