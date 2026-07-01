-- ImagingOS Phase 3: extend AI analysis job kinds for clinical image intelligence.
alter table fi_imaging_ai_analysis_jobs drop constraint if exists fi_imaging_ai_analysis_jobs_kind_chk;

alter table fi_imaging_ai_analysis_jobs
  add constraint fi_imaging_ai_analysis_jobs_kind_chk check (
    analysis_kind in (
      'density_estimate',
      'norwood_grade',
      'donor_assessment',
      'recipient_assessment',
      'clinical_image_analysis',
      'outcome_score'
    )
  );

comment on table fi_imaging_ai_analysis_jobs is
  'ImagingOS: durable queue + results for HairIntel-style CV models (density, grading, donor, recipient, clinical analysis, outcomes).';