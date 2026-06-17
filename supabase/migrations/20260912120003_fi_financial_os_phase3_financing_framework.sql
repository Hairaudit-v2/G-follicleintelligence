-- FinancialOS Phase 3 (additive): provider-ready financing framework.
-- Does not alter existing pathway, invoice, payment, checkout, or Stripe behaviour.

-- ---------------------------------------------------------------------------
-- fi_finance_providers
-- ---------------------------------------------------------------------------
create table if not exists public.fi_finance_providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.fi_tenants (id) on delete cascade,

  name text not null,
  provider_type text not null
    check (provider_type in (
      'medical_financing',
      'bnpl',
      'super_release',
      'international_financing',
      'custom'
    )),

  country_code text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_finance_providers_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_finance_providers is
  'FinancialOS Phase 3: clinic-configurable external financing providers (global catalog + tenant overrides). No live API integration in Phase 3.';

comment on column public.fi_finance_providers.tenant_id is
  'Null for global catalog providers; set for tenant-specific custom providers.';

create index if not exists idx_fi_finance_providers_tenant on public.fi_finance_providers (tenant_id);
create index if not exists idx_fi_finance_providers_provider_type on public.fi_finance_providers (provider_type);
create index if not exists idx_fi_finance_providers_is_active on public.fi_finance_providers (is_active);

alter table public.fi_finance_providers enable row level security;

drop policy if exists fi_finance_providers_select_tenant_member on public.fi_finance_providers;
create policy fi_finance_providers_select_tenant_member
  on public.fi_finance_providers for select to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_finance_providers.tenant_id
    )
  );

grant select on public.fi_finance_providers to authenticated, service_role;
grant insert, update, delete on public.fi_finance_providers to service_role;

create or replace function public.fi_finance_providers_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_finance_providers_set_updated_at on public.fi_finance_providers;
create trigger trg_fi_finance_providers_set_updated_at
  before update on public.fi_finance_providers
  for each row
  execute procedure public.fi_finance_providers_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_finance_applications
-- ---------------------------------------------------------------------------
create table if not exists public.fi_finance_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,

  payment_pathway_id uuid not null references public.fi_payment_pathways (id) on delete cascade,
  finance_provider_id uuid not null references public.fi_finance_providers (id) on delete restrict,

  application_status text not null default 'draft'
    check (application_status in (
      'draft',
      'documents_pending',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'settlement_pending',
      'settled',
      'cancelled'
    )),

  application_reference text,
  requested_amount_cents integer check (requested_amount_cents is null or requested_amount_cents >= 0),
  approved_amount_cents integer check (approved_amount_cents is null or approved_amount_cents >= 0),

  submitted_at timestamptz,
  approved_at timestamptz,
  settled_at timestamptz,
  expected_settlement_date date,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_finance_applications_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_finance_applications is
  'FinancialOS Phase 3: financing application workflow linked to medical_finance payment pathways.';

create index if not exists idx_fi_finance_applications_tenant on public.fi_finance_applications (tenant_id);
create index if not exists idx_fi_finance_applications_application_status on public.fi_finance_applications (application_status);
create index if not exists idx_fi_finance_applications_finance_provider on public.fi_finance_applications (finance_provider_id);
create index if not exists idx_fi_finance_applications_payment_pathway on public.fi_finance_applications (payment_pathway_id);
create index if not exists idx_fi_finance_applications_booking on public.fi_finance_applications (booking_id)
  where booking_id is not null;

alter table public.fi_finance_applications enable row level security;

drop policy if exists fi_finance_applications_select_tenant_member on public.fi_finance_applications;
create policy fi_finance_applications_select_tenant_member
  on public.fi_finance_applications for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_finance_applications.tenant_id
    )
  );

grant select on public.fi_finance_applications to authenticated, service_role;
grant insert, update, delete on public.fi_finance_applications to service_role;

create or replace function public.fi_finance_applications_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_finance_applications_set_updated_at on public.fi_finance_applications;
create trigger trg_fi_finance_applications_set_updated_at
  before update on public.fi_finance_applications
  for each row
  execute procedure public.fi_finance_applications_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_finance_application_documents
-- ---------------------------------------------------------------------------
create table if not exists public.fi_finance_application_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  finance_application_id uuid not null references public.fi_finance_applications (id) on delete cascade,

  document_type text not null
    check (document_type in (
      'id_verification',
      'bank_statement',
      'medical_letter',
      'super_release_form',
      'income_verification',
      'consent_form',
      'custom'
    )),

  status text not null default 'pending'
    check (status in (
      'pending',
      'requested',
      'received',
      'verified',
      'rejected'
    )),

  file_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_finance_application_documents_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_finance_application_documents is
  'FinancialOS Phase 3: document collection and verification tracking for financing applications.';

create index if not exists idx_fi_finance_application_documents_tenant on public.fi_finance_application_documents (tenant_id);
create index if not exists idx_fi_finance_application_documents_application on public.fi_finance_application_documents (finance_application_id);
create index if not exists idx_fi_finance_application_documents_status on public.fi_finance_application_documents (status);

alter table public.fi_finance_application_documents enable row level security;

drop policy if exists fi_finance_application_documents_select_tenant_member on public.fi_finance_application_documents;
create policy fi_finance_application_documents_select_tenant_member
  on public.fi_finance_application_documents for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_finance_application_documents.tenant_id
    )
  );

grant select on public.fi_finance_application_documents to authenticated, service_role;
grant insert, update, delete on public.fi_finance_application_documents to service_role;

create or replace function public.fi_finance_application_documents_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_finance_application_documents_set_updated_at on public.fi_finance_application_documents;
create trigger trg_fi_finance_application_documents_set_updated_at
  before update on public.fi_finance_application_documents
  for each row
  execute procedure public.fi_finance_application_documents_set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed global financing providers (inactive except Custom Provider)
-- ---------------------------------------------------------------------------
insert into public.fi_finance_providers (tenant_id, name, provider_type, country_code, is_active, metadata)
select v.tenant_id, v.name, v.provider_type, v.country_code, v.is_active, v.metadata
from (
  values
    (null::uuid, 'Zip Money Australia', 'bnpl', 'AU', false, '{"seed": true}'::jsonb),
    (null::uuid, 'Afterpay Australia', 'bnpl', 'AU', false, '{"seed": true}'::jsonb),
    (null::uuid, 'Humm Australia', 'bnpl', 'AU', false, '{"seed": true}'::jsonb),
    (null::uuid, 'MediPay Australia', 'medical_financing', 'AU', false, '{"seed": true}'::jsonb),
    (null::uuid, 'Custom Provider', 'custom', 'AU', true, '{"seed": true, "configurable": true}'::jsonb)
) as v (tenant_id, name, provider_type, country_code, is_active, metadata)
where not exists (
  select 1 from public.fi_finance_providers p
  where p.tenant_id is null and p.name = v.name
);
