-- SurgeryOS Phase 1B: live capture schema extensions (additive).
-- Extends Phase 1 tables for booking sync, phase transitions, and expanded event/note/status enums.

-- ---------------------------------------------------------------------------
-- fi_surgeries — clinic link, scheduled end, unique booking, recovery phase
-- ---------------------------------------------------------------------------
alter table public.fi_surgeries
  add column if not exists clinic_id uuid references public.fi_clinics (id) on delete set null;

alter table public.fi_surgeries
  add column if not exists scheduled_end_at timestamptz;

create unique index if not exists idx_fi_surgeries_booking_unique
  on public.fi_surgeries (booking_id)
  where booking_id is not null;

create index if not exists idx_fi_surgeries_tenant_clinic
  on public.fi_surgeries (tenant_id, clinic_id)
  where clinic_id is not null;

alter table public.fi_surgeries drop constraint if exists fi_surgeries_procedure_phase_check;
alter table public.fi_surgeries add constraint fi_surgeries_procedure_phase_check
  check (procedure_phase in (
    'pre_op',
    'patient_arrived',
    'design',
    'anaesthetic',
    'extraction',
    'extraction_paused',
    'break',
    'site_making',
    'implantation',
    'recovery',
    'completed'
  ));

comment on column public.fi_surgeries.clinic_id is
  'Clinic where the surgery is performed (copied from booking when available).';

comment on column public.fi_surgeries.scheduled_end_at is
  'Scheduled end time (copied from booking end_at when available).';

-- ---------------------------------------------------------------------------
-- fi_surgery_procedure_events — expanded event kinds for live capture
-- ---------------------------------------------------------------------------
alter table public.fi_surgery_procedure_events drop constraint if exists fi_surgery_procedure_events_event_kind_check;
alter table public.fi_surgery_procedure_events add constraint fi_surgery_procedure_events_event_kind_check
  check (event_kind in (
    'patient_arrived',
    'design_approved',
    'anaesthetic_complete',
    'extraction_started',
    'extraction_paused',
    'extraction_resumed',
    'break',
    'break_started',
    'break_ended',
    'site_making_started',
    'implantation_started',
    'procedure_completed',
    'phase_transition',
    'custom'
  ));

-- ---------------------------------------------------------------------------
-- fi_surgery_operational_notes — equipment issue note kind
-- ---------------------------------------------------------------------------
alter table public.fi_surgery_operational_notes drop constraint if exists fi_surgery_operational_notes_note_kind_check;
alter table public.fi_surgery_operational_notes add constraint fi_surgery_operational_notes_note_kind_check
  check (note_kind in (
    'medication_administered',
    'patient_discomfort',
    'bleeding_event',
    'anaesthetic_top_up',
    'graft_issue',
    'equipment_issue',
    'complication_note',
    'general'
  ));

-- ---------------------------------------------------------------------------
-- fi_surgery_team_assignments — checked_in and completed statuses
-- ---------------------------------------------------------------------------
alter table public.fi_surgery_team_assignments drop constraint if exists fi_surgery_team_assignments_assignment_status_check;
alter table public.fi_surgery_team_assignments add constraint fi_surgery_team_assignments_assignment_status_check
  check (assignment_status in (
    'assigned',
    'confirmed',
    'checked_in',
    'active',
    'break',
    'unavailable',
    'completed'
  ));
