-- Stage 13: additive persistent intelligence event log (sanitized summaries only; writes policy-gated in app code).

create table if not exists public.fi_intelligence_event_logs (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  source text not null,
  source_event_id text null,
  correlation_id text null,
  privacy_level text not null,
  delivery_mode text not null,
  status text not null,
  payload_summary jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}'::text[],
  error_message text null,
  occurred_at timestamptz null,
  created_at timestamptz not null default now()
);

comment on table public.fi_intelligence_event_logs is
  'Append-only intelligence bus audit trail: metadata + sanitized payload_summary only (no raw clinical payloads). Inserts via Supabase service role from trusted servers when FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED=1 and non-production policy gate passes.';

create index if not exists idx_fi_intelligence_event_logs_event_name_created
  on public.fi_intelligence_event_logs (event_name, created_at desc);

create index if not exists idx_fi_intelligence_event_logs_source_created
  on public.fi_intelligence_event_logs (source, created_at desc);

create index if not exists idx_fi_intelligence_event_logs_correlation_id
  on public.fi_intelligence_event_logs (correlation_id)
  where correlation_id is not null;

create index if not exists idx_fi_intelligence_event_logs_status_created
  on public.fi_intelligence_event_logs (status, created_at desc);

create index if not exists idx_fi_intelligence_event_logs_privacy_level
  on public.fi_intelligence_event_logs (privacy_level);

alter table public.fi_intelligence_event_logs enable row level security;

-- Authenticated and anonymous roles have no policies: default deny under RLS.
-- service_role bypasses RLS in Supabase; server code uses the service role key only.

revoke all on public.fi_intelligence_event_logs from public;
grant select, insert on public.fi_intelligence_event_logs to service_role;
