-- Stage 3A: platform booking layer (`fi_bookings`).
-- Design: docs/design/19-booking-calendar-foundation.md
--
-- Tenant-scoped anchors to CRM leads, persons, patients, and/or cases.
-- RLS: authenticated SELECT (tenant member); mutations via service_role (FI Admin routes/actions).

create table if not exists fi_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  lead_id uuid references fi_crm_leads (id) on delete cascade,
  person_id uuid references fi_persons (id) on delete restrict,
  patient_id uuid references fi_patients (id) on delete set null,
  case_id uuid references fi_cases (id) on delete set null,
  clinic_id uuid references fi_clinics (id) on delete set null,
  assigned_user_id uuid references fi_users (id) on delete set null,
  booking_type text not null,
  booking_status text not null default 'scheduled',
  title text,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text,
  location text,
  metadata jsonb not null default '{}'::jsonb,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid references fi_users (id) on delete set null,
  cancellation_reason text,
  created_by_user_id uuid references fi_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_bookings_booking_type_check check (
    booking_type in (
      'consultation',
      'prp',
      'prf',
      'mesotherapy',
      'exosomes',
      'surgery',
      'review',
      'follow_up',
      'other'
    )
  ),
  constraint fi_bookings_booking_status_check check (
    booking_status in ('scheduled', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show')
  ),
  constraint fi_bookings_at_least_one_anchor check (
    lead_id is not null
    or person_id is not null
    or patient_id is not null
    or case_id is not null
  ),
  constraint fi_bookings_end_after_start check (end_at > start_at),
  constraint fi_bookings_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_bookings is
  'Follicle Intelligence: tenant-scoped bookings (consultation, clinical, surgery, etc.) with optional CRM lead anchor.';

create index if not exists idx_fi_bookings_tenant_start on fi_bookings (tenant_id, start_at);
create index if not exists idx_fi_bookings_tenant_status on fi_bookings (tenant_id, booking_status);
create index if not exists idx_fi_bookings_tenant_type on fi_bookings (tenant_id, booking_type);
create index if not exists idx_fi_bookings_tenant_lead on fi_bookings (tenant_id, lead_id)
  where lead_id is not null;
create index if not exists idx_fi_bookings_tenant_person on fi_bookings (tenant_id, person_id)
  where person_id is not null;
create index if not exists idx_fi_bookings_tenant_patient on fi_bookings (tenant_id, patient_id)
  where patient_id is not null;
create index if not exists idx_fi_bookings_tenant_case on fi_bookings (tenant_id, case_id)
  where case_id is not null;
create index if not exists idx_fi_bookings_tenant_assigned on fi_bookings (tenant_id, assigned_user_id)
  where assigned_user_id is not null;
create index if not exists idx_fi_bookings_tenant_clinic on fi_bookings (tenant_id, clinic_id)
  where clinic_id is not null;

alter table fi_bookings enable row level security;

drop policy if exists fi_bookings_select_tenant_member on fi_bookings;
create policy fi_bookings_select_tenant_member
  on fi_bookings for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_bookings.tenant_id
    )
  );

grant select on fi_bookings to authenticated, service_role;
grant insert, update, delete on fi_bookings to service_role;
