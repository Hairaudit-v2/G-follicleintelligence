-- FinancialOS Phase 4 (additive): financial clearance engine snapshots.
-- Advisory operational visibility only — does not alter payment recording, Stripe checkout, or surgery blocking.

create table if not exists public.fi_financial_clearance_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  booking_id uuid references public.fi_bookings (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,

  clearance_state text not null
    check (clearance_state in (
      'not_ready',
      'deposit_ready',
      'pathway_pending',
      'attention_required',
      'financially_cleared',
      'paid_in_full',
      'unavailable'
    )),

  clearance_label text,
  financially_safe_to_proceed boolean not null default false,
  paid_in_full boolean not null default false,
  requires_staff_attention boolean not null default false,

  amount_paid_cents integer check (amount_paid_cents is null or amount_paid_cents >= 0),
  balance_due_cents integer check (balance_due_cents is null or balance_due_cents >= 0),

  blocking_factors jsonb not null default '[]'::jsonb,
  warning_factors jsonb not null default '[]'::jsonb,
  source_breakdown jsonb not null default '{}'::jsonb,

  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint fi_financial_clearance_snapshots_blocking_factors_array check (jsonb_typeof (blocking_factors) = 'array'),
  constraint fi_financial_clearance_snapshots_warning_factors_array check (jsonb_typeof (warning_factors) = 'array'),
  constraint fi_financial_clearance_snapshots_source_breakdown_object check (jsonb_typeof (source_breakdown) = 'object')
);

comment on table public.fi_financial_clearance_snapshots is
  'FinancialOS Phase 4: point-in-time financial clearance snapshots for upcoming surgery bookings (cron / analytics). Advisory only.';

create index if not exists idx_fi_financial_clearance_snapshots_tenant on public.fi_financial_clearance_snapshots (tenant_id);
create index if not exists idx_fi_financial_clearance_snapshots_booking on public.fi_financial_clearance_snapshots (booking_id)
  where booking_id is not null;
create index if not exists idx_fi_financial_clearance_snapshots_case on public.fi_financial_clearance_snapshots (case_id)
  where case_id is not null;
create index if not exists idx_fi_financial_clearance_snapshots_clearance_state on public.fi_financial_clearance_snapshots (clearance_state);
create index if not exists idx_fi_financial_clearance_snapshots_computed_at on public.fi_financial_clearance_snapshots (computed_at desc);

alter table public.fi_financial_clearance_snapshots enable row level security;

drop policy if exists fi_financial_clearance_snapshots_select_tenant_member on public.fi_financial_clearance_snapshots;
create policy fi_financial_clearance_snapshots_select_tenant_member
  on public.fi_financial_clearance_snapshots for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_financial_clearance_snapshots.tenant_id
    )
  );

grant select on public.fi_financial_clearance_snapshots to authenticated, service_role;
grant insert, update, delete on public.fi_financial_clearance_snapshots to service_role;
