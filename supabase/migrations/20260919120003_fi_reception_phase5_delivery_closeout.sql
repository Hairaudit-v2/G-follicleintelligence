-- ReceptionOS Phase 5: communication delivery tracking + end-of-day closeout persistence.

-- ---------------------------------------------------------------------------
-- fi_reception_communication_deliveries
-- ---------------------------------------------------------------------------
create table if not exists public.fi_reception_communication_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  lead_id uuid references public.fi_crm_leads (id) on delete set null,
  patient_id uuid references public.fi_patients (id) on delete set null,
  crm_communication_id uuid references public.fi_crm_lead_communications (id) on delete set null,
  task_id uuid references public.fi_reception_tasks (id) on delete set null,
  channel text not null
    check (channel in ('sms', 'email')),
  provider text not null
    check (provider in ('stub', 'resend', 'twilio')),
  external_message_id text,
  delivery_status text not null
    check (delivery_status in ('draft', 'dry_run', 'queued', 'sent', 'failed')),
  error_message text,
  sent_at timestamptz,
  template_key text,
  to_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_reception_comm_deliveries_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_reception_communication_deliveries is
  'ReceptionOS Phase 5: outbound SMS/email delivery attempts with status tracking (CRM contact log remains on fi_crm_lead_communications).';

create index if not exists idx_fi_reception_comm_deliveries_tenant_created
  on public.fi_reception_communication_deliveries (tenant_id, created_at desc);

create index if not exists idx_fi_reception_comm_deliveries_tenant_status
  on public.fi_reception_communication_deliveries (tenant_id, delivery_status, created_at desc);

create index if not exists idx_fi_reception_comm_deliveries_lead
  on public.fi_reception_communication_deliveries (lead_id)
  where lead_id is not null;

alter table public.fi_reception_communication_deliveries enable row level security;

drop policy if exists fi_reception_comm_deliveries_select_tenant_member on public.fi_reception_communication_deliveries;
create policy fi_reception_comm_deliveries_select_tenant_member
  on public.fi_reception_communication_deliveries for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reception_communication_deliveries.tenant_id
    )
  );

grant select on public.fi_reception_communication_deliveries to authenticated, service_role;
grant insert, update, delete on public.fi_reception_communication_deliveries to service_role;

create or replace function public.fi_reception_comm_deliveries_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_reception_comm_deliveries_set_updated_at on public.fi_reception_communication_deliveries;
create trigger trg_fi_reception_comm_deliveries_set_updated_at
  before update on public.fi_reception_communication_deliveries
  for each row
  execute procedure public.fi_reception_comm_deliveries_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_reception_daily_closeouts
-- ---------------------------------------------------------------------------
create table if not exists public.fi_reception_daily_closeouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  clinic_id uuid references public.fi_clinics (id) on delete set null,
  operating_date date not null,
  closed_by uuid references public.fi_users (id) on delete set null,
  risk_summary text,
  notes text,
  item_counts jsonb not null default '{}'::jsonb,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_reception_daily_closeouts_item_counts_object check (jsonb_typeof (item_counts) = 'object')
);

comment on table public.fi_reception_daily_closeouts is
  'ReceptionOS Phase 5: manager/admin end-of-day operational closeout records.';

create unique index if not exists idx_fi_reception_daily_closeouts_tenant_date_clinic
  on public.fi_reception_daily_closeouts (tenant_id, operating_date, coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists idx_fi_reception_daily_closeouts_tenant_date
  on public.fi_reception_daily_closeouts (tenant_id, operating_date desc);

alter table public.fi_reception_daily_closeouts enable row level security;

drop policy if exists fi_reception_daily_closeouts_select_tenant_member on public.fi_reception_daily_closeouts;
create policy fi_reception_daily_closeouts_select_tenant_member
  on public.fi_reception_daily_closeouts for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reception_daily_closeouts.tenant_id
    )
  );

grant select on public.fi_reception_daily_closeouts to authenticated, service_role;
grant insert, update, delete on public.fi_reception_daily_closeouts to service_role;

create or replace function public.fi_reception_daily_closeouts_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_reception_daily_closeouts_set_updated_at on public.fi_reception_daily_closeouts;
create trigger trg_fi_reception_daily_closeouts_set_updated_at
  before update on public.fi_reception_daily_closeouts
  for each row
  execute procedure public.fi_reception_daily_closeouts_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_reception_daily_closeout_items
-- ---------------------------------------------------------------------------
create table if not exists public.fi_reception_daily_closeout_items (
  id uuid primary key default gen_random_uuid(),
  closeout_id uuid not null references public.fi_reception_daily_closeouts (id) on delete cascade,
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  item_kind text not null
    check (item_kind in (
      'unresolved_critical_task',
      'unresolved_blocked_task',
      'unpaid_deposit_due_today',
      'incomplete_surgery_readiness',
      'consultation_no_next_action',
      'communication_failed',
      'tomorrow_first_patient_readiness'
    )),
  severity text
    check (severity is null or severity in ('info', 'warning', 'critical', 'blocked')),
  status text,
  title text not null,
  detail text,
  source_ref_id text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fi_reception_daily_closeout_items_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_reception_daily_closeout_items is
  'ReceptionOS Phase 5: snapshot checklist rows captured when a daily closeout is recorded.';

create index if not exists idx_fi_reception_daily_closeout_items_closeout
  on public.fi_reception_daily_closeout_items (closeout_id);

create index if not exists idx_fi_reception_daily_closeout_items_tenant_kind
  on public.fi_reception_daily_closeout_items (tenant_id, item_kind);

alter table public.fi_reception_daily_closeout_items enable row level security;

drop policy if exists fi_reception_daily_closeout_items_select_tenant_member on public.fi_reception_daily_closeout_items;
create policy fi_reception_daily_closeout_items_select_tenant_member
  on public.fi_reception_daily_closeout_items for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_reception_daily_closeout_items.tenant_id
    )
  );

grant select on public.fi_reception_daily_closeout_items to authenticated, service_role;
grant insert, update, delete on public.fi_reception_daily_closeout_items to service_role;
