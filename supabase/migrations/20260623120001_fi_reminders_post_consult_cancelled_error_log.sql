-- Reminder queue: post-consult + shorthand booking offsets, cancelled jobs, error_log rename, consent default.

-- ---------------------------------------------------------------------------
-- Patient consent default (new patients opt-in by default; staff can revoke)
-- ---------------------------------------------------------------------------
alter table fi_patients alter column reminder_consent set default true;

comment on column fi_patients.reminder_consent is
  'When true, automated reminders (email/SMS) may be enqueued. Defaults to true for new patients; staff may turn off per patient.';

-- ---------------------------------------------------------------------------
-- Template triggers: post_consult + booking_48h / booking_24h aliases
-- ---------------------------------------------------------------------------
alter table fi_reminder_templates drop constraint if exists fi_reminder_templates_trigger_check;

alter table fi_reminder_templates
  add constraint fi_reminder_templates_trigger_check check (
    trigger_event in (
      'booking_created',
      'booking_48h_before',
      'booking_24h_before',
      'booking_48h',
      'booking_24h',
      'post_consult',
      'lead_created'
    )
  );

-- ---------------------------------------------------------------------------
-- Job status: cancelled (superseded / ineligible booking)
-- ---------------------------------------------------------------------------
alter table fi_reminder_jobs drop constraint if exists fi_reminder_jobs_status_check;

alter table fi_reminder_jobs
  add constraint fi_reminder_jobs_status_check check (
    status in ('pending', 'processing', 'sent', 'failed', 'cancelled')
  );

-- ---------------------------------------------------------------------------
-- Rename error → error_log (deliverable naming)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fi_reminder_jobs' and column_name = 'error'
  ) then
    alter table fi_reminder_jobs rename column error to error_log;
  end if;
end $$;

comment on column fi_reminder_jobs.error_log is
  'Last failure message, supersede reason, or skip reason; cleared on successful send.';
