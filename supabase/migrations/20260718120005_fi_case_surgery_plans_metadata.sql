-- ConsultationOS Stage 5: optional JSON metadata on surgery plans for consultation handoff idempotency / provenance.

alter table fi_case_surgery_plans
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table fi_case_surgery_plans drop constraint if exists fi_case_surgery_plans_metadata_object;

alter table fi_case_surgery_plans
  add constraint fi_case_surgery_plans_metadata_object check (jsonb_typeof (metadata) = 'object');

comment on column fi_case_surgery_plans.metadata is
  'Extensible planning metadata (e.g. ConsultationOS handoff: source_form_instance_id, source_consultation_id).';
