-- FinancialOS Phase 5 (additive, production-safe): Executive Finance Intelligence.
-- Append-only executive snapshots — owner-level revenue, profitability, attribution, AR, and forecast signals.

-- ---------------------------------------------------------------------------
-- fi_financial_executive_snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.fi_financial_executive_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,

  period_start date not null,
  period_end date not null,

  gross_revenue_cents integer not null default 0 check (gross_revenue_cents >= 0),
  collected_revenue_cents integer not null default 0 check (collected_revenue_cents >= 0),
  outstanding_revenue_cents integer not null default 0 check (outstanding_revenue_cents >= 0),
  overdue_revenue_cents integer not null default 0 check (overdue_revenue_cents >= 0),
  surgery_revenue_cents integer not null default 0 check (surgery_revenue_cents >= 0),
  treatment_revenue_cents integer not null default 0 check (treatment_revenue_cents >= 0),

  gross_profit_cents integer not null default 0,
  average_margin_percentage numeric(8, 2) not null default 0,
  average_revenue_per_case_cents integer not null default 0 check (average_revenue_per_case_cents >= 0),
  average_revenue_per_graft_cents integer check (average_revenue_per_graft_cents is null or average_revenue_per_graft_cents >= 0),

  total_surgeries integer not null default 0 check (total_surgeries >= 0),
  total_consults integer not null default 0 check (total_consults >= 0),
  total_paid_invoices integer not null default 0 check (total_paid_invoices >= 0),
  total_overdue_invoices integer not null default 0 check (total_overdue_invoices >= 0),

  best_revenue_source text,
  best_profit_source text,
  highest_margin_procedure_type text,

  ar_risk_score numeric(5, 2) not null default 0
    check (ar_risk_score >= 0 and ar_risk_score <= 100),

  forecast_revenue_cents integer not null default 0 check (forecast_revenue_cents >= 0),
  forecast_confidence numeric(5, 2) not null default 0
    check (forecast_confidence >= 0 and forecast_confidence <= 100),

  source_metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),

  constraint fi_financial_executive_snapshots_period_valid check (period_end >= period_start),
  constraint fi_financial_executive_snapshots_source_metadata_object
    check (jsonb_typeof (source_metadata) = 'object')
);

comment on table public.fi_financial_executive_snapshots is
  'FinancialOS Phase 5: append-only executive finance intelligence snapshots per tenant/clinic/period.';

create index if not exists idx_fi_exec_snapshots_tenant
  on public.fi_financial_executive_snapshots (tenant_id);
create index if not exists idx_fi_exec_snapshots_tenant_period
  on public.fi_financial_executive_snapshots (tenant_id, period_start desc, period_end desc);
create index if not exists idx_fi_exec_snapshots_tenant_clinic_period
  on public.fi_financial_executive_snapshots (tenant_id, clinic_id, period_start desc)
  where clinic_id is not null;
create index if not exists idx_fi_exec_snapshots_calculated
  on public.fi_financial_executive_snapshots (tenant_id, calculated_at desc);

alter table public.fi_financial_executive_snapshots enable row level security;

drop policy if exists fi_exec_snapshots_select_tenant_member on public.fi_financial_executive_snapshots;
create policy fi_exec_snapshots_select_tenant_member
  on public.fi_financial_executive_snapshots for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_financial_executive_snapshots.tenant_id
    )
  );

grant select on public.fi_financial_executive_snapshots to authenticated, service_role;
grant insert on public.fi_financial_executive_snapshots to service_role;
revoke update, delete on public.fi_financial_executive_snapshots from service_role;
