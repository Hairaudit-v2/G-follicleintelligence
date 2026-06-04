-- FI OS: allow clinical workflow statuses on fi_cases alongside legacy audit pipeline values.
alter table fi_cases drop constraint if exists fi_cases_status_check;

alter table fi_cases
  add constraint fi_cases_status_check check (
    status in (
      'draft',
      'submitted',
      'processing',
      'complete',
      'failed',
      'consultation'
    )
  );

comment on column fi_cases.status is
  'Case lifecycle: legacy HairAudit pipeline (draft–failed) plus FI OS workflow values such as consultation.';
