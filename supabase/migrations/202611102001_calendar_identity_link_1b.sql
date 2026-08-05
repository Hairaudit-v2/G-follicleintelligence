-- CalendarOS FI-CALENDAR-IDENTITY-LINK-1B
-- Explicit consultation/person identity columns + tenant-scoped uniqueness for mappings.

-- ---------------------------------------------------------------------------
-- fi_calendar_events — consultation + person identity anchors
-- ---------------------------------------------------------------------------
alter table public.fi_calendar_events
  add column if not exists consultation_id uuid references public.fi_consultations (id) on delete set null;

alter table public.fi_calendar_events
  add column if not exists person_id uuid references public.fi_persons (id) on delete set null;

comment on column public.fi_calendar_events.consultation_id is
  'FI-CALENDAR-IDENTITY-LINK-1B: optional consultation identity when patient record is pending.';
comment on column public.fi_calendar_events.person_id is
  'FI-CALENDAR-IDENTITY-LINK-1B: canonical contact (fi_persons) for the calendar event.';

create index if not exists idx_fi_calendar_events_tenant_consultation
  on public.fi_calendar_events (tenant_id, consultation_id)
  where consultation_id is not null;

create index if not exists idx_fi_calendar_events_tenant_person
  on public.fi_calendar_events (tenant_id, person_id)
  where person_id is not null;

-- Tenant-scoped uniqueness for Google event mapping (preferred over global-only).
-- Keep existing global unique index; add tenant-scoped complementary uniqueness.
create unique index if not exists idx_fi_calendar_events_tenant_external_event
  on public.fi_calendar_events (tenant_id, external_event_id)
  where external_event_id is not null;

-- ---------------------------------------------------------------------------
-- Conversion idempotency — one FiOS booking per converted calendar event (tenant-scoped)
-- ---------------------------------------------------------------------------
create unique index if not exists idx_fi_bookings_tenant_calendar_event_conversion
  on public.fi_bookings (
    tenant_id,
    ((metadata ->> 'calendar_event_id'))
  )
  where metadata ->> 'source' = 'calendar_external_conversion'
    and nullif(metadata ->> 'calendar_event_id', '') is not null;

-- ---------------------------------------------------------------------------
-- Consultation → patient promotion idempotency uses existing:
--   fi_patient_source_ids unique (tenant_id, source_system, source_patient_id)
-- with source_system = 'consultation_promotion' and source_patient_id = consultation UUID.
-- Also fi_patients unique (tenant_id, person_id) prevents duplicate patients per contact.
-- ---------------------------------------------------------------------------

-- Optional explicit external identity mapping table (tenant-scoped).
create table if not exists public.fi_calendar_external_identity_maps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.fi_tenants (id) on delete cascade,
  external_system text not null default 'google_calendar',
  external_identity_key text not null,
  patient_id uuid references public.fi_patients (id) on delete cascade,
  consultation_id uuid references public.fi_consultations (id) on delete set null,
  person_id uuid references public.fi_persons (id) on delete set null,
  verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_calendar_external_identity_maps_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint fi_calendar_external_identity_maps_tenant_external_uq
    unique (tenant_id, external_system, external_identity_key)
);

comment on table public.fi_calendar_external_identity_maps is
  'FI-CALENDAR-IDENTITY-LINK-1B: verified external identity → FiOS patient/consultation mappings (tenant-scoped).';

create index if not exists idx_fi_calendar_external_identity_maps_patient
  on public.fi_calendar_external_identity_maps (tenant_id, patient_id)
  where patient_id is not null;

alter table public.fi_calendar_external_identity_maps enable row level security;

drop policy if exists fi_calendar_external_identity_maps_select_tenant_member
  on public.fi_calendar_external_identity_maps;
create policy fi_calendar_external_identity_maps_select_tenant_member
  on public.fi_calendar_external_identity_maps for select to authenticated
  using (
    exists (
      select 1 from public.fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_calendar_external_identity_maps.tenant_id
    )
  );

revoke all on public.fi_calendar_external_identity_maps from public;
grant select on public.fi_calendar_external_identity_maps to authenticated;
grant select, insert, update, delete on public.fi_calendar_external_identity_maps to service_role;
