-- FinancialOS Phase 3B (additive): super release workflow framework.
-- Provider-neutral retirement/superannuation release application workflow.
-- Does not alter existing pathway, invoice, payment, checkout, finance application, or Stripe behaviour.

-- ---------------------------------------------------------------------------
-- fi_super_release_applications
-- ---------------------------------------------------------------------------
create table if not exists public.fi_super_release_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  patient_id uuid references public.fi_patients (id) on delete set null,
  case_id uuid references public.fi_cases (id) on delete set null,
  booking_id uuid references public.fi_bookings (id) on delete set null,

  payment_pathway_id uuid not null references public.fi_payment_pathways (id) on delete cascade,

  provider_name text,

  application_status text not null default 'draft'
    check (application_status in (
      'draft',
      'eligibility_review',
      'documents_pending',
      'clinical_letter_required',
      'ready_for_submission',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'release_pending',
      'funds_released',
      'cancelled'
    )),

  requested_amount_cents integer check (requested_amount_cents is null or requested_amount_cents >= 0),
  approved_amount_cents integer check (approved_amount_cents is null or approved_amount_cents >= 0),

  submitted_at timestamptz,
  approved_at timestamptz,
  funds_released_at timestamptz,

  expected_release_date date,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_super_release_applications_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_super_release_applications is
  'FinancialOS Phase 3B: medically justified superannuation release application workflow linked to super_release payment pathways. No live provider APIs.';

create index if not exists idx_fi_super_release_applications_tenant on public.fi_super_release_applications (tenant_id);
create index if not exists idx_fi_super_release_applications_payment_pathway on public.fi_super_release_applications (payment_pathway_id);
create index if not exists idx_fi_super_release_applications_application_status on public.fi_super_release_applications (application_status);
create index if not exists idx_fi_super_release_applications_expected_release_date on public.fi_super_release_applications (expected_release_date)
  where expected_release_date is not null;
create index if not exists idx_fi_super_release_applications_booking on public.fi_super_release_applications (booking_id)
  where booking_id is not null;

alter table public.fi_super_release_applications enable row level security;

drop policy if exists fi_super_release_applications_select_tenant_member on public.fi_super_release_applications;
create policy fi_super_release_applications_select_tenant_member
  on public.fi_super_release_applications for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_super_release_applications.tenant_id
    )
  );

grant select on public.fi_super_release_applications to authenticated, service_role;
grant insert, update, delete on public.fi_super_release_applications to service_role;

create or replace function public.fi_super_release_applications_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_super_release_applications_set_updated_at on public.fi_super_release_applications;
create trigger trg_fi_super_release_applications_set_updated_at
  before update on public.fi_super_release_applications
  for each row
  execute procedure public.fi_super_release_applications_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_super_release_documents
-- ---------------------------------------------------------------------------
create table if not exists public.fi_super_release_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  super_release_application_id uuid not null references public.fi_super_release_applications (id) on delete cascade,

  document_type text not null
    check (document_type in (
      'identity_document',
      'medical_letter',
      'financial_hardship_statement',
      'super_release_form',
      'consent_form',
      'bank_details',
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

  constraint fi_super_release_documents_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_super_release_documents is
  'FinancialOS Phase 3B: document collection and verification for super release applications.';

create index if not exists idx_fi_super_release_documents_tenant on public.fi_super_release_documents (tenant_id);
create index if not exists idx_fi_super_release_documents_application on public.fi_super_release_documents (super_release_application_id);
create index if not exists idx_fi_super_release_documents_status on public.fi_super_release_documents (status);

alter table public.fi_super_release_documents enable row level security;

drop policy if exists fi_super_release_documents_select_tenant_member on public.fi_super_release_documents;
create policy fi_super_release_documents_select_tenant_member
  on public.fi_super_release_documents for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_super_release_documents.tenant_id
    )
  );

grant select on public.fi_super_release_documents to authenticated, service_role;
grant insert, update, delete on public.fi_super_release_documents to service_role;

create or replace function public.fi_super_release_documents_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_super_release_documents_set_updated_at on public.fi_super_release_documents;
create trigger trg_fi_super_release_documents_set_updated_at
  before update on public.fi_super_release_documents
  for each row
  execute procedure public.fi_super_release_documents_set_updated_at();

-- ---------------------------------------------------------------------------
-- fi_super_release_clinical_letters
-- ---------------------------------------------------------------------------
create table if not exists public.fi_super_release_clinical_letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,

  super_release_application_id uuid not null references public.fi_super_release_applications (id) on delete cascade,

  generated_by uuid references public.fi_users (id) on delete set null,

  letter_status text not null default 'draft'
    check (letter_status in (
      'draft',
      'review_required',
      'approved',
      'issued'
    )),

  issued_at timestamptz,
  file_url text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fi_super_release_clinical_letters_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table public.fi_super_release_clinical_letters is
  'FinancialOS Phase 3B: clinical letter workflow for super release applications.';

create index if not exists idx_fi_super_release_clinical_letters_tenant on public.fi_super_release_clinical_letters (tenant_id);
create index if not exists idx_fi_super_release_clinical_letters_application on public.fi_super_release_clinical_letters (super_release_application_id);
create index if not exists idx_fi_super_release_clinical_letters_letter_status on public.fi_super_release_clinical_letters (letter_status);

alter table public.fi_super_release_clinical_letters enable row level security;

drop policy if exists fi_super_release_clinical_letters_select_tenant_member on public.fi_super_release_clinical_letters;
create policy fi_super_release_clinical_letters_select_tenant_member
  on public.fi_super_release_clinical_letters for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_super_release_clinical_letters.tenant_id
    )
  );

grant select on public.fi_super_release_clinical_letters to authenticated, service_role;
grant insert, update, delete on public.fi_super_release_clinical_letters to service_role;

create or replace function public.fi_super_release_clinical_letters_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fi_super_release_clinical_letters_set_updated_at on public.fi_super_release_clinical_letters;
create trigger trg_fi_super_release_clinical_letters_set_updated_at
  before update on public.fi_super_release_clinical_letters
  for each row
  execute procedure public.fi_super_release_clinical_letters_set_updated_at();
