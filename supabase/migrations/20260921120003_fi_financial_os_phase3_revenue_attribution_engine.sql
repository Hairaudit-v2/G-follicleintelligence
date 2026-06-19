-- FinancialOS Phase 3 — Revenue Attribution Engine (additive, production-safe).
-- Append-only attribution events linking revenue to lead source, campaign, consultant, and clinic.

-- ---------------------------------------------------------------------------
-- fi_revenue_attribution_events — immutable revenue attribution ledger
-- ---------------------------------------------------------------------------
create table if not exists public.fi_revenue_attribution_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  patient_id uuid references public.fi_patients (id) on delete set null,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  consultation_id uuid references public.fi_consultations (id) on delete set null,
  surgery_id uuid references public.fi_surgeries (id) on delete set null,
  invoice_id uuid references public.fi_invoices (id) on delete set null,
  payment_id uuid references public.fi_payments (id) on delete set null,
  transaction_id uuid references public.fi_financial_transactions (id) on delete set null,

  attribution_source text not null default 'unknown'
    check (attribution_source in (
      'google_ads',
      'meta_ads',
      'organic',
      'referral',
      'ambassador',
      'existing_patient',
      'direct',
      'unknown'
    )),

  campaign_name text,
  campaign_id text,
  ad_group text,
  keyword text,
  referral_contact_id uuid references public.fi_persons (id) on delete set null,
  consultant_fi_user_id uuid references public.fi_users (id) on delete set null,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  attributed_revenue_cents integer not null default 0 check (attributed_revenue_cents >= 0),
  attributed_collected_cents integer not null default 0 check (attributed_collected_cents >= 0),
  gross_profit_cents integer,

  attribution_confidence text not null default 'inferred'
    check (attribution_confidence in ('direct', 'inferred', 'manual')),

  source_metadata jsonb not null default '{}'::jsonb,
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint fi_revenue_attribution_events_source_metadata_object
    check (jsonb_typeof (source_metadata) = 'object')
);

comment on table public.fi_revenue_attribution_events is
  'FinancialOS Phase 3: append-only revenue attribution events — never mutates fi_financial_transactions.';
comment on column public.fi_revenue_attribution_events.transaction_id is
  'Optional link to fi_financial_transactions.id for payment/ledger-triggered attribution.';
comment on column public.fi_revenue_attribution_events.idempotency_key is
  'Dedup key — one attribution event per tenant + idempotency_key (e.g. payment:{id}, snapshot:{id}).';

create index if not exists idx_fi_revenue_attribution_events_tenant on public.fi_revenue_attribution_events (tenant_id);
create index if not exists idx_fi_revenue_attribution_events_tenant_occurred
  on public.fi_revenue_attribution_events (tenant_id, occurred_at desc);
create index if not exists idx_fi_revenue_attribution_events_tenant_source
  on public.fi_revenue_attribution_events (tenant_id, attribution_source);
create index if not exists idx_fi_revenue_attribution_events_tenant_campaign
  on public.fi_revenue_attribution_events (tenant_id, campaign_id)
  where campaign_id is not null;
create index if not exists idx_fi_revenue_attribution_events_case
  on public.fi_revenue_attribution_events (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_revenue_attribution_events_lead
  on public.fi_revenue_attribution_events (tenant_id, lead_id)
  where lead_id is not null;

create unique index if not exists uq_fi_revenue_attribution_events_tenant_idempotency
  on public.fi_revenue_attribution_events (tenant_id, idempotency_key)
  where idempotency_key is not null;

alter table public.fi_revenue_attribution_events enable row level security;

drop policy if exists fi_revenue_attribution_events_select_tenant_member on public.fi_revenue_attribution_events;
create policy fi_revenue_attribution_events_select_tenant_member
  on public.fi_revenue_attribution_events for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_revenue_attribution_events.tenant_id
    )
  );

grant select on public.fi_revenue_attribution_events to authenticated, service_role;
grant insert on public.fi_revenue_attribution_events to service_role;

-- Attribution events are append-only — no UPDATE/DELETE for service_role.
revoke update, delete on public.fi_revenue_attribution_events from service_role;

-- ---------------------------------------------------------------------------
-- fi_revenue_attribution_overrides — admin manual repair per case
-- ---------------------------------------------------------------------------
create table if not exists public.fi_revenue_attribution_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  case_id uuid not null references public.fi_cases (id) on delete cascade,

  attribution_source text
    check (attribution_source is null or attribution_source in (
      'google_ads',
      'meta_ads',
      'organic',
      'referral',
      'ambassador',
      'existing_patient',
      'direct',
      'unknown'
    )),
  campaign_name text,
  campaign_id text,
  consultant_fi_user_id uuid references public.fi_users (id) on delete set null,

  updated_by_fi_user_id uuid references public.fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_revenue_attribution_overrides_tenant_case unique (tenant_id, case_id)
);

comment on table public.fi_revenue_attribution_overrides is
  'FinancialOS Phase 3: per-case manual attribution overrides applied by the resolver before event creation.';

create index if not exists idx_fi_revenue_attribution_overrides_tenant
  on public.fi_revenue_attribution_overrides (tenant_id);

alter table public.fi_revenue_attribution_overrides enable row level security;

drop policy if exists fi_revenue_attribution_overrides_select_tenant_member on public.fi_revenue_attribution_overrides;
create policy fi_revenue_attribution_overrides_select_tenant_member
  on public.fi_revenue_attribution_overrides for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_revenue_attribution_overrides.tenant_id
    )
  );

grant select on public.fi_revenue_attribution_overrides to authenticated, service_role;
grant insert, update, delete on public.fi_revenue_attribution_overrides to service_role;

drop trigger if exists trg_fi_revenue_attribution_overrides_set_updated_at on public.fi_revenue_attribution_overrides;
create trigger trg_fi_revenue_attribution_overrides_set_updated_at
  before update on public.fi_revenue_attribution_overrides
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit trail — revenue attribution recorded events
-- ---------------------------------------------------------------------------
alter table public.fi_financial_transaction_audit_events drop constraint if exists fi_financial_transaction_audit_event_kind_chk;
alter table public.fi_financial_transaction_audit_events
  add constraint fi_financial_transaction_audit_event_kind_chk check (
    event_kind in (
      'ledger_appended',
      'reconciliation_linked',
      'reconciliation_mismatch',
      'surgery_profitability_calculated',
      'revenue_attribution_recorded'
    )
  );
