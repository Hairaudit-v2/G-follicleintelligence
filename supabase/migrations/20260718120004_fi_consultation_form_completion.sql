-- ConsultationOS Stage 4: form completion metadata + rules-based completion_summary JSONB.

alter table fi_consultation_form_instances
  add column if not exists completed_at timestamptz;

alter table fi_consultation_form_instances
  add column if not exists completed_by_user_id uuid references fi_users (id) on delete set null;

alter table fi_consultation_form_instances
  add column if not exists completion_summary jsonb not null default '{}'::jsonb;

alter table fi_consultation_form_instances drop constraint if exists fi_consultation_form_instances_completion_summary_object;

alter table fi_consultation_form_instances
  add constraint fi_consultation_form_instances_completion_summary_object check (jsonb_typeof (completion_summary) = 'object');

comment on column fi_consultation_form_instances.completed_at is
  'When the clinician finalized ConsultationOS completion (Stage 4); distinct from submitted_at (form answers locked for edit).';

comment on column fi_consultation_form_instances.completion_summary is
  'Rules-based Consultation Completion Summary (JSON); source rules_v1.';
