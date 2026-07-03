-- FI-LEGACY-FOLLOWUP-IMAGING-1: lightweight follow-up encounters for returning Timely patients.
-- Continuity-of-care capture without full consultation. Writes via service role; tenant members SELECT.

-- ---------------------------------------------------------------------------
-- fi_follow_up_encounters
-- ---------------------------------------------------------------------------
create table if not exists fi_follow_up_encounters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  clinic_id uuid references fi_clinics (id) on delete set null,
  staff_id uuid references fi_staff (id) on delete set null,
  booking_id uuid references fi_bookings (id) on delete set null,
  encounter_type text not null,
  legacy_source text,
  legacy_external_id text,
  visit_reason text,
  clinical_note text,
  treatment_update text,
  follow_up_plan text,
  status text not null default 'draft',
  created_by uuid references fi_users (id) on delete set null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_follow_up_encounters_type_chk check (
    encounter_type in (
      'follow_up',
      'legacy_follow_up',
      'photos_only',
      'treatment_review',
      'post_op_review',
      'donor_review',
      'concern_review'
    )
  ),
  constraint fi_follow_up_encounters_status_chk check (status in ('draft', 'completed')),
  constraint fi_follow_up_encounters_legacy_source_chk check (
    legacy_source is null or legacy_source in ('timely')
  )
);

comment on table fi_follow_up_encounters is
  'Lightweight follow-up encounters for returning patients; no full consultation required.';

create index if not exists idx_fi_follow_up_encounters_tenant_id
  on fi_follow_up_encounters (tenant_id);

create index if not exists idx_fi_follow_up_encounters_patient_id
  on fi_follow_up_encounters (patient_id);

create index if not exists idx_fi_follow_up_encounters_status
  on fi_follow_up_encounters (status);

create index if not exists idx_fi_follow_up_encounters_created_at
  on fi_follow_up_encounters (created_at desc);

create or replace function fi_follow_up_encounters_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_follow_up_encounters_set_updated_at on fi_follow_up_encounters;

create trigger trg_fi_follow_up_encounters_set_updated_at
before update on fi_follow_up_encounters
for each row
execute function fi_follow_up_encounters_set_updated_at();

-- ---------------------------------------------------------------------------
-- Imaging protocol sessions — link to follow-up + AI review lifecycle
-- ---------------------------------------------------------------------------
alter table fi_imaging_protocol_sessions
  add column if not exists follow_up_encounter_id uuid references fi_follow_up_encounters (id) on delete set null;

alter table fi_imaging_protocol_sessions
  add column if not exists session_completeness_status text;

alter table fi_imaging_protocol_sessions
  add column if not exists ai_status text;

alter table fi_imaging_protocol_sessions
  add column if not exists ai_summary jsonb;

alter table fi_imaging_protocol_sessions
  add column if not exists ai_review_status text;

alter table fi_imaging_protocol_sessions
  add column if not exists ai_reviewed_by_staff_id uuid references fi_staff (id) on delete set null;

alter table fi_imaging_protocol_sessions
  add column if not exists ai_reviewed_at timestamptz;

alter table fi_imaging_protocol_sessions
  add column if not exists ai_review_audit jsonb;

alter table fi_imaging_protocol_sessions drop constraint if exists fi_imaging_protocol_sessions_completeness_chk;

alter table fi_imaging_protocol_sessions
  add constraint fi_imaging_protocol_sessions_completeness_chk check (
    session_completeness_status is null
    or session_completeness_status in ('incomplete', 'partial', 'complete', 'needs_retake')
  );

alter table fi_imaging_protocol_sessions drop constraint if exists fi_imaging_protocol_sessions_ai_status_chk;

alter table fi_imaging_protocol_sessions
  add constraint fi_imaging_protocol_sessions_ai_status_chk check (
    ai_status is null
    or ai_status in ('pending', 'processing', 'completed', 'needs_review', 'failed')
  );

alter table fi_imaging_protocol_sessions drop constraint if exists fi_imaging_protocol_sessions_ai_review_status_chk;

alter table fi_imaging_protocol_sessions
  add constraint fi_imaging_protocol_sessions_ai_review_status_chk check (
    ai_review_status is null
    or ai_review_status in (
      'ai_pending',
      'ai_ready_for_review',
      'clinician_approved',
      'clinician_rejected'
    )
  );

create index if not exists idx_fi_imaging_protocol_sessions_follow_up_encounter_id
  on fi_imaging_protocol_sessions (follow_up_encounter_id)
  where follow_up_encounter_id is not null;

-- ---------------------------------------------------------------------------
-- RLS — SELECT for authenticated tenant members (mutations via service role)
-- ---------------------------------------------------------------------------
alter table fi_follow_up_encounters enable row level security;

drop policy if exists fi_follow_up_encounters_select_tenant_member on fi_follow_up_encounters;

create policy fi_follow_up_encounters_select_tenant_member on fi_follow_up_encounters
for select
to authenticated
using (
  exists (
    select 1
    from fi_users u
    where u.auth_user_id = auth.uid()
      and u.tenant_id = fi_follow_up_encounters.tenant_id
  )
);
