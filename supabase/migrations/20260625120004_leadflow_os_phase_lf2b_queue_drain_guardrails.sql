-- LeadFlowOS Phase LF-2B — queue drain operational guardrails (additive).
-- Extends fi_external_events with retry columns and retrying status for production-safe draining.

alter table public.fi_external_events
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_retry_at timestamptz;

comment on column public.fi_external_events.error_message is
  'LeadFlowOS LF-2B: last processing error message when status is failed or retrying.';

comment on column public.fi_external_events.retry_count is
  'LeadFlowOS LF-2B: number of failed processing attempts; events stop retrying after 3.';

comment on column public.fi_external_events.last_retry_at is
  'LeadFlowOS LF-2B: timestamp of the most recent failed processing attempt.';

alter table public.fi_external_events
  drop constraint if exists fi_external_events_status_chk;

alter table public.fi_external_events
  add constraint fi_external_events_status_chk check (
    status in ('pending', 'processing', 'processed', 'failed', 'retrying', 'skipped')
  );

create index if not exists idx_fi_external_events_tenant_retrying
  on public.fi_external_events (tenant_id, provider, status, created_at asc)
  where status in ('pending', 'retrying');
