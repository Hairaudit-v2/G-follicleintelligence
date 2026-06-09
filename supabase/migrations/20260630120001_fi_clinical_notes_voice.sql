-- DoctorOS Stage 1C: voice-to-note foundation — structured clinical notes + patient timeline spine.
-- AI-generated notes are stored as record_status = ai_draft until a clinician approves.

-- ---------------------------------------------------------------------------
-- fi_clinical_notes
-- ---------------------------------------------------------------------------
create table if not exists fi_clinical_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  case_id uuid references fi_cases (id) on delete set null,
  consultation_id uuid references fi_consultations (id) on delete set null,
  source text not null default 'voice_consultation',
  record_status text not null default 'ai_draft',
  transcript_raw text not null,
  sections jsonb not null default '{}'::jsonb,
  ai_model text,
  audio_storage_bucket text,
  audio_storage_path text,
  created_by_fi_user_id uuid references fi_users (id) on delete set null,
  approved_by_fi_user_id uuid references fi_users (id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fi_clinical_notes_record_status_chk check (
    record_status in ('ai_draft', 'approved', 'archived')
  ),
  constraint fi_clinical_notes_sections_object check (jsonb_typeof(sections) = 'object'),
  constraint fi_clinical_notes_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table fi_clinical_notes is
  'DoctorOS: structured clinical notes; AI pipeline creates ai_draft rows; clinician approval promotes to official record.';

comment on column fi_clinical_notes.transcript_raw is
  'Speech-to-text output only; kept separate from approved structured sections.';

comment on column fi_clinical_notes.sections is
  'Structured consultation sections (JSON object); treat as draft until record_status = approved.';

create index if not exists idx_fi_clinical_notes_tenant_patient_created
  on fi_clinical_notes (tenant_id, patient_id, created_at desc);

create index if not exists idx_fi_clinical_notes_tenant_case
  on fi_clinical_notes (tenant_id, case_id)
  where case_id is not null;

-- ---------------------------------------------------------------------------
-- fi_patient_timeline_events (patient-native milestones; complements case fi_timeline_events)
-- ---------------------------------------------------------------------------
create table if not exists fi_patient_timeline_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references fi_tenants (id) on delete cascade,
  patient_id uuid not null references fi_patients (id) on delete cascade,
  case_id uuid references fi_cases (id) on delete set null,
  event_kind text not null,
  title text,
  detail jsonb,
  occurred_at timestamptz not null default now(),
  clinical_note_id uuid references fi_clinical_notes (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint fi_patient_timeline_events_detail_object_or_null check (
    detail is null or jsonb_typeof(detail) = 'object'
  )
);

comment on table fi_patient_timeline_events is
  'DoctorOS: patient-scoped timeline rows (e.g. voice note draft/approved markers); mutations via service role.';

create index if not exists idx_fi_patient_timeline_tenant_patient_occurred
  on fi_patient_timeline_events (tenant_id, patient_id, occurred_at desc);

create index if not exists idx_fi_patient_timeline_clinical_note
  on fi_patient_timeline_events (clinical_note_id)
  where clinical_note_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at (clinical notes)
-- ---------------------------------------------------------------------------
create or replace function fi_clinical_notes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_fi_clinical_notes_set_updated_at on fi_clinical_notes;
create trigger trg_fi_clinical_notes_set_updated_at
  before update on fi_clinical_notes
  for each row
  execute procedure fi_clinical_notes_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table fi_clinical_notes enable row level security;

drop policy if exists fi_clinical_notes_select_tenant_member on fi_clinical_notes;
create policy fi_clinical_notes_select_tenant_member
  on fi_clinical_notes for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_clinical_notes.tenant_id
    )
  );

alter table fi_patient_timeline_events enable row level security;

drop policy if exists fi_patient_timeline_events_select_tenant_member on fi_patient_timeline_events;
create policy fi_patient_timeline_events_select_tenant_member
  on fi_patient_timeline_events for select to authenticated
  using (
    exists (
      select 1 from fi_users u
      where u.auth_user_id = auth.uid()
        and u.tenant_id = fi_patient_timeline_events.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges: authenticated read-only; service_role full DML (Next.js server)
-- ---------------------------------------------------------------------------
grant select on fi_clinical_notes to authenticated, service_role;
grant insert, update, delete on fi_clinical_notes to service_role;

grant select on fi_patient_timeline_events to authenticated, service_role;
grant insert, update, delete on fi_patient_timeline_events to service_role;
