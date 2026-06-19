-- FinancialOS Phase 2 — Surgery Economics Engine (additive, production-safe).
-- Connects SurgeryOS cost models to immutable profitability snapshots per surgery/case.

-- ---------------------------------------------------------------------------
-- fi_surgery_cost_models — tenant-level procedure cost configuration
-- ---------------------------------------------------------------------------
create table if not exists public.fi_surgery_cost_models (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  procedure_type text not null,

  surgeon_cost_type text not null default 'fixed'
    check (surgeon_cost_type in ('fixed', 'percentage', 'per_graft', 'per_hour')),

  surgeon_cost_value_cents integer not null default 0
    check (surgeon_cost_value_cents >= 0),

  rn_hourly_rate_cents integer not null default 0 check (rn_hourly_rate_cents >= 0),
  technician_hourly_rate_cents integer not null default 0 check (technician_hourly_rate_cents >= 0),
  assistant_hourly_rate_cents integer not null default 0 check (assistant_hourly_rate_cents >= 0),
  room_hourly_cost_cents integer not null default 0 check (room_hourly_cost_cents >= 0),

  consumables_base_cost_cents integer not null default 0 check (consumables_base_cost_cents >= 0),
  graft_consumable_cost_cents integer not null default 0 check (graft_consumable_cost_cents >= 0),
  prp_cost_cents integer not null default 0 check (prp_cost_cents >= 0),
  exosome_cost_cents integer not null default 0 check (exosome_cost_cents >= 0),
  medication_cost_cents integer not null default 0 check (medication_cost_cents >= 0),

  default_duration_minutes integer not null default 480
    check (default_duration_minutes > 0 and default_duration_minutes <= 1440),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fi_surgery_cost_models is
  'FinancialOS Phase 2: configurable tenant-level surgery cost models by procedure type.';
comment on column public.fi_surgery_cost_models.surgeon_cost_type is
  'Surgeon fee model: fixed (cents), percentage (basis points of revenue), per_graft (cents/graft), per_hour (cents/hour).';
comment on column public.fi_surgery_cost_models.surgeon_cost_value_cents is
  'Surgeon cost parameter; for percentage type stores basis points (1500 = 15.00%).';

create index if not exists idx_fi_surgery_cost_models_tenant on public.fi_surgery_cost_models (tenant_id);
create index if not exists idx_fi_surgery_cost_models_tenant_procedure on public.fi_surgery_cost_models (tenant_id, lower(procedure_type));
create unique index if not exists idx_fi_surgery_cost_models_tenant_procedure_active
  on public.fi_surgery_cost_models (tenant_id, lower(procedure_type))
  where is_active = true;

alter table public.fi_surgery_cost_models enable row level security;

drop policy if exists fi_surgery_cost_models_select_tenant_member on public.fi_surgery_cost_models;
create policy fi_surgery_cost_models_select_tenant_member
  on public.fi_surgery_cost_models for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_surgery_cost_models.tenant_id
    )
  );

grant select on public.fi_surgery_cost_models to authenticated, service_role;
grant insert, update, delete on public.fi_surgery_cost_models to service_role;

drop trigger if exists trg_fi_surgery_cost_models_set_updated_at on public.fi_surgery_cost_models;
create trigger trg_fi_surgery_cost_models_set_updated_at
  before update on public.fi_surgery_cost_models
  for each row execute procedure public.fi_os_stage35_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_surgery_profitability_snapshots — immutable point-in-time profitability
-- ---------------------------------------------------------------------------
create table if not exists public.fi_surgery_profitability_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  case_id uuid references public.fi_cases (id) on delete set null,
  surgery_id uuid references public.fi_surgeries (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,
  invoice_id uuid references public.fi_invoices (id) on delete set null,

  procedure_type text not null,

  revenue_cents integer not null default 0 check (revenue_cents >= 0),
  collected_cents integer not null default 0 check (collected_cents >= 0),
  outstanding_cents integer not null default 0 check (outstanding_cents >= 0),

  surgeon_cost_cents integer not null default 0 check (surgeon_cost_cents >= 0),
  staff_cost_cents integer not null default 0 check (staff_cost_cents >= 0),
  room_cost_cents integer not null default 0 check (room_cost_cents >= 0),
  consumables_cost_cents integer not null default 0 check (consumables_cost_cents >= 0),
  treatment_addon_cost_cents integer not null default 0 check (treatment_addon_cost_cents >= 0),
  total_cost_cents integer not null default 0 check (total_cost_cents >= 0),

  gross_profit_cents integer not null,
  gross_margin_percentage numeric(8, 4) not null default 0,

  graft_count integer check (graft_count is null or graft_count >= 0),
  hair_count integer check (hair_count is null or hair_count >= 0),
  revenue_per_graft_cents integer check (revenue_per_graft_cents is null or revenue_per_graft_cents >= 0),
  cost_per_graft_cents integer check (cost_per_graft_cents is null or cost_per_graft_cents >= 0),

  source_metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint fi_surgery_profitability_snapshots_source_metadata_object
    check (jsonb_typeof (source_metadata) = 'object')
);

comment on table public.fi_surgery_profitability_snapshots is
  'FinancialOS Phase 2: immutable surgery profitability snapshots — append-only at application layer.';

create index if not exists idx_fi_surgery_profitability_snapshots_tenant on public.fi_surgery_profitability_snapshots (tenant_id);
create index if not exists idx_fi_surgery_profitability_snapshots_case on public.fi_surgery_profitability_snapshots (case_id)
  where case_id is not null;
create index if not exists idx_fi_surgery_profitability_snapshots_surgery on public.fi_surgery_profitability_snapshots (surgery_id)
  where surgery_id is not null;
create index if not exists idx_fi_surgery_profitability_snapshots_calculated_at
  on public.fi_surgery_profitability_snapshots (tenant_id, calculated_at desc);
create index if not exists idx_fi_surgery_profitability_snapshots_procedure
  on public.fi_surgery_profitability_snapshots (tenant_id, lower(procedure_type));

alter table public.fi_surgery_profitability_snapshots enable row level security;

drop policy if exists fi_surgery_profitability_snapshots_select_tenant_member on public.fi_surgery_profitability_snapshots;
create policy fi_surgery_profitability_snapshots_select_tenant_member
  on public.fi_surgery_profitability_snapshots for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_surgery_profitability_snapshots.tenant_id
    )
  );

grant select on public.fi_surgery_profitability_snapshots to authenticated, service_role;
grant insert on public.fi_surgery_profitability_snapshots to service_role;

-- Snapshots are immutable — no UPDATE/DELETE for service_role.
revoke update, delete on public.fi_surgery_profitability_snapshots from service_role;

-- ---------------------------------------------------------------------------
-- Audit trail — surgery profitability calculated events
-- ---------------------------------------------------------------------------
alter table public.fi_financial_transaction_audit_events drop constraint if exists fi_financial_transaction_audit_event_kind_chk;
alter table public.fi_financial_transaction_audit_events
  add constraint fi_financial_transaction_audit_event_kind_chk check (
    event_kind in (
      'ledger_appended',
      'reconciliation_linked',
      'reconciliation_mismatch',
      'surgery_profitability_calculated'
    )
  );
