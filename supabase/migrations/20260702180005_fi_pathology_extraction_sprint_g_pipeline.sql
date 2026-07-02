-- Sprint G: autonomous pathology extraction pipeline (job lifecycle + inbox readiness).

-- ---------------------------------------------------------------------------
-- fi_pathology_extraction_jobs — extended audit + preview fields
-- ---------------------------------------------------------------------------
alter table fi_pathology_extraction_jobs
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists extracted_marker_count integer not null default 0,
  add column if not exists skipped_marker_count integer not null default 0,
  add column if not exists review_status text not null default 'pending_review',
  add column if not exists raw_text_preview text,
  add column if not exists medical_intelligence_preview_json jsonb not null default '{}'::jsonb;

alter table fi_pathology_extraction_jobs
  drop constraint if exists fi_pathology_extraction_jobs_review_status_chk;

alter table fi_pathology_extraction_jobs
  add constraint fi_pathology_extraction_jobs_review_status_chk check (
    review_status in ('pending_review', 'reviewed', 'dismissed')
  );

alter table fi_pathology_extraction_jobs
  drop constraint if exists fi_pathology_extraction_jobs_mi_preview_object;

alter table fi_pathology_extraction_jobs
  add constraint fi_pathology_extraction_jobs_mi_preview_object check (
    jsonb_typeof (medical_intelligence_preview_json) = 'object'
  );

comment on column fi_pathology_extraction_jobs.review_status is
  'Staff review of extraction output: pending_review | reviewed | dismissed.';

-- ---------------------------------------------------------------------------
-- fi_pathology_inbound_documents — extraction lifecycle
-- ---------------------------------------------------------------------------
alter table fi_pathology_inbound_documents
  add column if not exists extraction_status text not null default 'not_started',
  add column if not exists extraction_job_id uuid references fi_pathology_extraction_jobs (id) on delete set null,
  add column if not exists draft_result_id uuid references fi_pathology_results (id) on delete set null,
  add column if not exists ready_for_review_at timestamptz;

alter table fi_pathology_inbound_documents
  drop constraint if exists fi_pathology_inbound_documents_extraction_status_chk;

alter table fi_pathology_inbound_documents
  add constraint fi_pathology_inbound_documents_extraction_status_chk check (
    extraction_status in ('not_started', 'queued', 'running', 'succeeded', 'failed', 'needs_review')
  );

create index if not exists idx_fi_pathology_inbound_documents_extraction_job
  on fi_pathology_inbound_documents (extraction_job_id)
  where extraction_job_id is not null;

create index if not exists idx_fi_pathology_inbound_documents_draft_result
  on fi_pathology_inbound_documents (draft_result_id)
  where draft_result_id is not null;

-- ---------------------------------------------------------------------------
-- fi_pathology_inbound_document_events — extraction lifecycle events
-- ---------------------------------------------------------------------------
alter table fi_pathology_inbound_document_events
  drop constraint if exists fi_pathology_inbound_document_events_type_chk;

alter table fi_pathology_inbound_document_events
  add constraint fi_pathology_inbound_document_events_type_chk check (
    event_type in (
      'created',
      'match_suggested',
      'match_confirmed',
      'match_rejected',
      'promoted',
      'extraction_queued',
      'extraction_started',
      'extraction_succeeded',
      'extraction_failed',
      'draft_result_created',
      'ready_for_review'
    )
  );
