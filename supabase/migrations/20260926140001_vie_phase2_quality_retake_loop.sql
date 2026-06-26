-- VIE Phase 2 — quality retake loop (accept / retake, clinical usability ledger)

alter table fi_vie_capture_intelligence
  add column if not exists acceptance_status text not null default 'pending',
  add column if not exists clinically_usable boolean not null default true,
  add column if not exists clinical_usability jsonb not null default '{}'::jsonb,
  add column if not exists warnings jsonb not null default '[]'::jsonb,
  add column if not exists retake_recommendation text,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by_user_id uuid references fi_users (id) on delete set null,
  add column if not exists quality_override boolean not null default false,
  add column if not exists replaced_at timestamptz,
  add column if not exists replaced_by_image_id uuid references fi_patient_images (id) on delete set null;

alter table fi_vie_capture_intelligence
  drop constraint if exists fi_vie_capture_intelligence_acceptance_status_chk;

alter table fi_vie_capture_intelligence
  add constraint fi_vie_capture_intelligence_acceptance_status_chk check (
    acceptance_status in ('pending', 'accepted', 'replaced', 'superseded')
  );

alter table fi_vie_capture_intelligence
  drop constraint if exists fi_vie_capture_intelligence_clinical_usability_object;

alter table fi_vie_capture_intelligence
  add constraint fi_vie_capture_intelligence_clinical_usability_object check (
    jsonb_typeof (clinical_usability) = 'object'
  );

alter table fi_vie_capture_intelligence
  drop constraint if exists fi_vie_capture_intelligence_warnings_array;

alter table fi_vie_capture_intelligence
  add constraint fi_vie_capture_intelligence_warnings_array check (jsonb_typeof (warnings) = 'array');

comment on column fi_vie_capture_intelligence.acceptance_status is
  'pending = awaiting staff accept; accepted = slot completed; replaced/superseded = retake archived prior capture.';

create index if not exists idx_fi_vie_capture_intelligence_session_slot
  on fi_vie_capture_intelligence (tenant_id, protocol_session_id, protocol_slot_slug, created_at desc)
  where protocol_session_id is not null;
