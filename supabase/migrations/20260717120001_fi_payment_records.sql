-- Manual payment / deposit tracking (FI OS V1). Not integrated billing — staff-recorded status only.

create table if not exists fi_payment_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants(id) on delete cascade,
  payment_context text not null
    check (payment_context in ('consultation', 'surgery', 'medication_reorder', 'other')),
  patient_id uuid references fi_patients(id) on delete set null,
  lead_id uuid references fi_crm_leads(id) on delete set null,
  consultation_id uuid references fi_consultations(id) on delete set null,
  case_id uuid references fi_cases(id) on delete set null,
  booking_id uuid references fi_bookings(id) on delete set null,
  amount_expected numeric(14, 2) not null default 0,
  amount_paid numeric(14, 2) not null default 0,
  currency text not null default 'AUD',
  status text not null default 'pending'
    check (status in (
      'not_required',
      'pending',
      'partially_paid',
      'paid',
      'waived',
      'refunded',
      'overdue'
    )),
  due_date date,
  notes text,
  recorded_by uuid references fi_users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fi_payment_records_tenant on fi_payment_records(tenant_id);
create index if not exists idx_fi_payment_records_tenant_consultation on fi_payment_records(tenant_id, consultation_id)
  where consultation_id is not null;
create index if not exists idx_fi_payment_records_tenant_case on fi_payment_records(tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_payment_records_tenant_booking on fi_payment_records(tenant_id, booking_id)
  where booking_id is not null;
create index if not exists idx_fi_payment_records_tenant_due on fi_payment_records(tenant_id, due_date)
  where due_date is not null;

comment on table fi_payment_records is 'Manual deposit/payment status tracking per tenant — not POS or integrated billing.';

alter table fi_payment_records enable row level security;

-- Tenant members may read (reception, clinical, finance, etc.).
drop policy if exists fi_payment_records_select_tenant_member on fi_payment_records;
create policy fi_payment_records_select_tenant_member
  on fi_payment_records for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payment_records.tenant_id
    )
  );

-- Writes: admin / manager / finance / owner / fi_admin (aligned with FI OS operational finance personas).
drop policy if exists fi_payment_records_insert_finance_roles on fi_payment_records;
create policy fi_payment_records_insert_finance_roles
  on fi_payment_records for insert to authenticated
  with check (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payment_records.tenant_id
        and lower(coalesce(u.role, '')) in (
          'fi_admin',
          'admin',
          'manager',
          'finance',
          'owner'
        )
    )
  );

drop policy if exists fi_payment_records_update_finance_roles on fi_payment_records;
create policy fi_payment_records_update_finance_roles
  on fi_payment_records for update to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payment_records.tenant_id
        and lower(coalesce(u.role, '')) in (
          'fi_admin',
          'admin',
          'manager',
          'finance',
          'owner'
        )
    )
  )
  with check (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_payment_records.tenant_id
        and lower(coalesce(u.role, '')) in (
          'fi_admin',
          'admin',
          'manager',
          'finance',
          'owner'
        )
    )
  );

grant select, insert, update on fi_payment_records to authenticated;
grant insert, update on fi_payment_records to service_role;
