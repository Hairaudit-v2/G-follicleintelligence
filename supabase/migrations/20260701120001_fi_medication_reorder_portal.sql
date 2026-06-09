-- DoctorOS Stage 1D: patient medication reorder portal + prescription repeat entitlements.

-- ---------------------------------------------------------------------------
-- Link Supabase auth user to foundation patient (patient portal login).
-- ---------------------------------------------------------------------------
alter table fi_patients add column if not exists portal_auth_user_id uuid references auth.users (id) on delete set null;

comment on column fi_patients.portal_auth_user_id is
  'When set, this auth user may access /patient/[tenantId]/* for this tenant’s portal (medications, reorders).';

create unique index if not exists idx_fi_patients_portal_auth_user_unique
  on fi_patients (portal_auth_user_id)
  where portal_auth_user_id is not null;

-- ---------------------------------------------------------------------------
-- Prescription-level repeat / reorder program (doctor-configured).
-- ---------------------------------------------------------------------------
alter table fi_patient_prescriptions add column if not exists repeats_allowed boolean not null default false;

alter table fi_patient_prescriptions add column if not exists repeat_limit int not null default 0;

alter table fi_patient_prescriptions add column if not exists reorders_used int not null default 0;

alter table fi_patient_prescriptions add column if not exists reorder_valid_from timestamptz;

alter table fi_patient_prescriptions add column if not exists reorder_valid_until timestamptz;

alter table fi_patient_prescriptions add column if not exists reorder_review_required boolean not null default false;

alter table fi_patient_prescriptions add column if not exists patient_reorder_fee_pence int;

alter table fi_patient_prescriptions add column if not exists reorder_fee_payment_required boolean not null default false;

comment on column fi_patient_prescriptions.repeats_allowed is
  'Patient portal may request refills/reorders for this prescription when clinically allowed.';

comment on column fi_patient_prescriptions.repeat_limit is
  'Maximum number of approved patient reorders for this prescription (>=1 when repeats_allowed).';

comment on column fi_patient_prescriptions.reorders_used is
  'Number of reorders already approved (incremented when a reorder request reaches approved/sent).';

comment on column fi_patient_prescriptions.reorder_review_required is
  'When true, patient reorders create doctor_review_required workflow instead of direct approval path.';

comment on column fi_patient_prescriptions.patient_reorder_fee_pence is
  'Optional fee in whole pence for a patient-initiated reorder (UI + payment stub).';

-- ---------------------------------------------------------------------------
-- Patient reorder requests
-- ---------------------------------------------------------------------------
create table if not exists fi_medication_reorder_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  source_prescription_id uuid not null references fi_patient_prescriptions (id) on delete restrict,
  source_prescription_item_id uuid not null references fi_prescription_items (id) on delete restrict,
  delivery_address text not null,
  status text not null default 'requested',
  fee_pence int,
  payment_status text not null default 'not_required',
  doctor_review_crm_task_id uuid references fi_crm_tasks (id) on delete set null,
  rejection_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_medication_reorder_requests_status_chk check (
    status in (
      'requested',
      'doctor_review_required',
      'approved',
      'sent_to_pharmacy',
      'posted',
      'completed',
      'rejected'
    )
  ),
  constraint fi_medication_reorder_requests_payment_chk check (
    payment_status in ('not_required', 'pending', 'paid', 'waived')
  ),
  constraint fi_medication_reorder_requests_metadata_object check (jsonb_typeof (metadata) = 'object')
);

comment on table fi_medication_reorder_requests is
  'DoctorOS 1D: patient-initiated medication reorders; service-role writes; staff approve / fulfil statuses.';

create index if not exists idx_fi_med_reorder_tenant_patient_created
  on fi_medication_reorder_requests (tenant_id, patient_id, created_at desc);

create index if not exists idx_fi_med_reorder_tenant_status
  on fi_medication_reorder_requests (tenant_id, status);

create index if not exists idx_fi_med_reorder_source_rx
  on fi_medication_reorder_requests (source_prescription_id);

-- updated_at
create or replace function fi_medication_reorder_requests_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_med_reorder_set_updated_at on fi_medication_reorder_requests;
create trigger trg_fi_med_reorder_set_updated_at
  before update on fi_medication_reorder_requests
  for each row
  execute procedure fi_medication_reorder_requests_set_updated_at();

alter table fi_medication_reorder_requests enable row level security;

drop policy if exists fi_medication_reorder_requests_select_tenant_member on fi_medication_reorder_requests;
create policy fi_medication_reorder_requests_select_tenant_member
  on fi_medication_reorder_requests for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_medication_reorder_requests.tenant_id
    )
  );

grant select on fi_medication_reorder_requests to authenticated, service_role;
grant insert, update, delete on fi_medication_reorder_requests to service_role;
